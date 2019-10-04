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

export async function updateAclStatus(
  context: Context<Webhooks.WebhookPayloadPullRequest>,
): Promise<void> {
  const {
    github,
    payload: { pull_request },
  } = context;
  const repoData = context.repo();
  const { owner, repo } = repoData;

  github.checks.create(
    context.repo({
      name: 'ACL',
      head_sha: pull_request.head.sha,
      status: 'in_progress',
    }),
  );

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
  const commitsWithShipitStatus = await getAclShipitStatusForCommits(
    (await pAcls).filter(isOwnerAclFile),
    await pCommitData,
    await pReviews,
  );

  const res = commitsWithShipitStatus.reduceRight(
    (acls, thisCommitWithStatus) => {
      thisCommitWithStatus.acls.forEach(acl => {
        if (acl.reviewStatus === 'PENDING' || acl.name in acls) return;
        Object.assign(acls, { [acl.name]: acl });
      });
      return acls;
    },
    {} as Dict<AclApprovalState>,
  );

  const aclOverrideFound = false;

  const aclChecks: ChecksCreateParams[] = Object.keys(res).map(aclName => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const aclResult = res[aclName]!;
    const inProgress = aclResult.reviewStatus === 'PENDING';
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
          title: `Changes requested by @${aclResult.reviewer}`,
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
          title: `Non-approving review by @${aclResult.reviewer}`,
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

    return context.repo({
      name: `ACL / ${aclName}`,
      head_sha: pull_request.head.sha,
      status: inProgress ? 'in_progress' : 'completed',
      conclusion,
      details_url: url,
      output,
    });
  });

  await Promise.all(aclChecks.map(chk => github.checks.create(chk)));

  const aclBins = aclChecks.reduce(
    (bins, aclCheck) => {
      bins.allNames.push(aclCheck.name);
      if (aclCheck.conclusion) {
        if (bins.concluded[aclCheck.conclusion])
          bins.concluded[aclCheck.conclusion].push(aclCheck.name);
        // eslint-disable-next-line no-param-reassign
        bins.concluded[aclCheck.conclusion] = [aclCheck.name];
      } else bins.nonConcluded.push(aclCheck.name);
      return bins;
    },
    {
      allNames: [] as string[],
      nonConcluded: [] as string[],
      concluded: {} as {
        [K in Exclude<ChecksCreateParams['conclusion'], undefined>]: string[];
      },
    },
  );
  github.checks.create(
    context.repo({
      name: 'ACL',
      head_sha: pull_request.head.sha,
      status: 'completed',
      conclusion: aclChecks.reduce(
        (bottomLine, aclCheck) => {
          if (bottomLine === 'failure' || aclCheck.conclusion !== 'success')
            return 'failure';
          return 'success';
        },
        'success' as 'success' | 'failure',
      ),
      output: {
        title: `${aclBins.concluded.success.length}/${aclBins.allNames.length} ACLs with approvals`,
        summary: '',
      },
    }),
  );

  context.log(JSON.stringify(commitsWithShipitStatus, null, '  '));
}
