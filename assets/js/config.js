window.SNORQL_CONFIG = {
    endpoint: "https://sparql.wikipathways.org/sparql/",
    examplesRepo: "http://localhost:8088/api/repos/local/SPARQLQueries",
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
        foaf: "http://xmlns.com/foaf/0.1/"
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
        }
    },
    welcomeTitle: "SPARQL Query Explorer",
    welcomeMessage: "<p>Browse and run SPARQL queries against the WikiPathways database.</p><ul><li><strong>Browse examples</strong> in the tree on the right to find a query</li><li><strong>Edit parameters</strong> to customize queries for your needs</li><li><strong>Write your own SPARQL</strong> directly in the editor below</li></ul>"
};
