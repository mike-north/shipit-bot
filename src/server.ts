import { Application, ApplicationFunction } from 'probot'; // eslint-disable-line no-unused-vars
import { updateAclStatus } from './event-handlers/pr/acl';
import { debounce } from './utils/debounce';

const STANDARD_DEBOUNCE = 1000; // ms

process.stdout.write('STARTING UP SHIPIT BOT\n');
const handler = debounce(updateAclStatus, STANDARD_DEBOUNCE);
const entry: ApplicationFunction = (app: Application): void => {
  app.log.info('Setting up');
  // app.on(`*`, async context => {
  //   context.log({ event: context.event, action: context.payload.action });
  // });

  app.on(
    [
      'pull_request',
      'pull_request.edited',
      'pull_request.sync',
      'pull_request_review',
      'issue_comment',
    ],
    async context => {
      context.log({ event: context.event, action: context.payload.action });
      if (context.payload.action === 'review_requested') return;

      await handler(context);
    },
  );
};

export = entry;
