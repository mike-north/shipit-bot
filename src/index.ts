import { Application } from "probot"; // eslint-disable-line no-unused-vars
import { updateAclStatus } from "./event-handlers/pr/acl";
import { debounce } from "./utils/debounce";

const STANDARD_DEBOUNCE = 1000; // ms

export = (app: Application) => {
  app.on(`*`, async context => {
    context.log({ event: context.event, action: context.payload.action });
  });

  app.on(
    ["pull_request", "pull_request.edited"],
    debounce(updateAclStatus, STANDARD_DEBOUNCE)
  );
};
