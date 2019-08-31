import { Application, Probot } from 'probot'; // eslint-disable-line no-unused-vars
import { updateAclStatus } from './event-handlers/pr/acl';
import { debounce } from './utils/debounce';
import { ApplicationFunction } from 'probot';
import * as dotenv from 'dotenv';
dotenv.config();

const STANDARD_DEBOUNCE = 1000; // ms

process.stdout.write('STARTING UP SHIPIT BOT\n\n\n');

module.exports = (app: Application): void => {
  console.log('Setting up');
  app.on(`*`, async context => {
    context.log.error('EVENT: ', context.event);
    context.log({ event: context.event, action: context.payload.action });
  });

  app.on(
    ['pull_request', 'pull_request.edited'],
    debounce(updateAclStatus, STANDARD_DEBOUNCE),
  );
};
