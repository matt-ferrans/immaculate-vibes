// IV gate: prompt-injection.
//
// Static scan for obvious prompt-injection patterns in tracked source.
// Agents read external content (review comments, PR bodies, issue text,
// user-submitted data that ends up in fixtures/seeds); a single hostile
// string committed to a repo can hijack a downstream agent into
// exfiltrating secrets via tool calls (the April 2026 "Comment and
// Control" disclosure, Guan et al., Johns Hopkins). The instruction layer
// tells agents to treat external content as untrusted — this gate is the
// enforcement layer for the subset we can statically observe: anything
// that lands in `git`.
//
// Lifted from Anser-Portal's scripts/dev/check-prompt-injection.ts. Logic
// unchanged; the pattern list and exclusions are config, defaulting to
// Anser's values.
//
// It is a tripwire for the obvious case, not a content filter — false
// positives are pure friction and a determined attacker can vary wording.

import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Patterns we treat as prompt-injection markers — each a case-insensitive
 * regex with no legitimate reason to exist in committed source. Default
 * set mirrors Anser-Portal; override/extend via `promptInjection.patterns`
 * (each entry `{ name, source, flags }`, since regexes aren't JSON-able).
 */
export const PROMPT_INJECTION_DEFAULT_PATTERNS = [
  { name: "ignore-previous-instructions", regex: /ignore (all )?previous instructions/i },
  { name: "disregard-above", regex: /disregard (the )?(above|previous)/i },
  { name: "you-are-now", regex: /you are now/i },
  // Fake system/assistant-prompt prefix at line start. The `m` flag makes
  // `^` match after every newline; anchoring avoids firing on the bare
  // English word "system:".
  { name: "fake-system-prompt", regex: /^system:/im },
  { name: "fake-assistant-prompt", regex: /^assistant:/im },
  // Llama / Mistral instruction-format markers.
  { name: "llama-inst-open", regex: /\[INST\]/i },
  { name: "llama-inst-close", regex: /\[\/INST\]/i },
];

export const PROMPT_INJECTION_DEFAULTS = {
  // Path prefixes excluded wholesale.
  excludedPrefixes: [
    "node_modules/",
    "e2e/", // test fixtures and snapshots
    "src/__tests__/", // test fixtures
    "docs/", // human-facing prose may quote attack patterns
    ".git/",
  ],
  // File suffixes excluded wholesale.
  excludedSuffixes: [
    ".md", // markdown (incl. CLAUDE.md/AGENTS.md that quote the patterns)
  ],
  // Exact paths excluded (relative to project root).
  excludedExact: ["CHANGELOG.md", "package-lock.json"],
  // Extensions treated as binary (skip to avoid garbage matches).
  binaryExtensions: [
    "png", "jpg", "jpeg", "gif", "webp", "ico", "pdf", "woff", "woff2",
    "ttf", "otf", "eot", "zip", "gz", "tar", "tgz", "wasm", "node",
  ],
};

function resolvePatterns(config) {
  if (!config.patterns) {
    return PROMPT_INJECTION_DEFAULT_PATTERNS;
  }
  // Config patterns arrive as { name, source, flags } so they survive JSON.
  return config.patterns.map((p) =>
    p.regex ? p : { name: p.name, regex: new RegExp(p.source, p.flags ?? "i") },
  );
}

function listTrackedFiles(root) {
  const out = spawnSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (out.status !== 0 || !out.stdout) {
    throw new Error(
      `iv-gate prompt-injection: \`git ls-files\` failed (status ${out.status}). ` +
        "This gate must run inside a git repository.",
    );
  }
  return out.stdout
    .toString("utf8")
    .split("\0")
    .filter((p) => p.length > 0);
}

function isExcluded(path, cfg) {
  if (cfg.excludedExact.has(path)) return true;
  for (const prefix of cfg.excludedPrefixes) {
    if (path.startsWith(prefix)) return true;
  }
  for (const suffix of cfg.excludedSuffixes) {
    if (path.endsWith(suffix)) return true;
  }
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return cfg.binaryExtensions.has(ext);
}

function readSafely(root, path) {
  try {
    const abs = resolve(root, path);
    const st = statSync(abs);
    if (!st.isFile() || st.size === 0 || st.size > 2 * 1024 * 1024) return null;
    const buf = readFileSync(abs);
    // Heuristic binary detection: a NUL byte in the first 8 KiB.
    if (buf.subarray(0, Math.min(buf.length, 8192)).includes(0)) return null;
    return buf.toString("utf8");
  } catch {
    return null;
  }
}

function scanFile(path, contents, patterns) {
  const findings = [];
  for (const { name, regex } of patterns) {
    const g = new RegExp(
      regex.source,
      regex.flags.includes("g") ? regex.flags : `${regex.flags}g`,
    );
    let match;
    while ((match = g.exec(contents)) !== null) {
      const upto = contents.slice(0, match.index);
      const line = upto.split("\n").length;
      const lineStart = upto.lastIndexOf("\n") + 1;
      const lineEnd = contents.indexOf("\n", match.index);
      const snippet = contents.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();
      findings.push({
        file: path,
        line,
        pattern: name,
        snippet: snippet.length > 200 ? `${snippet.slice(0, 197)}...` : snippet,
      });
      if (match.index === g.lastIndex) g.lastIndex++;
    }
  }
  return findings;
}

/**
 * Run the prompt-injection gate over a git working tree.
 *
 * @param {object} opts
 * @param {string} opts.root - project root (must be a git repo).
 * @param {object} [opts.config] - the `promptInjection` config block.
 * @returns {{ ok: boolean, findings: Array, scanned: number }}
 */
export function runPromptInjection({ root, config = {} }) {
  const patterns = resolvePatterns(config);
  const cfg = {
    excludedPrefixes: config.excludedPrefixes ?? PROMPT_INJECTION_DEFAULTS.excludedPrefixes,
    excludedSuffixes: config.excludedSuffixes ?? PROMPT_INJECTION_DEFAULTS.excludedSuffixes,
    excludedExact: new Set(config.excludedExact ?? PROMPT_INJECTION_DEFAULTS.excludedExact),
    binaryExtensions: new Set(
      config.binaryExtensions ?? PROMPT_INJECTION_DEFAULTS.binaryExtensions,
    ),
  };

  const findings = [];
  let scanned = 0;
  for (const f of listTrackedFiles(root)) {
    if (isExcluded(f, cfg)) continue;
    const contents = readSafely(root, f);
    if (contents === null) continue;
    scanned += 1;
    findings.push(...scanFile(f, contents, patterns));
  }

  return { ok: findings.length === 0, findings, scanned };
}

export default runPromptInjection;
