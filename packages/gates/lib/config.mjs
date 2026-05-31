// IV config loader.
//
// Finds the project root and loads `iv.config.{mjs,js,json}` if present.
// Every gate reads its slice of this config (e.g. the `docPaths` block);
// defaults live in each gate, so a project with no config file still runs
// with Anser-Portal's baseline values.
//
// Resolution: walk up from `cwd` until we find an iv.config.* file or a
// package.json (the project root). The directory containing whichever we
// hit first is the root. Config file is optional; package.json is the
// root anchor.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse as parsePath } from "node:path";
import { pathToFileURL } from "node:url";

const CONFIG_BASENAMES = ["iv.config.mjs", "iv.config.js", "iv.config.json"];

/**
 * Find the project root by walking up from `start` until a directory
 * contains package.json. Falls back to `start` if none is found.
 */
export function findProjectRoot(start = process.cwd()) {
  let dir = start;
  const { root: fsRoot } = parsePath(dir);
  while (true) {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }
    if (dir === fsRoot) {
      return start;
    }
    dir = dirname(dir);
  }
}

/**
 * Load IV config from the project root. Returns `{}` when no config file
 * is present — gates fall back to their own defaults.
 *
 * @param {string} root - project root directory.
 * @returns {Promise<object>} the resolved config object.
 */
export async function loadConfig(root) {
  for (const base of CONFIG_BASENAMES) {
    const full = join(root, base);
    if (!existsSync(full)) {
      continue;
    }
    if (base.endsWith(".json")) {
      return JSON.parse(readFileSync(full, "utf8"));
    }
    // .mjs / .js — dynamic import. A module may export the config as
    // default or as a named `config` export.
    const mod = await import(pathToFileURL(full).href);
    return mod.default ?? mod.config ?? {};
  }
  return {};
}

export default loadConfig;
