window.SNORQL_CONFIG = {
    endpoint: "https://sparql.wikipathways.org/sparql/",
    examplesRepo: "https://github.com/wikipathways/SPARQLQueries",
    defaultGraph: "",
    title: "My SPARQL Explorer",
    poweredByLink: "https://github.com/wikipathways/snorql-extended",
    poweredByLabel: "Snorql - Extended Edition",
    showLiteralType: false,
    renderers: {
        enableSVGRenderer: false,
        enableSMILESRenderer: false
    },
    namespaces: {
        rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        rdfs: "http://www.w3.org/2000/01/rdf-schema#",
        owl: "http://www.w3.org/2002/07/owl#",
        xsd: "http://www.w3.org/2001/XMLSchema#",
        dc: "http://purl.org/dc/elements/1.1/",
        dcterms: "http://purl.org/dc/terms/",
        foaf: "http://xmlns.com/foaf/0.1/",
        cur: "http://vocabularies.wikipathways.org/wp#Curation:"
    },
    autocompleteTypes: {
        pathway: {
            sparql: 'PREFIX dcterms: <http://purl.org/dc/terms/>\n' +
                'PREFIX dc: <http://purl.org/dc/elements/1.1/>\n' +
                'PREFIX wp: <http://vocabularies.wikipathways.org/wp#>\n' +
                'SELECT DISTINCT (str(?wpId) as ?id) (str(?title) as ?name) (str(?orgName) as ?species)\n' +
                'WHERE { ?pw a wp:Pathway ; dcterms:identifier ?wpId ; dc:title ?title ; wp:organismName ?orgName . }\n' +
                'ORDER BY ?wpId',
            valueField: 'id',
            labelField: 'name',
            extraField: 'species',
            placeholder: 'Type pathway ID or name...'
        },
        species: {
            sparql: 'PREFIX wp: <http://vocabularies.wikipathways.org/wp#>\n' +
                'SELECT DISTINCT ?species WHERE {\n' +
                '  ?pw a wp:Pathway ; wp:organismName ?species .\n' +
                '} ORDER BY ?species',
            valueField: 'species',
            placeholder: 'Type species name...'
        },
        entityType: {
            sparql: null,
            staticValues: ['GeneProduct', 'Metabolite', 'Protein', 'Rna', 'Complex'],
            valueField: 'value',
            placeholder: 'Select entity type...'
        },
        datasource: {
            sparql: null,
            staticValues: ['ChEBI', 'Chemspider', 'Ensembl', 'Entrez Gene',
                           'HMDB', 'HGNC Accession Number', 'PubChem',
                           'Rhea', 'Uniprot', 'Wikidata'],
            valueField: 'value',
            placeholder: 'Select datasource...'
        },
        interactionType: {
            sparql: null,
            staticValues: ['Binding', 'Catalysis', 'ComplexBinding', 'Conversion',
                           'Inhibition', 'Stimulation', 'TranscriptionTranslation', 'Translocation'],
            valueField: 'value',
            placeholder: 'Select interaction type...'
        },
        community: {
            sparql: 'PREFIX wp: <http://vocabularies.wikipathways.org/wp#>\n' +
                'SELECT DISTINCT (REPLACE(STR(?tag), "^.*Curation:", "") AS ?community) WHERE {\n' +
                '  ?pw a wp:Pathway ; wp:ontologyTag ?tag .\n' +
                '  FILTER(STRSTARTS(STR(?tag), "http://vocabularies.wikipathways.org/wp#Curation:"))\n' +
                '} ORDER BY ?community',
            valueField: 'community',
            placeholder: 'Type community name...'
        }
    },
    welcomeTitle: "SPARQL Query Explorer",
    welcomeMessage: "<p>Browse and run SPARQL queries against the WikiPathways database.</p><ul><li><strong>Browse examples</strong> in the tree on the right to find a query</li><li><strong>Edit parameters</strong> to customize queries for your needs</li><li><strong>Write your own SPARQL</strong> directly in the editor below</li></ul>",

    // ---- Phase 9: Query Reliability knobs ----
    // queryTimeoutMs: XHR timeout in milliseconds. Hung requests fail in bounded
    // time instead of polling indefinitely. Forks for federated/heavy queries
    // may bump this to 120000 or higher. (RELIAB-05)
    queryTimeoutMs: 60000,

    // maxGetUrlBytes: Single threshold gating BOTH the GET→POST method switch
    // and the permalink refusal. Computed against the prefixed, URL-encoded
    // query length. 4000 is conservative (well below nginx 8KB default and
    // Cloudflare 8KB limit). (RELIAB-03 + RELIAB-04)
    maxGetUrlBytes: 4000,

    // sendPrefixBlock: Controls PREFIX block delivery to the endpoint.
    //   'auto'  — used-only token-scan; prepend only prefixes the query
    //             references and that are NOT already declared inline (default).
    //   true    — force-prepend ALL CONFIG.namespaces entries not already
    //             declared inline (predictable, slightly heavier URL).
    //   false   — skip prepending entirely (rely on server-registered prefixes;
    //             best for Virtuoso-only forks). (RELIAB-01)
    sendPrefixBlock: 'auto'
};
