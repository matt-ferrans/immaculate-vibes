#!/usr/bin/env node
// immaculate-vibes — the Immaculate Vibes scaffolder CLI.
//
// `immaculate-vibes init` stamps the files that must physically live in a
// repo (config + thin shims that call @iv/* packages). Designed to be safe
// to re-run: existing files are skipped unless --force.
//
// Usage:
//   immaculate-vibes init [--dry-run] [--force] [--tier core,recommended]
//   immaculate-vibes --help
//
// Exit codes: 0 = ok, 2 = usage error.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { init } from "../lib/init.mjs";

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
  stream(`immaculate-vibes — scaffold the Immaculate Vibes guardrail files

Usage:
  immaculate-vibes init [options]

Options:
  --dry-run            show what would be written, change nothing
  --force              overwrite existing files (default: skip them)
  --tier <list>        comma-separated tiers (default: core,recommended)
                       tiers: core, recommended, optional
  --help, -h           show this help

What it stamps:
  iv.config.mjs            project config (every gate reads its slice)
  .pre-commit-config.yaml  hooks that call \`npx iv-gate <name>\`
`);
}

function parseArgs(argv) {
  const flags = { dryRun: false, force: false, tiers: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") flags.dryRun = true;
    else if (a === "--force") flags.force = true;
    else if (a === "--tier") {
      flags.tiers = (argv[++i] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return flags;
}

function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    usage();
    process.exit(argv.length === 0 ? 2 : 0);
  }

  const command = argv[0];
  if (command !== "init") {
    console.error(`immaculate-vibes: unknown command "${command}"\n`);
    usage(console.error);
    process.exit(2);
  }

  const flags = parseArgs(argv.slice(1));
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
  if (!flags.dryRun && created.length > 0) {
    console.log(
      "\nNext: `npm i -D @iv/gates`, edit iv.config.mjs, then `pre-commit install`.",
    );
  }

  process.exit(0);
}

main();
