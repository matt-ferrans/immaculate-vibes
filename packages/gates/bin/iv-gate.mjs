#!/usr/bin/env node
// iv-gate — the Immaculate Vibes gate runner.
//
// One CLI entry point for every IV gate. Scaffolded shims (pre-commit
// hooks, CI workflow steps) call `npx iv-gate <name>` so the gate logic
// lives in this versioned package, not duplicated in each consumer repo.
//
// Usage:
//   iv-gate <name> [--json]
//   iv-gate --list
//
// Exit codes: 0 = gate clean, 1 = findings, 2 = usage error.
//
// Phase 1 ships one real gate (doc-paths) plus the runner + config loader.
// Remaining gates (smell, prompt-injection, changelog, coverage-exclude,
// routes-check, coderabbit) land in later slices behind this same CLI.

import { findProjectRoot, loadConfig } from "../lib/config.mjs";
import { runDocPaths } from "../lib/doc-paths.mjs";
import { runPromptInjection } from "../lib/prompt-injection.mjs";
import { runChangelog } from "../lib/changelog.mjs";
import { runRoutes } from "../lib/routes.mjs";
import { runCoverageExclude } from "../lib/coverage-exclude.mjs";
import { runBannedPatterns } from "../lib/banned-patterns.mjs";

// Registry of available gates. Each entry: { run, render }.
//   run(ctx)    → result object with an `ok` boolean.
//   render(r)   → prints human output; returns nothing.
const GATES = {
  "doc-paths": {
    run: ({ root, config }) => runDocPaths({ root, config: config.docPaths ?? {} }),
    render: (r) => {
      if (r.missingDocs.length > 0) {
        console.warn(`note: doc(s) not present (skipped): ${r.missingDocs.join(", ")}`);
      }
      if (r.ok) {
        console.log(`✓ All path references in ${r.targets.join(", ")} resolve.`);
        return;
      }
      console.error(
        `\n✗ ${r.findings.length} path reference(s) in docs point at files that no longer exist:\n`,
      );
      for (const f of r.findings) {
        console.error(`  ${f.doc}: \`${f.token}\` (resolved to ${f.resolved})`);
      }
      console.error(
        "\nEither restore the file, update the doc, or add the token to the docPaths.allowlist in iv.config with a one-line reason.\n",
      );
    },
  },
  "prompt-injection": {
    run: ({ root, config }) =>
      runPromptInjection({ root, config: config.promptInjection ?? {} }),
    render: (r) => {
      if (r.ok) {
        console.log(`prompt-injection: scanned ${r.scanned} files, no matches`);
        return;
      }
      console.error(
        `\nprompt-injection: ${r.findings.length} match(es) found in committed source.\n`,
      );
      for (const f of r.findings) {
        console.error(`  ${f.file}:${f.line}  [${f.pattern}]`);
        console.error(`      ${f.snippet}`);
      }
      console.error(
        "\nThese patterns are tripwires for prompt-injection content arriving through\n" +
          "external review channels. If the match is a real injection attempt, revert it\n" +
          "and notify a human. If it's legitimate prose documenting the attack, move it\n" +
          "under an excluded path or add a narrow allowlist entry in iv.config.\n",
      );
    },
  },
  changelog: {
    run: ({ root, config, flags }) =>
      runChangelog({ root, config: config.changelog ?? {}, sync: flags.includes("--sync") }),
    render: (r) => {
      if (r.mode === "sync") {
        console.log(`changelog: wrote ${r.entries} entries to ${r.out}`);
        return;
      }
      if (r.ok) {
        console.log(`changelog: in sync (${r.entries} entries).`);
        return;
      }
      console.error(
        `\nchangelog: ${r.out} is out of sync with the source changelog.\n` +
          "Run `iv-gate changelog --sync` and commit the result.\n",
      );
    },
  },
  routes: {
    run: ({ root, config, flags }) =>
      runRoutes({ root, config: config.routes ?? {}, sync: flags.includes("--sync") }),
    render: (r) => {
      if (r.mode === "sync") {
        console.log(`routes: wrote ${r.routes} routes to ${r.manifest}`);
        return;
      }
      if (r.ok) {
        console.log(`routes: manifest in sync (${r.routes} routes).`);
        return;
      }
      console.error(
        `\nroutes: ${r.manifest} is out of sync with the app directory.\n` +
          "Run `iv-gate routes --sync` and commit the result.\n",
      );
    },
  },
  "coverage-exclude": {
    run: ({ root, config }) =>
      runCoverageExclude({ root, config: config.coverageExclude ?? {} }),
    render: (r) => {
      if (r.skipped) {
        console.warn(`coverage-exclude: skipped — ${r.reason}`);
        return;
      }
      if (r.ok) {
        console.log(
          r.added.length > 0
            ? `coverage-exclude: ${r.added.length} new exclusion(s); all justified with a TODO comment.`
            : "coverage-exclude: no new exclusions on this branch.",
        );
        return;
      }
      console.error(
        `\ncoverage-exclude: ${r.addedWithoutTodo.length} new exclusion(s) without a TODO comment:\n`,
      );
      for (const t of r.addedWithoutTodo) {
        console.error(`  + ${t}`);
      }
      console.error(
        "\nAdd an inline `// TODO(...): <reason>` comment on the same line, or remove the\n" +
          "exclusion. Excluding source from coverage is policy laundering — if you must do\n" +
          "it, leave the reason in the diff.\n",
      );
    },
  },
  "banned-patterns": {
    run: ({ root, config }) =>
      runBannedPatterns({ root, config: config.bannedPatterns ?? {} }),
    render: (r) => {
      if (r.ok) {
        console.log(`banned-patterns: scanned ${r.scanned} files, no findings`);
        return;
      }
      console.error(`\nbanned-patterns: ${r.findings.length} finding(s):\n`);
      for (const f of r.findings) {
        console.error(`  ${f.file}:${f.line}  ${f.detail}`);
      }
      console.error(
        "\nThese are 'silent compromise' patterns the house rules forbid: empty catch\n" +
          "blocks, error-swallowing returns, sentinel name fallbacks, and TODO markers\n" +
          "without a tracked ref. Fix the file rather than the regex.\n",
      );
    },
  },
};

function usage(stream = console.error) {
  stream(`iv-gate — run an Immaculate Vibes gate

Usage:
  iv-gate <name> [--json] [gate-specific flags]
  iv-gate changelog [--sync]   # --sync rewrites the mirror; default checks it
  iv-gate --list

Available gates:
${Object.keys(GATES)
  .map((n) => `  - ${n}`)
  .join("\n")}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    usage(console.log);
    process.exit(args.length === 0 ? 2 : 0);
  }

  if (args.includes("--list")) {
    for (const name of Object.keys(GATES)) {
      console.log(name);
    }
    process.exit(0);
  }

  const name = args[0];
  const asJson = args.includes("--json");
  const gate = GATES[name];

  if (!gate) {
    console.error(`iv-gate: unknown gate "${name}"\n`);
    usage();
    process.exit(2);
  }

  const root = findProjectRoot();
  const config = await loadConfig(root);
  // Pass remaining args (minus the gate name and --json) as flags so gates
  // like `changelog` can read mode switches such as --sync.
  const flags = args.slice(1).filter((a) => a !== "--json");
  const result = gate.run({ root, config, flags });

  if (asJson) {
    console.log(JSON.stringify({ gate: name, ...result }, null, 2));
  } else {
    gate.render(result);
  }

  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(`iv-gate: ${err?.stack ?? err}`);
  process.exit(2);
});
