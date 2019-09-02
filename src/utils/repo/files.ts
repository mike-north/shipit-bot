import { GitHubAPI } from 'probot/lib/github';
import { gql } from '../gql';
import { IFile } from '../../types';

/**
 * GraphQL expression for retrieving a set of files (and their content)
 * from the GitHub v4 API.
 *
 * @note the original purpose of this is to retrieve ACL files
 * @internal
 */
const REPO_FILES_GQL_EXTENSION = gql`
  repoFiles($owner: String!, $repo: String!, $expression: String!) {
    repository(owner: $owner, name: $repo) {
      content: object(expression: $expression) {
        ... on Blob {
          text
        }
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
 * For a given repo and ref (commit, branch, sha), search for
 * filenames that match a given path expression
 *
 * @param github GitHub API
 * @param owner owner of the repo
 * @param repo name of the repo
 * @param ref branch, commit or tag name to checkout for searching
 * @param path path of filename(s) to search for
 *
 * @internal
 */
export async function getRepoTextFiles(
  github: Pick<GitHubAPI, 'graphql'>,
  owner: string,
  repo: string,
  ref: string,
  path: string,
): Promise<IFile<string>[]> {
  const {
    repository: {
      content: { entries },
    },
  } = (await github.graphql(REPO_FILES_GQL_EXTENSION, {
    owner,
    repo,
    expression: `${ref}:${path}`,
  })) as any;
  return entries.map((e: any) => ({
    name: e.name,
    content: e.object.text,
  }));
}
