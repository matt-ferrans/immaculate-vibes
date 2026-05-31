// Immaculate Vibes sync / doctor engine.
//
// These are the "fleet leverage" commands: after `npm update @iv/*` ships a
// newer template, `doctor` reports which managed files have drifted and
// `sync` re-emits them — without clobbering files the consumer hand-edited.
//
// The `.iv/manifest.json` written by `init` is the pivot. For each managed
// file we have three content fingerprints:
//   - recorded:  the sha256 IV wrote (from the manifest)
//   - onDisk:    the sha256 of the file as it is now
//   - expected:  the sha256 of what the CURRENT installed template produces
//
// From those three we classify each file precisely:
//   - "missing"          : tracked by the manifest, but the file is gone
//   - "ok"               : onDisk === expected (already current)
//   - "outdated"         : onDisk === recorded, but expected differs
//                          → IV's template moved on; safe to re-emit
//   - "locally-modified" : onDisk !== recorded AND onDisk !== expected
//                          → the consumer edited it; do NOT clobber silently
//   - "untracked"        : a template exists but the manifest never recorded
//                          it (e.g. added in a newer IV, or tier not stamped)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { MANIFEST_PATH, TEMPLATES, sha256, stampedContent } from "./init.mjs";

function loadManifest(root) {
  const p = join(root, MANIFEST_PATH);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function onDiskHash(root, dest) {
  const p = join(root, dest);
  if (!existsSync(p)) return null;
  return sha256(readFileSync(p, "utf8"));
}

/**
 * Classify every managed/managed-eligible file. Pure: no writes.
 *
 * @param {object} opts
 * @param {string} opts.root - project root.
 * @param {string} opts.version - the installed IV version (for expected content).
 * @returns {{ manifestPresent: boolean, files: Array<{dest, tier, status, recorded, onDisk, expected}> }}
 */
export function diagnose({ root, version }) {
  const manifest = loadManifest(root);
  const recordedFiles = manifest?.files ?? {};
  const files = [];

  for (const entry of TEMPLATES) {
    const recorded = recordedFiles[entry.dest]?.sha256 ?? null;
    const onDisk = onDiskHash(root, entry.dest);
    const expected = sha256(stampedContent(entry, version));

    let status;
    if (recorded === null) {
      // Not in the manifest. If the file exists it's untracked-by-IV; if it
      // doesn't, IV simply hasn't stamped this template here (skip silently).
      if (onDisk === null) continue;
      status = "untracked";
    } else if (onDisk === null) {
      status = "missing";
    } else if (onDisk === expected) {
      status = "ok";
    } else if (onDisk === recorded) {
      status = "outdated";
    } else {
      status = "locally-modified";
    }

    files.push({ dest: entry.dest, tier: entry.tier, status, recorded, onDisk, expected });
  }

  return { manifestPresent: manifest !== null, files };
}

/**
 * Re-emit drifted templates. Safe by default: only files classified
 * "outdated" or "missing" are rewritten. "locally-modified" files are left
 * alone (reported, not clobbered) unless `force` is set.
 *
 * @param {object} opts
 * @param {string} opts.root
 * @param {string} opts.version
 * @param {boolean} [opts.force] - also overwrite locally-modified files.
 * @param {boolean} [opts.dryRun]
 * @returns {{ manifestPresent: boolean, actions: Array<{dest, status, action}> }}
 */
export function sync({ root, version, force = false, dryRun = false }) {
  const { manifestPresent, files } = diagnose({ root, version });
  const manifest = loadManifest(root) ?? { version, generatedAt: null, files: {} };
  const actions = [];
  let touched = false;

  for (const f of files) {
    const entry = TEMPLATES.find((t) => t.dest === f.dest);
    const rewrite = f.status === "outdated" || f.status === "missing";
    const forceRewrite = force && f.status === "locally-modified";

    if (!rewrite && !forceRewrite) {
      // ok / untracked / locally-modified(without force): leave as-is.
      actions.push({ dest: f.dest, status: f.status, action: "left as-is" });
      continue;
    }

    const content = stampedContent(entry, version);
    if (!dryRun) {
      const p = join(root, f.dest);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, content);
      manifest.files[f.dest] = { tier: entry.tier, sha256: sha256(content), version };
      touched = true;
    }
    actions.push({
      dest: f.dest,
      status: f.status,
      action: forceRewrite ? "overwritten (forced)" : "re-emitted",
    });
  }

  if (!dryRun && touched) {
    manifest.version = version;
    manifest.generatedAt = new Date().toISOString();
    const p = join(root, MANIFEST_PATH);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  return { manifestPresent, actions };
}

export default { diagnose, sync };
