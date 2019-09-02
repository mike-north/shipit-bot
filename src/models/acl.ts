import * as yml from 'js-yaml';
import { Validator as JSONValidator } from 'jsonschema';

import OwnerAcl from './acl/owner';
import ReleaseOwnerAcl from './acl/release-owner';
import AclBase, { IAclBase } from './acl/base';

const validator = new JSONValidator();

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

function parseYaml(
  yamlText: string,
): IAclBase & ({ owners?: string[]; release_owners?: string[] }) {
  const aclData = yml.safeLoad(yamlText);
  const result = validator.validate(aclData, ACL_DATA_SCHEMA);
  if (result.valid)
    return aclData as IAclBase &
      ({ owners?: string[]; release_owners?: string[] });
  if (!result.errors.length)
    throw new Error(
      'ACL data was found to be invalid, but no specific errors were detected',
    );
  throw new Error(
    `ACL data parse error: ${result.errors
      .map(e => `${e.name}: on ${e.property} - ${e.message}`)
      .join('\n')}`,
  );
}

export function createAcl(yamlText: string): OwnerAcl | ReleaseOwnerAcl {
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
