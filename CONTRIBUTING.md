# Contributing to Snorql-UI

Thanks for improving Snorql-UI. It is a dependency-light, **fully client-side** SPARQL interface — static HTML, CSS, and vanilla JavaScript loaded directly by `index.html` (no bundler, no build step). Contributions should preserve that property.

## Ground rules

- **Target branch:** open pull requests against `master`.
- **Commit messages:** `type(MM-DD): description`, e.g. `feat(06-18): add config-driven navbar linkouts` or `docs(06-18): document linkouts`. Common types: `feat`, `fix`, `docs`, `test`, `chore`.
- **Before pushing**, run the same gates CI runs and make sure they pass:
  ```bash
  npm ci
  npm run lint     # eslint assets/js/
  npm test         # jest (jsdom)
  ```
- **Keep changes additive and backwards-compatible.** A new feature must not change behavior for existing deployments unless that is the explicit intent.
- **No bundler / no new runtime dependencies** without discussion — vendored libraries live as plain files under `assets/`.

## Project layout

| Path | Purpose |
|------|---------|
| `assets/js/config.js` | `window.SNORQL_CONFIG` — the single place deployers edit (endpoint, namespaces, renderers, …). |
| `assets/js/sparql.js` | SPARQL protocol library (`SPARQL.Service`, `SPARQL.Query`). |
| `assets/js/snorql.js` | Main UI controller — query execution, result rendering, examples, parameters. |
| `assets/js/script.js` | DOM event handlers (clipboard, permalink, shortcuts). |
| `index.html` | Loads the scripts (order matters: `config.js` first) and holds the markup. |
| `__tests__/*.test.js` | Jest tests. Auto-discovered via `**/__tests__/**/*.test.js`. |

## Config-driven UI extensions

The preferred way to add an optional UI feature is to make it **config-driven and isolated**, so it ships off by default, doesn't touch the core controller, and stays easy to merge. `assets/js/linkouts.js` (configurable navbar linkout buttons) is the **reference implementation** of this pattern — read it alongside this section.

The recipe:

1. **One isolated module.** Add `assets/js/<feature>.js` as a self-contained IIFE in the vendored-globals style (no `import`/`require`). Expose a small namespace so it can be unit-tested, and self-initialize on `DOMContentLoaded` (guard the `readyState === 'loading'` race). Example shape — see `linkouts.js` lines 21–122.

2. **A config key with a safe default.** Add the feature's settings to `window.SNORQL_CONFIG` in `assets/js/config.js` with a default that renders nothing / changes nothing (`[]`, `false`, `null`). Existing deployments must be unaffected when they don't opt in. Document the shape in a comment block above the key (`linkouts: []` is the model).

3. **A mount point + correct load order.** Add any required element to `index.html` (e.g. an empty `<ul id="...">`) and load your script **after `config.js`** so `window.SNORQL_CONFIG` exists when it initializes:
   ```html
   <script src="assets/js/config.js"></script>
   <script src="assets/js/<feature>.js"></script>
   ```

4. **Treat config as untrusted input.** Config can arrive via git, mounted files, or third-party PRs and is rendered into the DOM, so sanitize at the boundary:
   - Write text via `textContent` / `createTextNode` — **never** `innerHTML`.
   - Allowlist URL schemes (e.g. `http`/`https`/`mailto`) with the `URL` parser; reject everything else (defeats `javascript:`/`data:`).
   - Allowlist any class/attribute suffix you compose (e.g. `^[a-z0-9-]+$` for a glyphicon suffix).
   - Add `rel="noopener noreferrer"` to any link that opens in a new tab.
   See the `escapeLinkoutText` / `sanitizeLinkoutUrl` / `buildLinkoutNode` helpers in `linkouts.js`. **Do not weaken these in review** — they are correctness requirements, not style.

5. **Tests.** Add `__tests__/<feature>.test.js` mirroring the existing vm-sandbox + jsdom harness in `__tests__/sparql.test.js` and `__tests__/linkouts.test.js`: read the source file, run it in a `vm` context with a real jsdom `document`/`window`/`URL`, pull the namespace off the sandbox, and assert on real DOM nodes. Cover the sanitizers (rejected inputs), the empty/absent-config path, and render order/attributes.

6. **Docs.** Add a brief subsection to `README.md` (Customization) and a full reference to `FORK.md` (field table + any Docker config-file override + the trust-boundary rationale). Cross-link back here.

Following this pattern keeps features opt-in, testable in isolation, safe against untrusted config, and cheap for downstream forks to adopt — which is the whole point of landing them here rather than in a fork.
