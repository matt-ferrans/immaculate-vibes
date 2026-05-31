# @iv/gates

Immaculate Vibes CI/quality gates behind a single `iv-gate` CLI. **Incubating.**

Scaffolded files in a consuming repo (pre-commit hooks, CI workflow steps)
call `npx iv-gate <name>` so the gate logic lives in this versioned package
rather than being copy-pasted into every project.

```bash
iv-gate <name> [--json]   # run a gate; exit 0 = clean, 1 = findings, 2 = usage error
iv-gate --list            # list available gates
```

## Gates

| Gate | Lifted from | What it checks |
| --- | --- | --- |
| `doc-paths` | `scripts/dev/check-doc-paths.ts` | Every backtick-quoted file/dir path in the configured docs (default: `CLAUDE.md`, `AGENTS.md`, `docs/testing-obligations.md`) actually exists. Catches stale references that poison an agent's context. |
| `prompt-injection` | `scripts/dev/check-prompt-injection.ts` | Scans tracked source for prompt-injection marker strings (`ignore previous instructions`, fake system/assistant prefixes, `[INST]` markers). A tripwire for hostile content arriving via review channels. |
| `changelog` | `scripts/sync-changelog.ts` | Parses a Keep-a-Changelog `CHANGELOG.md` and keeps a bundled type-safe mirror in sync. `iv-gate changelog` checks (fails if stale); `iv-gate changelog --sync` rewrites the mirror. |
| `routes` | `scripts/sync-routes-manifest.ts` | Scans an app dir for page files, derives the route list (minus an exclude set), and keeps a manifest in sync. `iv-gate routes` checks; `iv-gate routes --sync` rewrites. Manifest body is overridable via `routes.render` for app-specific shapes. |

Remaining Anser gates — `smell`, `coverage-exclude`, `coderabbit` — land
in later Phase 1 slices behind this same CLI.

## Config

Gates read their slice of `iv.config.{mjs,js,json}` at the project root
(found by walking up to the nearest `package.json`). Defaults mirror
Anser-Portal, so a repo with no config file runs with the same behavior.

```jsonc
// iv.config.json
{
  "docPaths": {
    "targets": ["AGENTS.md", "README.md"],
    "allowlist": [".claude/settings*.json"],
    "knownPrefixes": ["src/", "scripts/"],
    "rootFiles": ["package.json", "tsconfig.json"]
  }
}
```

Each field falls back to the gate's default when omitted (see
`lib/doc-paths.mjs` → `DOC_PATHS_DEFAULTS`).

## Why `.mjs`, not `.ts`

The gates run via `npx iv-gate` in hooks and CI with no build step, so they
ship as plain ESM with no TypeScript toolchain required to execute. (A typed
public API can come later via `.d.ts` without changing the runtime shape.)
