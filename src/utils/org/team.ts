/* eslint-disable no-console */

import { TeamsListResponseItem } from '@octokit/rest';
import { difference } from 'lodash';
import { GitHubAPI } from 'probot/lib/github';
import OwnerAcl from '../../models/acl/owner';
import { IFile } from '../../types';
import UserInputError from '../errors/user-input-error';

async function syncAclWithTeam(
  github: GitHubAPI,
  org: string,
  repo: string,
  aclFile: IFile<OwnerAcl>,
  members: string[],
  teams: Pick<TeamsListResponseItem, 'id' | 'name'>[],
): Promise<void> {
  const { content: acl } = aclFile;
  // Link to this ACL (github "view source" page) in markdown, for later use
  const mdAclLink = `[\`./acl/${aclFile.name}\`](https://github.com/${org}/${repo}/blob/master/acl/${aclFile.name})`;
  if (!acl.team) return; // no team specified, nothing to sync

  // Get the team name, as specified in the ACL file
  const teamName: string =
    typeof acl.team === 'string' ? acl.team : acl.team.owners;

  // If a "proxy team" is listed (i.e., to be used with pull panda) get that too
  const proxyTeamName = typeof acl.team === 'string' ? null : acl.team.proxy;

  // Given the team mentioned in the ACL, find the matching (by mname) team record in this org
  const teamMatch = teams.find(
    t => t.name.toLowerCase() === teamName.toLowerCase(),
  );
  // Present an error (via GH comment in the PR) if we can't find a matching team
  if (!teamMatch)
    throw new UserInputError(`No team ${teamName} was found in org ${org}.
Please check [${org}'s list of teams](https://github.com/orgs/${org}/teams) and the ${mdAclLink} ACL file`);

  // If a "proxy team" was named in the ACL file, find the corresponding team record
  const proxyTeamMatch:
    | Pick<TeamsListResponseItem, 'id' | 'name'>
    | undefined = proxyTeamName
    ? teams.find(t => t.name.toLowerCase() === proxyTeamName.toLowerCase())
    : undefined;
  console.log(`ACL: ${aclFile.name} - proxy ${proxyTeamName}`);

  // if a proxy team was named in the ACL file, but we can't find it, present an error in the PR
  if (proxyTeamName && !proxyTeamMatch) {
    throw new UserInputError(`No team ${proxyTeamName} was found in org ${org}.
Please check [${org}'s list of teams](https://github.com/orgs/${org}/teams) and the ${mdAclLink} ACL file`);
  }

  // Affirm that the listed team can push to the repo
  const teamRepoUpdatePromises: Promise<any>[] = [
    github.teams.addOrUpdateRepo({
      owner: org,
      repo,
      team_id: teamMatch.id,
      permission: 'push',
    }),
  ];
  if (proxyTeamMatch) {
    // and if a proxy team is part of the picture, ensure that it can push as well
    teamRepoUpdatePromises.push(
      github.teams.addOrUpdateRepo({
        owner: org,
        repo,
        team_id: proxyTeamMatch.id,
        permission: 'push',
      }),
      /**
       * Clean the proxy team of all members, otherwise what's the point
       * of a proxy team?
       */
      github.teams
        .listMembers({ team_id: proxyTeamMatch.id })
        .then(r => r.data.map(m => m.login))
        .then(proxyTeamMembersToRemove =>
          Promise.all(
            proxyTeamMembersToRemove.map(username =>
              github.teams.removeMembership({
                team_id: proxyTeamMatch.id,
                username,
              }),
            ),
          ),
        ),
    );
  }
  /**
   * Run the previous few steps in parallel, wait until they're done before
   * we proceed. Next steps will involve looking at team membership and we want
   * to ensure everything is settled by that point
   */
  await Promise.all(teamRepoUpdatePromises);
  // Get a list of existing/invited users belonging to the team in question
  const [teamConfirmedMembers, teamInvitedMembers] = await Promise.all([
    github.teams
      .listMembers({
        team_id: teamMatch.id,
      })
      .then(response => response.data.map(m => m.login)),
    github.teams
      .listMembers({
        team_id: teamMatch.id,
      })
      .then(response => response.data.map(m => m.login)),
  ]);
  const teamMembers = teamConfirmedMembers.concat(teamInvitedMembers);

  /**
   * Find any listed ACL owners that are not part of the org. In the future
   * we may want to think about allowing this case, since they can absolutely
   * provide a review approval.
   *
   * However, only those with "push" access to the repo can be sent a
   * "review request". This is a nice part of the workflow, so we'll make it
   * a hard requirement for now
   */
  const aclOwnersNotInOrg = difference(
    acl.owners.map(s => s.toLowerCase()),
    members.map(s => s.toLowerCase()),
  );
  /**
   * Present an error message as a PR comment if any listed ACL owners are
   * found to be missing from the org entirely
   */
  if (aclOwnersNotInOrg.length > 0)
    throw new UserInputError(
      `ACL ${mdAclLink} lists owners that do not belong to the ${org} org.
      
Please compare [the list of ${org}'s members](https://github.com/orgs/${org}/people) and compare to the ACL file's listed \`owners\`.

Non-team-members found on ACL:\n ${aclOwnersNotInOrg
        .map(o => `  - ${o}`)
        .join('\n')}`,
    );
  /**
   * Compare those users listed as ACL owners with members of the team.
   * Find any team members not present in the ACL owners -- they should be removed.
   * Find any ACL owners not present on the team -- they should be added
   */
  const toAdd = difference(acl.owners, teamMembers);
  const toRemove = difference(teamMembers, acl.owners);
  if (!toRemove.length && !toAdd.length) {
    console.log(
      `Team ${org}/${teamName} and ${repo} ACL ${aclFile.name} are already in sync`,
    );
  }
  /**
   * If any users found in the ACL owners need to be added to the respective team,
   * take care of doing that
   */
  if (toAdd.length > 0) {
    console.log(
      `Adding users to team ${org}/${teamName} to sync with ${aclFile.name}`,
      toAdd,
    );
    await Promise.all(
      toAdd.map(username =>
        github.teams.addOrUpdateMembership({
          team_id: teamMatch.id,
          username,
        }),
      ),
    );
  }
  /**
   * If any team members were not found to be ACL owners, remove them from the team now
   */
  if (toRemove.length > 0) {
    console.log(
      `Removing users from team ${org}/${teamName} to sync with ${aclFile.name}`,
      toAdd,
    );
    await Promise.all(
      toRemove.map(username =>
        github.teams.removeMembership({
          team_id: teamMatch.id,
          username,
        }),
      ),
    );
  }
}

/**
 * ACLs may include a GitHub team that should be "synced" to match the listed owners.
 * This is an important part of sending out load-balanced review requests via PullPanda.
 *
 * @param github Github API
 * @param org org name
 * @param repo repo name
 * @param acls list of ACLs to sync
 */
export async function syncAclsWithTeams(
  github: GitHubAPI,
  org: string,
  repo: string,
  acls: IFile<OwnerAcl>[],
): Promise<void> {
  /**
   * This is common work that can be done once and then re-used across
   * each ACL's "sync" task
   */
  const [{ data: orgMembers }, { data: teamList }] = await Promise.all([
    github.orgs.listMembers({
      org,
    }),
    github.teams.list({
      org,
    }),
  ]);
  await Promise.all(
    acls.map(acl =>
      syncAclWithTeam(
        github,
        org,
        repo,
        acl,
        orgMembers.map(m => m.login),
        teamList,
      ),
    ),
  );
}
