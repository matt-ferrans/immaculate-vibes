# Immaculate Vibes (IV) — incubating inside Anser-Portal

IV is a framework that packages Anser-Portal's guardrail stack — CI gates, git
hooks, lint/static-analysis, the smell ratchet, the `.claude/` agent layer, the
docs contracts — plus a setup wizard that provisions the external services
(Railway, GitHub, CodeRabbit, Sentry, email) so a new app can `init` + `import`
most of it.

The full design lives in [PLAN.md](./PLAN.md).

## Why it lives here (for now)

Building IV requires Anser-Portal's context — *why* each guardrail exists, not
just what it does. And the real acceptance test for IV is "can Anser itself be
transformed to consume it." So IV incubates here and gets extracted once it
stands on its own.

## Incubation rules

- **Nothing in Anser's `src/` imports this directory.** It cannot affect the
  app's build, tests, or runtime while it's half-built.
- **It's fenced off from Anser's own gates** so the incubating code doesn't
  trip them and doesn't count against the smell baseline. The fences:
  - `tsconfig.json` → `exclude: ["immaculate-vibes/**"]`
  - `.pre-commit-config.yaml` → `exclude` includes `immaculate-vibes/`
  - `eslint.config.mjs` → `globalIgnores(["immaculate-vibes/**"])`
  - `.prettierignore` → `immaculate-vibes/`
  - (jscpd / knip / the smell banned-pattern scan are already `src/`-scoped.)
- **Duplication with Anser is expected and temporary.** Phase 0 *copies* the
  `anser-test` ESLint rules into `@iv/eslint-plugin`; the eventual dogfood flip
  points Anser's config at `@iv/*` and deletes the originals.

## Extraction plan

When IV is ready, `git subtree split` this directory into a standalone
`immaculate-vibes` repo (commit history preserved), publish/register the
packages, then add them back to Anser as dependencies — the dogfood flip. That
flip is its own deliberate PR (it touches `package.json`, the lockfile,
`tsconfig` paths, and CI — the hot shared files Anser asks you to sequence
carefully).

## Layout

```text
immaculate-vibes/
├── PLAN.md                          design doc (library + scaffolder + sync + wizard)
└── packages/
    ├── eslint-plugin/   @iv/eslint-plugin    the anser-test rules, exposed as iv/*
    ├── eslint-config/   @iv/eslint-config    shareable flat-config factory
    ├── gates/           @iv/gates            `iv-gate <name>` CLI (6 gates + coderabbit evaluator)
    └── cli/             immaculate-vibes     `init` scaffolder (stamps config + hook shims)
```

## Status

> **Known gap — IV code is not yet under an automated gate.** Everything in
> `immaculate-vibes/` is fenced out of Anser's own tsc / eslint / prettier /
> jscpd / smell checks (see "Incubation rules" above), and Anser's gates are
> the wrong shape for a standalone library anyway (app-tuned thresholds,
> `src/`-scoped scans, and knip would flag the whole package as "unused" since
> nothing imports it yet). So each gate/scaffolder slice is currently validated
> **by hand via execution** (run against fixtures + the real repo), not by CI.
> This is a quality-coverage gap, not a production risk — nothing imports IV,
> so it cannot affect the app. It closes at the **dogfood flip**: when Anser
> imports `@iv/*` and the fences come down, IV gets linted / typechecked /
> tested as first-class code. (Decided 2026-05: defer IV's own gates to the
> flip rather than contort Anser's config around it.)

| Phase | Scope | State |
| --- | --- | --- |
| 0 | staging dir + design doc + fences; lift `@iv/eslint-config` + `@iv/eslint-plugin` | done |
| 1 | gate scripts as `iv-gate <name>` CLI bins (`@iv/gates`) | **in progress (this PR)** — runner + config loader + 6 gates ported & execution-validated: `doc-paths`, `prompt-injection`, `changelog`, `routes`, `coverage-exclude`, `banned-patterns`, plus the pure `coderabbit-evaluate` library. Remaining: the aggregate `smell` report (jscpd/knip/eslint, deps-heavy) and the `coderabbit` GitHub-fetch wrapper |
| 2 | scaffolder (`init` + templates: shims, docs, `.claude/`) | **done (this PR)** — `immaculate-vibes init` (version-stamped, manifest-backed, re-runnable, `--dry-run`/`--force`/`--tier`) stamps 7 templates: `iv.config.mjs`, `.pre-commit-config.yaml`, `iv-ci.yml`, `dependabot.yml`, `.claude/settings.json`, `AGENTS.md`, and (optional) `CODEOWNERS` |
| 3 | sync / doctor (drift detection + safe re-emit) | **done (this PR)** — `doctor` (read-only drift report, CI-usable exit code) + `sync` (re-emits outdated/missing, never clobbers locally-modified without `--force`), via a three-way sha256 comparison against `.iv/manifest.json` |
| 4 | project-specific recipes (PDF gate, Railway preview, route manifest) | **done (this PR)** — `immaculate-vibes add <recipe>` (+ `--list`) stamps opt-in stubs-with-TODOs for `pdf-gate`, `railway-preview`, `route-manifest`; recipe files are manifest-tracked (`recipe:<name>` tier) so `doctor`/`sync` cover them |
| 5 | setup wizard (Railway/GitHub/CodeRabbit/Sentry/email providers) | todo |
| — | extract via `git subtree split` + dogfood flip | todo |
