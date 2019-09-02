import OwnerAcl from '../../../src/models/acl/owner';

QUnit.module('OwnerAcl class', _hooks => {
  QUnit.test('Instantiation', assert => {
    assert.ok(
      new OwnerAcl({
        paths: ['abc/*'],
        owners: [],
      }),
    );
  });
});
