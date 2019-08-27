import { GitHubAPI } from 'probot/lib/github';

/**
 * Get the list of commit SHAs that relate to a specified pull request
 *
 * @param github GitHub api
 * @param owner repo owner
 * @param repo repo name
 * @param pull_number pull request number
 */
export async function getCommitHistoryForPullRequest(
  github: { pulls: Pick<GitHubAPI['pulls'], 'listCommits'> },
  owner: string,
  repo: string,
  pull_number: number,
): Promise<string[]> {
  const { data: commitList } = await github.pulls.listCommits({
    pull_number,
    repo,
    owner,
  });
  return commitList.map(c => c.sha);
}
