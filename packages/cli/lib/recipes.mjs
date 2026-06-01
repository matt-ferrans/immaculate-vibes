// Immaculate Vibes recipes — project-specific, opt-in scaffolds.
//
// Unlike the core/recommended templates that `init` stamps, recipes are
// things IV can't own generically because they're tied to a specific host
// (a Dockerfile, a Railway service, a Next.js route layout). `add <recipe>`
// stamps a recipe's files — as commented stubs with TODOs, never as
// silently-wrong defaults — and prints the manual follow-up steps. Stamped
// files are recorded in the same `.iv/manifest.json` as init's, so `doctor`
// and `sync` cover them too.
//
// A recipe is data: a list of template files (relative to the recipes/
// template dir) + a follow-up note. Adding one is a registry entry, no new
// command wiring.

export const RECIPES = {
  "pdf-gate": {
    summary: "Docker-based PDF/render e2e gate (build the real image, boot it, assert output).",
    files: [
      { template: "pdf-gate/pdf-e2e.sh", dest: "scripts/iv/pdf-e2e.sh", comment: "hash" },
      {
        template: "pdf-gate/workflow.yml",
        dest: ".github/workflows/iv-pdf-e2e.yml",
        comment: "hash",
      },
    ],
    followUp: [
      "Edit scripts/iv/pdf-e2e.sh: set PDF_URL to your real render endpoint and",
      "LOGIN_* if the route needs auth. The stub asserts the response starts with %PDF.",
      "The workflow is path-gated — adjust the `paths:` filter to your render surface.",
      "This gate needs Docker in CI; it's deliberately NOT a pre-push hook.",
    ],
  },
  "railway-preview": {
    summary: "Per-PR Railway preview environment notes + config stub.",
    files: [
      {
        template: "railway-preview/railway.json",
        dest: "railway.iv-example.json",
        comment: "none",
      },
      {
        template: "railway-preview/PREVIEW.md",
        dest: "docs/iv/preview-deployments.md",
        comment: "html",
      },
    ],
    followUp: [
      "railway.iv-example.json is a reference, not live config — merge the bits you",
      "need into your real railway.json (don't let IV own your deploy config).",
      "Set NEXT_PUBLIC_APP_URL as a build arg = https://${{RAILWAY_PUBLIC_DOMAIN}}.",
      "See docs/iv/preview-deployments.md for what's seeded/disabled in previews.",
    ],
  },
  "route-manifest": {
    summary: "Wire iv-gate routes: a manifest + a render hook stub for app-specific shapes.",
    files: [
      {
        template: "route-manifest/routes.config.mjs",
        dest: "iv.routes.config.mjs",
        comment: "line",
      },
    ],
    followUp: [
      "iv.routes.config.mjs shows a `render(routes)` hook for an app-specific",
      "manifest shape (auth classification, helper exports, etc.). Fold its",
      "`routes` block into iv.config.mjs, then run `npx iv-gate routes --sync`.",
    ],
  },
};

export function listRecipes() {
  return Object.entries(RECIPES).map(([name, r]) => ({ name, summary: r.summary }));
}
