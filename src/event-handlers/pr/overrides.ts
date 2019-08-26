interface IOverrideDescription {
  title: string;
}

type OVERRIDES =
  | "APPSTORERELEASEOVERRIDE"
  | "ACL_OVERRIDE_HASH"
  | "ACLOVERRIDE"
  | "DIFF_VERIFY_OVERRIDE"
  | "PCLOVERRIDE"
  | "PCVALIDATIONOVERRIDE"
  | "TRUNKBLOCKERFIX"
  | "EOLVALIDATIONOVERRIDE"
  | "CHERRYPICKOVERRIDE"
  | "NOAUTOREVERT";

const OVERRIDE_DESCRIPTIONS: { [K in OVERRIDES]: IOverrideDescription } = {
  APPSTORERELEASEOVERRIDE: {
    title:
      "Build and release Android multiproduct for all supported app stores. Only applicable during monthly release of Android multiproduct to the app store."
  },
  ACL_OVERRIDE_HASH: {
    title: "Overrides the source code ACL check without notifications."
  },
  ACLOVERRIDE: {
    title:
      "ACLOVERRIDE prevents your changes and the associated RB from being checked against the ACL server."
  },
  DIFF_VERIFY_OVERRIDE: {
    title:
      "DIFF_VERIFY_OVERRIDE skips the enforcement described in [Code Review SOC 2 Compliance](https://iwww.corp.linkedin.com/wiki/cf/display/TOOLS/Code+Review+SOC+2+Compliance) / [Code Review SOC 2 Compliance Dashboard.](https://iwww.corp.linkedin.com/wiki/cf/display/TOOLS/Code+Review+SOC+2+Compliance+Dashboard)"
  },
  PCLOVERRIDE: {
    title:
      "PCLOVERRIDE modifies the behavior of a single phase of your post-commit testing: dependency testing"
  },
  PCVALIDATIONOVERRIDE: {
    title:
      "PCVALIDATIONOVERRIDE skips all [precommit testing.](https://iwww.corp.linkedin.com/wiki/cf/pages/createpage.action?spaceKey=TOOLS&title=Precommit+Multiproduct+Support&linkCreation=true&fromPageId=47808817)"
  },
  TRUNKBLOCKERFIX: {
    title: "If the product's trunk is locked, this allows the commit in."
  },
  EOLVALIDATIONOVERRIDE: {
    title:
      "This override skips the EOL check in the mint validation in the precommit testing. See http://go/repeatable-build."
  },
  CHERRYPICKOVERRIDE: {
    title: "Commit to a hotfix branch without first having committed to trunk."
  },
  NOAUTOREVERT: {
    title: "Avoids auto revert when the build fails, useful for edge cases."
  }
};

function createOverrideDescriptionComment(
  sha: string,
  override: OVERRIDES
): string {
  return `Commit \`${sha}\` trigged a ${override}, which does the following:
> ${OVERRIDE_DESCRIPTIONS[override].title}

  `;
}
