import { debounce } from '../../src/utils/debounce';

QUnit.module('debounce tests', async function() {
  QUnit.test('immediate repeated invocations are debounced', async assert => {
    const done = assert.async();
    let invocationCount = 0;
    function foo(): void {
      invocationCount++;
    }
    const debouncedFn = debounce(foo, 10);
    debouncedFn();
    debouncedFn();
    debouncedFn();
    setTimeout(() => {
      assert.equal(invocationCount, 1, 'Only one innvocation');
      done();
    }, 50);
  });

  QUnit.test('async invocations are debounced', async assert => {
    const done = assert.async();
    let invocationCount = 0;
    function foo(): void {
      invocationCount++;
    }
    const debouncedFn = debounce(foo, 15);
    debouncedFn(); // first invocation
    setTimeout(() => {
      debouncedFn(); // second invocation at 10ms, should trigger a reset of 15ms wait
      setTimeout(() => {
        debouncedFn(); // third invocation at 20ms, should trigger a reset of 15ms wait
      }, 10);
    }, 10);
    setTimeout(() => {
      assert.equal(invocationCount, 0, 'Zero innvocations at 30ms');
    }, 30);
    setTimeout(() => {
      assert.equal(invocationCount, 1, 'One innvocation at 50ms');
      done();
    }, 50);
  });
});
