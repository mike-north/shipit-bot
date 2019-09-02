import { createAcl } from '../../../src/models/acl';

QUnit.module('Parsing ACLs from YAML text', _hooks => {
  QUnit.test('invalid YAML', assert => {
    assert.throws(() => {
      const acl = createAcl(`foo: []`);
    }, /requires property "paths"/);
  });

  QUnit.test('parsing "owner ACL" text', assert => {
    const acl = createAcl(`paths: [abc/*]
owners: [mike-north]
`);
    assert.ok(acl, 'ACL is created');
    assert.equal(acl.kind, 'owner', 'ACL is an "owner acl"');
  });

  QUnit.test('parsing "release_owner ACL" text', assert => {
    const acl = createAcl(`paths: [abc/*]
release_owners: [mike-north]
`);
    assert.ok(acl, 'ACL is created');
    assert.equal(acl.kind, 'release_owner', 'ACL is an "release_owner acl"');
  });
});
