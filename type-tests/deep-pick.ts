import { Pick2, Pick3 } from 'shipit-bot/types';

class Foo {
  bar = {
    biz: {
      baz: 4,
      boz: 'hello' as const,
    },
  };
  a = ['a'] as const;
  b = { c: { d: ['d'] } } as const;
}

/**
 * The "picked" type should only have properties specified
 * by the type parameters. In this case we should find
 * "bar", and inside that, "biz", but no "a" or "b"
 */
const barBiz: Pick2<Foo, 'bar', 'biz'> = new Foo();
barBiz.bar.biz.baz; // $ExpectType number
barBiz.bar.biz.boz; // $ExpectType "hello"
barBiz.a; // $ExpectError
barBiz.b; // $ExpectError

const barBizBaz: Pick3<Foo, 'bar', 'biz', 'baz'> = new Foo();
barBizBaz.bar.biz.baz; // $ExpectType number
barBizBaz.bar.biz.boz; // $ExpectError
barBizBaz.a; // $ExpectError
barBizBaz.b; // $ExpectError

const barBizBaz2: Pick3<Foo, 'bar', 'biz', 'baz' | 'boz'> = new Foo();
barBizBaz2.bar.biz.baz; // $ExpectType number
barBizBaz2.bar.biz.boz; // $ExpectType "hello"
barBizBaz2.a; // $ExpectError
barBizBaz2.b; // $ExpectError
