# Codebase Concerns

**Analysis Date:** 2026-03-04

## Security Vulnerabilities

### Hardcoded Bitly API Token

**Risk:** Public API token exposed in source code
- Files: `assets/js/script.js` (line 180)
- Token: `b0021fe4839aefbc4e7967b3578443d9ea6e89bf`
- Impact: Anyone with access to repo can abuse Bitly API limits, potentially shorten arbitrary URLs with this token, or perform quota exhaustion attacks
- Current mitigation: Token is in git history and publicly visible
- Recommendations:
  - Rotate this token immediately
  - Move to environment variable `SNORQL_BITLY_TOKEN`
  - Inject via `script.sh` at container startup (like endpoint configuration)
  - Never commit secrets - add `*.env` to `.gitignore` if not already present
  - Consider requiring users to provide their own Bitly token via configuration

### eval() in SPARQL JSON Parsing

**Risk:** Arbitrary code execution vulnerability
- Files: `assets/js/sparql.js` (line 274)
- Problem: `eval('(' + text + ')')` used to parse JSON responses from SPARQL endpoints
- Impact: If a SPARQL endpoint is compromised or MitM attack occurs, attacker can execute arbitrary JavaScript in user's browser
- Current mitigation: Regex validation checks for "bad characters" but eval is still dangerous
- Recommendations:
  - Replace with `JSON.parse()` immediately - modern browsers support it
  - The regex validation (`/[^,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t]/`) is not sufficient protection against eval injection
  - This is a critical vulnerability in production deployments

### innerHTML Assignment with Unsanitized Content

**Risk:** Cross-Site Scripting (XSS) vulnerabilities
- Files:
  - `assets/js/snorql.js` (lines 276, 280, 415, 483)
  - `assets/js/script.js` (lines 160, 163)
- Problem: SPARQL endpoint responses and fetched HTML are assigned directly to innerHTML without sanitization
- Scenarios:
  1. Line 276 in `snorql.js`: Error messages from SPARQL endpoint regex-matched from `<pre>` tags - attacker-controlled SPARQL endpoint could inject malicious HTML
  2. Line 280 in `snorql.js`: Full response HTML assigned directly - SPARQL endpoint compromise = XSS
  3. Line 160 in `script.js`: Table HTML from prefix endpoint fetched and inserted - endpoint response not validated
  4. Lines 415, 483 in `snorql.js`: SVG/image templates created with innerHTML - less risky but still unsafe pattern
- Impact: Stored/Reflected XSS attacks if SPARQL endpoint or fetched content is compromised
- Current mitigation: Users must trust the SPARQL endpoint completely
- Recommendations:
  - Use `textContent` for plain text, not `innerHTML`
  - For HTML content, sanitize with DOMPurify or similar
  - Parse SPARQL responses as JSON, don't assume HTML structure
  - Validate endpoints are HTTPS in production
  - Add Content Security Policy headers in Apache config (Dockerfile)

## Data Flow Security Issues

### Unvalidated Endpoint URL in Script.sh

**Risk:** Shell injection in configuration injection
- Files: `script.sh` (lines 6, 12, 19, 25)
- Problem: Environment variables injected directly into sed commands without quoting
- Example: `sed -i -e 's#var _endpoint = '".*"';#var _endpoint = "'"${SNORQL_ENDPOINT}"'";#g'`
- Impact: If `SNORQL_ENDPOINT` contains special characters (e.g., `#` or `&`), sed delimiter will break and inject code
- Current mitigation: Docker environment controlled, but manually set .env files are vulnerable
- Recommendations:
  - Properly escape sed delimiters or use different delimiter
  - Use `sed -i -e "s|var _endpoint = .*|var _endpoint = \"${SNORQL_ENDPOINT}\"|"` with pipe delimiter and proper escaping
  - Validate endpoint URL format before injection
  - Consider using jq for JSON files instead of sed

### CORS Configuration in Docker Compose

**Risk:** Overly permissive CORS origin matching
- Files: `docker-compose.example.yml` (lines 28-32)
- Problem: Comments recommend `CORS_ORIGINS="*"` for development - insecure pattern carries to production
- Impact: If CORS_ORIGINS remains `*`, any website can make SPARQL queries on behalf of users
- Current mitigation: Documentation warns about it, but default is risky
- Recommendations:
  - Default to `localhost` for development
  - Require explicit configuration in production
  - Document that `*` should never be used in production
  - Validate CORS_ORIGINS format in enable-cors.sh script

## Tech Debt & Code Quality

### Unsafe Legacy Cookie Persistence Functions

**Risk:** Code maintains backwards compatibility with removed feature
- Files: `assets/js/snorql.js` (lines 11-36, 51-59)
- Problem: `setCookie()`, `getCookie()` functions still defined even though cookie persistence removed (see CLAUDE.md)
- Impact: Confusion about whether cookies are used; functions could be called accidentally; dead code maintenance burden
- Current mitigation: Comments indicate removal, but code left in place
- Recommendations:
  - Remove `setCookie()` and `getCookie()` functions entirely
  - Keep only `clearLegacyCookies()` for migration support
  - Remove `onchange` handlers from HTML that reference removed functions (`changeEndpoint()`, `changeExamplesRepo()`)

### Deprecated/Non-functional Event Handlers

**Risk:** Dead code in HTML
- Files: `index.html` (lines 48, 95)
- Problem: `onchange="changeEndpoint();"` and `onchange="changeExamplesRepo();"` handlers call empty stub functions
- Impact: User confusion - changing endpoint/repo appears to do nothing in UI
- Current mitigation: Functions exist but are empty (lines 51-59 in snorql.js)
- Recommendations:
  - Remove event handlers from HTML
  - Clear UI expectation - these changes are session-only
  - Consider adding visual indication that changes are temporary

### Missing Error Handling in Critical Paths

**Risk:** Silent failures in GitHub example fetching
- Files: `assets/js/snorql.js` (lines 73-226)
- Problem: `mainAjax()` and `fetchExamples()` have no error handling for GitHub API failures
- Impact: If GitHub API is down or rate-limited, no feedback to user - examples panel appears empty
- Current mitigation: None visible
- Recommendations:
  - Add `.fail()` handler to AJAX in `mainAjax()` at line 75
  - Show error message when GitHub API is unreachable
  - Implement rate limit detection and user notification
  - Add timeout handling for slow GitHub API responses

### Export Functionality Type Confusion

**Risk:** Incorrect MIME types in export
- Files: `assets/js/snorql.js` (lines 517-535)
- Problem:
  - Line 524: JSON export uses `'data:text/csv;charset=utf8,'` instead of `'data:application/json'`
  - Line 531: XML export uses `'data:text/csv;charset=utf8,'` instead of `'data:application/xml'`
- Impact: Downloaded files may be incorrectly identified by OS; users might accidentally open in wrong application
- Current mitigation: File extensions (.json, .xml) added to filename
- Recommendations:
  - Fix MIME types: use `application/json` and `application/xml`
  - Verify CSV export (line 578) uses correct `text/csv` type
  - Test with actual file download to verify OS recognition

### Naive Query String Parameter Parsing

**Risk:** Potential parameter injection or parsing edge cases
- Files: `assets/js/snorql.js` (lines 38-49), duplicate in `assets/js/script.js` (lines 53-64)
- Problem:
  - Manual string splitting without proper URL parsing
  - Duplicate code (function defined twice)
  - No handling of malformed URLs
- Impact: Edge cases like `?q=&q=` could cause unexpected behavior
- Current mitigation: `decodeURIComponent()` used, but parsing is fragile
- Recommendations:
  - Use `URLSearchParams` API instead: `new URLSearchParams(location.search).get('q')`
  - Remove duplicate `findGetParameter()` function
  - Centralize URL parsing logic

## Performance & Scalability

### No Query Result Pagination

**Risk:** Large result sets cause performance degradation
- Files: `assets/js/snorql.js` (lines 326-367)
- Problem: All results rendered into HTML table at once - 1000+ rows = browser lag
- Impact: Queries returning large datasets become unusable; memory issues on low-end devices
- Current mitigation: None
- Recommendations:
  - Implement virtual scrolling with dynamic row rendering
  - Add pagination controls (First, Previous, Next, Last)
  - Show result count upfront and warn user for >1000 results
  - Consider server-side pagination (SPARQL LIMIT/OFFSET)

### Unnecessary GitHub API Calls on Page Load

**Risk:** Multiple duplicate API calls without caching
- Files: `assets/js/snorql.js` (lines 244-245)
- Problem: `fetchExamples()` called twice - once for normal view, once for fullscreen
- Impact: Rate limit exhaustion; slow initial page load
- Current mitigation: None
- Recommendations:
  - Cache GitHub tree response in memory/sessionStorage
  - Fetch once, render for both views
  - Add Last-Modified header checking to avoid unnecessary re-fetches

### CodeMirror Initialization on Every Page

**Risk:** Large library loaded and initialized even for static usage
- Files: `index.html` (lines 20-25), `assets/js/snorql.js` (lines 66-70)
- Problem: CodeMirror (+ all dependencies) loaded for read-only display in some deployment scenarios
- Impact: Unnecessary bundle size; slower initial render
- Current mitigation: None
- Recommendations:
  - Consider lazy-loading CodeMirror if read-only mode exists
  - Minify CodeMirror build (currently using full non-minified)

## Testing Gaps

### Incomplete Test Coverage

**Risk:** Critical paths not tested
- Files: `__tests__/sparql.test.js` (comprehensive), but no tests for `snorql.js` or `script.js`
- What's not tested:
  - `doQuery()` and result rendering (`displayResult()`, `jsonToHTML()`)
  - Error handling in `onFailure()`
  - Export functionality (`exportResults()`, `exportCSV()`)
  - GitHub example fetching (`fetchExamples()`)
  - Cookie functions and GDPR flow
  - URL parameter parsing and sharing
- Files missing tests: `assets/js/snorql.js`, `assets/js/script.js`
- Impact: Refactoring and bug fixes are high-risk; regressions undetected
- Priority: High - these are user-facing features
- Recommendations:
  - Add unit tests for HTML manipulation functions
  - Add integration tests for GitHub API fetching
  - Add tests for error scenarios (SPARQL endpoint down, invalid response)
  - Mock fetch/AJAX calls to test error handling
  - Aim for 80%+ coverage on core logic

### No E2E Tests

**Risk:** Real-world integration not validated
- Problem: No automated tests for full query → result flow
- Impact: UI regressions, endpoint integration issues discovered only by users
- Recommendations:
  - Add E2E tests with Playwright or Cypress
  - Test query submission, result rendering, export
  - Test GitHub examples loading
  - Test with actual SPARQL endpoint (or mock server)

## Fragile Areas

### GitHub Tree Structure Parsing

**Risk:** Brittle nested folder handling
- Files: `assets/js/snorql.js` (lines 84-162)
- Problem:
  - Hard-coded support for exactly 1, 2, or 3 path segments
  - If GitHub returns 4+ nested levels, files silently ignored
  - Complex nested loop logic with potential index collision bugs
  - No handling for files vs. folders disambiguation
- Impact: Repos with deeper folder structures won't display correctly
- Safe modification: Add comprehensive tests before touching this code
- Test coverage: None
- Recommendations:
  - Refactor to recursive tree builder
  - Test with deeply nested repository (3+ levels)
  - Add unit tests for tree structure generation

### SVG/SMILES Image Rendering

**Risk:** Unsafe embedding in HTML
- Files: `assets/js/snorql.js` (lines 405-416, 473-485)
- Problem:
  - SVG data embedded with `xlink:href` - potential XSS if URL is attacker-controlled
  - SMILES rendering via external CDKDepict service - depends on third-party availability
  - No validation of image URLs before embedding
- Impact: If SPARQL query results contain malicious SVG URLs, XSS possible
- Safe modification: Validate URLs (must be data URIs or trusted domains)
- Recommendations:
  - Whitelist trusted image hosts (e.g., `simolecule.com`)
  - Use `src` instead of `xlink:href` when possible
  - Add Content-Security-Policy to restrict image sources
  - Test with malicious URLs in result set

## Dependencies at Risk

### Deprecated Libraries

**Risk:** Using outdated versions with known vulnerabilities
- Bootstrap 3.3 (last release June 2017) - no longer supported
  - Files: `index.html`, `assets/css/bootstrap.min.css`, `assets/js/bootstrap.min.js`
  - Migration path: Upgrade to Bootstrap 5 (CSS/JS rewrite needed) or replace with modern CSS framework
  - Impact: Known XSS/CSS injection vulnerabilities in old Bootstrap versions
- jQuery 3.x (pinned version unclear from minified code)
  - Files: `assets/js/jquery.min.js`
  - Recommendation: Verify version, consider Vue/React if major refactor happens
- CodeMirror (version unclear, potentially outdated)
  - Recommendation: Check version, consider Monaco Editor as alternative
- Documentation recommends no build process, making dependency updates difficult

### Missing Dependency Documentation

**Risk:** Unclear which versions are in use
- Problem: Minified JS files with no version info in code
- Impact: Can't track security vulnerabilities, can't update safely
- Recommendations:
  - Add version comments to minified files or move to npm/package.json
  - Consider using CDN with version pinning in HTML
  - Document all external dependencies with URLs

## Configuration & Deployment Risks

### Default Docker Password Not Changed

**Risk:** Insecure default Virtuoso password
- Files: `docker-compose.example.yml` (line 42), `.env.example`
- Problem: `VIRTUOSO_PASSWORD=dba123` is default - documentation doesn't emphasize change in production
- Impact: If Docker compose is misconfigured, Virtuoso exposes RDF data to any user on network
- Current mitigation: Comments mention "change in production"
- Recommendations:
  - Use random password generation in .env.example
  - Add validation in `script.sh` to error if password is default value
  - Document as CRITICAL setup step in README

### No HTTPS Configuration in Docker

**Risk:** Unencrypted query transmission in production
- Files: `Dockerfile` (line 11 exposes only 80), `docker-compose.example.yml` (line 80 optional)
- Problem: HTTPS port is optional and not configured with certificates
- Impact: SPARQL queries sent in plaintext; endpoint credentials (if used) exposed
- Current mitigation: Users must add SSL reverse proxy
- Recommendations:
  - Add Let's Encrypt integration to Docker setup
  - Require HTTPS in production deployments
  - Document SSL setup clearly

### Missing API Rate Limiting

**Risk:** No protection against abuse
- Files: Bitly API calls (`script.js`), GitHub API calls (`snorql.js`)
- Problem: No client-side rate limiting; no server-side protection documented
- Impact: Bitly token quota exhaustion; GitHub API rate limit (60 req/hr anonymous)
- Current mitigation: None
- Recommendations:
  - Implement exponential backoff for API calls
  - Cache GitHub responses with ETags
  - Warn user when approaching GitHub rate limits
  - Add request throttling to Bitly shortener

## Known Functional Issues

### Fullscreen Mode Display Bug

**Risk:** Incomplete UI state management
- Files: `assets/js/script.js` (lines 137-147)
- Problem: Fullscreen navbar and footer visibility hard-coded with display property changes
- Impact: Could conflict with CSS media queries or custom styles
- Recommendations:
  - Use CSS classes instead of inline `style` manipulation
  - Test fullscreen mode across browsers and screen sizes

### Cookie Modal Dialog Flow

**Risk:** GDPR compliance unclear
- Files: `assets/js/script.js` (lines 6-29)
- Problem: Cookie decision navigation redirects to `cookies.html` - URL manipulation seems fragile
- Impact: If navigation fails, user stuck in bad state
- Recommendations:
  - Add try/catch around window.location.href
  - Consider simpler in-page disclosure instead of redirect
  - Test on slow networks and mobile

## Test Coverage Statistics

- **Coverage report exists:** Yes (`coverage/` directory)
- **Test files:** Only 2 files tested (`sparql.test.js`, `namespaces.test.js`)
- **Main source files:** 5+ files with critical logic (`snorql.js`, `script.js`, `sparql.js`, `namespaces.js`)
- **Estimated coverage:** ~40% - core SPARQL protocol tested, user-facing features untested

---

*Concerns audit: 2026-03-04*
