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
    └── gates/           @iv/gates            `iv-gate <name>` CLI (doc-paths; more to come)
```

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 0 | staging dir + design doc + fences; lift `@iv/eslint-config` + `@iv/eslint-plugin` | done |
| 1 | gate scripts as `iv-gate <name>` CLI bins (`@iv/gates`) | **in progress (this PR)** — runner + config loader + `doc-paths` ported; `smell` / `prompt-injection` / `changelog` / `coverage-exclude` / `routes-check` / `coderabbit` to follow |
| 2 | scaffolder (`init` + templates: shims, docs, `.claude/`) | todo |
| 3 | sync / doctor (drift detection + safe re-emit) | todo |
| 4 | project-specific recipes (PDF gate, Railway preview, route manifest) | todo |
| 5 | setup wizard (Railway/GitHub/CodeRabbit/Sentry/email providers) | todo |
| — | extract via `git subtree split` + dogfood flip | todo |
