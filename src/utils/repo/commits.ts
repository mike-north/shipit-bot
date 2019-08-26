import { GitHubAPI } from "probot/lib/github";
import { ICommitWithFileChanges } from "../../types";

export async function getFileChangesForCommits(
  github: GitHubAPI,
  owner: string,
  repo: string,
  commitList: string[]
): Promise<ICommitWithFileChanges[]> {
  const commitDetails = await Promise.all(
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
    commitList.map(async sha => {
      const {
        data: { files }
      } = await github.repos.getCommit({ repo, owner, ref: sha });
      return {
        sha,
        files: files.map(
          ({ filename, status, deletions, additions, changes }) => ({
            filename,
            status,
            additions,
            deletions,
            changes
          })
        )
      };
    })
  );
  return commitDetails;
}
