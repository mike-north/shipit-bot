import nock from 'nock';
import Octokit from '@octokit/rest';

import { getFileChangesForCommits } from '../../../src/utils/repo/commits';

QUnit.module('Commit utility tests', hooks => {
  hooks.beforeEach(function() {
    nock.disableNetConnect();
  });
  hooks.afterEach(function() {
    nock.enableNetConnect();
  });

  hooks.afterEach(function(assert) {
    assert.ok(nock.isDone());
  });

  QUnit.test('getFileChangesForCommits', async assert => {
    const scope = nock('https://api.github.com')
      .get(
        '/repos/mike-north/shipit-bot/commits/105916e1b20780929c671e28a538dd1d165743e0',
      )
      .reply(200, {
        files: [
          {
            filename: 'abc.txt',
            additions: 10,
            deletions: 2,
            changes: 12,
            status: 'modified',
          },
          {
            filename: 'def.txt',
            additions: 10,
            deletions: 2,
            changes: 12,
            status: 'modified',
          },
        ],
      });

    const github = new Octokit();
    const changes = await getFileChangesForCommits(
      github,
      'mike-north',
      'shipit-bot',
      ['105916e1b20780929c671e28a538dd1d165743e0'],
    );

    assert.ok(changes, 'changes are returned');
    assert.equal(changes.length, 1, '1 commit');
    assert.equal(
      changes[0].sha,
      '105916e1b20780929c671e28a538dd1d165743e0',
      'sha is correct',
    );
    assert.equal(changes[0].files.length, 2, '2 files');
    assert.equal(
      changes[0].files[0].filename,
      'abc.txt',
      'first file is correct',
    );
    assert.equal(
      changes[0].files[1].filename,
      'def.txt',
      'second file is correct',
    );
    assert.ok(scope.isDone());
  });
});
