import { FArguments } from "../types";

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
  state: WeakMap<Function, ReturnType<typeof setTimeout>> = defaultDebounceMap
): (...args: FArguments<F>) => Promise<void> {
  return async function debounced(...args: FArguments<F>): Promise<void> {
    // check to see if we should continue waiting
    const existingTimeout = state.get(fn);

    if (existingTimeout) {
      // existing timeout was found
      clearTimeout(existingTimeout); // cancel the previously queued function
      // queue the new invocation
    }
    const newTimeout = setTimeout(() => {
      state.delete(fn); // clear the cancellation token
      fn(...args); // ! RUN
    }, timeout);
    state.set(fn, newTimeout); // store the new cancellation token
  };
}
