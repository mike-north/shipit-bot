import { GitHubAPI } from 'probot/lib/github';
import { Pick2 } from '../../types';

import Webhooks = require('@octokit/webhooks');

/**
 * Get the list of commit SHAs that relate to a specified pull request
 *
 * @param github GitHub api
 * @param owner repo owner
 * @param repo repo name
 * @param pull_number pull request number
 *
 * @example
 *
 * const commitHistory = await getCommitHistoryForPullRequest(githubApi, 'mike-north', 'shipit-bot', 4);
 *
 * commitHistory[0];  // 3551adb35febbc3299e47d970784e3fb3cccb912
 * commitHistory[1];  // 105916e1b20780929c671e28a538dd1d165743e0
 */
export async function getCommitHistoryForPullRequest(
  github: Pick2<GitHubAPI, 'pulls', 'listCommits'>,
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
