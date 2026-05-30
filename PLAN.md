# Immaculate Vibes (IV)

A framework for spinning up a new app with the full Anser-Portal guardrail
stack — CI gates, git hooks, lint/static-analysis, the smell ratchet, the
agent-config layer, the docs contracts — plus a setup wizard that walks a
human (or an agent) through provisioning every external service and locks in
the variables needed to take the project the rest of the way.

---

## 1. Philosophy

- **Opinionated defaults, escape hatches everywhere.** IV ships Anser-Portal's
  hard-fail posture out of the box, but every threshold/pattern is overridable
  via one config file.
- **Maximize the library, minimize the files.** Logic lives in versioned
  packages you `npm update`; the files that *must* exist at fixed paths are
  thin shims that call into those packages.
- **Tone is cosmetic; guardrails are strict.** The house-voice instruction
  layer ships too, but it never relaxes a rule.
- **Same brand of Claude, with or without the maintainer.** The `.claude/`
  agent layer and `AGENTS.md` are first-class deliverables, not afterthoughts.

## 2. The hard constraint that shapes everything

A chunk of the guardrails can't be delivered as a pure `npm install`, because
the tools that consume them look for physical files at fixed paths:

- Git hooks → `.pre-commit-config.yaml` at repo root
- CI → `.github/workflows/*.yml`
- Agent behavior → `.claude/settings.json`, `.claude/hooks/*`, `AGENTS.md`
- Code review → `.coderabbit.yaml`; ownership → `CODEOWNERS`

You can't `import` those. So **IV is four things working together**:

1. **Library** (`@iv/*` packages) — all the logic: shareable ESLint config +
   custom rules, the gate scripts exposed as CLI bins, shared TS configs.
   Versioned; updated with `npm update`.
2. **Scaffolder** (`npx immaculate-vibes init`) — writes the files that must
   live in the repo, but makes each one a thin shim that calls into the library
   (the workflow runs `npx iv-gate smell`, the hook runs `npx iv-gate
   coderabbit`). Logic stays in the dependency; files stay near-empty.
3. **Sync / doctor** (`npx immaculate-vibes sync` / `doctor`) — re-emits the
   scaffolded shims when the library updates and reports drift. This is how an
   improvement propagates to every downstream app without hand-editing repos.
4. **Setup wizard** (`npx immaculate-vibes setup`) — provider-based onboarding
   for Railway, GitHub, CodeRabbit, Sentry, email, and secrets; routes every
   variable to its destination and emits a handoff manifest.

## 3. Repository layout (the IV monorepo)

```text
immaculate-vibes/                      (pnpm workspaces)
├── packages/
│   ├── eslint-config/    @iv/eslint-config     flat config: a11y + security + sonarjs + complexity caps
│   ├── eslint-plugin/    @iv/eslint-plugin     the anser-test rules, renamed iv/*
│   ├── prettier-config/  @iv/prettier-config
│   ├── commitlint-config/@iv/commitlint-config
│   ├── tsconfig/         @iv/tsconfig          strict base tsconfigs
│   ├── gates/            @iv/gates             CLI `iv-gate <name>`: smell, prompt-injection,
│   │                                           coderabbit, changelog-sync/check, coverage-exclude,
│   │                                           doc-paths, routes-check, ci (orchestrator)
│   ├── providers/        @iv/providers         setup-wizard service plugins (railway/github/…)
│   └── cli/              immaculate-vibes       init / sync / doctor / setup / add
├── templates/                                   files `init` stamps out (shims + docs)
│   ├── .pre-commit-config.yaml
│   ├── .github/workflows/{ci,coderabbit-gate,release,auto-fix,lighthouse}.yml
│   ├── .claude/{settings.json,hooks/*,commands/*}
│   ├── AGENTS.md            (Voice & working-style + guardrail sections, with placeholders)
│   ├── docs/{testing-obligations,agent-prompt-injection,preview-deployments}.md
│   ├── .coderabbit.yaml  CODEOWNERS  dependabot.yml  .nvmrc  CHANGELOG.md
│   └── …
└── iv.config.{ts,json}                          consumer's knobs (see §7)
```

## 4. Guardrail → delivery mechanism (from the Anser-Portal inventory)

| Guardrail | Delivery | Notes |
|---|---|---|
| ESLint a11y/security/sonarjs + complexity caps | **Library** `@iv/eslint-config` | consumer's `eslint.config.mjs` = 3-line re-export |
| `anser-test/*` custom rules (no-session-mock-in-actions, no-mock-only-assertions, no-nav-only-e2e) | **Library** `@iv/eslint-plugin` (→ `iv/*`) | the genuinely reusable IP |
| Prettier / commitlint / tsconfig | **Library** configs | one-line re-exports |
| smell report + check + baseline | **Library** `iv-gate smell` | baseline JSON stays in consumer repo |
| prompt-injection scan | **Library** `iv-gate prompt-injection` | pattern list overridable via config |
| coderabbit gate (script logic + fresh-agent rule) | **Library** `iv-gate coderabbit` | |
| changelog sync/check, coverage-exclude-diff, doc-paths, routes-check | **Library** gate bins | |
| `ci:quality / ci:test / ci:build` chain | **Library** `iv-gate ci` orchestrator | one bin runs the whole chain |
| `.pre-commit-config.yaml` | **Scaffold (shim)** | hooks call `npx iv-gate …` |
| `.github/workflows/*` | **Scaffold (shim)** | jobs call `npx iv-gate …` |
| `.claude/` settings + hooks (block-branch-switch, coderabbit-check) + commands | **Scaffold** | settings is data; hooks shim to library |
| `AGENTS.md` incl. Voice & working-style section | **Scaffold (template + your edits)** | ships with placeholders |
| `docs/testing-obligations`, `agent-prompt-injection`, `preview-deployments` | **Scaffold (docs)** | editable, drift-tracked |
| `.coderabbit.yaml`, CODEOWNERS, dependabot, `.nvmrc`/`.node-version` | **Scaffold** | CODEOWNERS needs your usernames |
| Schema-coordination, route manifest, PDF/Docker e2e gate, Railway preview | **Project-specific stub** | IV can't own these — emits a TODO stub + doc pointer; opt-in recipes via `add` |

## 5. Tiers (so `init` isn't all-or-nothing)

- **Core (always):** lint/prettier/commitlint/tsconfig, pre-commit shim, the
  `ci` gate, conventional commits, `.nvmrc`, `AGENTS.md` skeleton.
- **Recommended (default on, `--no-X` to skip):** smell ratchet,
  prompt-injection scan, changelog gate, CI workflows, CodeRabbit gate, the
  `.claude/` agent layer, the docs bundle.
- **Project-specific (stubs only):** PDF/Docker e2e, Railway preview deploy,
  route manifest, schema-coordination notes — IV drops a commented stub + a
  link to the doc explaining how to fill it in.

## 6. The `init` experience

```bash
npm create immaculate-vibes@latest
# or, in an existing repo:
npx immaculate-vibes init
```

Interactive prompts → writes the tier'd files, adds `@iv/*` devDeps, wires
`package.json` scripts to `iv-gate *`, drops `iv.config.ts`, prints a
"fill these in" checklist (CODEOWNERS handles, Railway IDs, domain conventions
in `AGENTS.md`).

## 7. Config surface (`iv.config.ts`)

One file for the knobs that legitimately vary per project — so customization
doesn't mean editing vendored files (which would break sync):

```ts
export default defineIV({
  node: "24",
  complexity: { max: 15, maxLines: 500, maxLinesPerFunction: 75, maxParams: 4, maxDepth: 3 },
  smell: { hardZero: ["unusedExports", "unusedFiles", "unusedDependencies", "bannedPatterns"] },
  promptInjection: { extraPatterns: [/* repo-specific */] },
  coverage: { global: { lines: 90, branches: 80 }, perPath: { "src/auth/**": { branches: 95 } } },
  agent: { pushScope: "claude/*", voice: "casual-explanatory" },
  services: { railway: true, sentry: true, email: "smtp", coderabbit: true },
})
```

## 8. The update / drift story (what makes it a *framework*)

- Library logic ships via `npm update @iv/*` — instant, every consumer.
- Scaffolded shims carry a version header; `npx immaculate-vibes sync` re-emits
  them and **shows a diff** for anything you've locally modified (asks before
  clobbering).
- `npx immaculate-vibes doctor` = Anser's `npm run doctor`: checks versions,
  hooks installed, config drift, which tier files are missing or stale.

---

## 9. Setup wizard — design

### 9.1 The real service & variable surface (from Anser-Portal)

| Service | Provides | Key variables |
|---|---|---|
| **Railway** | web service, managed Postgres, PR preview envs, cron services | `DATABASE_URL`, `PORT`, `RAILWAY_ENVIRONMENT_NAME`, `NEXT_PUBLIC_APP_URL` (build arg = `https://${{RAILWAY_PUBLIC_DOMAIN}}`) |
| **GitHub** | Actions, branch protection (required checks), CODEOWNERS, Dependabot, repo secrets | workflow `GITHUB_TOKEN` + uploaded secrets |
| **CodeRabbit** | PR review + the gate | `.coderabbit.yaml` + GitHub App install |
| **Email (Gmail)** | transactional mail — SMTP **or** OAuth path | `EMAILS_ENABLED`, `SMTP_HOST/PORT/USER/PASSWORD`, `EMAIL_FROM_NAME`, `EMAIL_MIN_INTERVAL_MS`, `EMAIL_OVERRIDE_TO` — or `GMAIL_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN`, `GMAIL_FROM_ADDRESS` |
| **Sentry** | error tracking + source maps | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG/PROJECT/AUTH_TOKEN` |
| **Auth / seed** | secrets | `JWT_SECRET` (`openssl rand -base64 32`), `SEED_ADMIN_EMAIL/PASSWORD` |
| **Lighthouse CI** | nightly perf/a11y | none required |

### 9.2 Core abstraction: service providers + variable-routing engine

```ts
interface ServiceProvider {
  id: "railway" | "github" | "coderabbit" | "sentry" | "email" | "secrets";
  detect():  Promise<Status>;     // already configured? partially?
  plan():    Promise<Step[]>;     // what it WOULD do (dry-run)
  apply(ctx): Promise<Result>;    // do the automatable parts
  verify():  Promise<Check[]>;    // prove it actually works
  vars():    VarSpec[];           // declares its variables + routing
  manualSteps(): ManualStep[];    // the parts only a human can click
}

type VarSpec = {
  name: string;
  secret: boolean;
  source: "generated" | "provider-api" | "user-paste" | "derived";
  destinations: Array<"env.local" | "railway:web" | "railway:build-arg" | "github:secret" | "github:var" | "manual">;
  environments: Array<"local" | "preview" | "staging" | "prod">;
  required: boolean;
};
```

The engine routes each variable to its destination(s) — that's the heart of
"lock in the variables." Destinations:

- `env.local` → local dev file (git-ignored, never committed)
- `railway:<service>` → Railway variable via API/CLI, per environment
- `railway:build-arg` → e.g. `NEXT_PUBLIC_APP_URL` (must be a build arg)
- `github:secret` / `github:var` → for Actions
- `manual` → can't be automated; goes into the handoff doc

### 9.3 Automatable vs guided-manual vs paste-back

| Provider | Auto (API/CLI) | Guided-manual (open browser, pause) | Paste-back |
|---|---|---|---|
| **secrets** | generate `JWT_SECRET`, seed creds | — | — |
| **GitHub** | branch protection required checks, upload secrets, ensure CODEOWNERS/dependabot/workflows present, enable Actions | — | token scopes if not authed |
| **Railway** | create project, add Postgres, set vars + build args, set `preDeployCommand`, create cron services, enable PR envs | connect GitHub repo, billing/plan | — |
| **Sentry** | create staging+prod projects, fetch DSNs, set source-map auth token | org/account creation | — |
| **CodeRabbit** | write/verify `.coderabbit.yaml`, confirm install via API | **click "Install GitHub App"** | — |
| **Email** | run OAuth token exchange, set vars, send log-only test | create Google Cloud OAuth client / Workspace mailbox + app password | client id/secret, app password |

Email is the most manual (Google won't let you script OAuth-client creation).

### 9.4 Two modes

- **`npx immaculate-vibes setup` (human):** interactive prompts, opens browser
  for OAuth/app-installs, pauses for paste-backs, applies after confirmation.
- **`npx immaculate-vibes setup --agent` (or `--plan`):** does no outward
  mutation by default. Emits a structured plan + a handoff manifest — exactly
  the "lock in everything an agent needs to take it the rest of the way" goal:

```text
.iv/handoff.md         human/agent-readable: done ✓, pending ☐, each pending
                       item's required value + where it goes + how to get it
.iv/setup-state.json   idempotent resume state: completed steps + non-secret
                       resource IDs (railway project id, sentry slug). NO secrets.
.iv/plan.json          machine-readable step graph for an agent to execute
```

Flow: human runs IV once to lay tracks → agent reads `handoff.md`, executes the
automatable remainder, surfaces only the genuinely-manual clicks back. The
manifest is the contract between them.

### 9.5 Idempotency, state, verification

- **Resumable:** every step checks `detect()` first; re-running skips what's
  done. State file records resource IDs, never secrets.
- **`npx immaculate-vibes setup --verify`** (extends `doctor`): pings each
  service for *proof*, not presence — Railway `/api/health` 200, Sentry DSN
  accepts an event, a log-only email renders, CodeRabbit app shows installed,
  branch protection lists the IV required checks, GitHub secrets exist.

### 9.6 Security rules (baked into the engine)

- Secrets never touch committed files or logs; `.iv/` is git-ignored; platform
  stores (Railway vars, GH secrets) are the source of truth, `.env.local` is
  local-only.
- Any outward action — creating cloud resources, writing remote vars, opening a
  browser, installing an app — confirms first; in `--agent` mode defaults to
  plan-only until explicitly approved. (Same principle as Anser's push-scope /
  destructive-script guardrails, extended to provisioning.)
- Generated secrets use a CSPRNG; `JWT_SECRET` ≥ 32 bytes to satisfy the app's
  own check.

---

## 10. Phased build roadmap

0. **Extract the pure library.** Lift `@iv/eslint-config` + `@iv/eslint-plugin`
   (the `anser-test` rules) + prettier/commitlint/tsconfig out of Anser-Portal
   verbatim. Lowest risk; dogfood by pointing Anser-Portal at them.
1. **Gates as bins.** Move smell/prompt-injection/coderabbit/changelog/
   coverage/doc-paths scripts into `@iv/gates` behind a stable `iv-gate <name>`
   CLI; parameterize Anser-specific bits via `iv.config`.
2. **Scaffolder.** `init` + the thin template set (shims + docs + `.claude/`).
3. **Sync / doctor.** Drift detection + safe re-emit — unlocks fleet leverage.
4. **Project-specific recipes.** PDF/Docker gate, Railway preview, route
   manifest as opt-in `npx immaculate-vibes add <recipe>`.
5. **Service onboarding (setup wizard).** Reuses Phase 3's drift/doctor engine:
   - 5a. secrets + GitHub providers (highest automation, lowest risk)
   - 5b. Railway provider (project, Postgres, vars, crons, PR envs)
   - 5c. Sentry + CodeRabbit providers
   - 5d. Email provider (OAuth / app-password flows)
   - 5e. `--agent` handoff manifest + `--verify` across all providers

## 11. Open decisions

1. **Name/scope:** `immaculate-vibes` CLI + `@iv/*` packages, or a company
   scope like `@yourco/iv`?
2. **Language scope:** JS/TS-only, or eventually wrap non-JS projects (the
   pre-commit/CI/agent layers are language-agnostic; lint/test layers aren't)?
3. **Opinionation dial:** hard-fail defaults (like Anser) vs. warn-first for
   adoption in messier existing repos?
4. **Distribution:** public npm scope, or private registry / GitHub Packages
   for company-internal use?
5. **Email path:** standardize on SMTP app-password (simpler) or OAuth (more
   robust)? Picking one shrinks the wizard a lot.
6. **Agent autonomy default:** may `--agent` *apply* the safe/automatable
   provisioning (secrets, GitHub) on its own, or always stop at plan-only and
   let a human approve every outward call?

---

## TL;DR

Immaculate Vibes = **library (logic) + scaffolder (files) + sync/doctor (drift)
+ setup wizard (services & variables)**. The library holds everything
importable; the scaffolder stamps thin shims for the things that must be files;
sync keeps them current; the wizard provisions the services and locks in the
variables a human or an agent needs to finish the job.
