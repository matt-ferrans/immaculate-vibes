// IV gate: doc-paths.
//
// Verifies that every backtick-quoted file/directory path in a project's
// agent/docs files actually exists in the working tree. Catches the
// "doc references a file we deleted six months ago" failure mode that
// quietly poisons the context window of every agent reading the file.
//
// Lifted from Anser-Portal's scripts/dev/check-doc-paths.ts. The logic is
// unchanged; the four project-specific lists (targets, allowlist, known
// prefixes, root files) are now config, defaulting to Anser's values so
// the behavior is identical out of the box.
//
// Heuristic: a backtick-quoted token containing `/` or matching a known
// root-level file is a path candidate. URLs, npm scripts (`db:migrate`),
// env vars (`DATABASE_URL`), and bare identifiers are ignored. False
// positives go in the allowlist with a one-line reason.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Default configuration — mirrors Anser-Portal's check-doc-paths.ts so a
 * consumer that provides no `docPaths` config gets identical behavior.
 * Override any field via `iv.config`'s `docPaths` key.
 */
export const DOC_PATHS_DEFAULTS = {
  // Files we mine for path references.
  targets: ["CLAUDE.md", "AGENTS.md", "docs/testing-obligations.md"],
  // Tokens that look like paths but aren't (false positives).
  allowlist: [
    // Glob with a mid-token wildcard for the real settings.json /
    // settings.local.json family. staticPrefix() truncates at the `*` to
    // `.claude/settings`, which isn't a real path — but `.claude/settings.json`
    // does exist.
    ".claude/settings*.json",
  ],
  // Top-level directories whose contents we audit. A path reference must
  // start with one of these (or be a known root-level file) to be checked —
  // keeps the rule tight enough that URL routes, example commands, and regex
  // snippets don't trigger false positives.
  knownPrefixes: [
    "src/",
    "e2e/",
    "scripts/",
    "docs/",
    "drizzle/",
    "public/",
    ".github/",
    ".claude/",
    "eslint-rules/",
    "node_modules/",
  ],
  // Root-level files that are valid path references even without a slash.
  rootFiles: [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "vitest.config.ts",
    "playwright.config.ts",
    "next.config.ts",
    "eslint.config.mjs",
    "drizzle.config.ts",
    "CHANGELOG.md",
    "README.md",
    "CLAUDE.md",
    "AGENTS.md",
    "Dockerfile",
    "railway.json",
    ".dockerignore",
    ".pre-commit-config.yaml",
    ".nvmrc",
    ".node-version",
    ".gitignore",
    ".jscpd.json",
  ],
};

function isPathLike(token, allowlist, knownPrefixes, rootFiles) {
  if (allowlist.has(token)) {
    return false;
  }
  // Quick rejects — anything that's obviously not a filesystem path.
  if (/\s/.test(token)) {
    // Contains whitespace → it's a command example, not a path.
    return false;
  }
  if (/[<>()|&;]/.test(token)) {
    // Shell metacharacters / placeholder syntax.
    return false;
  }
  if (token.startsWith("http://") || token.startsWith("https://")) {
    return false;
  }
  if (token.includes("..") || token.includes("…")) {
    // Truncated/abbreviated examples.
    return false;
  }
  if (knownPrefixes.some((p) => token.startsWith(p))) {
    return true;
  }
  return rootFiles.has(token);
}

// Reduce a token to the longest static prefix we can existence-check.
// Truncates at the first glob wildcard or dynamic segment, so `src/lib/**`
// checks as `src/lib` and `src/app/api/[id]/...` checks as `src/app/api/`.
function staticPrefix(token) {
  let s = token;
  const cuts = [s.indexOf("*"), s.indexOf("["), s.indexOf("?")].filter((i) => i !== -1);
  if (cuts.length > 0) {
    s = s.slice(0, Math.min(...cuts));
  }
  return s.replace(/\/+$/, "").trim();
}

function checkDoc(root, docPath, allowlist, knownPrefixes, rootFiles) {
  const full = join(root, docPath);
  if (!existsSync(full)) {
    return [];
  }
  const text = readFileSync(full, "utf8");

  const findings = [];
  const seen = new Set();

  const re = /`([^`\n]+)`/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const raw = match[1].trim();
    if (!isPathLike(raw, allowlist, knownPrefixes, rootFiles)) {
      continue;
    }
    const checkPath = staticPrefix(raw);
    if (!checkPath || seen.has(checkPath)) {
      continue;
    }
    seen.add(checkPath);
    if (!existsSync(join(root, checkPath))) {
      findings.push({ doc: docPath, token: raw, resolved: checkPath });
    }
  }
  return findings;
}

/**
 * Run the doc-paths gate. Pure with respect to I/O — returns a result the
 * CLI renders and exits on.
 *
 * @param {object} opts
 * @param {string} opts.root - project root to resolve paths against.
 * @param {object} [opts.config] - the `docPaths` config block (merged over defaults).
 * @returns {{ ok: boolean, findings: Array, missingDocs: string[], targets: string[] }}
 */
export function runDocPaths({ root, config = {} }) {
  const targets = config.targets ?? DOC_PATHS_DEFAULTS.targets;
  const allowlist = new Set(config.allowlist ?? DOC_PATHS_DEFAULTS.allowlist);
  const knownPrefixes = config.knownPrefixes ?? DOC_PATHS_DEFAULTS.knownPrefixes;
  const rootFiles = new Set(config.rootFiles ?? DOC_PATHS_DEFAULTS.rootFiles);

  const findings = [];
  const missingDocs = [];

  for (const doc of targets) {
    if (!existsSync(join(root, doc))) {
      missingDocs.push(doc);
      continue;
    }
    findings.push(...checkDoc(root, doc, allowlist, knownPrefixes, rootFiles));
  }

  return { ok: findings.length === 0, findings, missingDocs, targets };
}

export default runDocPaths;
