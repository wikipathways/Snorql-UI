# Coding Conventions

**Analysis Date:** 2026-03-04

## Naming Patterns

**Files:**
- Lowercase with hyphens for library/vendor files: `bootstrap.min.js`, `bootstrap-treeview.min.js`
- Camelcase for original source files: `snorql.js`, `sparql.js`, `namespaces.js`, `script.js`
- HTML files use lowercase: `index.html`, `cookies.html`
- Test files use pattern: `__tests__/[name].test.js`

**Functions:**
- camelCase for function names: `setPrefixes()`, `doQuery()`, `displayResult()`, `jsonToHTML()`, `exportCSV()`
- Getter/setter pattern: `getCookie()`, `setCookie()`, `changeEndpoint()`, `changeExamplesRepo()`
- Private functions prefixed with underscore: `_doCallback()`, `_queryFailure()`, `_querySuccess()`, `_add_graphs()`
- Event handler functions prefixed with action verb: `onFailure()`, `onExportFailure()`

**Variables:**
- Global state variables prefixed with underscore: `_endpoint`, `_examples_repo`, `_defaultGraph`, `_namespaces`, `_poweredByLink`, `_poweredByLabel`, `_showLiteralType`
- Loop counters use single letters: `i`, `v`, `x`
- Configuration variables use SCREAMING_SNAKE_CASE for constants: `numericXSDTypes`, `xsdNamespace`
- Local variables use camelCase: `service`, `query`, `results`, `binding`, `json`

**Types/Classes:**
- Constructor functions use PascalCase: `SPARQL.Service()`, `SPARQL.Query()`, `Object()`
- Namespace objects use SCREAMING_SNAKE_CASE: `SPARQL`, `snorql_namespacePrefixes`
- Method chaining conventions (jQuery): `jQuery("#id").method().method()`

## Code Style

**Formatting:**
- No automatic formatter configured (ESLint handles linting only)
- Indentation: 4 spaces (observed in `snorql.js`, `script.js`)
- Line termination: semicolons required
- jQuery style: Functions wrapped in `(function ($) { ... })(jQuery)` closure pattern (see `assets/js/script.js`)

**Linting:**
- Tool: ESLint 8.57.0
- Config: `.eslintrc.json`
- Rules enforced:
  - `semi: ["warn", "always"]` - Semicolons mandatory
  - `no-unused-vars: "warn"` - Unused variables warned (not errors)
  - `no-undef: "warn"` - Undefined variables warned
  - `no-prototype-builtins: "off"` - Allows prototype builtin checks
  - `no-redeclare: "warn"` - Variable redeclaration warned
  - `no-useless-escape: "warn"` - Unnecessary escape sequences warned
  - `no-mixed-spaces-and-tabs: "warn"` - Mixed indentation warned

**Environment:**
- Browser environment specified (`"browser": true`)
- ES2021 compatibility (`"ecmaVersion": "latest"`)
- jQuery globals enabled (`"jquery": true`)
- Many global functions declared in ESLint config due to multi-file architecture

## Import Organization

**Pattern:**
- No ES6 modules or imports used (legacy jQuery/script loading)
- External libraries loaded via `<script>` tags in `index.html` in dependency order:
  1. jQuery (dependency for everything)
  2. Bootstrap JS (depends on jQuery)
  3. CodeMirror (standalone)
  4. SPARQL protocol library (`sparql.js`)
  5. Namespace definitions (`namespaces.js`)
  6. Core logic (`snorql.js`)
  7. Event handlers (`script.js`)

**File Dependencies:**
- `script.js` depends on `snorql.js` functions: `doQuery()`, `displayResult()`, `getPrefixes()`, `fetchExamples()`, `exportResults()`
- `snorql.js` depends on `sparql.js` SPARQL.Service class and `namespaces.js` global `snorql_namespacePrefixes`
- `sparql.js` has no dependencies (standalone SPARQL protocol implementation)

**Global Variables:**
- ESLint config declares ~50 global functions/variables to prevent false `no-undef` errors due to multi-file nature
- List in `.eslintrc.json` lines 12-55 documents all globals

## Error Handling

**Patterns:**
- Callback-based error handling in SPARQL queries:
  ```javascript
  service.query(sparql, {
      success: callback,
      failure: onFailure
  });
  ```
- Failure handler extracts error message from HTML response:
  ```javascript
  function onFailure(report) {
      var message = report.responseText.match(/<pre>([\s\S]*)<\/pre>/);
      if (message) {
          var pre = document.createElement('pre');
          pre.innerHTML = message[1];
          setResult(pre);
      } else {
          var div = document.createElement('div');
          div.innerHTML = report.responseText;
          setResult(div);
      }
  }
  ```
- Alert dialogs used for user-facing errors: `alert("Please execute a query first then try to export")`
- No try-catch blocks in most code; exceptions are not expected
- Cross-site request errors handled with alerts in `sparql.js` line 360

## Logging

**Framework:** `console` object (no logging library used)

**Patterns:**
- Debug logging with `console.log()` (example at `sparql.test.js` line 199 for test debugging)
- No production logging statements in main code
- Error tracking with `console.log(data)` in permalink generation failure handler (`script.js` line 199)

## Comments

**When to Comment:**
- Complex algorithms documented with block comments (e.g., `sparql.js` lines 1-73 example usage)
- Section headers marked with comment lines: `//------------ Section Name starts --------`
- Removed features documented: comments show why code was deleted (see `snorql.js` lines 52-58 for cookie removal)

**JSDoc/TSDoc:**
- Not used in this codebase
- Function purposes implicit from names
- SPARQL.js includes detailed example usage in header comments showing API patterns

## Function Design

**Size:**
- Most functions 10-50 lines
- Longer functions perform complex DOM manipulation: `jsonToHTML()` (40 lines), `mainAjax()` (90 lines)
- No utility for breaking down functions enforced

**Parameters:**
- Functions accept 1-3 parameters typically
- Callback pattern common: `doQuery(url, sparql, callback)`
- Object parameters used occasionally: `{ success: fn, failure: fn }`
- Default parameters supported (ES6): `fetchExamples(suffix="")` in `snorql.js` line 181

**Return Values:**
- Most functions perform side effects (DOM manipulation, AJAX calls)
- Query functions return AJAX deferred objects: `return pager` in `mainAjax()`
- Getter functions return values: `endpoint()`, `method()`, `output()`
- Transformation functions return new objects: SPARQL transformations return extracted data

## Module Design

**Exports:**
- No module export system (legacy global variables)
- Each file contributes to global namespace
- SPARQL namespace pattern used to avoid collisions: `SPARQL.Service`, `SPARQL.Query`, `SPARQL._query_transformations`
- Naming convention prevents conflicts: `snorql_namespacePrefixes` is uniquely namespaced

**Barrel Files:**
- Not applicable (no module system)
- Load order in `index.html` functions as dependency management

## Special Patterns

**Global State Management:**
- Configuration stored in module-scoped variables: `_endpoint`, `_examples_repo`, `_defaultGraph`
- Modified by change handlers: `changeEndpoint()`, `changeExamplesRepo()`
- DOM element references cached in global: `var editor` (CodeMirror instance in `index.html` line 66)
- Cookie-based persistence removed; all state is session-only

**DOM Manipulation:**
- Direct DOM API used: `document.createElement()`, `appendChild()`, `innerHTML`
- jQuery used primarily for event binding: `jQuery("#id").on("click", handler)`
- Bootstrap plugins used with jQuery: `$('#examples').treeview({...})`
- No template system; HTML built programmatically

**AJAX Patterns:**
- jQuery.ajax() used for external requests (GitHub API in `snorql.js` line 212)
- Fetch API used for newer code: `fetch(prefixesUrl)` in `script.js` line 157
- SPARQL.Service class provides abstraction over XMLHttpRequest
- Polling pattern instead of callbacks in `sparql.js` lines 392-405

---

*Convention analysis: 2026-03-04*
