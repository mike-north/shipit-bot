import { GitHubAPI } from 'probot/lib/github';
import { PullsListReviewsResponseItem } from '@octokit/rest';

/**
 * Get the reviews completed for a given pull request
 *
 * @param github partial GitHub API
 * @param owner name of repo owner
 * @param repo name of repo
 * @param pull_number pull request number
 */
export async function getReviewsForPullRequest({
  github,
  owner,
  repo,
  pull_number,
}: {
  github: {
    pulls: Pick<GitHubAPI['pulls'], 'listReviews'>;
  };
  owner: string;
  repo: string;
  pull_number: number;
}): Promise<PullsListReviewsResponseItem[]> {
  const { data: reviewsList } = await github.pulls.listReviews({
    owner,
    repo,
    pull_number,
  });
  return reviewsList;
}
