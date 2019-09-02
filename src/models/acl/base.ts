/**
 * A base type describing optional properties that may
 * be found in _any_ ACL
 *
 * @private
 */
export interface IAclBase {
  whitelist?: string[];
  paths: string[];
  exclude_paths?: string[];
  description?: string;
  block_message?: string;
  groups?: string[];
}

export default abstract class AclBase implements IAclBase {
  whitelist?: string[];

  paths: string[] = [];

  exclude_paths?: string[];

  description?: string;

  block_message?: string;

  groups?: string[];

  abstract kind: 'owner' | 'release_owner';

  protected pathRegexes: RegExp[];

  protected constructor(arg: IAclBase) {
    this.paths = arg.paths;
    if (arg.paths.length === 0)
      throw new Error(`Paths invalid: ${JSON.stringify(arg, null, '  ')}`);
    if (arg.whitelist) this.whitelist = arg.whitelist;
    if (arg.exclude_paths) this.exclude_paths = arg.exclude_paths;
    if (arg.description) this.description = arg.description;
    if (arg.block_message) this.block_message = arg.block_message;
    if (arg.groups) this.groups = arg.groups;
    this.pathRegexes = this.paths.map(p => new RegExp(p));
  }

  appliesToFile(filePath: string): boolean {
    for (const r of this.pathRegexes) {
      if (r.test(filePath)) return true;
    }
    return false;
  }
}
