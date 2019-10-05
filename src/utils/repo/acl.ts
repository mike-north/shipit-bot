import { GitHubAPI } from 'probot/lib/github';
import {
  PullsListReviewsResponseItem,
  ChecksCreateParams,
} from '@octokit/rest';
import { Dict } from '@mike-north/types';
import { getRepoTextFiles } from './files';
import { Acl, IFile, ICommitWithFileChanges } from '../../types';
import OwnerAcl from '../../models/acl/owner';
import { createAcl } from '../../models/acl';
import UnreachableError from '../errors/unreachable';
import { AclApprovalReviewStatus } from '../../types/acls';

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

export type AclPendingApprovalState = IFile<OwnerAcl> & {
  reviewStatus: 'PENDING';
};
export type AclConcludedApprovalState = IFile<OwnerAcl> & {
  reviewer: string;
  reviewPosition: number;
  reviewCommit: string;
  reviewUrl: string;
  isStale: boolean;
  reviewStatus: AclApprovalReviewStatus;
};

export type AclApprovalState =
  | AclPendingApprovalState
  | AclConcludedApprovalState;

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
          // if there's only one review, this is probably the most important information to surface
          if (latest === null) return ownerReview;
          // if we're currently regarding a "commented" review as the strongest signal, seek a stronger one
          if (latest[1].state === 'COMMENTED') {
            if (
              ownerReview[1].state !== 'COMMENTED' || // a more concrete one
              ownerReview[0] > latest[0] // a more recent one
            )
              return ownerReview;
          } else {
            if (ownerReview[1].state === 'COMMENTED') return latest;
            return ownerReview[0] > latest[0] ? ownerReview : latest;
          }
          return latest;
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

export function aclApprovalStateAsCheckRunParams(
  aclResult: AclApprovalState,
  isAclOverride: boolean,
): Pick<
  ChecksCreateParams,
  'output' | 'conclusion' | 'details_url' | 'status'
> {
  let inProgress = aclResult.reviewStatus === 'PENDING';
  let output: ChecksCreateParams['output'];
  let conclusion: ChecksCreateParams['conclusion'];
  let url: string | undefined;
  const shortCommit =
    aclResult.reviewStatus !== 'PENDING'
      ? aclResult.reviewCommit.substr(0, 6)
      : null;
  switch (aclResult.reviewStatus) {
    case 'PENDING':
      output = { title: 'Still waiting on review', summary: '' };
      break;
    case 'APPROVED':
      if (aclResult.isStale) {
        output = {
          summary: '',
          title: `New changes after ${shortCommit} require re-approval`,
        };
        conclusion = 'action_required';
      } else {
        output = {
          summary: '',
          title: `Approved by @${aclResult.reviewer} at ${shortCommit}`,
        };
        conclusion = 'success';
      }
      url = aclResult.reviewUrl;
      break;
    case 'CHANGES_REQUESTED':
      output = {
        summary: '',
        title: `Changes requested by @${aclResult.reviewer} at ${shortCommit}`,
      };
      conclusion = 'failure';
      url = aclResult.reviewUrl;
      break;
    case 'DISMISSED':
      output = {
        summary: '',
        title: `Dismissed review from @${aclResult.reviewer}`,
      };
      conclusion = 'cancelled';
      url = aclResult.reviewUrl;
      break;
    case 'COMMENTED':
      output = {
        summary: '',
        title: `Comment-only review by @${aclResult.reviewer} at ${shortCommit}`,
      };
      conclusion = 'failure';
      url = aclResult.reviewUrl;
      break;
    default:
      throw new UnreachableError(
        aclResult,
        `Unknown reivew status type: ${(aclResult as any).reviewStatus}`,
      );
  }
  if (isAclOverride) {
    if (
      inProgress ||
      (conclusion &&
        ['failure', 'cancelled', 'action_required'].includes(conclusion))
    ) {
      inProgress = false;
      output.title = `ACLOVERRIDE (was: ${conclusion || 'pending'} - ${
        output.title
      })`;
      conclusion = 'neutral';
    }
  }
  return {
    output,
    conclusion,
    details_url: url,
    status: inProgress ? 'in_progress' : 'completed',
  };
}
