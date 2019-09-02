import { GitHubAPI } from 'probot/lib/github';
import { PullsListReviewsResponseItem } from '@octokit/rest';
import { getRepoTextFiles } from './files';
import { Acl, IFile, ICommitWithFileChanges } from '../../types';
import OwnerAcl from '../../models/acl/owner';
import { createAcl } from '../../models/acl';

/**
 * Get the list of ACLs included in a specified repo
 *
 * @param github GitHub api namespace
 * @param owner name of the repo owner
 * @param repo name of the repo
 *
 * @internal
 */
export async function getAclsForRepo(
  github: Pick<GitHubAPI, 'graphql'>,
  owner: string,
  repo: string,
): Promise<IFile<Acl>[]> {
  const files = await getRepoTextFiles(github, owner, repo, 'master', 'acls/');
  const acls = files.map(({ name, content }) => ({
    name,
    content: createAcl(content),
  }));

  return acls;
}

/**
 * For a list of files (probably those changed in a commit or PR),
 * determine which ACLs will require a ship-it
 *
 * @param repoAclFiles ACL files found in a repo
 * @param fileNames names of files touched in a code change
 */
function getOwnerAclsForFiles(
  repoAclFiles: IFile<Acl>[],
  fileNames: string[],
): IFile<OwnerAcl>[] {
  // return an array of those ACLs that match
  return [
    ...repoAclFiles.reduce((set, acl) => {
      // check whether this ACL applies to any files
      const applies = fileNames.reduce((doesApply, file) => {
        // if we already found this ACL to be relevant, don't even bother checking
        if (doesApply) return true;
        // this ACL may or may not be relevant, we need to check against the file path
        return acl.content.appliesToFile(file);
      }, false);
      // If we have determined this ACL to be relevant
      const { content } = acl;
      if (applies && content.kind === 'owner') set.add({ ...acl, content }); // add it to the set
      return set;
    }, new Set<IFile<OwnerAcl>>()),
  ];
}

export async function getAclShipitStatusForCommits(
  repoAclFiles: IFile<Acl>[],
  commits: ICommitWithFileChanges[],
  existingReviews: PullsListReviewsResponseItem[],
): Promise<never[]> {
  const commitAcls = commits.map(c => {
    const commitFiles = c.files.map(f => f.filename);
    const acls = getOwnerAclsForFiles(repoAclFiles, commitFiles);
    return {
      commit: c,
      acls,
    };
  });

  const reviewData = existingReviews.map(({ state, user, commit_id }) => ({
    state,
    user,
    commit_id,
  }));
  // eslint-disable-next-line no-console
  console.log('Existing Reviews:\n', JSON.stringify(reviewData, null, '  '));

  commitAcls.forEach(cacl => {
    // eslint-disable-next-line no-console
    console.log(
      `Commit: ${cacl.commit.sha}\n${JSON.stringify(
        cacl.acls.map(({ name, content: { owners } }) => ({ name, owners })),
        null,
        '  ',
      )}`,
    );
  });
  return [];
}
