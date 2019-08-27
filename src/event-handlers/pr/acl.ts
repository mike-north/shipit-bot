import { Context } from 'probot';
import Webhooks = require('@octokit/webhooks');
import {
  getAclsForRepo,
  getAclShipitStatusForCommits,
} from '../../utils/repo/acl';
import { getCommitHistoryForPullRequest } from '../../utils/repo/pull-request';
import { getFileChangesForCommits } from '../../utils/repo/commits';
import { getReviewsForPullRequest } from '../../utils/reviews';

export async function updateAclStatus(
  context: Context<Webhooks.WebhookPayloadPullRequest>,
) {
  const {
    github,
    payload: { pull_request },
  } = context;
  const repoData = context.repo();
  const { owner, repo } = repoData;
  // Get the ACLs pertaining to this repo
  const pAcls = getAclsForRepo(github, owner, repo);
  const pReviews = getReviewsForPullRequest(
    github,
    owner,
    repo,
    pull_request.number,
  );
  // Get the list of commit SHAs included with this PR
  const pCommits = getCommitHistoryForPullRequest(
    github,
    owner,
    repo,
    pull_request.number,
  );

  // For our list of commits, obtain data around which files were changed
  const pCommitData = getFileChangesForCommits(
    github,
    owner,
    repo,
    await pCommits,
  );
  console.log('getting ship-it statuese');
  const shipitStatus = await getAclShipitStatusForCommits(
    await pAcls,
    await pCommitData,
    await pReviews,
  );
  console.log(JSON.stringify(shipitStatus, null, '  '));
}

// async function forceOverrides(
//   context: Context<Webhooks.WebhookPayloadPullRequest>
// ) {
//   const {
//     pull_request: {
//       head: { sha: headSha }
//     }
//   } = context.payload;
//   const checks = await context.github.checks.listForRef(
//     context.repo({
//       ref: headSha
//     })
//   );
//   await Promise.all(
//     checks.data.check_runs.map(async run => {
//       context.github.checks.update(
//         context.repo({
//           check_run_id: run.id,
//           conclusion: "neutral",
//           status: "completed",
//           output: {
//             title: "OVERRIDE from @mike-north",
//             summary: "OVERRIDE from @mike-north"
//           }
//         })
//       );
//     })
//   );
// }

// export async function maybeApplyOverride(
//   context: Context<Webhooks.WebhookPayloadPullRequest>
// ) {
//   if (context.payload.pull_request.body.indexOf("ACLOVERRIDE") >= 0) {
//     await forceOverrides(context);
//   }
// }

//   const issueComment = context.issue({
//     body: "Thanks for editing this PR!"
//   });
//   const startTime = new Date();
//   // Do stuff
//   const {
//     pull_request: {
//       head: { sha: headSha }
//     }
//   } = context.payload;
//   await context.github.checks.create(
//     context.repo({
//       name: "ACL: @mike-north",
//       head_sha: headSha,
//       status: "in_progress",
//       // conclusion: "",
//       details_url:
//         "https://docs.google.com/document/d/18xGWBqRKVTjadN_p2ZvKdXsG0J-Aftrz0jyVu_4Cliw/edit?usp=sharing",
//       // started_at: startTime.toISOString(),
//       // completed_at: new Date().toISOString(),
//       actions: [
//         {
//           label: "Custom Button 1",
//           description: "This is a description 2",
//           identifier: "identi-fier1"
//         },
//         {
//           label: "Custom Button 2",
//           description: "This is a description 2",
//           identifier: "identi-fier2"
//         },
//         {
//           label: "Custom Button 3",
//           description: "This is a description 3",
//           identifier: "identi-fier3"
//         }
//       ],
//       output: {
//         title: "ACL - platform owners",
//         summary: `## The check has passed!
// Here's some other awesome information
// * one
// * two
// * three
// `
//       }
//     })
//   );
