import { Dict } from '@mike-north/types';

export function mapDict<T, S>(input: Dict<T>, transform: (t: T) => S): Dict<S> {
  return Object.keys(input).reduce(
    (d, key) => {
      // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-non-null-assertion
      d[key] = transform(input[key]!);
      return d;
    },
    {} as Dict<S>,
  );
}
