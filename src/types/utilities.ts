/**
 * Extract the arguments from a call or construct signature
 */
export type FArguments<F> = F extends (...args: infer ARGS) => any
  ? ARGS
  : F extends new (...args: infer ARGS) => any
  ? ARGS
  : never;

/**
 * Pick a sparse type via a two-parameter path
 *
 * @example
 *
 * class Foo {
 *   bar = {
 *      baz: Promise.resolve(6)
 *   }
 *   a = 4;
 *   b = { c: 'This is c'}
 * }
 *
 * const pickTwoFoo: Pick2<Foo, 'b', 'c'> = new Foo();
 * pickTwoFoo.b.c; // DOES type-check
 * pickTwoFoo.bar; // DOES NOT type-check
 *
 * const otherPickTwoFoo: Pick2<Foo, 'b', 'c'> = new Foo();
 * otherPickTwoFoo.b; // DOES NOT type-check
 * otherPickTwoFoo.bar.baz; // DOES type-check
 */
export type Pick2<
  OBJ,
  A extends keyof OBJ = keyof OBJ,
  B extends keyof OBJ[A] = keyof OBJ[A]
> = {
  [AA in A]: Pick<OBJ[AA], B>;
};

/**
 * Pick a sparse type via a three-parameter path
 *
 * @example
 *
 * class Foo {
 *   bar = {
 *      baz: Promise.resolve(6)
 *   }
 *   a = 4;
 *   b = {
 *     c: {
 *       d: 'This is d'
 *     }
 *   }
 * }
 *
 * const pickThreeFoo: Pick3<Foo, 'b', 'c', 'd'> = new Foo();
 * pickThreeFoo.b.c.d; // DOES type-check
 * pickThreeFoo.bar; // DOES NOT type-check
 * @see Pick2
 */
export type Pick3<
  OBJ,
  A extends keyof OBJ,
  B extends keyof OBJ[A],
  C extends keyof OBJ[A][B]
> = {
  [AA in A]: Pick2<OBJ[AA], B, C>;
};
