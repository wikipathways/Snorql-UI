window.SNORQL_CONFIG = {
    endpoint: "http://localhost:8890/sparql",
    examplesRepo: "",
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
        community: {
            sparql: 'PREFIX wp: <http://vocabularies.wikipathways.org/wp#>\n' +
                'SELECT DISTINCT (REPLACE(STR(?tag), "^.*Curation:", "") AS ?community) WHERE {\n' +
                '  ?pw a wp:Pathway ; wp:ontologyTag ?tag .\n' +
                '  FILTER(STRSTARTS(STR(?tag), "http://vocabularies.wikipathways.org/wp#Curation:"))\n' +
                '} ORDER BY ?community',
            valueField: 'community',
            placeholder: 'Type community name...'
        }
    }
};
