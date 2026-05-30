# @iv/eslint-config

The framework-agnostic slice of Anser-Portal's flat ESLint config, as a
composable factory. **Incubating.**

```js
// consuming eslint.config.mjs
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { ivConfig } from "@iv/eslint-config";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  ...ivConfig(), // a11y promotions, security, complexity caps, test-quality rules, prettier-last
  globalIgnores([".next/**", "coverage/**"]),
]);
```

## What it includes

- jsx-a11y promotions to `error` (WCAG 2.1 AA subset), JSX/TSX scoped
- `eslint-plugin-security` recommended
- `sonarjs/cognitive-complexity` cap on source (off in tests)
- complexity / size / maintainability caps on source
- `no-only-tests` in test + e2e files
- the `@iv/eslint-plugin` test-quality rules
- `eslint-config-prettier` last

## What it leaves to the consumer

- the framework preset (e.g. `eslint-config-next`) — that's the app's choice
- `globalIgnores` — that's the app's path layout

## Options

`ivConfig(options)` accepts glob overrides (`src`, `tests`, `unitTests`,
`actionTests`, `e2e`, `e2eDir`) and a `complexity` object
(`cognitive`, `cyclomatic`, `maxLines`, `maxLinesPerFunction`, `maxParams`,
`maxDepth`, `maxNestedCallbacks`). Defaults mirror Anser-Portal.
