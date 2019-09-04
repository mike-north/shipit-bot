import Deferred from '../../src/utils/deferred';

QUnit.module('Deferred tests', _hooks => {
  QUnit.test(
    'Expected properties are available, and have expected types',
    assert => {
      const d = new Deferred();
      assert.ok(d.promise instanceof Promise, 'deferred.promise is a Promise');
      assert.equal(
        typeof d.resolve,
        'function',
        'deferred.resolve is a function',
      );
      assert.equal(
        typeof d.reject,
        'function',
        'deferred.reject is a function',
      );
    },
  );

  QUnit.test(
    '"rejecting" a deferred, rejects its respective promise',
    async assert => {
      const d = new Deferred();
      let isRejected = false;
      assert.notOk(
        isRejected,
        'Before deferred is resolved, its promise is not rejected',
      );
      d.reject();
      await d.promise.then(() => {
        isRejected = true;
      });
      assert.ok(
        isRejected,
        'Before deferred is resolved, its promise is not resolved',
      );
    },
  );
  QUnit.test(
    '"rejecting" a deferred, resolves its respective promise',
    async assert => {
      const d = new Deferred();
      let isResolved = false;
      assert.notOk(
        isResolved,
        'Before deferred is resolved, its promise is not resolved',
      );
      d.resolve();
      await d.promise.then(() => {
        isResolved = true;
      });
      assert.ok(
        isResolved,
        'Before deferred is resolved, its promise is not resolved',
      );
    },
  );
});
