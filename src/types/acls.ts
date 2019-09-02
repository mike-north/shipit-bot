import OwnerAcl, { IOwnerAcl } from '../models/acl/owner';
import ReleaseOwnerAcl, { IReleaseOwnerAcl } from '../models/acl/release-owner';

/**
 * Either be an "owner ACL" or a "release owner ACL"
 *
 * @private
 */
export type IAcl = IOwnerAcl | IReleaseOwnerAcl;
export type Acl = OwnerAcl | ReleaseOwnerAcl;
