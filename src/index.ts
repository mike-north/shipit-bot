import { Application } from "probot"; // eslint-disable-line no-unused-vars

export = (app: Application) => {
  app.on(`*`, async context => {
    context.log({ event: context.event, action: context.payload.action });
  });

  app.on("issues.opened", async context => {
    const issueComment = context.issue({
      body: "Thanks for opening this issue!"
    });
    await context.github.issues.createComment(issueComment);
  });
  app.on("issues.reopened", async context => {
    const issueComment = context.issue({
      body: "Thanks for reopening this issue!"
    });
    await context.github.issues.createComment(issueComment);
  });
  app.on("issues.closed", async context => {
    const issueComment = context.issue({
      body: "Thanks for closing this issue!"
    });
    await context.github.issues.createComment(issueComment);
  });
  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
