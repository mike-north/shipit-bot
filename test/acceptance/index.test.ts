import nock from 'nock';
import { Probot } from 'probot';

// Requiring our app implementation
import myProbotApp from '../../src';

// Requiring our fixtures
import payload from './fixtures/issues.opened.json';

const issueCreatedBody = { body: 'Thanks for opening this issue!' };

nock.disableNetConnect();

QUnit.module('My Probot app', async hooks => {
  let probot: any;

  hooks.beforeEach(() => {
    probot = new Probot({ id: 123, cert: 'test' });
    // Load our app into probot
    const app = probot.load(myProbotApp);

    // just return a test token
    app.app.getSignedJsonWebToken = (): string => 'test';
  });

  QUnit.test('creates a comment when an issue is opened', async assert => {
    const done = assert.async();
    // Test that we correctly return a test token
    nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, { token: 'test' });

    // Test that a comment is posted
    nock('https://api.github.com')
      .post('/repos/hiimbex/testing-things/issues/1/comments', (body: any) => {
        assert.deepEqual(body, issueCreatedBody, 'Payload body is as expected');
        done();
        return true;
      })
      .reply(200);

    // Receive a webhook event

    await probot.receive({ name: 'issues', payload });
  });
});

// For more information about testing with Nock see:
// https://github.com/nock/nock
