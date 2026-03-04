# Technology Stack

**Analysis Date:** 2026-03-04

## Languages

**Primary:**
- HTML5 - Markup for UI structure (`index.html`)
- CSS3 - Styling and layout (`assets/css/`)
- JavaScript (ES5/ES6) - Client-side logic and interactivity (`assets/js/`)

**Secondary:**
- Bash - Docker entrypoint and configuration scripts (`script.sh`, `entrypoint.sh`)

## Runtime

**Environment:**
- Apache HTTP Server 2.4 - Web server container runtime
- Node.js (development only) - Testing and linting

**Package Manager:**
- npm - JavaScript package manager
- Lockfile: `package-lock.json` (present in git history)

## Frameworks

**Core:**
- Bootstrap 3.3 - Responsive UI framework (`assets/css/bootstrap.min.css`, `assets/js/bootstrap.min.js`)
- CodeMirror - SPARQL query editor with syntax highlighting (`assets/codemirror/`)
  - Includes SPARQL mode (`assets/codemirror/sparql.js`)
  - Fullscreen addon (`assets/codemirror/addon/display/fullscreen.js`)
  - Active line highlighting addon

**UI Components:**
- bootstrap-treeview - Tree view widget for SPARQL examples (`assets/js/bootstrap-treeview.min.js`)
- jQuery 3.x - DOM manipulation and AJAX (`assets/js/jquery.min.js`)

**Testing:**
- Jest 29.7.0 - Unit testing framework
- jest-environment-jsdom 29.7.0 - DOM environment for Jest tests

**Build/Dev:**
- ESLint 8.57.0 - JavaScript linting

## Key Dependencies

**Critical:**
- jQuery 3.x - DOM and AJAX operations for query execution and result rendering
- CodeMirror - SPARQL syntax-aware text editor with line numbers and bracket matching
- Bootstrap 3.3 - CSS framework for responsive layout and modals
- bootstrap-treeview - Hierarchical display of GitHub-hosted SPARQL examples

**Infrastructure:**
- None - This is a pure frontend application with no backend dependencies

## Configuration

**Environment:**
- Injected at container runtime via environment variables (no .env parsing in client)
- Docker Compose reads `.env` file and passes variables to container
- Container entrypoint (`entrypoint.sh`) uses `sed` to inject config into static files

**Key Environment Variables:**
```
SNORQL_ENDPOINT          # SPARQL endpoint URL (default: https://sparql.wikipathways.org/sparql/)
SNORQL_EXAMPLES_REPO     # GitHub repo URL with .rq example files
SNORQL_TITLE             # Browser tab title (default: My SPARQL Explorer)
DEFAULT_GRAPH            # Default RDF graph URI (optional)
SNORQL_CONTAINER         # Container name (default: my-snorql)
SNORQL_PORT              # Port for web UI (default: 8088)
VIRTUOSO_CONTAINER       # Virtuoso container name (default: my-virtuoso)
VIRTUOSO_HOST            # Virtuoso hostname (default: localhost)
VIRTUOSO_HTTP_PORT       # Virtuoso HTTP port (default: 8890)
VIRTUOSO_ISQL_PORT       # Virtuoso ISQL port (default: 1111)
VIRTUOSO_USER            # Virtuoso admin user (default: dba)
VIRTUOSO_PASSWORD        # Virtuoso admin password (default: dba123)
SPARQL_UPDATE            # Allow SPARQL UPDATE queries (default: false)
CORS_ORIGINS             # CORS allowed origins for Virtuoso (default: *)
```

**Build:**
- Dockerfile builds Apache httpd image with static assets
- No build step - files are copied as-is into container
- Configuration injection happens at container startup

**Configuration Flow:**
1. `.env.example` → `.env` (user copies and customizes)
2. Docker Compose reads `.env` and sets environment variables
3. Container startup runs `entrypoint.sh` → `script.sh`
4. `script.sh` uses `sed` to inject config into:
   - `assets/js/snorql.js` - SPARQL endpoint and examples repo URLs
   - `index.html` - Page title

## Platform Requirements

**Development:**
- Node.js (for linting and testing)
- npm
- Docker and Docker Compose (for containerized deployment)
- Any HTTP server or direct file opening (for local development)

**Production:**
- Docker and Docker Compose
- OpenLink Virtuoso 7.2.11 (optional - can use external SPARQL endpoint)
- Standard HTTP/HTTPS infrastructure

## Deployment Targets

**Containerized:**
- Docker - Primary deployment method via `docker-compose.example.yml`
- Exposed on port 8088 (HTTP) and 8443 (HTTPS optional)
- Apache httpd inside container serves static files

**Static File Hosting:**
- Can be deployed to any static file hosting service (GitHub Pages, AWS S3, Netlify, etc.)
- No build process required - `index.html` and `assets/` can be deployed directly

---

*Stack analysis: 2026-03-04*
