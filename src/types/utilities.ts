/**
 * Extract the arguments from a call or construct signature
 */
export type FArguments<F> = F extends (...args: infer ARGS) => any
  ? ARGS
  : F extends new (...args: infer ARGS) => any
  ? ARGS
  : never;
