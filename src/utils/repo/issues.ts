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
