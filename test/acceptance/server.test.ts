import nock from 'nock';
import { Probot } from 'probot';

// Requiring our app implementation
import myProbotApp from '../../src/server';

// Requiring our fixtures
import payload from './fixtures/issues.opened.json';

const issueCreatedBody = { body: 'Thanks for opening this issue!' };

QUnit.module('My Probot app', hooks => {
  let probot: Probot;
  hooks.before(() => {
    nock.disableNetConnect();
  });
  hooks.after(() => {
    nock.enableNetConnect();
  });
  hooks.beforeEach(() => {
    probot = new Probot({ id: 123, cert: 'test' });
    // Load our app into probot
    const app = probot.load(myProbotApp);

    // just return a test token
    app.app.getSignedJsonWebToken = (): string => 'test';
  });

  QUnit.test('creates a comment when an issue is opened', async assert => {
    // Test that a comment is posted
    nock('https://api.github.com')
      .post('/repos/hiimbex/testing-things/issues/1/comments', (body: any) => {
        assert.deepEqual(body, issueCreatedBody, 'Payload body is as expected');
        assert.step('attempted to create issue comment');
        return true;
      })
      .reply(200);

    // Receive a webhook event
    await probot.receive({ id: '2', name: 'issues', payload });

    assert.verifySteps(
      ['attempted to create issue comment'],
      'order of operations is as expected',
    );
  });
});

// For more information about testing with Nock see:
// https://github.com/nock/nock
