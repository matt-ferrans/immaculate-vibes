# Setup wizard (`immaculate-vibes setup`)

Plans the service onboarding an app needs — Railway, GitHub, CodeRabbit,
Sentry, email, secrets — and writes a **handoff manifest** that "locks in"
the variables a human or a downstream agent needs to finish wiring up.

```bash
immaculate-vibes setup            # plan all services, write .iv/handoff.{json,md}
immaculate-vibes setup --list     # list available service providers
immaculate-vibes setup --services railway,secrets   # only some
immaculate-vibes setup --json     # machine-readable plan to stdout
```

## Plan-only by design

`setup` performs **no outward mutation**. It never creates cloud resources,
writes remote variables, opens a browser, or installs an app. It builds a plan
from declarative provider definitions and emits a handoff. That's what makes it
safe to run unattended — and safe for an agent to run — because the dangerous
half (provisioning) is a separate, explicitly-approved step.

This mirrors the rest of IV's posture: like the push-scope denies in
`.claude/settings.json`, outward/irreversible actions don't happen without
explicit human approval.

## Secret hygiene

The handoff records variable **metadata only** — name, whether it's secret,
its source (`generated` / `provider-api` / `user-paste` / `derived`), which
destinations it must be written to, and how to obtain it. It **never** records
a secret value. Generated secrets are *described* ("generate with
`openssl rand -base64 32`"), not generated, at plan time.

## The handoff

Two files in `.iv/`:

- **`handoff.json`** — machine-readable: `services`, a `routing` table
  (destination → which vars land there), per-variable metadata, and the
  manual-step list. This is the contract an agent reads to execute the
  automatable remainder.
- **`handoff.md`** — the same, human-readable, with the manual steps as a
  checklist.

## Variable destinations

| Destination | Meaning |
| --- | --- |
| `env.local` | local dev file (git-ignored, never committed) |
| `railway:web` | a Railway service variable |
| `railway:build-arg` | a Docker build arg (e.g. `NEXT_PUBLIC_*`, inlined at build) |
| `github:secret` / `github:var` | for Actions |
| `manual` | can't be automated; lives in the manual-steps checklist |

## Providers

`secrets`, `github`, `railway`, `sentry`, `email` (SMTP **or** OAuth — pick
one), `coderabbit`. Each declares its variables, the steps a future apply
phase *could* automate, and the steps only a human can do (browser, OAuth,
billing). Adding a provider is one entry in `lib/providers.mjs`.

## Not yet built

The **apply** phase (actually running the automatable steps via the Railway
API / `gh` / a CSPRNG for generated secrets) is intentionally not implemented.
When it is, it will confirm before each outward action and default to plan-only
until explicitly approved.
