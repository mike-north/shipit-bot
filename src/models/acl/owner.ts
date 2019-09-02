import AclBase, { IAclBase } from './base';

export interface IOwnerAcl extends IAclBase {
  owners: string[];
  paths: string[];
}

/**
 * An ACL that describes owners. This must _at least_
 * contain `owners` and `paths` string arrays
 *
 */
export default class OwnerAcl extends AclBase implements IOwnerAcl {
  owners: string[];

  readonly kind = 'owner' as const;

  constructor(arg: IOwnerAcl) {
    super(arg);
    this.owners = arg.owners;
  }
}
