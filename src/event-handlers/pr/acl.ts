import * as Webhooks from '@octokit/webhooks';
import { Context, Octokit } from 'probot';
import { Dict } from '@mike-north/types';
import { ChecksCreateParams, ChecksUpdateParams } from '@octokit/rest';
import { GitHubAPI } from 'probot/lib/github';
import {
  getAclsForRepo,
  getAclShipitStatusForCommits,
  isOwnerAclFile,
  AclApprovalState,
  aclApprovalStateAsCheckRunParams,
  AclConcludedApprovalState,
  AclPendingApprovalState,
} from '../../utils/repo/acl';
import { getCommitHistoryForPullRequest } from '../../utils/repo/pull-request';
import { getFileChangesForCommits } from '../../utils/repo/commits';
import { getReviewsForPullRequest } from '../../utils/repo/reviews';
import { itemsWithCount } from '../../utils/ui-text';
import { isAclOverrideFound } from '../../utils/repo/issues';
import { isPullRequestPaylod } from '../../utils/webhook-payloads';

function createAclCheckRunParams(
  aclAprovalsByState: Dict<AclApprovalState>,
  sha: string,
  isAclOverride: boolean,
): Pick<
  ChecksCreateParams,
  Exclude<keyof ChecksCreateParams, 'owner' | 'repo'>
>[] {
  return Object.keys(aclAprovalsByState).map(aclName => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const aclResult = aclAprovalsByState[aclName]!;

    return {
      name: `ACL: ${aclResult.content.description || aclName}`,
      head_sha: sha,
      ...aclApprovalStateAsCheckRunParams(aclResult, isAclOverride),
    };
  });
}

function createOverallCheckRunParams(
  aclAprovalsByState: Dict<AclApprovalState>,
  isAclOverride: boolean,
): Pick<
  ChecksUpdateParams,
  Exclude<keyof ChecksUpdateParams, 'check_run_id' | 'owner' | 'repo'>
> {
  const aclBins = Object.keys(aclAprovalsByState).reduce(
    (bins, aclName) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const aclResult = aclAprovalsByState[aclName]!;
      const existingStatusList = bins[aclResult.reviewStatus];
      if (existingStatusList) {
        if (aclResult.reviewStatus === 'PENDING')
          (existingStatusList as AclPendingApprovalState[]).push(
            aclResult as AclPendingApprovalState,
          );
        else
          (existingStatusList as AclConcludedApprovalState[]).push(
            aclResult as AclConcludedApprovalState,
          );
      } else if (aclResult.reviewStatus === 'PENDING') {
        // eslint-disable-next-line no-param-reassign
        (bins[aclResult.reviewStatus] as AclPendingApprovalState[]) = [
          aclResult as AclPendingApprovalState,
        ];
      } else {
        // eslint-disable-next-line no-param-reassign
        (bins[aclResult.reviewStatus] as AclConcludedApprovalState[]) = [
          aclResult as AclConcludedApprovalState,
        ];
      }
      return bins;
    },

    {} as Record<
      Exclude<AclApprovalState['reviewStatus'], 'PENDING'>,
      AclConcludedApprovalState[] | undefined
    > &
      Record<'PENDING', AclPendingApprovalState[] | undefined>,
  );

  const [approvedFresh, approvedStale] = (aclBins.APPROVED || []).reduce(
    ([fresh, stale], item) => {
      if (item.isStale) return [fresh, [...stale, item]];
      return [[...fresh, item], stale];
    },
    [[], []] as [AclConcludedApprovalState[], AclConcludedApprovalState[]],
  );
  const { length: passedCt } = approvedFresh;
  const { length: staleCt } = approvedStale;
  const { length: failedCt } = aclBins.CHANGES_REQUESTED || [];
  const { length: dismissedCt } = aclBins.DISMISSED || [];
  const { length: commentedCt } = aclBins.COMMENTED || [];
  const { length: pendingCt } = aclBins.PENDING || [];

  let conclusion: ChecksCreateParams['conclusion'];
  let title = '';
  if (failedCt || pendingCt || commentedCt || dismissedCt) {
    conclusion = 'failure';
    const descriptionParts: string[] = [];
    if (failedCt) {
      descriptionParts.push(
        `${itemsWithCount('ACL', failedCt)} requested changes`,
      );
    }
    if (pendingCt + commentedCt) {
      descriptionParts.push(
        `${itemsWithCount('ACL', pendingCt + commentedCt)} need${
          pendingCt === 1 ? 's' : ''
        } review`,
      );
    }
    if (staleCt) {
      descriptionParts.push(
        `${itemsWithCount('ACL', staleCt)} need${
          staleCt === 1 ? 's' : ''
        } re-approval`,
      );
    }
    if (dismissedCt) {
      descriptionParts.push(
        `${itemsWithCount('ACL', dismissedCt)} ${
          pendingCt === 1 ? 'has' : 'have'
        } dismissed reviews`,
      );
    }
    title = descriptionParts.join(', ');
  } else {
    conclusion = 'success';
    title = `${itemsWithCount('ACL', passedCt)} approved!`;
  }
  if (isAclOverride && conclusion !== 'success') {
    conclusion = 'neutral';
    title = `ACLOVERRIDE (was: ${title})`;
  }
  return {
    status: 'completed',
    conclusion,
    output: {
      title,
      summary: '',
    },
  };
}

async function pullRequestFromPayload(
  github: GitHubAPI,
  payload:
    | Webhooks.WebhookPayloadPullRequest
    | Webhooks.WebhookPayloadIssueComment,
  repoInfo: { repo: string; owner: string },
): Promise<
  Webhooks.WebhookPayloadPullRequestPullRequest | Octokit.PullsGetResponse
> {
  if (isPullRequestPaylod(payload)) return payload.pull_request;
  return (await github.pulls.get({
    ...repoInfo,
    pull_number: payload.issue.number,
  })).data;
}

export async function updateAclStatus(
  context: Context<
    Webhooks.WebhookPayloadPullRequest | Webhooks.WebhookPayloadIssueComment
  >,
): Promise<void> {
  const { github, payload } = context;
  const repoData = context.repo();
  const { owner, repo } = repoData;

  const pull_request = await pullRequestFromPayload(github, payload, repoData);

  // maybe not necessary to do this _all the time_
  const pAclOverrideFound = isAclOverrideFound(context, pull_request.number);

  const pMainCheck = github.checks.create(
    context.repo({
      name: 'ACL',
      head_sha: pull_request.head.sha,
      status: 'in_progress',
      output: {
        title: 'Evaluating ACL approval status',
        summary: '',
      },
    }),
  );
  context.log.info(`Getting ACLs for Repo: ${repo}`);
  // Get the ACLs pertaining to this repo
  const pAcls = getAclsForRepo(github, owner, repo);
  const pReviews = getReviewsForPullRequest(
    github,
    owner,
    repo,
    pull_request.number,
  );
  // Get the list of commit SHAs included with this PR
  const pCommits = getCommitHistoryForPullRequest(
    github,
    owner,
    repo,
    pull_request.number,
  );

  // For our list of commits, obtain data around which files were changed
  const pCommitData = getFileChangesForCommits(
    github,
    owner,
    repo,
    await pCommits,
  );
  // TODO: handle release owner ACLs. We just discard them here
  const repoOwnerAcls = (await pAcls).filter(isOwnerAclFile);
  context.log.info(`${repo} ACLs found`, repoOwnerAcls.map(a => a.name));

  /**
   * Walk through the commits associated with this pull request, examine
   * the files changed, which ACLs those files pertain to and the existing reviews.
   *
   * Determine the "approval outcome" of each ACL, for each commit
   */
  const commitsWithApprovalStatuses = await getAclShipitStatusForCommits(
    repoOwnerAcls,
    await pCommitData,
    await pReviews,
  );

  /**
   * Iterate over the commits, from HEAD backwards and accumulate
   * the _most recent signal that pertains to each ACL_.
   */
  const aclAprovalsByState = commitsWithApprovalStatuses.reduceRight(
    (aclDict, thisCommitWithStatus) => {
      thisCommitWithStatus.acls.forEach(acl => {
        if (acl.name in aclDict) return;
        Object.assign(aclDict, { [acl.name]: acl });
      });
      return aclDict;
    },
    {} as Dict<AclApprovalState>,
  );

  const aclOverrideFound = await pAclOverrideFound;
  context.log.info(`ACL OVERRIDE ${aclOverrideFound ? '' : 'NOT '}DETECTED`);

  // We now have all the information we need, and know what to indicate for each ACL

  // Tell GitHub about the status of each ACL and the overall approval status of the PR
  await Promise.all([
    ...createAclCheckRunParams(
      aclAprovalsByState,
      pull_request.head.sha,
      aclOverrideFound,
    ).map(async params => {
      await github.checks.create(context.repo(params));
    }),
    github.checks
      .update(
        context.repo({
          check_run_id: (await pMainCheck).data.id,
          ...createOverallCheckRunParams(aclAprovalsByState, aclOverrideFound),
        }),
      )
      .then(() => {}),
  ]);
}
