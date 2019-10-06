import OwnerAcl, { IOwnerAcl } from '../models/acl/owner';
import ReleaseOwnerAcl, { IReleaseOwnerAcl } from '../models/acl/release-owner';
import { IFile } from './files';

/**
 * Either be an "owner ACL" or a "release owner ACL"
 *
 * @private
 */
export type IAcl = IOwnerAcl | IReleaseOwnerAcl;
export type Acl = OwnerAcl | ReleaseOwnerAcl;

export type AclApprovalReviewStatus =
  | 'COMMENTED'
  | 'DISMISSED'
  | 'APPROVED'
  | 'CHANGES_REQUESTED';

export type AclApprovalPendingReview = { status: 'PENDING'; isStale?: false };
export type AclApprovalConcludedReview = {
  user: string;
  sha: string;
  position: number;
  url: string;
  status: AclApprovalReviewStatus;
  isStale: boolean;
};
export type AclReview = AclApprovalPendingReview | AclApprovalConcludedReview;

export type AclPendingApprovalState = IFile<OwnerAcl> & {
  review: AclApprovalPendingReview;
};
export type AclConcludedApprovalState = IFile<OwnerAcl> & {
  review: AclApprovalConcludedReview;
};
export type AclApprovalState =
  | AclConcludedApprovalState
  | AclPendingApprovalState;
