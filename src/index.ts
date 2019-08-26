import { Application } from "probot"; // eslint-disable-line no-unused-vars
import { updateAclStatus } from "./event-handlers/pr/acl";
import { debounce } from "./utils/debounce";

export = (app: Application) => {
  app.on(`*`, async context => {
    context.log({ event: context.event, action: context.payload.action });
  });

  app.on(
    ["pull_request", "pull_request.edited"],
    debounce(updateAclStatus, 100)
  );
};
