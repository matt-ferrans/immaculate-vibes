// IV gate: coverage-exclude.
//
// Fails if a coverage-config's `exclude` list grew (vs a git base ref)
// without an inline TODO comment justifying each added entry. Coverage
// exclusions are the easiest "make CI green" lever someone reaches for
// when a file is hard to test; requiring a tracked comment keeps the
// reason in the diff for future reviewers.
//
// Lifted from Anser-Portal's scripts/dev/check-coverage-exclude-diff.ts.
// Logic unchanged; the config path, base/head refs, and TODO pattern are
// config (defaulting to Anser's values + env BASE_REF/HEAD_REF).

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const COVERAGE_EXCLUDE_DEFAULTS = {
  // Config file whose coverage.exclude block we diff.
  configPath: "vitest.config.ts",
  // Git ref to diff against (env BASE_REF wins, then this, then origin/main).
  baseRef: "origin/main",
  // Source string a justifying comment must contain (case-sensitive).
  todoMarker: "TODO",
};

function git(args, cwd) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) {
    return null;
  }
  return r.stdout;
}

// Extract everything inside the coverage `exclude: [ ... ]` block. No TS
// parser needed — the format is quoted strings one per line with optional
// inline comments; a regex over the block stays robust against refactors.
function parseExcludeBlock(source) {
  const m = /coverage:\s*\{[\s\S]*?exclude:\s*\[([\s\S]*?)\]/m.exec(source);
  if (!m) return [];
  return m[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function entries(lines, todoMarker) {
  const out = [];
  const todoRe = new RegExp(`//.*${todoMarker}`);
  for (const line of lines) {
    const stringMatch = /"([^"]+)"|'([^']+)'/.exec(line);
    if (!stringMatch) continue;
    out.push({
      token: (stringMatch[1] ?? stringMatch[2]).trim(),
      hasTodo: todoRe.test(line),
    });
  }
  return out;
}

/**
 * Run the coverage-exclude gate.
 *
 * @param {object} opts
 * @param {string} opts.root - project root (git repo).
 * @param {object} [opts.config] - the `coverageExclude` config block.
 * @returns {{ ok: boolean, skipped?: boolean, reason?: string, added: string[], addedWithoutTodo: string[] }}
 */
export function runCoverageExclude({ root, config = {} }) {
  const configPath = config.configPath ?? COVERAGE_EXCLUDE_DEFAULTS.configPath;
  const baseRef =
    process.env.BASE_REF ?? config.baseRef ?? COVERAGE_EXCLUDE_DEFAULTS.baseRef;
  const todoMarker = config.todoMarker ?? COVERAGE_EXCLUDE_DEFAULTS.todoMarker;

  const headFull = join(root, configPath);
  if (!existsSync(headFull)) {
    return { ok: true, skipped: true, reason: `${configPath} not found`, added: [], addedWithoutTodo: [] };
  }
  const head = readFileSync(headFull, "utf8");

  const base = git(["show", `${baseRef}:${configPath}`], root);
  if (base === null) {
    // Base ref not reachable (common in shallow local clones). Skip rather
    // than fail — CI fetches the base; this gate is a diff gate, not a
    // standalone one.
    return {
      ok: true,
      skipped: true,
      reason: `could not read ${baseRef}:${configPath} — set BASE_REF or fetch the base branch`,
      added: [],
      addedWithoutTodo: [],
    };
  }

  const baseTokens = new Set(entries(parseExcludeBlock(base), todoMarker).map((e) => e.token));
  const headEntries = entries(parseExcludeBlock(head), todoMarker);
  const added = headEntries.filter((e) => !baseTokens.has(e.token));
  const addedWithoutTodo = added.filter((e) => !e.hasTodo).map((e) => e.token);

  return {
    ok: addedWithoutTodo.length === 0,
    added: added.map((e) => e.token),
    addedWithoutTodo,
  };
}

export default runCoverageExclude;
