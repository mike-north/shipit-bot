import nock from 'nock';
import Octokit from '@octokit/rest';
import { graphql } from '@octokit/graphql';

import { getCommitHistoryForPullRequest } from '../../../src/utils/repo/pull-request';

QUnit.module('PR utilities', hooks => {
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
      .get('/repos/mike-north/shipit-bot/pulls/2/commits')
      .reply(200, [{ sha: 'a' }, { sha: 'b' }]);
    const github = { ...new Octokit(), graphql };
    const commitHistory = await getCommitHistoryForPullRequest(
      github,
      'mike-north',
      'shipit-bot',
      2,
    );
    assert.equal(commitHistory.length, 2, 'Two commits');
    assert.ok(scope.isDone());
  });
});
