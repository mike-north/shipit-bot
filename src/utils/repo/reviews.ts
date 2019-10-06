import * as Octokit from '@octokit/rest';
import { Pick2 } from '../../types/utilities';
import { AclApprovalState, AclApprovalReviewStatus } from '../../types/acls';

/**
 * Get the reviews completed for a given pull request
 *
 * @param github partial GitHub API
 * @param owner name of repo owner
 * @param repo name of repo
 * @param pull_number pull request number
 */
export async function getReviewsForPullRequest(
  github: Pick2<Octokit, 'pulls', 'listReviews'>,
  owner: string,
  repo: string,
  pull_number: number,
): Promise<Octokit.PullsListReviewsResponseItem[]> {
  const { data: reviewsList } = await github.pulls.listReviews({
    owner,
    repo,
    pull_number,
  });
  return reviewsList;
}

export const REVIEW_STATUS_SIGNAL_STRENGTH: {
  [K in AclApprovalState['review']['status'] | 'STALE']: number;
} = {
  PENDING: 1,
  DISMISSED: 3,
  COMMENTED: 5,
  STALE: 6,
  APPROVED: 10,
  CHANGES_REQUESTED: 10,
};

export function determineDecidingAclActivity<
  T extends {
    review: Pick<AclApprovalState['review'], 'status'> & { isStale?: boolean };
  }
>(activities: T[]): T {
  const [decidingSignal] = activities.reduceRight(
    ([current, currentStrength], thisSignal) => {
      const { review } = thisSignal;
      const strength =
        review.status !== 'PENDING' && review.isStale
          ? REVIEW_STATUS_SIGNAL_STRENGTH.STALE
          : REVIEW_STATUS_SIGNAL_STRENGTH[thisSignal.review.status];
      if (strength >= currentStrength) return [thisSignal, strength];
      return [current, currentStrength];
    },
    [null, -1] as [T | null, number],
  );
  if (!decidingSignal)
    throw new Error(
      `Could not come to a conclusion about review activity: ${JSON.stringify(
        activities,
        null,
        ' ',
      )}`,
    );
  return decidingSignal;
}
