import * as Webhooks from '@octokit/webhooks';
import { Context } from 'probot';
import { Dict } from '@mike-north/types';
import { ChecksCreateParams } from '@octokit/rest';
import {
  getAclsForRepo,
  getAclShipitStatusForCommits,
  isOwnerAclFile,
  AclApprovalState,
} from '../../utils/repo/acl';
import { getCommitHistoryForPullRequest } from '../../utils/repo/pull-request';
import { getFileChangesForCommits } from '../../utils/repo/commits';
import { getReviewsForPullRequest } from '../../utils/repo/reviews';
import UnreachableError from '../../utils/errors/unreachable';
import { getCommentsForIssue } from '../../utils/repo/issues';

function aclWithCount(n: number): string {
  switch (n) {
    case 0:
      return 'No ACLs';
    case 1:
      return '1 ACL';
    default:
      return `${n} ACLs`;
  }
}

export async function updateAclStatus(
  context: Context<
    Webhooks.WebhookPayloadPullRequest | Webhooks.WebhookPayloadIssueComment
  >,
): Promise<void> {
  const { github, payload } = context;
  const repoData = context.repo();
  const { owner, repo } = repoData;

  const pull_request = (payload as any).pull_request
    ? (payload as Webhooks.WebhookPayloadPullRequest).pull_request
    : (await github.pulls.get(
        context.repo({
          pull_number: (payload as Webhooks.WebhookPayloadIssueComment).issue
            .number,
        }),
      )).data;

  // maybe not necessary to do this _all the time_
  const pAclOverrideFound = getCommentsForIssue(
    context,
    pull_request.number,
  ).then(
    comments =>
      comments.filter(c => c.body.indexOf('ACLOVERRIDE') >= 0).length > 0,
  );

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
  const repoAcls = (await pAcls).filter(isOwnerAclFile);
  context.log.info(`${repo} ACLs: ${repoAcls.map(a => a.name).join(', ')}`);
  const commitsWithShipitStatus = await getAclShipitStatusForCommits(
    repoAcls,
    await pCommitData,
    await pReviews,
  );
  context.log.debug(
    `COMMITS WITH SHIPITS\n${commitsWithShipitStatus
      .map(
        c =>
          `\t${c.commit.sha}: ${c.acls.map(
            a => `${a.name}: ${a.reviewStatus}`,
          )}`,
      )
      .join('\n')}`,
  );

  const res = commitsWithShipitStatus.reduceRight(
    (aclDict, thisCommitWithStatus) => {
      context.log.debug(`Examining commit\t${thisCommitWithStatus.commit.sha}`);
      thisCommitWithStatus.acls.forEach(acl => {
        context.log.debug(`\tACL: ${acl.name}: ${acl.reviewStatus}`);
        if (acl.name in aclDict) return;
        Object.assign(aclDict, { [acl.name]: acl });
      });
      return aclDict;
    },
    {} as Dict<AclApprovalState>,
  );
  context.log.debug('RES', { res });
  const aclOverrideFound = await pAclOverrideFound;
  context.log.debug(`ACL OVERRIDE FOUND? ${aclOverrideFound}`);
  const aclChecks: ChecksCreateParams[] = Object.keys(res).map(aclName => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const aclResult = res[aclName]!;
    let inProgress = aclResult.reviewStatus === 'PENDING';
    let output: ChecksCreateParams['output'];
    let conclusion: ChecksCreateParams['conclusion'];
    let url: string | undefined;
    const shortCommit =
      aclResult.reviewStatus !== 'PENDING'
        ? aclResult.reviewCommit.substr(0, 6)
        : null;
    switch (aclResult.reviewStatus) {
      case 'PENDING':
        output = { title: 'Still waiting on review', summary: '' };
        break;
      case 'APPROVED':
        if (aclResult.isStale) {
          output = {
            summary: '',
            title: `Changes after @${aclResult.reviewer}'s approval at ${shortCommit}`,
          };
          conclusion = 'action_required';
        } else {
          output = {
            summary: '',
            title: `Approved by @${aclResult.reviewer} at ${shortCommit}`,
          };
          conclusion = 'success';
        }
        url = aclResult.reviewUrl;
        break;
      case 'CHANGES_REQUESTED':
        output = {
          summary: '',
          title: `Changes requested by @${aclResult.reviewer} at ${shortCommit}`,
        };
        conclusion = 'failure';
        url = aclResult.reviewUrl;
        break;
      case 'DISMISSED':
        output = {
          summary: '',
          title: `Dismissed review from @${aclResult.reviewer}`,
        };
        conclusion = 'cancelled';
        url = aclResult.reviewUrl;
        break;
      case 'COMMENTED':
        output = {
          summary: '',
          title: `Non-approving review by @${aclResult.reviewer} at ${shortCommit}`,
        };
        conclusion = 'failure';
        url = aclResult.reviewUrl;
        break;
      default:
        throw new UnreachableError(
          aclResult,
          `Unknown reivew status type: ${(aclResult as any).reviewStatus}`,
        );
    }
    if (aclOverrideFound) {
      if (
        inProgress ||
        (conclusion &&
          ['failure', 'cancelled', 'action_required'].includes(conclusion))
      ) {
        inProgress = false;
        output.title = `ACLOVERRIDE (was: ${conclusion || 'pending'} - ${
          output.title
        })`;
        conclusion = 'neutral';
      }
    }

    return context.repo({
      name: `ACL: ${aclResult.content.description || aclName}`,
      head_sha: pull_request.head.sha,
      status: inProgress ? 'in_progress' : 'completed',
      conclusion,
      details_url: url,
      output,
    });
  });
  context.log.debug(`ACL Checks`, { aclChecks });

  await Promise.all(aclChecks.map(chk => github.checks.create(chk)));

  context.log.debug('Created individual check runs for ACLs');

  const aclBins = Object.keys(res).reduce(
    (bins, aclName) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const aclResult = res[aclName]!;
      const existingStatusList = bins[aclResult.reviewStatus];
      if (existingStatusList) {
        existingStatusList.push(aclResult);
      } else {
        // eslint-disable-next-line no-param-reassign
        bins[aclResult.reviewStatus] = [aclResult];
      }
      return bins;
    },
    {} as Record<
      AclApprovalState['reviewStatus'],
      AclApprovalState[] | undefined
    >,
  );
  context.log.debug('Sorted ACL check outcomes into bins', { aclBins });

  const aclsPassed = (aclBins.APPROVED || []).length;
  const aclsFailed = (aclBins.CHANGES_REQUESTED || []).length;
  const aclsDismissed = (aclBins.DISMISSED || []).length;
  const aclsCommented = (aclBins.COMMENTED || []).length;

  const aclsPending = (aclBins.PENDING || []).length;

  context.log.debug('ACL statuses: ', {
    passed: aclsPassed,
    failed: aclsFailed,
    pending: aclsPending,
    commented: aclsCommented,
    dismissed: aclsDismissed,
  });

  const mainCheck = (await pMainCheck).data;
  let mainCheckConclusion: ChecksCreateParams['conclusion'];
  let mainCheckDescription = '';
  if (aclsFailed || aclsPending || aclsCommented || aclsDismissed) {
    mainCheckConclusion = 'failure';
    const descriptionParts: string[] = [];
    if (aclsFailed) {
      descriptionParts.push(`${aclWithCount(aclsFailed)} requested changes`);
    }
    if (aclsPending + aclsCommented) {
      descriptionParts.push(
        `${aclWithCount(aclsPending + aclsCommented)} still need${
          aclsPending === 1 ? 's' : ''
        } approval`,
      );
    }
    if (aclsDismissed) {
      descriptionParts.push(
        `${aclWithCount(aclsDismissed)} ${
          aclsPending === 1 ? 'has' : 'have'
        } dismissed reviews`,
      );
    }
    mainCheckDescription = descriptionParts.join(', ');
  } else {
    mainCheckConclusion = 'success';
    mainCheckDescription = `${aclWithCount(aclsPassed)} approved!`;
  }
  if (aclOverrideFound && mainCheckConclusion !== 'success') {
    mainCheckConclusion = 'neutral';
    mainCheckDescription = `ACLOVERRIDE (was: ${mainCheckDescription})`;
  }
  await github.checks.update(
    context.repo({
      check_run_id: mainCheck.id,
      status: 'completed',
      conclusion: mainCheckConclusion,
      output: {
        title: mainCheckDescription,
        summary: '',
      },
    }),
  );
}
