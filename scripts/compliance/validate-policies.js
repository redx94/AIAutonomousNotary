const loadConfig = require("../../overlay/config/loadConfig");
const PolicyEngine = require("../../overlay/policy/PolicyEngine");

function main() {
  const config = loadConfig();
  const policyEngine = new PolicyEngine({ config });
  const policySet = policyEngine.validatePolicySet();
  console.log(
    JSON.stringify(
      {
        policyVersion: policySet.policyVersion,
        ruleCount: policySet.rules.length,
        publicationModes: [...new Set(policySet.rules.flatMap((rule) => rule.publicationModes))],
      },
      null,
      2
    )
  );
}

main();
