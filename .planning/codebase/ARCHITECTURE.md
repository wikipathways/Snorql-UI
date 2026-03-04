# Architecture

**Analysis Date:** 2026-03-04

## Pattern Overview

**Overall:** Single-Page Application (SPA) with event-driven UI and client-side SPARQL query execution

**Key Characteristics:**
- Pure frontend JavaScript application (no server-side code generation)
- Modular JavaScript files organized by responsibility
- Event-driven interaction model using jQuery
- RESTful SPARQL protocol communication
- CodeMirror-based query editor with syntax highlighting
- Bootstrap 3-based responsive UI

## Layers

**Presentation Layer:**
- Purpose: Render UI components and handle user interactions
- Location: `index.html`, `assets/css/style.css`, `assets/codemirror/`
- Contains: HTML structure, CSS styling, CodeMirror integration
- Depends on: jQuery, Bootstrap 3, CodeMirror
- Used by: End users via browser

**UI Controller Layer:**
- Purpose: Handle DOM events and coordinate between view and business logic
- Location: `assets/js/script.js`
- Contains: Click handlers, modal management, form interactions
- Depends on: jQuery, snorql.js, sparql.js
- Used by: Presentation layer elements (buttons, forms)

**Business Logic Layer:**
- Purpose: Core SPARQL execution, result formatting, examples management
- Location: `assets/js/snorql.js`
- Contains: Query execution (`doQuery()`), result rendering (`displayResult()`, `jsonToHTML()`), examples fetching (`fetchExamples()`)
- Depends on: sparql.js, namespaces.js
- Used by: script.js, export functions

**SPARQL Protocol Layer:**
- Purpose: Low-level SPARQL HTTP protocol implementation
- Location: `assets/js/sparql.js`
- Contains: `SPARQL.Service`, `SPARQL.Query` classes, HTTP communication, result transformation
- Depends on: XMLHttpRequest, browser APIs
- Used by: snorql.js via `doQuery()` and `exportResults()`

**Data/Configuration Layer:**
- Purpose: Define namespace prefixes and configuration constants
- Location: `assets/js/namespaces.js`
- Contains: RDF namespace prefix mappings (rdf, rdfs, owl, dc, foaf, wikidata, etc.)
- Depends on: None
- Used by: snorql.js for URI-to-QName conversion

## Data Flow

**Query Execution Flow:**

1. User types SPARQL query in CodeMirror editor (`index.html` textarea)
2. User clicks "Query" button → triggers `jQuery("#query-button").on("click")` handler in `script.js`
3. Handler reads query from editor via `editor.getDoc().getValue()`
4. Handler calls `doQuery(endpoint, query, callback)` from `snorql.js`
5. `doQuery()` creates `SPARQL.Service(url)` from `sparql.js`
6. Service.query() sends GET request to SPARQL endpoint
7. Endpoint returns JSON results
8. Callback receives JSON and calls `displayResult(json, "SPARQL results")`
9. `displayResult()` calls `jsonToHTML(json)` to convert JSON to HTML table
10. Table is rendered in `#result` div via `setResult()` → `display()`

**Example Fetching Flow:**

1. `start()` called on page load (from `onload="start()"` in index.html)
2. `start()` calls `fetchExamples()` twice (normal and fullscreen versions)
3. `fetchExamples()` reads GitHub repo URL from `#examples-repo` input
4. Makes AJAX call to GitHub API: `https://api.github.com/repos/{owner}/{repo}/git/trees/master?recursive=1`
5. Response callback parses GitHub tree into nested structure via `mainAjax()` and `getIndexFromTree()`
6. `tree` array built with folders and `.rq` files
7. `$('#examples').treeview()` renders tree structure
8. On node selection (`onNodeSelected`), fetches raw file from GitHub
9. File content loaded into editor via `editor.getDoc().setValue(response)`

**Result Rendering Flow:**

1. JSON result object passed to `displayResult(json, resultTitle)`
2. Calls `jsonToHTML(json)` which creates HTML table with:
   - Headers from `json.head.vars`
   - Rows from `json.results.bindings`
3. For each cell value, calls `nodeToHTML(node)` to format:
   - URIs → clickable links with QName conversion via `toQName()`
   - SMILES strings → rendered images via CDKDepict service
   - SVG URIs → embedded SVG images
   - Literals → plain text
4. Table rendered in `#result` container

**State Management:**

- **Session state:** Endpoint URL, examples repo URL, query text (stored in CodeMirror editor)
- **URL parameters:** Query and endpoint can be passed via URL query strings (`?q=...&endpoint=...`)
- **Cookies:** Cookie decision tracking (`cookieDecision`), removed endpoint/repo persistence in recent version
- **Global variables:** `_endpoint`, `_examples_repo`, `_defaultGraph`, `_namespaces`, `tree`, `editor`

## Key Abstractions

**SPARQL.Service:**
- Purpose: Encapsulates HTTP communication with SPARQL endpoint
- Examples: `assets/js/sparql.js` lines 138-235
- Pattern: Facade pattern wrapping XMLHttpRequest with SPARQL protocol handling
- Methods: `query()`, `ask()`, `selectValues()`, `selectSingleValue()`, `selectValueArrays()`, `selectValueHashes()`

**SPARQL.Query:**
- Purpose: Represents a single SPARQL query with its own graphs and prefixes
- Examples: `assets/js/sparql.js` lines 243-516
- Pattern: Query object pattern allowing query-specific configuration
- Methods: `queryString()`, `queryUrl()`, `queryParameters()`

**Node-to-HTML Transformation:**
- Purpose: Convert SPARQL result binding values to HTML elements
- Examples: `assets/js/snorql.js` lines 395-493 (`nodeToHTML()`)
- Pattern: Type-based polymorphism (uri, literal, bnode, typed-literal)
- Handles: URIs with QName formatting, SMILES chemical structure rendering, SVG images

**GitHub Examples Tree:**
- Purpose: Build hierarchical folder structure from GitHub API response
- Examples: `assets/js/snorql.js` lines 73-179 (`mainAjax()`, `getIndexFromTree()`)
- Pattern: Tree construction from flat file list with path parsing

## Entry Points

**Page Load:**
- Location: `index.html` line 34, `onload="start()"`
- Triggers: `start()` function from `snorql.js`
- Responsibilities: Initialize endpoint, fetch examples, set powered-by link, clear legacy cookies

**Query Execution:**
- Location: `script.js` lines 31-44, `jQuery("#query-button").on("click")`
- Triggers: `doQuery()` from `snorql.js`
- Responsibilities: Read query from editor, send to endpoint, display results

**Export Operations:**
- Location: `script.js` lines 119-135
- Triggers: `exportResults()` and `renderOutput()` from `snorql.js`
- Responsibilities: Transform results to CSV/JSON/XML and download

**Examples Refresh:**
- Location: `script.js` lines 46-49, `jQuery("#fetch").on("click")`
- Triggers: `fetchExamples()` from `snorql.js`
- Responsibilities: Re-fetch examples from GitHub repository

## Error Handling

**Strategy:** Direct user feedback via alerts and modal dialogs, error display in results area

**Patterns:**

- **Query failures:** `onFailure(report)` catches endpoint errors, extracts HTML error message, displays in results div
- **GitHub API errors:** Alert shown if repo URL invalid, empty tree silently handled
- **Export errors:** `onExportFailure()` shows alert message
- **Cross-origin requests:** Alert if cross-site scripting denied (Firefox legacy code path, lines 360)
- **Export validation:** Check if results exist before CSV export, alert to run query first (line 583)
- **Prefix lookup:** Special handling for Virtuoso endpoints via `#show-prefixes` button fetching help page

## Cross-Cutting Concerns

**Logging:**
- Console logging via native `console.log()` (not visible in production)
- No centralized logging framework

**Validation:**
- GitHub repo URL validation in `fetchExamples()`: checks for `https://github.com` prefix
- SPARQL endpoint validation implicit (relies on endpoint response)
- Query validation delegated to SPARQL endpoint

**Authentication:**
- No built-in authentication
- SPARQL endpoint credentials passed via URL if needed
- Bitly API token hardcoded in `script.js` line 180 (for permalink generation)

**Configuration:**
- Global variables set at `snorql.js` startup: `_endpoint`, `_examples_repo`, `_defaultGraph`, `_showLiteralType`
- Can be overridden via Docker at container startup via `script.sh` using sed
- URL parameters override defaults for endpoint

---

*Architecture analysis: 2026-03-04*
