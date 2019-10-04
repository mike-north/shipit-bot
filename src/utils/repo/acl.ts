import { GitHubAPI } from 'probot/lib/github';
import { PullsListReviewsResponseItem } from '@octokit/rest';
import { Dict } from '@mike-north/types';
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

export type AclApprovalState =
  | { name: string; reviewStatus: 'PENDING' }
  | {
      name: string;
      reviewer: string;
      reviewPosition: number;
      reviewCommit: string;
      reviewUrl: string;
      isStale: boolean;
      reviewStatus:
        | 'COMMENTED'
        | 'DISMISSED'
        | 'APPROVED'
        | 'CHANGES_REQUESTED';
    };

export async function getAclShipitStatusForCommits(
  repoAclFiles: IFile<OwnerAcl>[],
  commits: ICommitWithFileChanges[],
  existingReviews: PullsListReviewsResponseItem[],
): Promise<
  {
    commit: ICommitWithFileChanges;
    commitPosition: number;
    acls: AclApprovalState[];
  }[]
> {
  const commitAcls = commits.map(c => {
    const commitFiles = c.files.map(f => f.filename);
    const acls = getOwnerAclsForFiles(repoAclFiles, commitFiles);
    return {
      commit: c,
      acls,
    };
  });

  const commitList = commits.map(c => c.sha);

  const reviewPositions = existingReviews.reduce(
    (map, r) => {
      // eslint-disable-next-line no-param-reassign
      map[r.user.login] = [commitList.indexOf(r.commit_id), r];
      return map;
    },
    {} as Dict<[number, PullsListReviewsResponseItem]>,
  );

  const reviewCommitPositionMap: Dict<
    [number, PullsListReviewsResponseItem]
  > = {};

  repoAclFiles.forEach(aclFile => {
    const {
      content: { owners },
    } = aclFile;
    const latestReview = owners
      .filter(o => Object.hasOwnProperty.call(reviewPositions, o))
      .reduce(
        (latest, thisOwner) => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const ownerReview = reviewPositions[thisOwner]!;
          if (latest === null) return ownerReview;
          return ownerReview[0] > latest[0] ? ownerReview : latest;
        },
        null as [number, PullsListReviewsResponseItem] | null,
      );
    if (latestReview) reviewCommitPositionMap[aclFile.name] = latestReview;
  });

  return commitAcls.map(({ commit, acls }) => {
    const commitPosition = commitList.indexOf(commit.sha);

    const result: {
      commit: ICommitWithFileChanges;
      commitPosition: number;
      acls: AclApprovalState[];
    } = {
      commit,
      acls: acls.map(acl => {
        const aclReview = reviewCommitPositionMap[acl.name];
        if (!aclReview) return { ...acl, reviewStatus: 'PENDING' as const };
        const [reviewPosition, review] = aclReview;
        const reviewer = review.user.login;
        const reviewCommit = review.commit_id;
        const reviewUrl = review.html_url;

        return {
          ...acl,
          reviewStatus: review.state as Exclude<
            AclApprovalState['reviewStatus'],
            'PENDING'
          >,
          isStale: commitPosition > reviewPosition,
          reviewer,
          reviewPosition,
          reviewCommit,
          reviewUrl,
        };
      }),
      commitPosition,
    };
    return result;
  });
}

export function isOwnerAclFile(acl: IFile<Acl>): acl is IFile<OwnerAcl> {
  return (acl.content as any).owners;
}
