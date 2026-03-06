# Structuring your SPARQL examples repository

Snorql-UI pulls example queries from a public GitHub repository. It reads the repo's file tree through the GitHub API and shows every `.rq` file it finds. Everything else is ignored.

## File layout

Put your `.rq` files in the repository root, or organize them into folders. Folders show up as collapsible groups in the examples panel. The UI handles up to two levels of nesting:

```
my-sparql-examples/
  list-classes.rq              # appears at top level
  schema/
    properties.rq              # appears under "schema"
    datatypes.rq
  pathways/
    by-organism/
      human-pathways.rq        # appears under "pathways > by-organism"
```

Three levels deep is the maximum. Anything nested further won't show up.

## Comment headers

Each `.rq` file can include comment headers at the top. They're all optional -- without them, the UI just cleans up the filename and uses that as the display name.

```sparql
# title: Human pathways
# description: Lists all pathways for Homo sapiens with their identifiers
# category: Pathways, Species

SELECT ?pathway ?id WHERE {
  ?pathway a wp:Pathway ;
           wp:organism <http://purl.obolibrary.org/obo/NCBITaxon_9606> ;
           dcterms:identifier ?id .
}
```

`# title:` sets the display name in the tree. Without it, the filename gets cleaned up (strip `.rq`, replace dashes and underscores with spaces).

`# description:` adds a short explanation that appears as a popover when someone selects the query. You can split long descriptions across multiple `# description:` lines -- they get joined with a space.

`# category:` tags the query for the category filter buttons above the examples panel. Comma-separated values assign a query to multiple categories. Categories are independent from the folder structure, so a file sitting in the `schema/` folder can have `# category: Genes` and it'll appear under the "Genes" filter.

## Parameters

Parameters turn a static query into a fill-in-the-blank form. Users see labeled input fields instead of raw SPARQL.

The header format uses pipe separators: `# param: name|type|default|label`

```sparql
# title: Find genes by name
# description: Search for genes matching a text pattern
# category: Genes
# param: gene_name|string|TP53|Gene name or symbol

SELECT ?gene ?label WHERE {
  ?gene a wp:GeneProduct ;
        rdfs:label ?label .
  FILTER(CONTAINS(LCASE(?label), LCASE("{{gene_name}}")))
}
```

The four pipe-separated fields:

- **name** -- placeholder used in `{{name}}` in the query body
- **type** -- `string`, `uri`, or `enum:value1,value2,value3`
- **default** -- pre-filled value shown in the input
- **label** -- text displayed next to the input

For enum types, the UI renders a dropdown instead of a text field:

```sparql
# param: organism|enum:Homo sapiens,Mus musculus,Rattus norvegicus|Homo sapiens|Select organism
```

You can have multiple parameters. One `# param:` line per parameter.

## Connecting your repo

Set the `examplesRepo` field in `config.js`:

```javascript
// Whole repository
examplesRepo: "https://github.com/your-org/sparql-examples"

// Subdirectory within a repository
examplesRepo: "https://api.github.com/repos/your-org/your-repo/contents/sparql-queries"
```

The repository must be public. GitHub allows 60 unauthenticated API requests per hour, but Snorql-UI caches responses in sessionStorage so repeated page loads in the same browser session don't hit the API again.

## Example repositories

- WikiPathways: https://github.com/wikipathways/SPARQLQueries
- SARS-CoV-2 (subfolder): https://api.github.com/repos/egonw/SARS-CoV-2-Queries/contents/sparql
