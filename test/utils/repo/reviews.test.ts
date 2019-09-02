import nock from 'nock';
import Octokit from '@octokit/rest';
import { graphql } from '@octokit/graphql';

import { getReviewsForPullRequest } from '../../../src/utils/repo/reviews';

QUnit.module('Review utilities', hooks => {
  hooks.beforeEach(function() {
    nock.disableNetConnect();
  });
  hooks.afterEach(function() {
    nock.enableNetConnect();
  });

  hooks.afterEach(function(assert) {
    assert.ok(nock.isDone());
  });

  QUnit.test('getCommitHistoryForPullRequest', async assert => {
    const scope = nock('https://api.github.com')
      .get('/repos/mike-north/shipit-bot/pulls/2/reviews')
      .reply(200, ['a', 'b', 'c']);
    const github = { ...new Octokit(), graphql };
    const reviews = await getReviewsForPullRequest(
      github,
      'mike-north',
      'shipit-bot',
      2,
    );
    assert.equal(reviews.length, 3, 'Three reviews');
    assert.ok(scope.isDone());
  });
});
