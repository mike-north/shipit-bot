import ReleaseOwnerAcl from '../../../src/models/acl/release-owner';

QUnit.module('ReleaseOwnerAcl class', _hooks => {
  QUnit.test('Instantiation', assert => {
    assert.ok(
      new ReleaseOwnerAcl({
        release_owners: [],
        paths: ['abc/*'],
      }),
    );
  });
});
