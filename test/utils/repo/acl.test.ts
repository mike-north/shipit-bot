import nock from 'nock';
import Octokit from '@octokit/rest';
import { graphql } from '@octokit/graphql';

import {
  getAclsForRepo,
  getAclShipitStatusForCommits,
} from '../../../src/utils/repo/acl';

QUnit.module('ACL utility tests', hooks => {
  hooks.beforeEach(function() {
    nock.disableNetConnect();
  });
  hooks.afterEach(function() {
    nock.enableNetConnect();
  });

  hooks.afterEach(function(assert) {
    assert.ok(nock.isDone());
  });

  QUnit.test('getAclsForRepo', async assert => {
    const scope = nock('https://api.github.com')
      .post('/graphql')
      .reply(200, {
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
    assert.ok(scope.isDone());
  });

  QUnit.test('getAclShipitStatusForCommits', async assert => {
    const acls = await getAclShipitStatusForCommits([], [], []);

    assert.ok(acls);
  });
});
