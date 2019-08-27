import { GitHubAPI } from "probot/lib/github";
import { PullsListReviewsResponseItem } from "@octokit/rest";

export async function getReviewsForPullRequest(
  github: GitHubAPI,
  owner: string,
  repo: string,
  pull_number: number
): Promise<PullsListReviewsResponseItem[]> {
  const { data: reviewsList } = await github.pulls.listReviews({
    owner,
    repo,
    pull_number
  });
  return reviewsList;
}
