import { gql } from '../../src/utils/gql';

QUnit.module('gql tagged template tests', async () => {
  QUnit.test(
    'w/o interpolation, passes through values as a string',
    async assert => {
      assert.equal(gql`query { }`, 'query { }', 'no value interpolation');
    },
  );
  QUnit.test(
    'interpolates values like un-tagged template literals',
    async assert => {
      assert.equal(gql`${'query'} { }`, 'query { }');
    },
  );
});
