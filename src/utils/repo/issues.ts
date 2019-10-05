import { Context } from 'probot';
import { IssuesListCommentsResponseItem } from '@octokit/rest';

import Webhooks = require('@octokit/webhooks');

export async function getCommentsForIssue(
  context: Context<
    Webhooks.WebhookPayloadPullRequest | Webhooks.WebhookPayloadIssueComment
  >,
  issueNumber: number,
): Promise<IssuesListCommentsResponseItem[]> {
  const { github } = context;
  const comments = await github.issues.listComments(
    context.repo({
      issue_number: issueNumber,
      per_page: 50,
      page: 1,
    }),
  );
  return comments.data;
}

/**
 * Given a pull request number, determine whether an ACLOVERRIDE comment exists
 *
 * @param context Probot context
 * @param prNumber pull request number
 */
export function isAclOverrideFound(
  context: Context<
    Webhooks.WebhookPayloadPullRequest | Webhooks.WebhookPayloadIssueComment
  >,
  prNumber: number,
): Promise<boolean> {
  return getCommentsForIssue(context, prNumber).then(
    comments =>
      comments.filter(c => c.body.indexOf('ACLOVERRIDE') >= 0).length > 0,
  );
}
