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
    // Optional navbar linkout buttons, rendered in array order by linkouts.js.
    // Keep the live default EMPTY so existing deployments render unchanged.
    // Each entry: { label, url, authors?, icon? }
    //   label   - button text (shown as plain text; HTML is escaped)
    //   url     - http/https/mailto only; other schemes (javascript:/data:) are rejected
    //   authors - optional; used as the accessible name (aria-label/title) when present
    //   icon    - optional Bootstrap-3 glyphicon suffix, e.g. "book" -> glyphicon-book
    //             (allowlisted to [a-z0-9-]; invalid suffixes are dropped)
    // SECURITY: this array is untrusted input — do not remove the escaping or
    // the URL scheme allowlist in assets/js/linkouts.js. See FORK.md.
    // Example:
    //   linkouts: [
    //     { label: "Tutorial", url: "https://example.org/tutorial", icon: "book" },
    //     { label: "Credits",  url: "https://example.org/about", authors: "Jane Doe et al." }
    //   ],
    linkouts: [],
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
    welcomeMessage: "<p>Browse and run SPARQL queries against the WikiPathways database.</p><ul><li><strong>Browse examples</strong> in the tree on the right to find a query</li><li><strong>Edit parameters</strong> to customize queries for your needs</li><li><strong>Write your own SPARQL</strong> directly in the editor below</li></ul>"
};
