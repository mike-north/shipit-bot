import * as Octokit from '@octokit/rest';
import { ICommitWithFileChanges, Pick2, IChangedFile } from '../../types';

/**
 * For each commit in a list of commit IDs, determine which
 * files were added, changed or removed
 *
 * @param github GitHub API
 * @param owner name of repo owner
 * @param repo name of repo
 * @param commitList array of commit Ids
 *
 * @example
 *
 * const shas = [
 *  '3551adb35febbc3299e47d970784e3fb3cccb912',
 *  '105916e1b20780929c671e28a538dd1d165743e0'
 * ];
 *
 * const commitFileChanges =
 *   await getFileChangesForCommits(githubApi, 'mike-north', 'shipit-bot', shas);
 *
 * commitFileChanges[0].sha; // 3551adb35febbc3299e47d970784e3fb3cccb912
 * commitFileChanges[0].files[0].filename;  // "abc.txt"
 * commitFileChanges[0].files[0].status;    // "added"
 * commitFileChanges[0].files[0].additions; // 10
 * commitFileChanges[0].files[0].deletions; // 0
 * commitFileChanges[0].files[0].changes;   // 0
 */
export async function getFileChangesForCommits(
  github: Pick2<Octokit, 'repos', 'getCommit'>,
  owner: string,
  repo: string,
  commitList: string[],
): Promise<{ sha: string; files: IChangedFile[] }[]> {
  return await Promise.all(
    /**
     * Having to make an individual API call per commit to get the
     * files added/deleted/changed is not great, but it's currently
     * the only way to get this information from GitHub.
     *
     * Here's GitHub verifying that the GraphQL API doesn't yet support
     * getting "files touched in commit" information
     * https://github.community/t5/GitHub-API-Development-and/GraphQL-API-get-list-of-files-related-to-commit/m-p/24996/highlight/true#M1898
     *
     * TODO: It's safe to add some caching here. This data won't change over time
     *
     * TODO: Some API throttling is needed here, since we make N API calls
     *  for N commits, potentially all in parallel. For PRs with large
     *  numbers of commits, this is likely to trigger abuse detection
     */
    commitList.map(
      async (sha): Promise<{ sha: string; files: IChangedFile[] }> => {
        const resp = await github.repos.getCommit({ repo, owner, ref: sha });
        const {
          data: { files },
        } = resp;
        return {
          sha,
          files: files.map(
            ({
              filename,
              status,
              additions,
              deletions,
              changes,
            }: Octokit.ReposGetCommitResponseFilesItem) =>
              ({
                filename,
                status,
                additions,
                deletions,
                changes,
              } as IChangedFile),
          ),
        };
      },
    ),
  );
}

export function shortCommit(sha: string) {
  return sha.substr(0, 6);
}
