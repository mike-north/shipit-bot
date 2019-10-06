import Webhooks = require('@octokit/webhooks');

export function isPullRequestPaylod(
  arg: any,
): arg is Webhooks.WebhookPayloadPullRequest {
  return !!(arg as Webhooks.WebhookPayloadPullRequest).pull_request;
}

export function isIssueCommentPaylod(
  arg: any,
): arg is Webhooks.WebhookPayloadIssueComment {
  const typedArg = arg as Webhooks.WebhookPayloadIssueComment;
  return !!(typedArg.comment && typedArg.issue);
}
