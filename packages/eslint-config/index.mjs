// @iv/eslint-config — the framework-agnostic slice of Anser-Portal's
// flat ESLint config, as a composable factory.
//
// What this DOES include (the reusable guardrails):
//   - jsx-a11y promotions to "error" for WCAG 2.1 AA (JSX/TSX scoped)
//   - eslint-plugin-security recommended
//   - sonarjs cognitive-complexity cap on source (off in tests)
//   - complexity / size / maintainability caps on source
//   - no-only-tests in test + e2e files
//   - the @iv/eslint-plugin test-quality rules
//   - eslint-config-prettier last
//
// What this DELIBERATELY does NOT include (app-specific, stays in the
// consumer's eslint.config.mjs):
//   - the eslint-config-next presets (framework choice is the app's)
//   - globalIgnores (path layout is the app's)
//
// Usage in a consuming flat config:
//
//   import { ivConfig } from "@iv/eslint-config";
//   export default [
//     ...nextVitals, ...nextTs,            // app's framework presets
//     ...ivConfig({ src: "src/**/*.{ts,tsx,mts}" }),
//     globalIgnores([...]),                // app's ignores
//   ];
//
// Thresholds mirror Anser-Portal's values and are overridable per option.

import security from "eslint-plugin-security";
import sonarjs from "eslint-plugin-sonarjs";
import noOnlyTests from "eslint-plugin-no-only-tests";
import prettierConfig from "eslint-config-prettier";
import ivPlugin from "@iv/eslint-plugin";

const DEFAULTS = {
  // Glob for production source the complexity/quality caps apply to.
  src: "src/**/*.{ts,tsx,mts}",
  // Globs treated as tests (relaxed limits, test-quality rules).
  tests: ["src/__tests__/**", "**/*.test.{ts,tsx}"],
  // Glob for the unit-test files the no-mock-only-assertions rule covers.
  unitTests: "src/__tests__/**/*.test.{ts,tsx}",
  // Glob for action tests the no-session-mock rule covers.
  actionTests: "src/__tests__/actions/**/*.test.{ts,tsx}",
  // Glob for Playwright e2e specs.
  e2e: "e2e/**/*.spec.ts",
  // Broad e2e glob for relaxed limits.
  e2eDir: "e2e/**",
  complexity: {
    cognitive: 15,
    cyclomatic: 15,
    maxLines: 500,
    maxLinesPerFunction: 75,
    maxParams: 4,
    maxDepth: 3,
    maxNestedCallbacks: 3,
  },
};

export function ivConfig(options = {}) {
  const o = {
    ...DEFAULTS,
    ...options,
    complexity: { ...DEFAULTS.complexity, ...(options.complexity ?? {}) },
  };
  const c = o.complexity;

  return [
    // jsx-a11y is assumed to come from the consumer's framework preset
    // (e.g. eslint-config-next). Tighten the WCAG 2.1 AA subset to error.
    {
      files: ["**/*.{jsx,tsx}"],
      rules: {
        "jsx-a11y/alt-text": "error",
        "jsx-a11y/aria-props": "error",
        "jsx-a11y/aria-role": "error",
        "jsx-a11y/role-has-required-aria-props": "error",
        "jsx-a11y/heading-has-content": "error",
        "jsx-a11y/anchor-is-valid": "error",
        "jsx-a11y/label-has-associated-control": "error",
        "jsx-a11y/no-autofocus": "error",
      },
    },

    // Security static analysis
    {
      plugins: { security },
      rules: {
        ...security.configs.recommended.rules,
      },
    },

    // Cognitive complexity (sonarjs) on source only.
    {
      files: [o.src],
      plugins: { sonarjs },
      rules: {
        "sonarjs/cognitive-complexity": ["error", c.cognitive],
      },
    },
    {
      files: o.tests,
      // Register sonarjs here too: o.tests can include globs outside o.src
      // (e.g. "**/*.test.{ts,tsx}"), and flat config validates even "off"
      // rules, so the plugin must be present for the matching scope.
      plugins: { sonarjs },
      rules: {
        "sonarjs/cognitive-complexity": "off",
      },
    },

    // Complexity / maintainability caps on source.
    {
      files: [o.src],
      rules: {
        complexity: ["error", { max: c.cyclomatic }],
        "max-depth": ["error", { max: c.maxDepth }],
        "max-lines": ["error", { max: c.maxLines, skipBlankLines: true, skipComments: true }],
        "max-lines-per-function": [
          "error",
          { max: c.maxLinesPerFunction, skipBlankLines: true, skipComments: true },
        ],
        "max-params": ["error", { max: c.maxParams }],
        "max-nested-callbacks": ["error", { max: c.maxNestedCallbacks }],
        "no-duplicate-imports": "error",
        "no-else-return": "error",
        "no-unneeded-ternary": "error",
        eqeqeq: ["error", "always"],
        curly: ["error", "all"],
        "no-console": ["error", { allow: ["warn", "error"] }],
      },
    },

    // Relaxed limits in tests + e2e.
    {
      files: [...o.tests, o.e2eDir],
      rules: {
        "max-lines": "off",
        "max-lines-per-function": "off",
        "max-nested-callbacks": "off",
      },
    },

    // Block .only / .skip in committed tests; .fixme stays allowed.
    {
      files: [...o.tests, o.e2eDir],
      plugins: { "no-only-tests": noOnlyTests },
      rules: {
        "no-only-tests/no-only-tests": [
          "error",
          { block: ["test", "it", "describe"], focus: ["only"] },
        ],
      },
    },

    // IV test-quality rules.
    {
      files: [o.actionTests],
      plugins: { iv: ivPlugin },
      rules: {
        "iv/no-session-mock-in-actions": "error",
      },
    },
    {
      files: [o.unitTests],
      plugins: { iv: ivPlugin },
      rules: {
        "iv/no-mock-only-assertions": "error",
      },
    },
    {
      files: [o.e2e],
      plugins: { iv: ivPlugin },
      rules: {
        "iv/no-nav-only-e2e": "error",
      },
    },

    // Prettier last to disable conflicting stylistic rules.
    prettierConfig,
  ];
}

export default ivConfig;
