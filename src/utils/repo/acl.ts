import { Dict } from '@mike-north/types';
import {
  ChecksCreateParams,
  PullsListReviewsResponseItem,
} from '@octokit/rest';
import { GitHubAPI } from 'probot/lib/github';
import { yamlToAcl } from '../../models/acl';
import OwnerAcl from '../../models/acl/owner';
import { Acl, IChangedFile, IFile } from '../../types';
import {
  AclApprovalReviewStatus,
  AclApprovalState,
  AclConcludedApprovalState,
  AclPendingApprovalState,
} from '../../types/acls';
import UnreachableError from '../errors/unreachable';
import { listWithOr } from '../ui-text';
import { getFileChangesForCommits } from './commits';
import { getRepoTextFiles } from './files';

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
  return files.map(({ name, content }) => ({
    name,
    content: yamlToAcl(content),
  }));
}

/**
 * For a list of files (probably those changed in a commit or PR),
 * determine which ACLs will require a review and approval from an owner
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

/**
 * Determine whether an ACL file is an _Owner_ ACL file
 * @param acl ACL file
 */
export function isOwnerAclFile(acl: IFile<Acl>): acl is IFile<OwnerAcl> {
  return (acl.content as any).owners;
}

/**
 * Given an ACL approval state, generate partial ChecksCreateParams, for the
 * purpose of creating an ACL-specific CheckRun on GitHub
 *
 * @param aclResult ACL approval state
 * @param isAclOverride whether an `ACLOVERRIDE` signal has been detected
 */
export function checkRunParamsFromAclApprovalState(
  aclResult: AclApprovalState,
  isAclOverride: boolean,
  suggestedReviewers?: { teams: string[]; users: string[] },
): Pick<
  ChecksCreateParams,
  'output' | 'conclusion' | 'details_url' | 'status'
> {
  let inProgress = aclResult.review.status === 'PENDING';
  let output: ChecksCreateParams['output'];
  let conclusion: ChecksCreateParams['conclusion'];
  let url: string | undefined;
  const shortCommit =
    aclResult.review.status !== 'PENDING'
      ? aclResult.review.sha.substr(0, 6)
      : null;
  const { review } = aclResult;
  switch (review.status) {
    case 'PENDING': {
      let title = 'Pending review';
      if (suggestedReviewers && suggestedReviewers.users.length > 0) {
        title = `Pending review from ${listWithOr(suggestedReviewers.users)}`;
      } else if (suggestedReviewers && suggestedReviewers.teams.length > 0) {
        title = `Pending review from ${listWithOr(suggestedReviewers.teams)}`;
      }
      output = { title, summary: '' };
      break;
    }
    case 'APPROVED':
      if (review.isStale) {
        output = {
          summary: '',
          title: `New changes after ${shortCommit} require re-approval`,
        };
        conclusion = 'action_required';
      } else {
        output = {
          summary: '',
          title: `Approved by @${review.user} at ${shortCommit}`,
        };
        conclusion = 'success';
      }
      url = review.url;
      break;
    case 'CHANGES_REQUESTED':
      output = {
        summary: '',
        title: `Changes requested by @${review.user} at ${shortCommit}`,
      };
      conclusion = 'failure';
      url = review.url;
      break;
    case 'DISMISSED':
      output = {
        summary: '',
        title: `Dismissed review from @${review.user}`,
      };
      conclusion = 'cancelled';
      url = review.url;
      break;
    case 'COMMENTED':
      output = {
        summary: '',
        title: `Comment-only review by @${review.user} at ${shortCommit}`,
      };
      conclusion = 'failure';
      url = review.url;
      break;
    default:
      throw new UnreachableError(
        review,
        `Unknown reivew status type: ${JSON.stringify(
          review as any,
          null,
          '  ',
        )}`,
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

export async function getAclShipitStatusForCommits(
  repoAclFiles: IFile<OwnerAcl>[],
  commits: { sha: string; files: IChangedFile[] }[],
  existingReviews: PullsListReviewsResponseItem[],
): Promise<{ sha: string; files: IChangedFile[]; acls: AclApprovalState[] }[]> {
  const commitAcls = commits.map(c => {
    const { sha, files } = c;
    const commitFiles = files.map(f => f.filename);
    const acls = getOwnerAclsForFiles(repoAclFiles, commitFiles);
    return [sha, files, acls] as const;
  });

  const shaOrder = commits.map(c => c.sha);

  const userReviewPositions = existingReviews.reduce(
    (map, r) => {
      // eslint-disable-next-line no-param-reassign
      map[r.user.login] = [shaOrder.indexOf(r.commit_id), r];
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
      .filter(o => Object.hasOwnProperty.call(userReviewPositions, o))
      .reduce(
        (latest, thisOwner) => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const ownerReview = userReviewPositions[thisOwner]!;
          // if there's only one review, this is probably the most important information to surface
          if (latest === null) return ownerReview;

          /**
           * TODO: the logic below should be moved so that we determine "the determining signal"
           * in a single place
           */
          // if we're currently regarding a "commented" review as the strongest signal, seek a stronger one
          if (latest[1].state === 'DISMISSED') {
            if (
              ownerReview[1].state !== 'DISMISSED' || // a more concrete one
              ownerReview[0] > latest[0] // a more recent one
            )
              return ownerReview;
          } else if (latest[1].state === 'COMMENTED') {
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

  return commitAcls.map(([sha, files, acls]) => {
    const commitPosition = shaOrder.indexOf(sha);
    return {
      sha,
      files,
      acls: acls.map(acl => {
        const aclReview = reviewCommitPositionMap[acl.name];
        if (!aclReview)
          return {
            ...acl,
            review: { status: 'PENDING' as const },
          } as AclPendingApprovalState;
        const [position, review] = aclReview;
        const user = review.user.login;
        const reviewSha = review.commit_id;
        const url = review.html_url;

        return {
          ...acl,
          review: {
            isStale: commitPosition > position,
            user,
            status: review.state as AclApprovalReviewStatus,
            position,
            sha: reviewSha,
            url,
          },
        } as AclConcludedApprovalState;
      }),
    };
  });
}

export async function getPertinentFilesAndAclsForCommitList(
  github: GitHubAPI,
  commits: string[],
  acls: IFile<OwnerAcl>[],
  reviews: PullsListReviewsResponseItem[],
  { owner, repo }: { owner: string; repo: string },
): Promise<
  {
    sha: string;
    files: IChangedFile[];
    acls: AclApprovalState[];
  }[]
> {
  // For our list of commits, obtain data around which files were changed
  const commitData = await getFileChangesForCommits(
    github,
    owner,
    repo,
    commits,
  );

  return await getAclShipitStatusForCommits(acls, commitData, reviews);
}
