// IV gate: banned-patterns.
//
// Surfaces the "silent compromise" anti-patterns the Anser-Portal house
// rules forbid — the ones that don't show up in eslint or jscpd. This is
// the pure, dependency-free core of Anser's smell system (the rest of
// which shells out to jscpd/knip/eslint and lands in a later phase).
//
// Lifted from Anser-Portal's scripts/dev/smell/banned-patterns.ts. The
// detection logic is unchanged; the source globs are config.
//
// Categories matched:
//   1. Empty catch blocks (code only)
//   2. `catch { return []; }` and friends — parse-failure swallow (code only)
//   3. Sentinel fallback ("Unknown", "(unset)", "N/A", "TBD") in value
//      position on a name-ish field (code only)
//   4. Un-accountable TODO/FIXME/XXX/HACK markers (anywhere, comments incl.)
//
// Precision is deliberate: a sentinel is only flagged in *value position*
// (a fallback/assignment/return, not a comparison) and only when the line
// carries a name-ish identifier; comments are stripped for the code
// patterns. Accountable markers carrying a `(ref)` scope pass.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const BANNED_PATTERNS_DEFAULTS = {
  // Directories scanned (git-tracked *.ts/*.tsx within these).
  sourceGlobs: ["src"],
};

const CODE_PATTERNS = [
  {
    regex: /catch\s*\([^)]*\)\s*\{\s*\}/,
    detail: "empty catch block swallows errors",
    weight: 4,
  },
  {
    regex: /catch\s*\([^)]*\)\s*\{\s*return\s*(\[\]|null|undefined|""|''|\{\})\s*;?\s*\}/,
    detail: "catch returns empty value, silently dropping the error",
    weight: 4,
  },
];

// Marker form regardless of scope content (bare `:` or any `(…):`).
const TODO_MARKER_RE = /\b(?:TODO|FIXME|XXX|HACK)(?::|\([^)]*\):)/;
// Accountable: at least one non-whitespace char inside the parens.
const TODO_ACCOUNTABLE_RE = /\b(?:TODO|FIXME|XXX|HACK)\(\s*[^)\s][^)]*\):/;

// Sentinel in value position: fallback (`??`/`||`), assignment/object value
// (`:`/`=`, not a comparison), arrow return, or explicit `return`.
const SENTINEL_VALUE_RE =
  /(?:\?\?|\|\||(?<![=!<>])[:=]|=>|\breturn\b)\s*["'](?:Unknown|\(unset\)|N\/A|TBD)["']/i;
const NAME_CONTEXT_RE = /\b(?:[A-Za-z]*[Nn]ame|title|label)\b/;

function isCommentLine(trimmed) {
  return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
}

function stripLineComment(line) {
  return line.replace(/\/\/.*$/, "");
}

function listSourceFiles(root, sourceGlobs) {
  // `:(glob)` pathspec magic so `**` matches zero-or-more directories —
  // i.e. files directly under a source root (src/foo.ts) are included, not
  // just nested ones (src/lib/foo.ts). Anser's original scanner used a
  // bare `src/**/*.ts` glob, which silently skips top-level files; that
  // worked only because Anser keeps no .ts at src/ root. A reusable gate
  // must not have that blind spot, so this is a deliberate, strictly-more
  // -inclusive deviation from the verbatim lift. Result on Anser is
  // unchanged (still 0 findings).
  const args = [
    "ls-files",
    ...sourceGlobs.flatMap((g) => [`:(glob)${g}/**/*.ts`, `:(glob)${g}/**/*.tsx`]),
  ];
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    throw new Error(
      `iv-gate banned-patterns: \`git ls-files\` failed (status ${r.status}). ` +
        "This gate must run inside a git repository.",
    );
  }
  return r.stdout
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter(
      (s) => !s.includes("__tests__/") && !s.endsWith(".test.ts") && !s.endsWith(".test.tsx"),
    );
}

/**
 * Run the banned-patterns gate.
 *
 * @param {object} opts
 * @param {string} opts.root - project root (git repo).
 * @param {object} [opts.config] - the `bannedPatterns` config block.
 * @returns {{ ok: boolean, findings: Array<{file,line,detail,weight}>, scanned: number }}
 */
export function runBannedPatterns({ root, config = {} }) {
  const sourceGlobs = config.sourceGlobs ?? BANNED_PATTERNS_DEFAULTS.sourceGlobs;
  const files = listSourceFiles(root, sourceGlobs);
  const findings = [];

  for (const rel of files) {
    let content;
    try {
      content = readFileSync(`${root}/${rel}`, "utf8");
    } catch (err) {
      // Surface read failures rather than silently skipping — that's the
      // exact "silent compromise" this gate polices. Continue so one bad
      // file doesn't abort the scan.
      console.warn(`[banned-patterns] failed to read ${rel}; skipping:`, err);
      continue;
    }
    content.split("\n").forEach((line, idx) => {
      const push = (detail, weight) =>
        findings.push({ file: rel, line: idx + 1, detail, weight });

      const isMarker = TODO_MARKER_RE.test(line) || TODO_ACCOUNTABLE_RE.test(line);
      if (isMarker) {
        if (!TODO_ACCOUNTABLE_RE.test(line)) {
          push("un-accountable TODO marker — add a ticket ref, e.g. TODO(REF): …", 1);
        }
        return;
      }

      if (isCommentLine(line.trimStart())) return;
      const code = stripLineComment(line);

      for (const p of CODE_PATTERNS) {
        if (p.regex.test(code)) {
          push(p.detail, p.weight);
          return;
        }
      }

      if (NAME_CONTEXT_RE.test(code) && SENTINEL_VALUE_RE.test(code)) {
        push("sentinel placeholder string — house rules forbid these for required fields", 2);
      }
    });
  }

  return { ok: findings.length === 0, findings, scanned: files.length };
}

export default runBannedPatterns;
