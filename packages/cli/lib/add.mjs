// Immaculate Vibes `add` engine — stamps an opt-in recipe's files.
//
// Recipes (see recipes.mjs) are project-specific scaffolds IV can't own
// generically. `add` stamps a recipe's stub files using the same marker +
// manifest machinery as `init`, so `doctor`/`sync` cover recipe files too,
// then surfaces the recipe's manual follow-up steps.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { IV_MARKER, MANIFEST_PATH, sha256 } from "./init.mjs";
import { RECIPES } from "./recipes.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const RECIPES_DIR = join(HERE, "..", "recipes");

function markerLine(comment, version) {
  const body = `${IV_MARKER} v${version} — recipe stub from \`immaculate-vibes add\`. Customize freely; see the recipe's follow-up notes.`;
  switch (comment) {
    case "hash":
      return `# ${body}`;
    case "html":
      return `<!-- ${body} -->`;
    case "none":
      return null;
    case "line":
    default:
      return `// ${body}`;
  }
}

function stampRecipeFile(file, version) {
  const body = readFileSync(join(RECIPES_DIR, file.template), "utf8");
  const marker = markerLine(file.comment, version);
  return marker === null ? body : `${marker}\n${body}`;
}

function loadManifest(root) {
  const p = join(root, MANIFEST_PATH);
  if (!existsSync(p)) return { version: null, generatedAt: null, files: {} };
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return { version: null, generatedAt: null, files: {} };
  }
}

/**
 * Add a recipe.
 *
 * @param {object} opts
 * @param {string} opts.root
 * @param {string} opts.recipe - recipe name (key of RECIPES).
 * @param {string} opts.version
 * @param {boolean} [opts.force] - overwrite existing files.
 * @param {boolean} [opts.dryRun]
 * @returns {{ unknownRecipe?: boolean, actions: Array, followUp: string[] }}
 */
export function add({ root, recipe, version, force = false, dryRun = false }) {
  const def = RECIPES[recipe];
  if (!def) {
    return { unknownRecipe: true, actions: [], followUp: [] };
  }

  const manifest = loadManifest(root);
  const actions = [];
  let touched = false;

  for (const file of def.files) {
    const destPath = join(root, file.dest);
    const exists = existsSync(destPath);

    if (exists && !force) {
      actions.push({ dest: file.dest, action: "skipped (exists)" });
      continue;
    }

    const content = stampRecipeFile(file, version);
    if (!dryRun) {
      mkdirSync(dirname(destPath), { recursive: true });
      writeFileSync(destPath, content);
      manifest.files[file.dest] = {
        tier: `recipe:${recipe}`,
        sha256: sha256(content),
        version,
      };
      touched = true;
    }
    actions.push({ dest: file.dest, action: exists ? "overwritten" : "created" });
  }

  if (!dryRun && touched) {
    manifest.version = version;
    manifest.generatedAt = new Date().toISOString();
    const p = join(root, MANIFEST_PATH);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  return { actions, followUp: def.followUp };
}

export default add;
