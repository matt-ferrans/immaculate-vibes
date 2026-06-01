// Immaculate Vibes service providers — declarative definitions for the
// setup wizard. Each provider declares:
//
//   summary      one-line description
//   vars         VarSpec[] — the variables it owns, with routing metadata
//   autoSteps    string[]  — steps a future apply phase COULD automate
//   manualSteps  string[]  — steps only a human can do (browser, OAuth, billing)
//
// A VarSpec:
//   { name, secret, source, destinations[], environments[], required, howTo }
//     source:       "generated" | "provider-api" | "user-paste" | "derived"
//     destinations: where the value must be written — "env.local",
//                   "railway:web", "railway:build-arg", "github:secret",
//                   "github:var", "manual"
//
// These are declarations only — nothing here performs I/O or provisioning.
// The variable surface mirrors a typical Next.js + Postgres app (modeled on
// Anser-Portal's .env.example).

export const PROVIDERS = {
  secrets: {
    summary: "App secrets — generated locally, then mirrored to the platform.",
    vars: [
      {
        name: "JWT_SECRET",
        secret: true,
        source: "generated",
        destinations: ["env.local", "railway:web", "github:secret"],
        environments: ["local", "preview", "staging", "prod"],
        required: true,
        howTo: "Generate with `openssl rand -base64 32` (>=32 bytes).",
      },
      {
        name: "SEED_ADMIN_EMAIL",
        secret: false,
        source: "user-paste",
        destinations: ["env.local", "railway:web"],
        environments: ["local", "staging"],
        required: false,
        howTo: "The email for the seeded first admin user.",
      },
      {
        name: "SEED_ADMIN_PASSWORD",
        secret: true,
        source: "generated",
        destinations: ["env.local", "railway:web"],
        environments: ["local", "staging"],
        required: false,
        howTo: "Generate a strong password for the seeded admin.",
      },
    ],
    autoSteps: ["Generate JWT_SECRET / SEED_ADMIN_PASSWORD with a CSPRNG."],
    manualSteps: [],
  },

  github: {
    summary: "GitHub Actions, branch protection, repo secrets.",
    vars: [],
    autoSteps: [
      "Ensure the IV workflow + CODEOWNERS + dependabot files are present (init does this).",
      "Upload secrets (JWT_SECRET, etc.) via `gh secret set`.",
      "Set branch protection requiring the iv-gates + quality checks.",
    ],
    manualSteps: [
      "Authenticate `gh` (gh auth login) if not already — needs repo + workflow scope.",
    ],
  },

  railway: {
    summary: "Web service, managed Postgres, per-PR preview environments.",
    vars: [
      {
        name: "DATABASE_URL",
        secret: true,
        source: "provider-api",
        destinations: ["railway:web", "env.local"],
        environments: ["local", "preview", "staging", "prod"],
        required: true,
        howTo: "Railway provisions this when you add a Postgres plugin; reference it as ${{Postgres.DATABASE_URL}}.",
      },
      {
        name: "NEXT_PUBLIC_APP_URL",
        secret: false,
        source: "derived",
        destinations: ["railway:build-arg"],
        environments: ["preview", "staging", "prod"],
        required: true,
        howTo: "MUST be a Docker build arg (NEXT_PUBLIC_* is inlined at build time). For previews use https://${{RAILWAY_PUBLIC_DOMAIN}}.",
      },
      {
        name: "PORT",
        secret: false,
        source: "provider-api",
        destinations: ["railway:web"],
        environments: ["preview", "staging", "prod"],
        required: false,
        howTo: "Injected by Railway at runtime; the app should read process.env.PORT.",
      },
    ],
    autoSteps: [
      "Create the Railway project + Postgres plugin (via the Railway API/CLI).",
      "Set service variables and the NEXT_PUBLIC_APP_URL build arg.",
      "Set the preDeployCommand (migrate + seed) and enable PR environments.",
    ],
    manualSteps: [
      "Connect the GitHub repo to the Railway project (one-time, in the dashboard).",
      "Confirm the plan/billing tier supports PR environments.",
    ],
  },

  sentry: {
    summary: "Error tracking + source-map upload (no-ops cleanly when unset).",
    vars: [
      {
        name: "SENTRY_DSN",
        secret: false,
        source: "provider-api",
        destinations: ["railway:web"],
        environments: ["staging", "prod"],
        required: false,
        howTo: "From the Sentry project settings. Use SEPARATE DSNs per environment.",
      },
      {
        name: "NEXT_PUBLIC_SENTRY_DSN",
        secret: false,
        source: "provider-api",
        destinations: ["railway:build-arg"],
        environments: ["staging", "prod"],
        required: false,
        howTo: "Browser-side DSN (safe to expose). Often the same value as SENTRY_DSN.",
      },
      {
        name: "SENTRY_AUTH_TOKEN",
        secret: true,
        source: "provider-api",
        destinations: ["github:secret"],
        environments: ["prod"],
        required: false,
        howTo: "Only needed to upload source maps at build time; the build succeeds without it.",
      },
    ],
    autoSteps: ["Create staging + prod Sentry projects and read back their DSNs."],
    manualSteps: ["Create a Sentry org/account if you don't have one."],
  },

  email: {
    summary: "Transactional email (Gmail). Pick ONE path: SMTP app-password or OAuth.",
    vars: [
      {
        name: "EMAILS_ENABLED",
        secret: false,
        source: "user-paste",
        destinations: ["env.local", "railway:web"],
        environments: ["staging", "prod"],
        required: false,
        howTo: 'Leave unset/"false" for log-only mode (URLs printed, not sent).',
      },
      {
        name: "SMTP_USER",
        secret: false,
        source: "user-paste",
        destinations: ["railway:web", "env.local"],
        environments: ["staging", "prod"],
        required: false,
        howTo: "SMTP path: a dedicated Workspace mailbox with 2-Step Verification on.",
      },
      {
        name: "SMTP_PASSWORD",
        secret: true,
        source: "user-paste",
        destinations: ["railway:web", "github:secret"],
        environments: ["staging", "prod"],
        required: false,
        howTo: "SMTP path: a 16-char Google app password (no spaces).",
      },
      {
        name: "GMAIL_OAUTH_REFRESH_TOKEN",
        secret: true,
        source: "user-paste",
        destinations: ["railway:web", "github:secret"],
        environments: ["staging", "prod"],
        required: false,
        howTo: "OAuth path: from the one-time token exchange against your Google OAuth client.",
      },
    ],
    autoSteps: [
      "OAuth path only: run the refresh-token exchange and capture the token.",
      "Send a log-only test email to confirm rendering.",
    ],
    manualSteps: [
      "Decide SMTP vs OAuth (standardize one per project to avoid half-wiring both).",
      "SMTP: create the Workspace mailbox + app password (Google won't let this be scripted).",
      "OAuth: create the Google Cloud OAuth client (also manual in the Google console).",
    ],
  },

  coderabbit: {
    summary: "Automated PR review + the CodeRabbit gate.",
    vars: [],
    autoSteps: [
      "Ensure .coderabbit.yaml is present and the coderabbit-gate check is wired.",
      "Confirm the GitHub App install via the API.",
    ],
    manualSteps: [
      "Install the CodeRabbit GitHub App on the repo (click-through, one-time).",
    ],
  },
};

export function listProviders() {
  return Object.entries(PROVIDERS).map(([id, p]) => ({ id, summary: p.summary }));
}
