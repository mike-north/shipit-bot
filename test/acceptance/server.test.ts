import nock from 'nock';
import { Probot } from 'probot';

// Requiring our app implementation
import myProbotApp from '../../src/server';

// Requiring our fixtures
import payload from './fixtures/issues.opened.json';

const issueCreatedBody = { body: 'Thanks for opening this issue!' };

QUnit.module('My Probot app', hooks => {
  let probot: Probot;
  let n!: nock.Scope;
  hooks.beforeEach(() => {
    nock.disableNetConnect();
    n = nock('https://api.github.com');
  });
  hooks.afterEach(assert => {
    nock.enableNetConnect();
    assert.deepEqual(n.pendingMocks(), [], 'Nock is done');
    nock.cleanAll();
  });
  hooks.beforeEach(() => {
    probot = new Probot({ id: 123, cert: 'test' });
    // Load our app into probot
    const app = probot.load(myProbotApp);

    // just return a test token
    app.app.getSignedJsonWebToken = (): string => 'test';
  });
});

// For more information about testing with Nock see:
// https://github.com/nock/nock
