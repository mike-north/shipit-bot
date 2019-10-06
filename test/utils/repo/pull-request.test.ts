import nock from 'nock';
import Octokit from '@octokit/rest';
import { graphql } from '@octokit/graphql';

import { getCommitHistoryForPullRequest } from '../../../src/utils/repo/pull-request';

QUnit.module('PR utilities', hooks => {
  let n!: nock.Scope;
  hooks.beforeEach(function() {
    nock.disableNetConnect();
    n = nock('https://api.github.com').log(console.log);
  });

  hooks.afterEach(function(assert) {
    nock.enableNetConnect();
    assert.ok(nock.isDone());
  });

  hooks.after(() => nock.cleanAll());

  QUnit.test('getCommitHistoryForPullRequest', async assert => {
    n.get('/repos/mike-north/shipit-bot/pulls/2/commits').reply(200, [
      { sha: 'a' },
      { sha: 'b' },
    ]);
    const github = { ...new Octokit(), graphql };
    const commitHistory = await getCommitHistoryForPullRequest(
      github,
      'mike-north',
      'shipit-bot',
      2,
    );
    assert.equal(commitHistory.length, 2, 'Two commits');
  });
});
