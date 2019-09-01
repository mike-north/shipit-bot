/**
 * A Dictionary, generic over the type of value it holds
 */
export interface IDict<T> {
  [k: string]: T | undefined;
}
