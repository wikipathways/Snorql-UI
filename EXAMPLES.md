# Structuring your SPARQL examples repository

This page describes the `.rq` format (`examplesFormat: "rq"`). For examples as `.ttl` files with
permanent identifiers, versions and metadata (`examplesFormat: "index"`), see
[tools/examples/README.md](tools/examples/README.md).

Snorql-UI pulls example queries from a public GitHub repository. It lists the repo's files through jsDelivr (GitHub's API as fallback) and shows every `.rq` file it finds. Everything else is ignored.

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

`# category:` is accepted but not used by the editor: the tree follows the folders. (In the `.ttl` format, categories do set the tree.)

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
examplesRepo: "https://github.com/your-org/sparql-examples",
examplesBranch: "main"   // default "master"
```

Only whole repositories are supported (`https://github.com/<owner>/<repo>`); every `.rq` file in
the branch is listed, in its folder.

The repository must be public. The file list comes from jsDelivr, with GitHub's API (60 unauthenticated requests per hour) as fallback, and is cached for an hour in localStorage, so repeated page loads don't list the repository again.

## Example repositories

- WikiPathways: https://github.com/wikipathways/SPARQLQueries
- AOP-Wiki: https://github.com/marvinm2/AOP-Wiki-Queries
