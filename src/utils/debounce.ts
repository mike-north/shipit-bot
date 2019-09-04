import { FArguments } from '../types';
import Deferred from './deferred';

const defaultDebounceMap = new WeakMap<
  Function,
  ReturnType<typeof setTimeout>
>();

/**
 * Create a debounced copy of a function
 *
 * @param fn Function to debounce
 * @param timeout how long (in ms) to debounce
 */
export function debounce<F extends (...args: any[]) => void>(
  fn: F,
  timeout: number,
  state: WeakMap<Function, ReturnType<typeof setTimeout>> = defaultDebounceMap,
): (...args: FArguments<F>) => Promise<void> {
  let d: Deferred<void> = new Deferred();
  return function debounced(...args: FArguments<F>): Promise<void> {
    // check to see if we should continue waiting
    const existingTimeout = state.get(fn);

    if (existingTimeout) {
      // existing timeout was found
      clearTimeout(existingTimeout); // cancel the previously queued function
      // queue the new invocation
    }

    const newTimeout = setTimeout(async () => {
      state.delete(fn); // clear the cancellation token
      try {
        const result = await fn(...args); // ! RUN
        d.resolve(result);
      } catch (e) {
        d.reject(e);
      } finally {
        d = new Deferred();
      }
    }, timeout);
    state.set(fn, newTimeout); // store the new cancellation token
    return d.promise;
  };
}
