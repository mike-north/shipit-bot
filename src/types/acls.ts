import { IFile } from "./files";

/**
 * A base type describing optional properties that may
 * be found in _any_ ACL
 *
 * @private
 */
export interface IAclBase {
  whitelist?: string[];
  paths?: string[];
  exclude_paths?: string[];
  description?: string;
  block_message?: string;
  groups?: string[];
}

/**
 * An ACL that describes owners. This must _at least_
 * contain `owners` and `paths` string arrays
 *
 * @private
 */
export interface IOwnerAcl extends IAclBase {
  owners: string[];
  paths: string[];
}

/**
 * An ACL that describes release_owners. This must _at least_
 * contain `release_owners` and `paths` string arrays
 *
 * @private
 */
export interface IReleaseOwnerAcl extends IAclBase {
  release_owners: string[];
  paths: string[];
}

/**
 * Either be an "owner ACL" or a "release owner ACL"
 *
 * @private
 */
export type Acl = IOwnerAcl | IReleaseOwnerAcl;
