#!/usr/bin/env node
// immaculate-vibes — the Immaculate Vibes scaffolder CLI.
//
// Commands:
//   init    stamp the files that must physically live in a repo (config +
//           thin shims that call @iv/* packages). Safe to re-run.
//   doctor  report drift between the installed templates and what's on disk
//           (read-only). Non-zero exit when anything needs attention — so it
//           works as a CI check.
//   sync    re-emit drifted templates after `npm update @iv/*`, without
//           clobbering files the consumer hand-edited (unless --force).
//
// Exit codes: 0 = ok, 1 = doctor found drift, 2 = usage error.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { init } from "../lib/init.mjs";
import { diagnose, sync } from "../lib/sync.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

function version() {
  try {
    const pkg = JSON.parse(readFileSync(join(HERE, "..", "package.json"), "utf8"));
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function usage(stream = console.log) {
  stream(`immaculate-vibes — scaffold + maintain the Immaculate Vibes guardrail files

Usage:
  immaculate-vibes init    [--dry-run] [--force] [--tier core,recommended]
  immaculate-vibes doctor  [--json]
  immaculate-vibes sync    [--dry-run] [--force]

Commands:
  init     stamp config + hook/CI/agent shims into this repo (safe to re-run)
  doctor   report template drift (read-only); exits 1 if anything needs action
  sync     re-emit outdated/missing templates; --force also rewrites
           locally-modified files

Options:
  --dry-run   show what would change, write nothing
  --force     init: overwrite existing files; sync: also overwrite local edits
  --tier      comma-separated tiers (init only): core, recommended, optional
  --json      doctor only: machine-readable output
  --help, -h  show this help`);
}

function parseFlags(argv) {
  const flags = { dryRun: false, force: false, json: false, tiers: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") flags.dryRun = true;
    else if (a === "--force") flags.force = true;
    else if (a === "--json") flags.json = true;
    else if (a === "--tier") {
      flags.tiers = (argv[++i] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return flags;
}

function runInit(flags) {
  const root = process.cwd();
  const { actions } = init({ root, version: version(), ...flags });
  const verb = flags.dryRun ? "Would scaffold" : "Scaffolded";
  console.log(`${verb} Immaculate Vibes into ${root}:\n`);
  for (const a of actions) {
    console.log(`  ${a.action.padEnd(18)} ${a.dest}  (${a.tier})`);
  }
  const created = actions.filter((a) => a.action === "created" || a.action === "overwritten");
  const skippedExists = actions.filter((a) => a.action === "skipped (exists)");
  console.log(
    `\n${created.length} file(s) ${flags.dryRun ? "to write" : "written"}, ` +
      `${skippedExists.length} left untouched.`,
  );
  if (skippedExists.length > 0 && !flags.force) {
    console.log("Re-run with --force to overwrite the untouched files.");
  }
  return 0;
}

function runDoctor(flags) {
  const root = process.cwd();
  const result = diagnose({ root, version: version() });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
  }

  if (!result.manifestPresent) {
    if (!flags.json) {
      console.log("immaculate-vibes doctor: no .iv/manifest.json found.");
      console.log("Run `immaculate-vibes init` to scaffold this repo first.");
    }
    return 1;
  }

  const needsAttention = result.files.filter((f) => f.status !== "ok");
  if (!flags.json) {
    console.log("immaculate-vibes doctor:\n");
    for (const f of result.files) {
      console.log(`  ${f.status.padEnd(18)} ${f.dest}`);
    }
    if (needsAttention.length === 0) {
      console.log("\nAll managed files are current. ✓");
    } else {
      const outdated = needsAttention.filter(
        (f) => f.status === "outdated" || f.status === "missing",
      );
      const local = needsAttention.filter((f) => f.status === "locally-modified");
      const untracked = needsAttention.filter((f) => f.status === "untracked");
      console.log("");
      if (outdated.length > 0) {
        console.log(
          `${outdated.length} file(s) outdated/missing — run \`immaculate-vibes sync\` to update.`,
        );
      }
      if (local.length > 0) {
        console.log(
          `${local.length} file(s) locally modified — review, then \`sync --force\` to overwrite if intended.`,
        );
      }
      if (untracked.length > 0) {
        console.log(`${untracked.length} file(s) present but not IV-managed (informational).`);
      }
    }
  }
  // "untracked" alone is informational, not a failure; anything else is.
  const actionable = needsAttention.filter((f) => f.status !== "untracked");
  return actionable.length > 0 ? 1 : 0;
}

function runSync(flags) {
  const root = process.cwd();
  const { manifestPresent, actions } = sync({ root, version: version(), ...flags });
  if (!manifestPresent) {
    console.log("immaculate-vibes sync: no .iv/manifest.json found.");
    console.log("Run `immaculate-vibes init` first.");
    return 1;
  }
  const verb = flags.dryRun ? "Would sync" : "Synced";
  console.log(`${verb} Immaculate Vibes templates in ${root}:\n`);
  for (const a of actions) {
    console.log(`  ${a.action.padEnd(22)} ${a.dest}  [${a.status}]`);
  }
  const changed = actions.filter((a) => a.action !== "left as-is");
  console.log(`\n${changed.length} file(s) ${flags.dryRun ? "would change" : "changed"}.`);
  const skippedLocal = actions.filter(
    (a) => a.status === "locally-modified" && a.action === "left as-is",
  );
  if (skippedLocal.length > 0 && !flags.force) {
    console.log(
      `${skippedLocal.length} locally-modified file(s) left untouched — \`sync --force\` to overwrite.`,
    );
  }
  return 0;
}

function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    usage();
    process.exit(argv.length === 0 ? 2 : 0);
  }

  const command = argv[0];
  const flags = parseFlags(argv.slice(1));

  let code;
  switch (command) {
    case "init":
      code = runInit(flags);
      break;
    case "doctor":
      code = runDoctor(flags);
      break;
    case "sync":
      code = runSync(flags);
      break;
    default:
      console.error(`immaculate-vibes: unknown command "${command}"\n`);
      usage(console.error);
      code = 2;
  }
  process.exit(code);
}

main();
