/**
 * A Dictionary, generic over the type of value it holds
 */
export interface Dict<T> {
  [k: string]: T | undefined;
}
