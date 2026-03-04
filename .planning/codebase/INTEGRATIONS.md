# External Integrations

**Analysis Date:** 2026-03-04

## APIs & External Services

**SPARQL Endpoints:**
- Wikipedia SPARQL endpoint (default: `https://sparql.wikipathways.org/sparql/`)
  - SDK/Client: Custom `SPARQL.Service` class (`assets/js/sparql.js`)
  - Method: HTTP GET or POST (configurable)
  - Protocol: W3C SPARQL Query Results JSON Format
  - Use: User queries executed against configurable SPARQL endpoint

**GitHub API:**
- Service: GitHub REST API v3
  - Use: Fetch SPARQL example files from user-specified repository
  - Endpoint: `https://api.github.com/repos/{owner}/{repo}/git/trees/master?recursive=1`
  - Integration: `fetchExamples()` in `assets/js/snorql.js`
  - No authentication required (public repos)
  - Returns: JSON tree of repository files
  - Fetches: `.rq` files (SPARQL query files) from GitHub repository
  - Raw file access: `https://raw.githubusercontent.com/{owner}/{repo}/master/{path}`

**URL Shortening:**
- Bitly API
  - Service: Bitly URL shortening
  - Endpoint: `https://api-ssl.bitly.com/v4/shorten`
  - Auth: Bearer token (hardcoded in `assets/js/script.js` line 180)
  - Method: POST with JSON payload
  - Use: Generates shareable short links for SPARQL queries
  - Triggered by: "Get Permalink" button click
  - Response: JSON with shortened URL

**Chemical Structure Rendering:**
- simolecule CDKDepict Service
  - Service: `https://www.simolecule.com/cdkdepict/`
  - Use: Renders SMILES chemical notation as SVG images
  - Endpoint: `/depict/bow/svg?smi={smiles}&zoom=2.0&annotate=none&bgcolor=transparent`
  - Integration: Dynamic image generation in `nodeToHTML()` function (`assets/js/snorql.js` line 475)
  - Trigger: When query result variable name is `smilesDepict`
  - Fallback: Shows placeholder image if rendering fails

## Data Storage

**Databases:**
- OpenLink Virtuoso 7.2.11 (optional - only if using included docker-compose service)
  - Type: RDF triplestore with SPARQL endpoint
  - Connection: HTTP interface on port 8890
  - Client: None (HTTP SPARQL protocol only)
  - Configuration: Environment variables in `.env`
    - `VIRTUOSO_HOST` - Hostname (default: localhost)
    - `VIRTUOSO_HTTP_PORT` - HTTP port (default: 8890)
    - `VIRTUOSO_ISQL_PORT` - ISQL port (default: 1111)
    - `VIRTUOSO_PASSWORD` - DBA password (default: dba123)
  - Note: Can be replaced with any SPARQL 1.1 compliant endpoint

**File Storage:**
- Local filesystem only
- No persistent file storage in containerized deployment
- Example data loaded manually via scripts or external tools

**Caching:**
- Browser localStorage (removed in recent versions)
- Previously stored endpoint and examples repo URLs (cleared on startup)

## Authentication & Identity

**Auth Provider:**
- None - Application is completely unauthenticated
- SPARQL endpoint authentication: Depends on endpoint configuration
  - If endpoint requires auth: Not currently supported by client
  - Current implementation: No auth headers sent

**Bitly Token:**
- Static bearer token hardcoded in `assets/js/script.js`
- Not configurable via environment
- Risk: Token embedded in client-side code is public

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- Browser console (via `console.log()`)
- Container logs (Apache httpd access/error logs)
- No structured logging

## CI/CD & Deployment

**Hosting:**
- Docker container (primary)
- Container registry: Not specified (built locally via `docker build`)
- Optional: Apache httpd on any server (static deployment)

**CI Pipeline:**
- Docker Compose configuration validation
- ESLint JavaScript linting
- Jest unit tests
- No automated deployment pipeline detected

## Environment Configuration

**Required env vars (critical):**
- `SNORQL_ENDPOINT` - SPARQL endpoint URL
- `SNORQL_EXAMPLES_REPO` - GitHub repo with example queries

**Optional env vars:**
- `SNORQL_TITLE` - Page title (default: My SPARQL Explorer)
- `DEFAULT_GRAPH` - Default RDF graph URI
- `SNORQL_PORT` - Web interface port (default: 8088)
- `VIRTUOSO_PASSWORD` - Only if using included Virtuoso service

**Secrets location:**
- `.env` file (git-ignored, not committed)
- Bitly token: Hardcoded in source (security risk)

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- GitHub API calls (read-only) to fetch example queries
- SPARQL endpoint calls (read-only by default)
- Bitly API calls (POST for URL shortening)

## CORS & Preflight Requests

**Requirement:**
- Browser-based SPARQL execution requires CORS headers from endpoint
- Default Virtuoso endpoints need CORS enabled via script

**Configuration:**
```bash
# CORS can be enabled via enable-cors.sh script
CORS_ORIGINS="*"              # Development
CORS_ORIGINS="http://yourdomain.com"  # Production
```

## Notable Integrations

**Wikipedia/WikiPathways Context:**
- Powered by link: `https://github.com/wikipathways/snorql-extended`
- Data source: WikiPathways SPARQL endpoint
- Reference: DOI `10.1093/nar/gkad960`

**Namespace Prefixes:**
- Hardcoded RDF namespace mappings in `assets/js/namespaces.js`
- Supports: RDF, RDFS, OWL, Dublin Core, FOAF, Wikidata, and 15+ others
- No dynamic prefix discovery except via Virtuoso `?help=nsdecl` endpoint

---

*Integration audit: 2026-03-04*
