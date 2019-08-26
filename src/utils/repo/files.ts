import { GitHubAPI } from "probot/lib/github";
import { gql } from "../../utils/gql";

/**
 * GraphQL expression for retrieving a set of files (and their content)
 * from the GitHub v4 API.
 *
 * @note the original purpose of this is to retrieve ACL files
 * @internal
 */
const REPO_FILES_GQL_EXTENSION = gql`
  query repoFiles($owner: String!, $repo: String!, $expression: String!) {
    repository(owner: $owner, name: $repo) {
      content: object(expression: $expression) {
        ... on Tree {
          entries {
            ... on TreeEntry {
              name
              object {
                ... on Blob {
                  text
                }
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * A text file, with a file name and some text content
 */
export interface ITextFile {
  name: string;
  content: string;
}

/**
 * For a given repo and ref (commit, branch, sha), search for
 * filenames that match a given path expression
 *
 * @param github GitHub API
 * @param owner owner of the repo
 * @param repo name of the repo
 * @param ref branch, commit or tag name to checkout for searching
 * @param path path of filename(s) to search for
 *
 * @private
 */
export async function getRepoTextFiles(
  github: GitHubAPI,
  owner: string,
  repo: string,
  ref: string,
  path: string
): Promise<ITextFile[]> {
  const {
    repository: {
      content: { entries }
    }
  } = (await github.graphql(REPO_FILES_GQL_EXTENSION, {
    owner,
    repo,
    expression: `${ref}:${path}`
  })) as any;
  return entries.map((e: any) => ({
    name: e.name,
    content: e.object.text
  }));
}
