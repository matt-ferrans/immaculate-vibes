// Immaculate Vibes configuration.
//
// Every IV gate reads its slice of this file; anything you omit falls back
// to the gate's built-in default (which mirrors Anser-Portal's values). So
// this generated file is intentionally minimal — uncomment and adjust only
// what your project needs to differ.

export default {
  // node: "24",

  // doc-paths: which docs to mine for backtick path references, and which
  // tokens to allow even though they look like paths.
  // docPaths: {
  //   targets: ["AGENTS.md", "README.md"],
  //   allowlist: [],
  // },

  // prompt-injection: extra excluded paths or custom marker patterns.
  // (Patterns are { name, source, flags } so they survive this file being
  // read as data by tooling.)
  // promptInjection: {
  //   excludedPrefixes: ["node_modules/", "docs/"],
  // },

  // changelog: source + generated mirror paths, and the category set.
  // changelog: {
  //   source: "CHANGELOG.md",
  //   out: "src/lib/changelog-data.ts",
  // },

  // routes: app dir + manifest, plus routes to exclude from coverage.
  // routes: {
  //   appDir: "src/app",
  //   manifest: "e2e/routes.manifest.ts",
  //   exclude: [],
  // },

  // coverage-exclude: config file diffed for new exclusions, and the base ref.
  // coverageExclude: {
  //   configPath: "vitest.config.ts",
  //   baseRef: "origin/main",
  // },

  // banned-patterns: directories scanned for silent-compromise anti-patterns.
  // bannedPatterns: {
  //   sourceGlobs: ["src"],
  // },
};
