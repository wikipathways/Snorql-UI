# Fork Guide

Snorql-UI is a browser-based SPARQL query interface. It connects to any SPARQL endpoint, displays results as tables, and can load example queries from a GitHub repository. This guide covers everything you need to deploy Snorql-UI against your own RDF database.

No backend language is required. Snorql-UI is static HTML, CSS, and JavaScript served by any web server or opened directly in a browser.

## Quick Start (Static Files)

1. Fork or clone the repository:
   ```bash
   git clone https://github.com/wikipathways/Snorql-UI.git my-sparql-ui
   cd my-sparql-ui
   ```

2. Edit `assets/js/config.js` and set `endpoint` to your SPARQL endpoint URL:
   ```javascript
   window.SNORQL_CONFIG = {
       endpoint: "https://your-server.example.org/sparql",
       // ... other fields
   };
   ```

3. Open `index.html` in a browser. The UI will connect to your endpoint and you can start running queries.

## Quick Start (Docker)

1. Fork or clone the repository:
   ```bash
   git clone https://github.com/wikipathways/Snorql-UI.git my-sparql-ui
   cd my-sparql-ui
   ```

2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and set `SNORQL_ENDPOINT` to your SPARQL endpoint URL:
   ```
   SNORQL_ENDPOINT=https://your-server.example.org/sparql
   ```

4. Copy the Docker Compose template and start the services:
   ```bash
   cp docker-compose.example.yml docker-compose.yml
   docker compose up -d
   ```

5. Open `http://localhost:8088` in a browser.

## Configuration Reference

All configuration lives in `assets/js/config.js`. Edit this file to customize the UI for your deployment.

| Field | Default | Description |
|-------|---------|-------------|
| `endpoint` | `http://localhost:8890/sparql` | SPARQL endpoint URL. The UI sends all queries here. |
| `examplesRepo` | `""` (empty) | GitHub repository URL containing `.rq` example files. Leave empty to hide the examples panel. |
| `defaultGraph` | `""` (empty) | Default named graph for queries. Leave empty to use the endpoint's default. |
| `title` | `My SPARQL Explorer` | Browser tab title and header text. |
| `poweredByLink` | `https://github.com/wikipathways/snorql-extended` | URL for the "Powered by" link in the footer. |
| `poweredByLabel` | `Snorql - Extended Edition` | Text for the "Powered by" link in the footer. |
| `showLiteralType` | `false` | When `true`, displays RDF literal datatypes (e.g., `^^xsd:string`) in query results. |
| `renderers.enableSVGRenderer` | `false` | When `true`, renders SVG content inline in result table cells instead of showing the raw markup. |
| `renderers.enableSMILESRenderer` | `false` | When `true`, renders SMILES chemical structure strings as images via the CDKDepict service. Only useful for chemistry datasets. |
| `namespaces` | 7 standard prefixes | RDF namespace prefix mappings used to display compact QNames (e.g., `rdfs:label` instead of full URIs) in query results. |
| `linkouts` | `[]` (empty) | Ordered array of navbar linkout buttons, each `{ label, url, authors?, icon? }`, rendered by `assets/js/linkouts.js`. Empty (the default) renders none. See [Navbar Linkouts](#navbar-linkouts) below. |

**Note:** For Docker deployments, three fields (`endpoint`, `title`, `examplesRepo`) are set via `.env` environment variables and injected at container startup. All other `config.js` fields (including `linkouts`) must be edited directly in the file — see the Docker note under [Navbar Linkouts](#navbar-linkouts) for the config-file override path.

## Navbar Linkouts

Add tutorial, documentation, or credit buttons to the navbar entirely through configuration — no source edits per instance. Define an ordered `linkouts` array on `window.SNORQL_CONFIG` in `assets/js/config.js`:

```javascript
linkouts: [
  { label: "Tutorial", url: "https://example.org/tutorial", icon: "book" },
  { label: "Credits",  url: "https://example.org/about", authors: "Jane Doe et al." }
]
```

Each entry's fields:

| Field | Required | Description |
|-------|----------|-------------|
| `label` | yes | Button text. Rendered as plain text — any HTML is escaped. |
| `url` | yes | Link target. Only `http:`, `https:`, and `mailto:` schemes are allowed; `javascript:`/`data:` (and obfuscated variants) are rejected and the entry is skipped. |
| `authors` | no | Attribution string. When present it becomes the button's accessible name (`aria-label`/`title`); otherwise `label` is used. |
| `icon` | no | A Bootstrap-3 glyphicon suffix (e.g. `book` → `glyphicon-book`). Allowlisted to `[a-z0-9-]`; invalid suffixes are silently dropped. |

Buttons open in a new tab and carry `rel="noopener noreferrer"`. They render in array order. An empty or absent array renders no buttons and logs no console error, so the default is safe for every deployment.

### Docker config-file override (linkouts is config-file-only)

`linkouts` is **not** env/`.env`-injectable — unlike `endpoint`, `title`, and `examplesRepo`, it cannot be set through environment variables (a multi-line array of objects cannot be safely substituted at container start). To customize `linkouts` in a Docker deployment, bind-mount your own `config.js` over the one in the image:

```yaml
services:
  snorql:
    volumes:
      - ./my-config.js:/usr/local/apache2/htdocs/assets/js/config.js:ro
```

Your mounted `config.js` must define the full `window.SNORQL_CONFIG` object (copy the in-repo file and edit the `linkouts` array).

### Trust boundary — do not weaken the sanitizers

The `linkouts` array is untrusted input: it travels through git, mounted files, and potentially third-party pull requests, then is rendered directly into the navbar DOM. `assets/js/linkouts.js` therefore (1) writes `label`/`authors` via `textContent` only — never `innerHTML` — and (2) allowlists URL schemes to `http`/`https`/`mailto`. These are correctness requirements, not stylistic choices. Removing the escaping reintroduces XSS via a crafted label; removing the scheme check reintroduces `javascript:` execution via a crafted URL.

Linkouts is the reference example for adding new config-driven UI features — see [CONTRIBUTING.md](CONTRIBUTING.md#config-driven-ui-extensions).

## Adding SPARQL Examples

Snorql-UI loads example queries from a public GitHub repository. Each query is a `.rq` file with optional comment headers that control how the query appears in the examples panel.

The supported comment headers are `#title:`, `#description:`, `#category:`, and `#param:`.

### Comment Header Reference

| Header | Required | Description |
|--------|----------|-------------|
| `# title:` | No | Display name in the examples panel. Falls back to the filename if omitted. |
| `# description:` | No | Short description shown when the query is selected. |
| `# category:` | No | Groups the query under a category in the tree view. |
| `# param:` | No | Declares a parameter. Format: `# param: name type description` |

### Basic Example

```sparql
# title: List all classes
# description: Returns all RDF classes defined in the dataset
# category: Schema

SELECT DISTINCT ?class ?label
WHERE {
  ?class a owl:Class .
  OPTIONAL { ?class rdfs:label ?label }
}
ORDER BY ?class
LIMIT 100
```

### Parameterized Example

Parameters let users fill in values before running a query. The `{{name}}` placeholder in the query body is replaced with the user's input.

```sparql
# title: Find resources by label
# description: Search for resources matching a text pattern
# category: Search
# param: pattern string Enter search text

SELECT ?resource ?label
WHERE {
  ?resource rdfs:label ?label .
  FILTER(CONTAINS(LCASE(?label), LCASE("{{pattern}}")))
}
LIMIT 50
```

The `# param:` header format is: `# param: name type description`
- **name** -- the placeholder name used in `{{name}}`
- **type** -- `string`, `uri`, or `enum(value1,value2,value3)`
- **description** -- label shown in the parameter input form

### Setting Up Your Examples Repository

1. Create a public GitHub repository for your `.rq` files.
2. Add your query files to the repository root or organize them in folders (folders become categories in the tree view).
3. Set `examplesRepo` in `config.js` to the repository URL:
   ```javascript
   examplesRepo: "https://github.com/your-org/your-sparql-queries",
   ```
4. If your queries are in a subdirectory, use the GitHub API URL format:
   ```javascript
   examplesRepo: "https://api.github.com/repos/your-org/your-repo/contents/sparql",
   ```

The UI fetches the file list from the GitHub API and displays them in the examples panel automatically.

## Docker Environment Variables

The `.env` file controls Docker deployment settings. Copy `.env.example` to `.env` and edit the values.

| Variable | Default | Description |
|----------|---------|-------------|
| `SNORQL_ENDPOINT` | `http://localhost:8890/sparql` | SPARQL endpoint URL as seen from the browser. |
| `SNORQL_EXAMPLES_REPO` | (empty) | GitHub repository URL for example queries. |
| `SNORQL_TITLE` | `My SPARQL Explorer` | Browser tab title. |
| `SNORQL_PORT` | `8088` | Port for the Snorql-UI web interface. |
| `DEFAULT_GRAPH` | (empty) | Default named graph for queries. |
| `SNORQL_EXAMPLES_BRANCH` | `master` | Branch of the examples repository. |
| `WELCOME_TITLE`, `WELCOME_MESSAGE` | (config.js) | Welcome panel heading and HTML message. |
| `SNORQL_QUERY_TIMEOUT_MS`, `SNORQL_MAX_GET_URL_BYTES`, `SNORQL_SEND_PREFIX_BLOCK` | (config.js) | Reliability settings, see below. |
| `SNORQL_BITLY_TOKEN` | (config.js) | Bitly token for short permalinks; set it empty to disable shortening. |
| `VIRTUOSO_PASSWORD` | `dba123` | Virtuoso admin password. Change this for production. |
| `VIRTUOSO_HTTP_PORT` | `8890` | Virtuoso HTTP and SPARQL endpoint port. |

See `.env.example` for the full list of variables including Virtuoso container settings and CORS configuration.

## Customizing the UI

Prefer an **overlay** to a code fork: build your image `FROM` the published engine image
and copy in only your own files, so updating is a matter of bumping the engine tag.

```dockerfile
FROM ghcr.io/wikipathways/snorql-ui:1.2
COPY config.js /usr/local/apache2/htdocs/assets/js/config.js
COPY theme.css /usr/local/apache2/htdocs/assets/css/theme.css
COPY images/   /usr/local/apache2/htdocs/assets/images/
```

Environment variables (above) still apply on top of your `config.js`. Keep the keys that
`script.sh` rewrites (`endpoint`, `title`, `welcomeMessage`, ...) on a single line each.

### Logo, favicon, footer, endpoint label

Set these in `config.js` (applied by `assets/js/branding.js`); see the commented example
there. The footer is a list of plain-text strings, `{ label, url, title }` links and
`{ image, url, alt, height }` images. Text is never parsed as HTML and URLs are limited to
http(s)/mailto, so there is no way (and no need) to inject raw markup.

### Colours and layout

Put CSS in `assets/css/theme.css`. It is empty in the engine and loaded after `style.css`.

### Namespaces

Add your domain-specific namespace prefixes to the `namespaces` object in `config.js`. These prefixes are used to display compact QNames in query results instead of full URIs.

```javascript
namespaces: {
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    // Add your prefixes:
    ex: "http://example.org/ontology#",
    schema: "http://schema.org/"
}
```

## Reliability Tuning (v1.2)

Three `CONFIG` keys in `assets/js/config.js` tune the query-execution path. All three are missing-safe — older forked `config.js` files without these keys continue to work using the documented defaults.

| Key | Default | Purpose |
|-----|---------|---------|
| `queryTimeoutMs` | `60000` | XHR timeout for SPARQL queries (milliseconds). Hung requests fail in bounded time. Bump for federated/heavy aggregations. |
| `maxGetUrlBytes` | `4000` | Threshold above which queries are sent via POST instead of GET, and above which "Get Permalink" refuses with a clear message. Measured against the URL-encoded prefixed query. |
| `sendPrefixBlock` | `'auto'` | PREFIX block delivery mode (see below). |

### `sendPrefixBlock` modes

- **`'auto'`** (default) — Scan the user's query for prefix references (e.g. `cur:Foo`) and prepend ONLY the matching `CONFIG.namespaces` entries that are NOT already declared inline. Recommended for forks targeting Stardog / GraphDB / Fuseki, which reject duplicate prefix declarations on strict mode.
- **`true`** — Force-prepend every entry in `CONFIG.namespaces` that is not already declared inline. Predictable; slightly heavier URL.
- **`false`** — Skip prepending entirely. Recommended for Virtuoso-only forks that rely on server-registered prefixes and want to minimize URL length.

### CORS requirements for POST fallback

When a query exceeds `maxGetUrlBytes`, Snorql sends it as `POST` with `Content-Type: application/x-www-form-urlencoded`. Together with the existing `Accept: application/sparql-results+json` header, this triggers a CORS preflight (`OPTIONS`) request. Self-hosted endpoints must respond with at least:

```
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Accept, Content-Type
Access-Control-Allow-Origin: <your origin or *>
```

The bundled `enable-cors.sh` script handles this for Virtuoso. Other engines (Fuseki, GraphDB, Stardog) ship their own CORS configuration mechanisms — consult engine docs.

> **Note:** Snorql sends form-urlencoded POST only. It does NOT use `Content-Type: application/sparql-query` — that direct-body POST form has a confirmed Virtuoso bug ([virtuoso-opensource#842](https://github.com/openlink/virtuoso-opensource/issues/842)) and is intentionally locked out for v1.2.

## Troubleshooting

**Queries fail with a CORS error.**
Your SPARQL endpoint must allow cross-origin requests from the domain where Snorql-UI is hosted. If using the included Virtuoso container, run `./scripts/enable-cors.sh` after starting the services. For other endpoints, configure CORS on the server side or deploy Snorql-UI on the same origin as the endpoint.

**Examples panel is empty.**
Check that `examplesRepo` in `config.js` (or `SNORQL_EXAMPLES_REPO` in `.env`) points to a valid, public GitHub repository URL. The repository must contain `.rq` files. Private repositories are not supported without a GitHub API token.

**Health dot stays red.**
The health indicator checks connectivity to the SPARQL endpoint. Verify the `endpoint` URL in `config.js` is correct and that the SPARQL server is running and reachable from the browser. Browser developer tools (Network tab) will show the failing request.

**Docker container won't start.**
Ensure `.env` exists in the project root and contains valid values. Run `docker compose config` to check for syntax errors. Common issues: missing `.env` file (copy from `.env.example`), port conflicts with other services, or invalid characters in environment variable values.
