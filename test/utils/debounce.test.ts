import { debounce } from '../../src/utils/debounce';
import { IDict } from '../../src/types';

const timeout = (n: number) => new Promise(res => setTimeout(res, n));

QUnit.module('debounce tests', function() {
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

  QUnit.test(
    'promise returned by debounce resolves only once work is actually done',
    async assert => {
      const done = assert.async();
      let startCount = 0;
      let finishCount = 0;
      async function foo(): Promise<void> {
        startCount++;
        await timeout(100);
        finishCount++;
      }
      const debouncedFn = debounce(foo, 15);

      const p1 = debouncedFn(); // first invocation at 0ms
      const isResolved: IDict<boolean> = {
        1: false,
        2: false,
        3: false,
      };

      p1.then(() => {
        isResolved[1] = true;
      });
      setTimeout(() => {
        const p2 = debouncedFn(); // second invocation at 10ms, should trigger a reset of 15ms wait
        p2.then(() => {
          isResolved[2] = true;
        });
        setTimeout(() => {
          const p3 = debouncedFn(); // third invocation at 20ms, should trigger a reset of 15ms wait
          p3.then(() => {
            isResolved[3] = true;
          });
        }, 10);
      }, 10);

      /**
       *
       * @param delay number of ms to wait before asserting
       * @param expectations number of "start", "finish" and "resolved" indications we expect
       */
      function assertAtTime(
        delay: number,
        expectations: {
          starts: number;
          finishes: number;
          resolved: number;
        },
      ) {
        const { starts, finishes, resolved } = expectations;
        setTimeout(() => {
          assert.equal(
            startCount,
            starts,
            `${starts} innvocations at ${delay}ms`,
          );
          assert.equal(
            finishCount,
            finishes,
            `${finishes} finished innvocations at ${delay}ms`,
          );
          // count how many promises have resolved
          const numResolvedPromises = Object.entries(isResolved).reduce(
            (trues, [_, item]) => {
              if (item) return trues + 1;
              return trues;
            },
            0,
          );
          assert.equal(
            numResolvedPromises,
            resolved,
            `${resolved} promises have resolved at ${delay}ms`,
          );
        }, delay);
      }
      // at 5ms we should still be debouncing from the first invocation at 0ms
      assertAtTime(5, { starts: 0, finishes: 0, resolved: 0 });
      // at 15ms we should still be debouncing from the second invocation at 10ms
      assertAtTime(15, { starts: 0, finishes: 0, resolved: 0 });
      // at 30ms we should still be debouncing from the third invocation at 20ms
      assertAtTime(30, { starts: 0, finishes: 0, resolved: 0 });
      // at 50ms we should no longer be debouncing, and should see evidence that our async work has begun (but not finished)
      assertAtTime(50, { starts: 1, finishes: 0, resolved: 0 });
      // at 160ms we should see that the work has finished, and the shared promise between all three debounced fn invocations should have resolved
      assertAtTime(160, { starts: 1, finishes: 1, resolved: 3 });

      // keep this test alive for 0.25s, just to make sure all of the above have a chance to run
      setTimeout(done, 250);
    },
  );

  QUnit.test(
    'a new "shared promise" is used between adequately-spaced debounced invocations',
    async assert => {
      const done = assert.async();
      let startCount = 0;
      let finishCount = 0;
      async function foo(): Promise<void> {
        startCount++;
        await timeout(20);
        finishCount++;
      }
      const debouncedFn = debounce(foo, 15);

      const p1 = debouncedFn(); // first invocation at 0ms
      const isResolved: IDict<boolean> = {
        1: false,
        2: false,
        3: false,
      };

      p1.then(() => {
        isResolved[1] = true;
      });
      setTimeout(() => {
        const p2 = debouncedFn(); // second invocation at 10ms, should trigger a reset of 15ms wait
        p2.then(() => {
          isResolved[2] = true;
        });
        setTimeout(() => {
          const p3 = debouncedFn(); // third invocation at 20ms, should trigger a reset of 15ms wait
          p3.then(() => {
            isResolved[3] = true;
          });
        }, 70);
      }, 10);

      /**
       *
       * @param delay number of ms to wait before asserting
       * @param expectations number of "start", "finish" and "resolved" indications we expect
       */
      function assertAtTime(
        delay: number,
        expectations: {
          starts: number;
          finishes: number;
          resolved: number;
        },
      ) {
        const { starts, finishes, resolved } = expectations;
        setTimeout(() => {
          assert.equal(
            startCount,
            starts,
            `${starts} innvocations at ${delay}ms`,
          );
          assert.equal(
            finishCount,
            finishes,
            `${finishes} finished innvocations at ${delay}ms`,
          );
          // count how many promises have resolved
          const numResolvedPromises = Object.entries(isResolved).reduce(
            (trues, [_, item]) => {
              if (item) return trues + 1;
              return trues;
            },
            0,
          );
          assert.equal(
            numResolvedPromises,
            resolved,
            `${resolved} promises have resolved at ${delay}ms`,
          );
        }, delay);
      }
      // FIRST ROUND OF DEBOUNCING
      // at 5ms we should still be debouncing from the first invocation at 0ms
      assertAtTime(5, { starts: 0, finishes: 0, resolved: 0 });
      // at 15ms we should still be debouncing from the second invocation at 10ms
      assertAtTime(15, { starts: 0, finishes: 0, resolved: 0 });
      // after 45ms the promises from the first two invocations (first debounced, second one went through) should have resolved
      assertAtTime(50, { starts: 1, finishes: 1, resolved: 2 });

      // SECOND ROUND OF DEBOUNCING
      // at 103ms we should no longer be debouncing, and should see evidence that our next chunk of async work has begun (but not finished)
      assertAtTime(103, { starts: 2, finishes: 1, resolved: 2 });
      // at 130ms we should see that our second call to `foo` has finished, and the third promise resolved
      assertAtTime(130, { starts: 2, finishes: 2, resolved: 3 });

      // keep this test alive for 0.25s, just to make sure all of the above have a chance to run
      setTimeout(done, 250);
    },
  );
});
