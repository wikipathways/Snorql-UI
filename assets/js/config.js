window.SNORQL_CONFIG = {
    endpoint: "https://sparql.wikipathways.org/sparql/",
    examplesRepo: "https://github.com/wikipathways/SPARQLQueries",
    examplesBranch: "master",
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
    // Optional branding (applied by assets/js/branding.js). Leave a key out to
    // keep the markup in index.html. Text is set as plain text and URLs are
    // allowlisted; there is no raw-HTML option. Colours go in assets/css/theme.css.
    // Example:
    //   logo: { src: "assets/images/my-logo.png", alt: "My SPARQL", height: 50 },
    //   favicon: "assets/images/my-favicon.png",
    //   endpointLabel: "SPARQL Endpoint",
    //   metaDescription: "Explore my data with SPARQL",
    //   metaAuthor: "My Team",
    //   footer: [
    //     { label: "My project", url: "https://example.org" }, " | ",
    //     { label: "Source", url: "https://github.com/me/my-snorql" },
    //     " | Data: ", { label: "CC-BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/", title: "Data licence" },
    //     " ", { image: "assets/images/partner.png", url: "https://example.org", alt: "Partner", height: 25 }
    //   ],
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
    sendPrefixBlock: 'auto',

    // bitlyToken: Bitly access token used by "Get Permalink" to shorten the ?q= URL.
    // It is visible to anyone who loads the page, so use a token with no other rights.
    // Empty string = no shortening; the full permalink is shown. Set at container start
    // with SNORQL_BITLY_TOKEN (an empty value disables shortening).
    bitlyToken: "b0021fe4839aefbc4e7967b3578443d9ea6e89bf"
};
