# Snorql-UI

## What This Is

A generic, forkable SPARQL query interface that makes RDF data accessible to non-technical users. The repository serves as both a reusable template (fork, configure, deploy) and the production WikiPathways SPARQL explorer. Built with HTML5, CSS3, jQuery, and Bootstrap 3 — no build system, no backend.

## Core Value

Non-technical users (biologists, researchers, data consumers) can find, understand, and run SPARQL queries without knowing the query language.

## Requirements

### Validated

<!-- Existing capabilities inferred from codebase -->

- ✓ SPARQL query editor with syntax highlighting (CodeMirror) — existing
- ✓ Query execution against configurable SPARQL endpoint — existing
- ✓ Result rendering as HTML table with special handling (SVG, SMILES, URIs) — existing
- ✓ GitHub-based example query loading (.rq files from any repo) — existing
- ✓ Tree-view navigation for example queries — existing
- ✓ Export results to CSV/JSON/XML — existing
- ✓ Permalink generation for sharing queries — existing
- ✓ Fullscreen editor mode — existing
- ✓ Docker deployment with environment variable configuration — existing
- ✓ Config injection at container startup (endpoint, title, examples repo) — existing
- ✓ Namespace prefix management for URI-to-QName conversion — existing
- ✓ GDPR cookie consent banner — existing

### Active

<!-- New scope for this milestone -->

- [ ] Example queries have plain-language titles and descriptions
- [ ] Example queries are organized by categories/tags with filtering
- [ ] Example queries support editable parameters (fill-in-the-blank fields)
- [ ] WikiPathways-specific content externalized from core (config-driven separation)
- [ ] Fork experience requires only config changes (no code edits needed)
- [ ] Namespaces configurable via external config (not hardcoded)
- [ ] Clear documentation for forking and customization

### Out of Scope

- Visual SPARQL query builder — high complexity, better examples approach chosen instead
- Natural language to SPARQL — AI dependency, out of scope for static frontend
- Framework migration (React/Vue) — current jQuery/Bootstrap 3 stack stays
- Backend/server-side code — remains a pure frontend application
- User authentication — not needed for public SPARQL exploration
- Real-time collaboration — not relevant to query exploration use case

## Context

This is a brownfield project with a working codebase. The existing UI already handles SPARQL query editing, execution, and result display well. The main gaps are:

1. **Examples UX** — the current tree-view shows raw filenames from GitHub. Non-technical users can't tell what a query does without opening it. No categories, no descriptions, no way to customize queries without editing SPARQL.

2. **Generic vs WikiPathways** — WikiPathways-specific content (namespaces, default endpoint, branding) is mixed into the core code. Forking requires finding and replacing these references.

3. **Fork friction** — while Docker config is already externalized via `.env`, some customization still requires editing JavaScript files directly (namespaces, special result rendering like SMILES/SVG).

The target audience spans three groups: researchers who want data without learning SPARQL, data consumers who browse and export, and developers who fork to create their own SPARQL UI instances.

## Constraints

- **Tech stack**: jQuery 3.x, Bootstrap 3.3, CodeMirror, vanilla JS — no framework changes
- **No build system**: Must remain deployable as static files with no compilation step
- **GitHub API dependency**: Example queries fetched from GitHub repos — must work within GitHub API rate limits
- **Backward compatibility**: Existing WikiPathways deployment must continue working during and after changes

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep jQuery/Bootstrap 3 stack | Works well enough, modernization not worth the effort for this scope | — Pending |
| Config-driven WikiPathways separation | Cleaner than branches, allows single codebase to serve multiple deployments | — Pending |
| Better examples over query builder | Lower complexity, serves 80% of non-technical user needs | — Pending |
| Editable parameters in examples | Lets users customize queries without understanding SPARQL syntax | — Pending |

---
*Last updated: 2026-03-04 after initialization*
