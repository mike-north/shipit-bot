import * as yml from "js-yaml";
import { GitHubAPI } from "probot/lib/github";
import { getRepoTextFiles } from "./files";
import { IOwnerAcl, IReleaseOwnerAcl, Acl, IFile } from "../../types";

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
): Promise<IFile<Acl>[]> {
  const files = await getRepoTextFiles(github, owner, repo, "master", "acls/");
  const acls = files.map(({ name, content }) => ({
    name,
    content: parseAcl(content)
  }));

  return acls;
}
