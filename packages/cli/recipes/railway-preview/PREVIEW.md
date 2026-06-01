# Preview deployments

Per-PR preview environments: each PR gets its own app + ephemeral database at
an auto-generated URL, so a reviewer can click into the change without running
it locally.

> Scaffolded by `immaculate-vibes add railway-preview`. This is a starting
> runbook — adjust it to your host and seeded data.

## What's seeded

- Migrations + your demo seed (so the preview has clickable data).
- Demo credentials match your local seed.

## What's disabled in previews

- **Outbound email** — log-only mode; actions print the URL they'd have sent
  instead of delivering. (Real email needs a staging env with a real provider.)
- **Error tracking** — point at a separate "preview" project or disable, so
  preview noise doesn't pollute production alerts.

## Gotchas

- `NEXT_PUBLIC_*` vars are inlined at build time — set the app URL as a Docker
  **build arg** (`= https://${{RAILWAY_PUBLIC_DOMAIN}}`), not just runtime env.
- Each open PR costs per-minute compute; close stale PRs.
- Include the preview URL in every PR description with a one-line note on what
  to click into to see the change.
