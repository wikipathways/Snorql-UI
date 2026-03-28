# Roadmap: Snorql-UI

## Milestones

- [x] **v1.0 MVP** --- Phases 1-5 (shipped 2026-03-06)
- [ ] **v1.1 Query Templates & UI Enhancements** --- Phases 6-8 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-5) --- SHIPPED 2026-03-06</summary>

- [x] Phase 1: Security and Config Foundation (2/2 plans) --- completed 2026-03-04
- [x] Phase 2: Example Metadata and GitHub Reliability (3/3 plans) --- completed 2026-03-05
- [x] Phase 3: Interaction Improvements and Parameterization (2/2 plans) --- completed 2026-03-05
- [x] Phase 4: Fork Experience (2/2 plans) --- completed 2026-03-06
- [x] Phase 5: Stale Reference Cleanup & Docs Alignment (1/1 plan) --- completed 2026-03-06

</details>

### v1.1 Query Templates & UI Enhancements

**Milestone Goal:** Consolidate near-duplicate example queries into parameterized templates and add a description panel for better query context.

- [ ] **Phase 6: Description Panel** - Styled query info area with welcome message and per-query descriptions
- [ ] **Phase 7: Template Infrastructure** - Dynamic title rendering and new autocomplete parameter types
- [ ] **Phase 8: Template Consolidation** - Author parameterized templates replacing 30+ near-duplicate queries

## Phase Details

### Phase 6: Description Panel
**Goal**: Users see contextual information about the selected query in a visible, styled panel above the editor
**Depends on**: Phase 5 (v1.0 complete)
**Requirements**: DESC-01, DESC-02
**Success Criteria** (what must be TRUE):
  1. When user selects an example query, a styled panel above the editor shows the query's title, description, and category badges
  2. When no query is selected (page load or after clearing), a welcome message explains what the tool does and how to get started
  3. When user manually edits the query in the editor, the description panel hides or dims to indicate it no longer describes the editor contents
  4. The description panel does not consume excessive vertical space on small screens (max-height with overflow or collapse)
**Plans:** 2 plans

Plans:
- [x] 06-01-PLAN.md -- Category removal, config keys, CSS foundation, HTML skeleton
- [x] 06-02-PLAN.md -- Panel state machine, event wiring, welcome/active/stale behavior

**UI hint**: yes

### Phase 7: Template Infrastructure
**Goal**: The parameter system supports dynamic title updates and new autocomplete types needed by consolidated templates
**Depends on**: Phase 6
**Requirements**: TMPL-07, TMPL-08
**Success Criteria** (what must be TRUE):
  1. When user changes a parameter value in the form, the query title in the description panel updates to reflect the current selection (e.g., "Count of [Genes] in [Homo sapiens]")
  2. User can select entity types, datasources, and other domain-specific values via autocomplete dropdowns in the parameter form (not just pathwayId and species)
  3. New autocomplete types are dispatched by the `#param` type field, not by parameter name matching
**Plans:** 2 plans

Plans:
- [x] 07-01-PLAN.md -- Autocomplete type registry, generic functions, parser extension
- [x] 07-02-PLAN.md -- Type-dispatched buildParamPanel, dynamic title rendering

**UI hint**: yes

### Phase 8: Template Consolidation
**Goal**: Near-duplicate query families are replaced by parameterized templates that produce equivalent SPARQL
**Depends on**: Phase 7
**Requirements**: TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05, TMPL-06
**Success Criteria** (what must be TRUE):
  1. User can run a single datacounts template and select the entity type via parameter, producing the same results as the individual queries it replaces
  2. User can run parameterized templates for average counts, datasource counts, entity-per-species, community stats, and X-of-pathway queries, each with appropriate parameter dropdowns
  3. Each consolidated template has a descriptive title, description, and category that display correctly in the description panel
  4. The total number of example queries in the tree view is visibly reduced (30+ individual queries become 6-10 templates)
  5. Selecting different parameter values in any consolidated template updates the live SPARQL preview in the editor
**Plans:** 3 plans

Plans:
- [ ] 08-01-PLAN.md -- Enum value=label parsing, community autocomplete type, cur: namespace
- [ ] 08-02-PLAN.md -- Datacounts, average, datasource, per-species templates (TMPL-01 to TMPL-04)
- [ ] 08-03-PLAN.md -- Community templates (TMPL-05), X-of-pathway migration (TMPL-06), cleanup

## Progress

**Execution Order:**
Phases execute in numeric order: 6 -> 7 -> 8

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Security and Config Foundation | v1.0 | 2/2 | Complete | 2026-03-04 |
| 2. Example Metadata and GitHub Reliability | v1.0 | 3/3 | Complete | 2026-03-05 |
| 3. Interaction Improvements and Parameterization | v1.0 | 2/2 | Complete | 2026-03-05 |
| 4. Fork Experience | v1.0 | 2/2 | Complete | 2026-03-06 |
| 5. Stale Reference Cleanup & Docs Alignment | v1.0 | 1/1 | Complete | 2026-03-06 |
| 6. Description Panel | v1.1 | 0/2 | Planned | - |
| 7. Template Infrastructure | v1.1 | 0/2 | Planned | - |
| 8. Template Consolidation | v1.1 | 0/3 | Not started | - |

---
*Full v1.0 details: .planning/milestones/v1.0-ROADMAP.md*
