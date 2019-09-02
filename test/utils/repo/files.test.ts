import nock from 'nock';
import Octokit from '@octokit/rest';
import { graphql } from '@octokit/graphql';

import { getRepoTextFiles } from '../../../src/utils/repo/files';

QUnit.module('File utilities', hooks => {
  hooks.beforeEach(function() {
    nock.disableNetConnect();
  });
  hooks.afterEach(function() {
    nock.enableNetConnect();
  });

  hooks.afterEach(function(assert) {
    assert.ok(nock.isDone());
  });

  QUnit.test('getRepoTextFiles', async assert => {
    const scope = nock('https://api.github.com')
      .post('/graphql')
      .reply(200, {
        data: {
          repository: {
            content: {
              entries: [
                {
                  name: 'abc.txt',
                  object: { text: 'foo' },
                },
              ],
            },
          },
        },
      });
    const github = { ...new Octokit(), graphql };
    const files = await getRepoTextFiles(
      github,
      'mike-north',
      'shipit-bot',
      'master',
      'acls/*',
    );
    assert.equal(files.length, 1, 'One file');
    assert.equal(files[0].name, 'abc.txt', 'File name is correct');
    assert.equal(files[0].content, 'foo', 'File body is correct');
  });
});
