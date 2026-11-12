# Example queries as .ttl files

Snorql-UI can read its example queries from a repository of Turtle files, one per
example, instead of `.rq` files. Each file holds the query and its metadata in the format
of [SIB's sparql-examples](https://github.com/sib-swiss/sparql-examples), plus a few terms
from the Snorql vocabulary ([`ns/snorql.ttl`](../../ns/snorql.ttl),
`https://w3id.org/snorql/ns#`). The repository's CI checks the files and publishes an
index, and the editor reads that index (`examplesFormat: "index"` in `config.js`).

What this gives over `.rq` files:

- **Permanent identifiers.** Every example has one (`WPQ036`) that ends its IRI. Links use
  it (`?example=WPQ036`), so files can be renamed and moved; old paths keep working.
- **Versions.** Each example has its own `MAJOR.MINOR.PATCH` version. CI checks that it
  goes up when the example changes, every published version stays available
  (`?example=WPQ036&version=1.0.0`), and tagged releases freeze the whole set.
- **Metadata.** Creators and contributors (ORCID), dates, licence, categories, keywords,
  federated endpoints, references, deprecation, expected results.
- **Standard format.** The files work with SIB's tools and can be loaded into a triple store,
  e.g. at the endpoint's `/.well-known/sparql-examples`.
- **Queries that run as they are.** Parameters are bound in a `VALUES` block that holds the
  default, so the query is valid SPARQL anywhere; the editor replaces the value in that block.

The WikiPathways examples ([wikipathways/SPARQLQueries](https://github.com/wikipathways/SPARQLQueries),
see its `AUTHORING.md`) are the reference for the format.

## Repository layout

| File | What it holds |
|---|---|
| `collection.ttl` | One `snorql:ExampleCollection`: `schema:name`, `void:uriSpace` (IRI base of the examples) and `snorql:identifierPrefix` (e.g. `WPQ`) |
| `categories.ttl` | The categories as `skos:Concept`s with `skos:prefLabel`, `sh:order` and `skos:broader` |
| `contributors.ttl` | A `schema:name` for every creator and contributor IRI |
| any other `*.ttl` | One example each; folders are free (hidden folders and `.github`, `scripts`, `tests` are skipped) |

## An example

```turtle
wpq:WPQ036 a sh:SPARQLExecutable, sh:SPARQLSelectExecutable ;
    dcterms:identifier "WPQ036" ;                      # IRI = void:uriSpace + identifier
    rdfs:label "Genes of a Pathway"@en ;
    rdfs:comment "Lists all gene products in a given pathway."@en ;
    schema:version "1.0.0" ;
    dcterms:created "2020-10-11"^^xsd:date ;
    dcterms:creator <https://orcid.org/0000-0003-2230-0840> ;
    dcterms:license <https://www.gnu.org/licenses/gpl-3.0.html> ;
    dcterms:subject wpcat:General ;
    schema:target <https://sparql.wikipathways.org/sparql> ;
    snorql:alias "D. General/GenesofPathway.rq" ;      # old path, for old links
    snorql:expect [ snorql:minResults 1 ] ;
    sh:parameter [
        a sh:Parameter ;
        sh:path param:pathwayId ;                       # name in links; also the variable
        sh:name "Pathway ID" ;
        sh:defaultValue "WP1560" ;
        sh:datatype xsd:string ;
        snorql:autocomplete "pathway" ;                 # a list from config.js autocompleteTypes
        sh:order 1
    ] ;
    sh:select """PREFIX dcterms: <http://purl.org/dc/terms/>
SELECT ?pathway WHERE {
  VALUES ?pathwayId { "WP1560" }
  ?pathway dcterms:identifier ?pathwayId .
}""" .
```

Required: identifier, label, comment, version, created, creator, licence, subject, target
and one query (`sh:select`, `sh:ask`, `sh:construct` or `spex:describe`). Parameter options:

- `sh:datatype xsd:string`: the value is a string literal;
- `sh:nodeKind sh:IRI` with `snorql:valueTemplate "https://identifiers.org/wikipathways/{value}"`:
  the user's value, percent-encoded, goes into the IRI; without a template the value is a full IRI;
- `snorql:option [ rdf:value "DataNode" ; rdfs:label "Data Nodes" ; sh:order 1 ]`: a fixed list;
- `snorql:variable "pathway"`: the variable the `VALUES` block binds, when it is not the parameter name;
- no `sh:defaultValue` and `VALUES ?aop { UNDEF }`: an optional parameter. Left empty in the editor,
  the variable stays unbound, so the query runs without that constraint (e.g. all AOPs).

`shapes.ttl` is the SHACL profile of all this; `snorql_examples.py check` runs it together
with the checks SHACL cannot express.

## Commands

`snorql_examples.py` needs Python 3.10+ and `pip install -r requirements.txt`.

```bash
python snorql_examples.py --repo <examples checkout> check          # validate the working tree
python snorql_examples.py --repo <...> versions --base origin/master # version bumps in a pull request
python snorql_examples.py --repo <...> next-id                       # next free identifier
python snorql_examples.py --repo <...> build --out <dir>             # write the published index
python snorql_examples.py --repo <...> live [--only WPQ036]          # run against the endpoints
python snorql_examples.py --repo <...> stage-sib --out <dir>         # layout for SIB's test jar
```

`check` reports: identifiers that do not match the prefix or the IRI, duplicate
identifiers, missing required fields, a parameter without exactly one `VALUES` block
holding its default, `SERVICE` calls without `spex:federatesWith` (and the reverse), unknown
categories, people without a name, queries rdflib cannot parse, and SHACL violations.

`versions` compares with a base commit. A changed example must get a higher version: PATCH
for metadata, at least MINOR when the query or its parameters change, MAJOR when the result
columns change. A removed identifier is an error (deprecate it with `owl:deprecated true`
instead), and so is an identifier that was used before.

Tests: `python -m pytest tools/examples`.

## CI

Call the reusable workflow from the examples repository:

```yaml
on:
  pull_request:
  push:
    branches: [master]
    tags: ['*']
jobs:
  examples:
    uses: wikipathways/Snorql-UI/.github/workflows/examples-index.yml@v1.4.0
    with:
      tools-ref: v1.4.0
      publish: ${{ github.event_name != 'pull_request' }}
      sib-project: MyProject
    permissions:
      contents: write
```

It runs `check`, `versions` (on pull requests) and SIB's sparql-examples-utils test (the jar is
checked against its sha256) in a read-only job. With `publish: true` it builds the index from the
default branch, whichever ref triggered the run, and force-pushes it to the `examples-index`
branch; a tag push then only adds the new release to `history.json`.

## The published index (schema 1)

The `examples-index` branch holds:

| File | Content |
|---|---|
| `index.json` | `{ schema: 1, generated, repository, commit, collection, categories: [...], examples: [...] }` |
| `history.json` | `{ schema: 1, examples: { <id>: [{ version, commit, date, path }] }, releases: { <tag>: { commit, date, versions: { <id>: <version> } } } }` |
| `versions/<id>/<version>.json` | The example as it was at that version (same fields as in `index.json`, plus `commit`) |
| `sparql-examples.ttl` | All examples, categories, contributors and the collection in one Turtle file |
| `rq/<path>.rq` | Each example as an `.rq` file with the old comment header and `{{name}}` placeholders |

An example in `index.json` has: `id`, `iri`, `label`, `description`, `version`, `created`,
`modified` (date of its current version), `creators` and `contributors` (`[{ iri, name }]`),
`license`, `categories` (IRIs), `keywords`, `level`, `target`, `federatesWith`, `references`,
`derivedFrom`, `testedAgainst`, `deprecated`, `replacedBy`, `queryType`, `query`, `params`,
`expect`, `path` and `aliases` (old paths). A parameter has `name`, `variable`, `label`,
`description`, `order`, `kind` (`literal` or `iri`), `valueTemplate`, `default`,
`autocomplete` and `options` (`[{ value, label }]`). The history only covers commits on the
first-parent line of the branch, so a version stays reachable after later merges.

The editor reads the index from `https://raw.githubusercontent.com/<repo>/examples-index/`,
or from `examplesIndexUrl` when that is set. Without a published index it falls back to
listing `.rq` files.
