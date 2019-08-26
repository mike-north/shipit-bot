/**
 * A Dictionary, generic over the type of value it holds
 */
export interface Dict<T> {
  [k: string]: T | undefined;
}

/**
 * Extract the arguments from a call or construct signature
 */
export type FArguments<F> = F extends (...args: infer ARGS) => any
  ? ARGS
  : F extends new (...args: infer ARGS) => any
  ? ARGS
  : never;
