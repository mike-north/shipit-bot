import * as Webhooks from '@octokit/webhooks';
import { Context } from 'probot';
import {
  getAclsForRepo,
  getAclShipitStatusForCommits,
} from '../../utils/repo/acl';
import { getCommitHistoryForPullRequest } from '../../utils/repo/pull-request';
import { getFileChangesForCommits } from '../../utils/repo/commits';
import { getReviewsForPullRequest } from '../../utils/repo/reviews';

export async function updateAclStatus(
  context: Context<Webhooks.WebhookPayloadPullRequest>,
): Promise<void> {
  const {
    github,
    payload: { pull_request },
  } = context;
  const repoData = context.repo();
  const { owner, repo } = repoData;
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
  context.log('getting ship-it statuese');
  const shipitStatus = await getAclShipitStatusForCommits(
    await pAcls,
    await pCommitData,
    await pReviews,
  );
  context.log(JSON.stringify(shipitStatus, null, '  '));
}
