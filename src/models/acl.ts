import * as yml from 'js-yaml';
import { Validator as JSONValidator } from 'jsonschema';

import OwnerAcl from './acl/owner';
import ReleaseOwnerAcl from './acl/release-owner';
import AclBase, { IAclBase } from './acl/base';

const validator = new JSONValidator();

/**
 * A type containing all possible properties on an ACL
 *
 * @note This is deliberately not exported, and should not be used outside of parsing logic
 */
type PartialAcl = IAclBase & ({ owners?: string[]; release_owners?: string[] });

const ACL_DATA_SCHEMA = {
  id: '/AclFile',
  type: 'object',
  properties: {
    whitelist: {
      type: 'array',
      items: { type: 'string' },
    },
    paths: {
      type: 'array',
      items: { type: 'string' },
    },
    description: { type: 'string' },
    block_message: { type: 'string' },
    groups: { items: { type: 'string' }, type: 'array' },
    exclude_paths: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['paths'],
};

function isPartialAcl(val: any): val is PartialAcl {
  const validationResult = validator.validate(val, ACL_DATA_SCHEMA);
  if (validationResult.valid) return true;
  if (!validationResult.errors.length)
    throw new Error(
      'ACL was found to be invalid, but no specific errors were detected',
    );
  throw new Error(
    `ACL parse error: ${validationResult.errors
      .map(e => `${e.name}: on ${e.property} - ${e.message}`)
      .join('\n')}`,
  );
}

function parseYaml(yamlText: string): PartialAcl {
  const aclData = yml.safeLoad(yamlText);
  if (isPartialAcl(aclData)) return aclData;
  // theoretically unreachable, b/c `isPartialAcl`
  // user-defined type guard above either returns true or throws
  throw new Error(`Invaid ACL data: ${JSON.stringify(aclData, null, '  ')}`);
}

/**
 * Parse a YAML string into an ACL object
 * @param yamlText YAML string
 *
 * @note any extraneous data that's not discussed in the {@link https://iwww.corp.linkedin.com/wiki/cf/display/TOOLS/Source+Code+ACLs+Cheat+Sheet | ACL file format documentation} will be discarded
 */
export function yamlToAcl(yamlText: string): OwnerAcl | ReleaseOwnerAcl {
  const data = parseYaml(yamlText);
  const { release_owners, owners } = data;
  if (owners) {
    return new OwnerAcl({ ...data, owners });
  }
  if (release_owners) {
    return new ReleaseOwnerAcl({ ...data, release_owners });
  }
  throw new Error(
    `ACL data parse error: must contain either a 'release_owners' or 'owners' property`,
  );
}
