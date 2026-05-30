# @iv/eslint-plugin

Test-quality ESLint rules for Immaculate Vibes. **Incubating** — lifted from
Anser-Portal's local `eslint-rules/` plugin (named `anser-test`) and exposed
here under the plugin name `iv`.

## Rules

| Rule | What it bans |
| --- | --- |
| `iv/no-session-mock-in-actions` | `vi.mock("@/lib/session" …)` in action tests — stubbing the auth boundary deletes the test's value. |
| `iv/no-mock-only-assertions` | `it()`/`test()` blocks whose only `expect()`s are against mocks. Requires ≥1 assertion against observable state. |
| `iv/no-nav-only-e2e` | Playwright specs whose only assertion is heading visibility. Requires a behavior assertion. |

See `docs/testing-obligations.md` in Anser-Portal for the full rationale.

## Known de-branding TODOs (later phase)

These keep the rules a faithful, auditable lift for now; they get
parameterized before IV ships as a real dependency:

- `no-session-mock-in-actions` hard-codes Anser's session modules
  (`@/lib/session`, `@/lib/auth/session`, `@/lib/auth`). Make the module
  list a rule option.
- Rule messages reference `docs/testing-obligations.md`. Make the doc URL
  configurable (or generic).
