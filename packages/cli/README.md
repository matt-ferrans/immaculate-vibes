# immaculate-vibes (CLI)

The Immaculate Vibes **scaffolder**. **Incubating.**

```bash
immaculate-vibes init [--dry-run] [--force] [--tier core,recommended]
```

`init` stamps the files that must physically live in a repo — config plus
thin shims that call into the versioned `@iv/*` packages. The logic stays in
the dependency; the stamped files stay near-empty, so `npm update @iv/*`
upgrades behavior without re-scaffolding.

## What it stamps

| File | Tier | What it is |
| --- | --- | --- |
| `iv.config.mjs` | core | Project config. Every gate reads its slice; omitted keys fall back to the gate's default. Generated minimal (everything commented). |
| `.pre-commit-config.yaml` | recommended | Hooks that call `npx iv-gate <name>` (doc-paths, prompt-injection, banned-patterns, changelog). |

More templates (CI workflows, `.claude/` agent layer, docs bundle, CODEOWNERS,
dependabot) land in later slices.

## Safety model

- **Re-runnable.** An existing file is skipped (reported `skipped (exists)`),
  never clobbered, unless `--force`.
- **`--dry-run`** prints the plan and writes nothing.
- **Version-stamped.** Every generated file's first line carries an
  `iv:managed v<version>` marker so a future `sync` command can detect drift
  between the installed template and the emitted copy.
- **Tiers.** `--tier core` for the minimum; `core,recommended` (default)
  adds the hooks; `optional` reserved for opt-in extras.
