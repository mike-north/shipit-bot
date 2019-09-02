import BaseAcl, { IAclBase } from '../../../src/models/acl/base';

class SubAcl extends BaseAcl {
  kind = 'owner' as const;

  constructor(arg: IAclBase) {
    super(arg);
  }
}

QUnit.module('BaseAcl class', _hooks => {
  QUnit.test('Instantiation should require at least one path', assert => {
    assert.throws(() => {
      // eslint-disable-next-line no-new
      new SubAcl({ paths: [] });
    });

    assert.ok(
      new SubAcl({ paths: ['abc/*'] }),
      'Able to instantiate an ACL subclass',
    );
  });

  QUnit.test('appliesToFile', assert => {
    const acl = new SubAcl({ paths: ['abc/*', 'def/*'] });
    assert.ok(acl.appliesToFile('abc/foo.txt'));
    assert.notOk(acl.appliesToFile('foo.txt'));
    assert.ok(acl.appliesToFile('def/foo.txt'));
  });
});
