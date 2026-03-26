# Requirements: Snorql-UI

**Defined:** 2026-03-26
**Core Value:** Non-technical users can find, understand, and run SPARQL queries without knowing the query language

## v1.1 Requirements

Requirements for v1.1 Query Templates & UI Enhancements. Each maps to roadmap phases.

### Template Consolidation

- [ ] **TMPL-01**: User can run a single parameterized datacounts query instead of multiple near-duplicate queries
- [ ] **TMPL-02**: User can run a single parameterized average-count query instead of multiple near-duplicate queries
- [ ] **TMPL-03**: User can run a single parameterized datasource-count query instead of multiple near-duplicate queries
- [ ] **TMPL-04**: User can run a single parameterized entity-per-species query instead of multiple near-duplicate queries
- [ ] **TMPL-05**: User can run a single parameterized community stats query instead of multiple near-duplicate queries
- [ ] **TMPL-06**: User can run a single parameterized "X of pathway" query instead of multiple near-duplicate queries
- [ ] **TMPL-07**: Query title updates dynamically when user changes parameter values in the form
- [ ] **TMPL-08**: User can select entity types, datasources, and other domain values via autocomplete dropdowns (beyond pathwayId/species)

### Description Panel

- [x] **DESC-01**: User sees a styled description area above the query panel showing the selected query's title and description
- [x] **DESC-02**: User sees a welcome/intro message explaining the tool when no query is selected

## Future Requirements

### Result Linkouts (deferred from v1.1)

- **LINK-01**: User sees configurable action buttons on result URIs matching deployment-specific patterns
- **LINK-02**: User can have multiple linkout actions per result column

### Bug Fixes (addressable independently)

- **BUG-01**: Long queries sent via HTTP POST instead of failing silently (GH #7)
- **BUG-02**: Cookie rejection redirects to correct URL, not hardcoded WikiPathways (GH #6)
- **BUG-03**: 504 timeouts show friendly error message (GH #15)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Result linkouts (GH #21) | Deferred to future milestone — not prioritized for v1.1 |
| Visual query builder (GH #22) | High complexity, better examples approach chosen |
| SPARQL editor warnings (GH #14) | Non-trivial CodeMirror lint integration, not core to v1.1 goals |
| LaTeX/Markdown export (GH #13) | Nice-to-have, not aligned with template consolidation focus |
| Natural language to SPARQL | AI dependency, out of scope for static frontend |
| Framework migration (React/Vue) | Current jQuery/Bootstrap 3 stack stays |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TMPL-01 | Phase 8 | Pending |
| TMPL-02 | Phase 8 | Pending |
| TMPL-03 | Phase 8 | Pending |
| TMPL-04 | Phase 8 | Pending |
| TMPL-05 | Phase 8 | Pending |
| TMPL-06 | Phase 8 | Pending |
| TMPL-07 | Phase 7 | Pending |
| TMPL-08 | Phase 7 | Pending |
| DESC-01 | Phase 6 | Complete |
| DESC-02 | Phase 6 | Complete |

**Coverage:**
- v1.1 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0

---
*Requirements defined: 2026-03-26*
*Last updated: 2026-03-26 after roadmap creation*
