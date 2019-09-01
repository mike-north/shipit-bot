import AclBase, { IAclBase } from './base';

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

export default class ReleaseOwnerAcl extends AclBase
  implements IReleaseOwnerAcl {
  release_owners: string[];

  readonly kind = 'release_owner' as const;

  constructor(arg: IReleaseOwnerAcl) {
    super(arg);
    this.release_owners = arg.release_owners;
  }
}
