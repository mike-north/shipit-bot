import * as Octokit from '@octokit/rest';
import { Pick2 } from '../../types/utilities';

/**
 * Get the reviews completed for a given pull request
 *
 * @param github partial GitHub API
 * @param owner name of repo owner
 * @param repo name of repo
 * @param pull_number pull request number
 */
export async function getReviewsForPullRequest(
  github: Pick2<Octokit, 'pulls', 'listReviews'>,
  owner: string,
  repo: string,
  pull_number: number,
): Promise<Octokit.PullsListReviewsResponseItem[]> {
  const { data: reviewsList } = await github.pulls.listReviews({
    owner,
    repo,
    pull_number,
  });
  return reviewsList;
}
