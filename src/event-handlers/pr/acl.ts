import { Dict } from '@mike-north/types';
import { ChecksCreateParams, ChecksUpdateParams } from '@octokit/rest';
import * as Webhooks from '@octokit/webhooks';
import { flatMap, groupBy } from 'lodash';
import { Context, Octokit } from 'probot';
import { GitHubAPI } from 'probot/lib/github';
import {
  AclApprovalReviewStatus,
  AclApprovalState,
  AclConcludedApprovalState,
  AclPendingApprovalState,
} from '../../types/acls';
import { mapDict, reduceDict } from '../../utils/dict';
import {
  checkRunParamsFromAclApprovalState,
  getAclsForRepo,
  getPertinentFilesAndAclsForCommitList,
  isOwnerAclFile,
} from '../../utils/repo/acl';
import { isAclOverrideFound } from '../../utils/repo/issues';
import { getCommitHistoryForPullRequest } from '../../utils/repo/pull-request';
import {
  determineDecidingAclActivity,
  getReviewsForPullRequest,
} from '../../utils/repo/reviews';
import { itemsWithCount } from '../../utils/ui-text';
import { isPullRequestPaylod } from '../../utils/webhook-payloads';

/**
 * Generate the name of an ACL approval check-run
 * @param aclResult ACL approval state
 * @private
 */
export function aclCheckRunName(aclResult: AclApprovalState): string {
  return `ACL: ${aclResult.content.description || aclResult.name}`;
}

/**
 * Create an array of `ChecksCreateParams` objects corresponding
 * to ACL approvals
 *
 * @param aclAprovalsByState ACL approvals, bucketed by approval state
 * @param isAclOverride whether an `ACLOVERRIDE` signal has been detected
 * @private
 */
export function createCheckRunParamsForAclApprovals(
  aclAprovalsByState: Dict<AclApprovalState>,
  isAclOverride: boolean,
): Pick<
  ChecksCreateParams,
  Exclude<keyof ChecksCreateParams, 'owner' | 'repo' | 'head_sha'>
>[] {
  return Object.keys(aclAprovalsByState).map(aclName => ({
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    name: aclCheckRunName(aclAprovalsByState[aclName]!),
    ...checkRunParamsFromAclApprovalState(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      aclAprovalsByState[aclName]!,
      isAclOverride,
    ),
  }));
}

type BucketedAclApprovals = {
  PENDING: AclPendingApprovalState[] | undefined;
} & Record<AclApprovalReviewStatus, AclConcludedApprovalState[] | undefined>;

function bucketAclApprovals(
  aclAprovalsByState: Dict<AclApprovalState>,
): BucketedAclApprovals {
  return reduceDict(
    aclAprovalsByState,
    (bins, aclResult) => {
      const {
        review: { status },
      } = aclResult;
      const existingStatusList = bins[status];
      if (existingStatusList) {
        if (status === 'PENDING')
          (existingStatusList as AclPendingApprovalState[]).push(
            aclResult as AclPendingApprovalState,
          );
        else
          (existingStatusList as AclConcludedApprovalState[]).push(
            aclResult as AclConcludedApprovalState,
          );
      } else {
        // eslint-disable-next-line no-param-reassign
        (bins[status] as (
          | AclPendingApprovalState
          | AclConcludedApprovalState)[]) = [
          aclResult as AclPendingApprovalState | AclConcludedApprovalState,
        ];
      }
      return bins;
    },

    {} as BucketedAclApprovals,
  );
}

function createOverallCheckRunParams(
  aclAprovalsByState: Dict<AclApprovalState>,
  isAclOverride: boolean,
): Pick<
  ChecksUpdateParams,
  Exclude<keyof ChecksUpdateParams, 'check_run_id' | 'owner' | 'repo'>
> {
  const aclBins = bucketAclApprovals(aclAprovalsByState);
  const [approvedFresh, approvedStale] = (aclBins.APPROVED || []).reduce(
    ([fresh, stale], item) => {
      if (item.review.isStale) return [fresh, [...stale, item]];
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

  // TODO: handle release owner ACLs. We just discard them here
  const repoOwnerAcls = (await pAcls).filter(isOwnerAclFile);
  context.log.info(`${repo} ACLs found`, repoOwnerAcls.map(a => a.name));

  /**
   * Walk through the commits associated with this pull request, examine
   * the files changed, which ACLs those files pertain to and the existing reviews.
   *
   * Determine the "approval outcome" of each ACL, for each commit
   *
   */
  const commitsWithChangedFilesAndApprovals = await getPertinentFilesAndAclsForCommitList(
    github,
    await pCommits,
    repoOwnerAcls,
    await pReviews,
    repoData,
  );

  /**
   * Group the activities in the sequence of commits by ACL
   */
  const aclActivities = groupBy(
    flatMap(commitsWithChangedFilesAndApprovals, c => c.acls),
    acl => acl.name,
  );

  const REVIEW_STATUS_SIGNAL_STRENGTH: {
    [K in AclApprovalState['review']['status']]: number;
  } = {
    PENDING: 1,
    DISMISSED: 3,
    COMMENTED: 5,
    APPROVED: 10,
    CHANGES_REQUESTED: 10,
  };

  const decidingAclActivities = mapDict(
    aclActivities,
    determineDecidingAclActivity,
  );

  const aclOverrideFound = await pAclOverrideFound;
  context.log.info(`ACL OVERRIDE ${aclOverrideFound ? '' : 'NOT '}DETECTED`);

  // We now have all the information we need, and know what to indicate for each ACL

  // Tell GitHub about the status of each ACL and the overall approval status of the PR
  await Promise.all([
    ...createCheckRunParamsForAclApprovals(
      decidingAclActivities,
      aclOverrideFound,
    ).map(async params => {
      await github.checks.create(
        context.repo({
          ...params,
          head_sha: pull_request.head.sha,
        }),
      );
    }),
    github.checks
      .update(
        context.repo({
          check_run_id: (await pMainCheck).data.id,
          ...createOverallCheckRunParams(
            decidingAclActivities,
            aclOverrideFound,
          ),
        }),
      )
      .then(() => {}),
  ]);
}
