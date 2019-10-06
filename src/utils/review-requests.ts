import { PullsListReviewRequestsResponse } from '@octokit/rest';
import { GitHubAPI } from 'probot/lib/github';
import OwnerAcl from '../models/acl/owner';
import { IFile } from '../types';
import UserInputError from './errors/user-input-error';

export async function createReviewRequestsForAcls(
  github: GitHubAPI,
  repoInfo: { repo: string; owner: string },
  prNumber: number,
  prAuthorName: string,
  aclFiles: IFile<OwnerAcl>[],
  existingReviewerNames: string[],
  reviewRequests: PullsListReviewRequestsResponse,
): Promise<void> {
  // Identify ACLs that still need a review request of some ort
  const aclsRequringReviewRequests = aclFiles.filter(aclFile => {
    const { content: acl } = aclFile;
    // Name of the "real" GitHub team for ACL owners
    const ownerTeamName =
      !acl.team || typeof acl.team === 'string' ? acl.team : acl.team.owners;
    // Name of the "proxy" GitHub team used by PullPanda
    const proxyTeamName =
      acl.team && typeof acl.team === 'object' ? acl.team.proxy : null;

    /**
     * Does the PR already have a team review request that corresponds to this ACL?
     * Note: either the "real" or "proxy" team will do
     */
    const hasTeamReviewRequest =
      ownerTeamName || proxyTeamName
        ? !!reviewRequests.teams.find(
            team =>
              (ownerTeamName && team.name === ownerTeamName) ||
              (proxyTeamName && team.name === proxyTeamName),
          )
        : false;
    /**
     * Does the PR already have a review request for one of this ACL's owners?
     */
    const hasIndividualReviewRequest = !!reviewRequests.users.find(rr =>
      acl.owners.includes(rr.login),
    );
    /**
     * Does the PR already have a review of some sort from one of this ACL's owners?
     */
    const hasIndividualReview = !!existingReviewerNames.find(reviewer =>
      acl.owners.includes(reviewer),
    );
    /**
     * If any of these three conditions are true, we don't need to do anything for this ACL
     */
    return (
      !hasIndividualReview &&
      !hasIndividualReviewRequest &&
      !hasTeamReviewRequest
    );
  });
  /**
   * Accumulate a list of teams and individuals, to request a review from
   */
  const reviewersToRequest = aclsRequringReviewRequests.reduce(
    (reqs, aclFile) => {
      const { content: acl } = aclFile;
      const ownerTeamName =
        !acl.team || typeof acl.team === 'string' ? acl.team : acl.team.owners;

      const proxyTeamName =
        acl.team && typeof acl.team !== 'string' ? acl.team.proxy : null;
      // No GitHub team specified to sync with the ACL's owners
      if (!ownerTeamName) {
        /**
         * We'll have to request a review directly from ACL owners instead of a team
         */
        // If there's only one owner and it's the PR author, comment in the PR with a nice error
        if (acl.owners.length === 1 && acl.owners[0] === prAuthorName) {
          throw new UserInputError(
            `ACL ${aclFile.name} only has the author of this pull request, ${prAuthorName} as an owner.
Authors cannot approve their own code. Please add additional reviewers to the ACL`,
          );
        }
        // If there are no owners in the ACL, comment in the PR
        if (acl.owners.length === 0) {
          throw new UserInputError(
            `ACL ${aclFile.name} has no owners listed. Please add two or more owners`,
          );
        }
        /**
         * Now we know that there's at least one owner on the ACL that's NOT the PR author
         * Let's get a list of valid reviewers by filtering the author out
         */
        const otherOwners = acl.owners.filter(o => o !== prAuthorName);

        // Find a random reviewer
        const randomReviewerIdx = Math.floor(
          Math.random() * otherOwners.length,
        );
        // Add them to our "to ask" list
        reqs.reviewers.push(otherOwners[randomReviewerIdx]);
      } else if (proxyTeamName) {
        // If a proxy team is listed, request a review from them
        reqs.team_reviewers.push(proxyTeamName);
      } else {
        // Otherwise, request a review from the real team
        reqs.team_reviewers.push(ownerTeamName);
      }

      return reqs;
    },
    {
      team_reviewers: [] as string[],
      reviewers: [] as string[],
    },
  );
  console.log({ reviewersToRequest });
  /**
   * Actually create the review request. It's pretty nice that we can
   * do this in a single API call
   */
  await github.pulls.createReviewRequest({
    ...repoInfo,
    pull_number: prNumber,
    ...reviewersToRequest,
  });
}
