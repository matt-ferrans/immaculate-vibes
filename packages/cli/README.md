# immaculate-vibes (CLI)

The Immaculate Vibes **scaffolder + maintainer**. **Incubating.**

```bash
immaculate-vibes init    [--dry-run] [--force] [--tier core,recommended]
immaculate-vibes doctor  [--json]
immaculate-vibes sync    [--dry-run] [--force]
```

`init` stamps the files that must physically live in a repo — config plus
thin shims that call into the versioned `@iv/*` packages. The logic stays in
the dependency; the stamped files stay near-empty, so `npm update @iv/*`
upgrades behavior without re-scaffolding. `doctor` reports drift; `sync`
re-emits drifted templates after an `@iv/*` update.

## What it stamps

| File | Tier | What it is |
| --- | --- | --- |
| `iv.config.mjs` | core | Project config. Every gate reads its slice; omitted keys fall back to the gate's default. Generated minimal (everything commented). |
| `.pre-commit-config.yaml` | recommended | Hooks that call `npx iv-gate <name>` (doc-paths, prompt-injection, banned-patterns, changelog). |
| `.github/workflows/iv-ci.yml` | recommended | CI workflow running the iv-gate checks on PRs + pushes. |
| `.github/dependabot.yml` | recommended | Weekly npm + monthly actions bumps (keeps `@iv/*` patched). |
| `.claude/settings.json` | recommended | Agent permission set — the push-scope/force-push/no-verify denies, an ask-list, and a `claude/*`-only push allow. |
| `AGENTS.md` | recommended | Agent context skeleton with the house "Voice & working style" section and guardrail pointers. |
| `.github/CODEOWNERS` | optional | Auto-request review on IV-managed + sensitive paths (opt-in via `--tier`). |

## Safety model

- **Re-runnable.** An existing file is skipped (reported `skipped (exists)`),
  never clobbered, unless `--force`.
- **`--dry-run`** prints the plan and writes nothing.
- **Version-stamped + manifested.** Comment-friendly files carry an
  `iv:managed v<version>` marker; the authoritative record (per-file sha256 +
  version) lives in `.iv/manifest.json`, which also covers files that can't
  carry a comment (JSON uses a `$iv` key instead).
- **Tiers.** `--tier core` for the minimum; `core,recommended` (default)
  adds the hooks/CI/agent layer; `optional` for opt-in extras like CODEOWNERS.

## Drift maintenance (`doctor` / `sync`)

After `npm update @iv/*` ships newer templates, keep your repo current:

- **`doctor`** — read-only. Classifies each managed file as `ok`,
  `outdated` (IV's template moved on), `locally-modified` (you edited it),
  `missing`, or `untracked`. Exits **1** when anything needs action (except
  purely-informational `untracked`), so it doubles as a CI check.
- **`sync`** — re-emits `outdated`/`missing` files. It **never clobbers a
  locally-modified file** — those are reported and left alone unless you pass
  `--force`. `--dry-run` previews.

The three-way hash comparison (recorded in the manifest vs. on-disk vs. what
the current template produces) is what lets `sync` tell "IV's template
changed" apart from "the user edited this" — and only auto-update the former.
