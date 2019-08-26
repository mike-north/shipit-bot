import * as yml from "js-yaml";
import { GitHubAPI } from "probot/lib/github";
import { getRepoTextFiles } from "./files";

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

/**
 * A file with a filename and ACL content
 *
 * @private
 */
export interface IAclFile {
  name: string;
  content: Acl;
}

/**
 * Parse a corretly formatted string into an {@link ACL} data structure
 *
 * @note any extraneous data that's not discussed in the {@link https://iwww.corp.linkedin.com/wiki/cf/display/TOOLS/Source+Code+ACLs+Cheat+Sheet | ACL file format documentation} will be discarded
 * @param fileContents YAML-formatted string
 * @internal
 */
function parseAcl(fileContents: string): Acl {
  const aclData: Partial<IOwnerAcl & IReleaseOwnerAcl> = yml.safeLoad(
    fileContents
  );
  const {
    owners,
    paths,
    whitelist,
    exclude_paths,
    groups,
    release_owners,
    block_message,
    description
  } = aclData;
  if (!paths)
    throw new Error(
      `ACL file must have a "paths" property: \n${JSON.stringify(aclData)}`
    );

  if (owners) {
    // owner ACL
    return {
      owners,
      paths,
      whitelist,
      exclude_paths,
      groups,
      block_message,
      description
    };
  } else if (release_owners) {
    // release owner ACL
    return {
      release_owners,
      paths,
      whitelist,
      exclude_paths,
      groups,
      block_message,
      description
    };
  } else throw new Error(`Invalid ACL file: \n${JSON.stringify(aclData)}`);
}

/**
 * Get the list of ACLs included in a specified repo
 *
 * @param github GitHub api namespace
 * @param owner name of the repo owner
 * @param repo name of the repo
 *
 * @private
 */
export async function getAclsForRepo(
  github: GitHubAPI,
  owner: string,
  repo: string
): Promise<IAclFile[]> {
  const files = await getRepoTextFiles(github, owner, repo, "master", "acls/");
  const acls = files.map(({ name, content }) => ({
    name,
    content: parseAcl(content)
  }));

  return acls;
}
