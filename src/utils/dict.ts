import { Dict, ExtractPropertyNamesOfType } from '@mike-north/types';

export function mapDict<T, S>(
  input: Dict<T>,
  transform: (t: T) => S | undefined,
): Dict<S> {
  return Object.keys(input).reduce(
    (d, key) => {
      // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-non-null-assertion
      d[key] = transform(input[key]!);
      return d;
    },
    {} as Dict<S>,
  );
}

export function reduceDict<T, R>(
  input: Dict<T>,
  reducer: (acc: R, item: T, key: string, dict: Dict<T>) => R,
  initialVal: R,
): R {
  return Object.keys(input).reduce((acc, key) => {
    // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
    return reducer(acc, input[key]!, key, input);
  }, initialVal);
}

export function listToDict<
  T extends object,
  K extends keyof T,
  L extends string | number | symbol,
  R = T
>(
  list: T[],
  keySpecifier: (t: T) => L,
  appender: (item: T, existing?: R) => R = (x: any): any => x,
): Record<L, R | undefined> {
  return list.reduce(
    (dict, listItem) => {
      const k = keySpecifier(listItem);
      const existingDictItem = dict[k];
      // eslint-disable-next-line no-param-reassign
      dict[k] = appender(listItem, existingDictItem);
      return dict;
    },
    {} as Record<L, R | undefined>,
  );
}
