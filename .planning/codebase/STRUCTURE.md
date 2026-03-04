# Codebase Structure

**Analysis Date:** 2026-03-04

## Directory Layout

```
Snorql-UI/
├── index.html                     # Main entry point - HTML UI template
├── cookies.html                   # Cookie policy page
├── script.sh                      # Docker entrypoint - injects config via sed
├── Dockerfile                     # Containerization
├── docker-compose.yml             # Docker Compose config (generated from .example)
├── docker-compose.example.yml     # Docker Compose template
├── .env.example                   # Configuration template
├── package.json                   # Node.js metadata and build scripts
├── jest.config.js                 # Jest test configuration
├── .eslintrc.json                 # ESLint linting rules
├── .eslintignore                  # ESLint exclusions
│
├── assets/                        # Static web assets
│   ├── js/                        # JavaScript source files
│   │   ├── jquery.min.js          # jQuery library
│   │   ├── bootstrap.min.js       # Bootstrap library
│   │   ├── bootstrap-treeview.min.js # Tree view component
│   │   ├── sparql.js              # SPARQL protocol implementation (653 lines)
│   │   ├── snorql.js              # Core business logic (602 lines)
│   │   ├── script.js              # Event handlers and UI control (204 lines)
│   │   ├── namespaces.js          # RDF namespace prefix definitions (23 lines)
│   │   └── lib/                   # Third-party libraries
│   │
│   ├── codemirror/                # CodeMirror editor components
│   │   ├── lib/
│   │   │   └── codemirror.js      # CodeMirror core
│   │   ├── mode/
│   │   │   └── javascript/        # JS syntax highlighting (used for SPARQL)
│   │   ├── addon/                 # CodeMirror extensions
│   │   │   ├── selection/
│   │   │   ├── edit/
│   │   │   └── display/
│   │   └── sparql.js              # SPARQL mode for CodeMirror
│   │
│   ├── css/                       # Stylesheets
│   │   ├── bootstrap.min.css      # Bootstrap framework
│   │   ├── bootstrap-treeview.min.css
│   │   └── style.css              # Application-specific styles (91 lines)
│   │
│   ├── images/                    # Image assets
│   │   ├── favicon.ico
│   │   ├── wikipathways-snorql-logo.png
│   │   └── noimage.png            # Fallback for broken images
│   │
│   └── fonts/                     # Webfonts
│       └── glyphicons-halflings-regular.* # Bootstrap glyphicons
│
├── __tests__/                     # Jest test files
│   ├── namespaces.test.js         # Tests for RDF namespaces (82 lines)
│   └── sparql.test.js             # Tests for SPARQL protocol (275 lines)
│
├── scripts/                       # Shell scripts for deployment
│   ├── config.sh                  # Shared configuration sourced by other scripts
│   ├── data-loader.sh             # Generic RDF data loader with validation
│   ├── enable-cors.sh             # Virtuoso CORS enablement
│   ├── load-rdf-example.sh        # Load example RDF data
│   ├── load.sh.template           # Template for bulk RDF loading
│   └── wikipathways-loader.sh     # WikiPathways-specific data loader
│
├── .planning/                     # GSD planning documents
│   └── codebase/                  # Analysis output (created by /gsd:map-codebase)
│       ├── ARCHITECTURE.md
│       ├── STRUCTURE.md
│       ├── CONVENTIONS.md
│       ├── TESTING.md
│       ├── STACK.md
│       ├── INTEGRATIONS.md
│       └── CONCERNS.md
│
├── test-setup/                    # Test fixtures and setup
│   └── data/                      # Test data files
│
├── coverage/                      # Jest coverage reports (generated)
│   └── lcov-report/
│
├── db/ and db2/                   # Local database data (ignored in .gitignore)
│   └── data/
│
├── snorql-extended/               # Extended version files (separate variant)
│   └── .well-known/
│
├── tmp/                           # Temporary files (ignored)
│
└── ep2-local/                     # Local endpoint configuration files
```

## Directory Purposes

**assets/js/:**
- Purpose: Core application JavaScript files
- Contains: SPARQL protocol, business logic, event handlers, namespace definitions
- Key files: `snorql.js` (core), `sparql.js` (protocol), `script.js` (events), `namespaces.js` (config)

**assets/codemirror/:**
- Purpose: CodeMirror editor and plugins for SPARQL syntax highlighting
- Contains: Editor core, modes, addons, SPARQL language definition
- Key files: `lib/codemirror.js`, `mode/javascript/`, `sparql.js`

**assets/css/:**
- Purpose: Styling and layout
- Contains: Bootstrap framework, custom application styles
- Key files: `bootstrap.min.css`, `style.css` (application-specific only 91 lines)

**__tests__/:**
- Purpose: Jest test files
- Contains: Unit tests for SPARQL protocol and namespaces
- Key files: `sparql.test.js` (275 lines), `namespaces.test.js` (82 lines)

**scripts/:**
- Purpose: Docker and deployment utilities
- Contains: RDF data loading, CORS configuration, Virtuoso setup
- Key files: `config.sh` (shared config), `data-loader.sh` (generic loader), `enable-cors.sh`

**.planning/codebase/:**
- Purpose: GSD codebase analysis documents
- Contains: Architecture, structure, conventions, testing, stack, integrations, concerns
- Generated by: `/gsd:map-codebase` command

## Key File Locations

**Entry Points:**
- `index.html`: Main HTML page - loads all CSS, libraries, and JS files in order
- `script.sh`: Docker container entrypoint - injects environment variables via sed

**Configuration:**
- `.env.example`: Template for environment variables (SNORQL_ENDPOINT, SNORQL_EXAMPLES_REPO, SNORQL_TITLE, etc.)
- `docker-compose.example.yml`: Docker Compose template with variable substitution
- `jest.config.js`: Test runner configuration
- `.eslintrc.json`: Linting rules

**Core Logic:**
- `assets/js/snorql.js`: Query execution, result rendering, examples fetching (602 lines) - PRIMARY BUSINESS LOGIC
- `assets/js/sparql.js`: SPARQL protocol implementation, HTTP communication (653 lines)
- `assets/js/script.js`: jQuery event handlers, modal management, UI interaction (204 lines)
- `assets/js/namespaces.js`: RDF namespace prefix mappings (23 lines)

**Testing:**
- `__tests__/sparql.test.js`: Unit tests for SPARQL.Service and SPARQL.Query classes
- `__tests__/namespaces.test.js`: Validation tests for namespace prefix definitions

## Naming Conventions

**Files:**
- HTML: `index.html`, `cookies.html` (kebab-case not used)
- JavaScript: `snorql.js`, `sparql.js`, `script.js`, `namespaces.js` (lowercase with hyphens avoided)
- CSS: `style.css`, `bootstrap.min.css` (minified files use .min.js/.min.css)
- Test files: `*.test.js` suffix (Jest convention)
- Config files: `.eslintrc.json`, `jest.config.js`, `docker-compose.yml` (dot-prefixed or camelCase)

**Directories:**
- Lowercase: `assets/`, `scripts/`, `coverage/`, `__tests__/`
- JavaScript subfolder: `assets/js/` (single letter for brevity)
- Third-party: `assets/codemirror/`, `assets/css/`, `assets/fonts/`, `assets/images/`
- Doubled underscores: `__tests__/`, `.planning/` (Jest/GSD conventions)

**JavaScript Identifiers:**
- Global variables: UPPERCASE with underscore prefix `_endpoint`, `_examples_repo`, `_defaultGraph`
- Functions: camelCase `doQuery()`, `fetchExamples()`, `displayResult()`, `nodeToHTML()`
- Classes/Constructors: PascalCase `SPARQL.Service`, `SPARQL.Query`
- Namespace objects: UPPERCASE `SPARQL`, `snorql_namespacePrefixes`
- Private fields: Leading underscore `_endpoint`, `_service`, `_default_graphs`

## Where to Add New Code

**New Feature (query-related logic):**
- Primary code: `assets/js/snorql.js` - add functions near similar functionality
- Tests: `__tests__/` - create new test file following `*.test.js` pattern
- UI handlers: `assets/js/script.js` - add jQuery event handlers if button/form interaction needed
- Example: Adding CSV export functionality → extend `exportResults()` in snorql.js

**New Component/Module:**
- Implementation: `assets/js/{feature-name}.js` - e.g., `assets/js/query-builder.js`
- Tests: `__tests__/{feature-name}.test.js`
- Include in `index.html` after other script tags in correct order (dependencies first)
- Example: Custom query builder → create new JS file, write tests, add to index.html

**Utilities/Helpers:**
- Shared helpers: Add functions to existing relevant files
- Namespace-related utilities: `assets/js/namespaces.js`
- Result formatting utilities: `assets/js/snorql.js`
- DOM/UI utilities: `assets/js/script.js`
- SPARQL communication utilities: `assets/js/sparql.js`

**Styles:**
- Application-specific: `assets/css/style.css` (currently only 91 lines of custom styles)
- Do not modify Bootstrap directly - override in style.css
- Use CSS classes matching HTML element IDs where possible

**Configuration Changes:**
- Update `.env.example` with new variable
- Document in `CLAUDE.md` under "Configuration"
- Update `docker-compose.example.yml` if Docker-related
- Update `scripts/config.sh` if shell script needs the variable

## Special Directories

**assets/codemirror/:**
- Purpose: Third-party CodeMirror editor library
- Generated: No (bundled)
- Committed: Yes
- Notes: Large directory but essential for SPARQL syntax highlighting

**coverage/:**
- Purpose: Jest code coverage reports
- Generated: Yes (created by `npm run test:coverage`)
- Committed: No (in .gitignore)
- View with: Open `coverage/lcov-report/index.html` in browser

**db/ and db2/:**
- Purpose: Virtuoso SPARQL endpoint database files
- Generated: Yes (created by Docker Compose)
- Committed: No (in .gitignore)
- Notes: Local development databases, different instances for testing

**test-setup/:**
- Purpose: Test fixtures and sample data
- Generated: No
- Committed: Yes
- Contains: Sample RDF files, test configurations

**snorql-extended/:**
- Purpose: Extended version with additional features
- Generated: No
- Committed: Yes
- Notes: Variant of main application, some config differences

**ep2-local/:**
- Purpose: Local endpoint configuration overrides
- Generated: No
- Committed: Yes
- Notes: Development-specific configuration files

---

*Structure analysis: 2026-03-04*
