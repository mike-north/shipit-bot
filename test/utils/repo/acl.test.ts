import nock, { ReplyCallback } from 'nock';
import Octokit from '@octokit/rest';
import { graphql } from '@octokit/graphql';

import {
  getAclsForRepo,
  getAclShipitStatusForCommits,
} from '../../../src/utils/repo/acl';

QUnit.module('ACL utility tests', hooks => {
  let n!: nock.Scope;
  hooks.beforeEach(function() {
    nock.disableNetConnect();
    n = nock('https://api.github.com').log(console.error);
  });

  hooks.afterEach(function(assert) {
    nock.enableNetConnect();
    assert.ok(nock.isDone(), 'nock is done');
    assert.deepEqual(nock.pendingMocks(), [], 'No pending mocks remain');
    nock.cleanAll();
  });

  QUnit.test('getAclsForRepo', async assert => {
    n.post('/graphql').reply(200, {
      data: {
        repository: {
          content: {
            entries: [
              {
                name: 'main.acl',
                object: {
                  text: `paths: [docs/*]
owners: []`,
                },
              },
            ],
          },
        },
      },
    });
    const github = { ...new Octokit(), graphql };
    const acls = await getAclsForRepo(github, 'mike-north', 'shipit-bot');
    assert.equal(acls.length, 1, 'One acl');
    assert.equal(acls[0].name, 'main.acl', 'ACL has correct name');
    assert.equal(
      acls[0].content.appliesToFile('docs/index.md'),
      true,
      'ACL pertains to correct files',
    );
  });

  QUnit.test('getAclShipitStatusForCommits', async assert => {
    const acls = await getAclShipitStatusForCommits([], [], []);

    assert.ok(acls, 'acls are truthy');
  });
});
