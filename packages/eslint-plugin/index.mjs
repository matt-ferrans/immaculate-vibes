// @iv/eslint-plugin — project-local test-quality rules.
//
// Lifted from Anser-Portal's eslint-rules/ (plugin name "anser-test").
// Each rule encodes a test antipattern the source project was actively
// bitten by; see docs/testing-obligations.md for the full rationale and
// the migration notes for grandfathered offenders.
//
// The rules are exposed under the plugin name "iv", so a consuming flat
// config references them as `iv/no-session-mock-in-actions`, etc.

import noSessionMockInActions from "./rules/no-session-mock-in-actions.mjs";
import noMockOnlyAssertions from "./rules/no-mock-only-assertions.mjs";
import noNavOnlyE2e from "./rules/no-nav-only-e2e.mjs";

export default {
  meta: { name: "iv", version: "0.0.0" },
  rules: {
    "no-session-mock-in-actions": noSessionMockInActions,
    "no-mock-only-assertions": noMockOnlyAssertions,
    "no-nav-only-e2e": noNavOnlyE2e,
  },
};
