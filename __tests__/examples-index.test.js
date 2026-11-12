/**
 * Tests for examples-index.js - examples from a published index of .ttl examples:
 * the tree, finding an example by identifier or old path, parameters bound in
 * VALUES blocks, versions, and the metadata shown under the description.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(path.join(__dirname, '../assets/js/examples-index.js'), 'utf8');

let EI;

beforeEach(() => {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  EI = sandbox.window.ExamplesIndex;
});

const CAT = 'https://example.org/category/';
const BASE = 'https://sparql.example.org/.well-known/sparql-examples/';

function example(over) {
  return Object.assign({
    id: 'WPQ001',
    iri: BASE + 'WPQ001',
    label: 'Example',
    description: 'Does something.',
    version: '1.0.0',
    created: '2026-01-01',
    modified: '2026-02-01',
    creators: [{ iri: 'https://orcid.org/0000-0003-2230-0840', name: 'Marvin Martens' }],
    contributors: [],
    license: 'https://www.gnu.org/licenses/gpl-3.0.html',
    categories: [CAT + 'General'],
    keywords: ['general'],
    target: 'https://sparql.example.org/sparql',
    federatesWith: [],
    deprecated: false,
    replacedBy: null,
    queryType: 'select',
    query: 'SELECT * WHERE { ?s ?p ?o }',
    params: [],
    path: 'D. General/example.ttl',
    aliases: []
  }, over);
}

function index(examples, categories) {
  return {
    schema: 1,
    categories: categories || [
      { iri: CAT + 'Metadata', label: 'Metadata', parent: null },
      { iri: CAT + 'Species', label: 'Species', parent: CAT + 'Metadata' },
      { iri: CAT + 'General', label: 'General', parent: null },
      { iri: CAT + 'Empty', label: 'Empty', parent: null }
    ],
    examples: examples
  };
}

describe('indexBase', () => {
  test('defaults to the examples-index branch of the repository', () => {
    expect(EI.indexBase('wikipathways/SPARQLQueries', ''))
      .toBe('https://raw.githubusercontent.com/wikipathways/SPARQLQueries/examples-index/');
  });

  test('uses the configured URL, with a trailing slash', () => {
    expect(EI.indexBase('a/b', 'http://localhost:8000/index')).toBe('http://localhost:8000/index/');
  });

  test('no repository and no configured URL', () => {
    expect(EI.indexBase(null, '')).toBeNull();
    expect(EI.indexBase('not a repo path', undefined)).toBeNull();
  });
});

describe('buildTree', () => {
  test('nests categories, puts examples under theirs and drops empty categories', () => {
    const tree = EI.buildTree(index([
      example({ id: 'WPQ002', label: 'B species query', categories: [CAT + 'Species'] }),
      example({ id: 'WPQ003', label: 'A metadata query', categories: [CAT + 'Metadata'] }),
      example({ id: 'WPQ001', label: 'General one' })
    ]));
    expect(tree.map((n) => n.text)).toEqual(['Metadata', 'General']);
    // Examples first, then subcategories.
    expect(tree[0].nodes.map((n) => n.text)).toEqual(['A metadata query', 'Species']);
    expect(tree[0].nodes[1].nodes[0].exampleId).toBe('WPQ002');
    expect(tree[0].nodes[1].nodes[0].tags).toEqual(['WPQ002']);
  });

  test('leaves deprecated examples out and shows one in every category it names', () => {
    const tree = EI.buildTree(index([
      example({ id: 'WPQ001', categories: [CAT + 'General', CAT + 'Metadata'] }),
      example({ id: 'WPQ002', deprecated: true })
    ]));
    const ids = [];
    const walk = (nodes) => nodes.forEach((n) => (n.nodes ? walk(n.nodes) : ids.push(n.exampleId)));
    walk(tree);
    expect(ids).toEqual(['WPQ001', 'WPQ001']);
  });

  test('examples with an unknown category go under Other', () => {
    const tree = EI.buildTree(index([example({ categories: ['https://elsewhere/x'] })]));
    expect(tree.map((n) => n.text)).toEqual(['Other']);
  });

  test('search text covers identifier, keywords and people', () => {
    const tree = EI.buildTree(index([example({ keywords: ['Lipids'] })]));
    const leaf = tree[0].nodes[0];
    expect(leaf.searchText).toContain('wpq001');
    expect(leaf.searchText).toContain('lipids');
    expect(leaf.searchText).toContain('marvin martens');
  });

  test('not an index', () => {
    expect(EI.buildTree({ schema: 2, examples: [] })).toEqual([]);
    expect(EI.buildTree(null)).toEqual([]);
  });
});

describe('findExample', () => {
  const idx = index([example({ id: 'WPQ036', path: 'D. General/GenesofPathway.ttl', aliases: ['D. General/GenesofPathway.rq'] })]);

  test('by identifier, in any letter case', () => {
    expect(EI.findExample(idx, 'WPQ036').id).toBe('WPQ036');
    expect(EI.findExample(idx, 'wpq036').id).toBe('WPQ036');
  });

  test('by current or old path', () => {
    expect(EI.findExample(idx, 'D. General/GenesofPathway.ttl').id).toBe('WPQ036');
    expect(EI.findExample(idx, 'D. General/GenesofPathway.rq').id).toBe('WPQ036');
  });

  test('unknown', () => {
    expect(EI.findExample(idx, 'WPQ999')).toBeNull();
    expect(EI.findExample(idx, '')).toBeNull();
  });
});

const PATHWAY = {
  name: 'pathwayId', label: 'Pathway ID', kind: 'iri', default: 'WP1560',
  valueTemplate: 'https://identifiers.org/wikipathways/{value}', autocomplete: 'pathway', options: null
};
const SPECIES = { name: 'species', label: 'Species', kind: 'literal', default: 'Homo sapiens', autocomplete: 'species' };
const ENTITY = {
  name: 'entityType', label: 'Entity Type', kind: 'iri', default: 'DataNode',
  valueTemplate: 'http://vocabularies.wikipathways.org/wp#{value}',
  options: [{ value: 'DataNode', label: 'Data Nodes' }, { value: 'Metabolite', label: 'Metabolites' }]
};

describe('toParams', () => {
  test('maps index parameters to the parameter panel shape', () => {
    const [p, s, e] = EI.toParams({ params: [PATHWAY, SPECIES, ENTITY] });
    expect(p).toMatchObject({ name: 'pathwayId', variable: 'pathwayId', type: 'autocomplete', kind: 'iri', autocompleteType: 'pathway', defaultValue: 'WP1560' });
    expect(s).toMatchObject({ type: 'autocomplete', kind: 'literal', defaultValue: 'Homo sapiens' });
    expect(e).toMatchObject({ type: 'enum', options: [{ value: 'DataNode', label: 'Data Nodes' }, { value: 'Metabolite', label: 'Metabolites' }] });
  });

  test('an IRI parameter without a template takes a full IRI', () => {
    expect(EI.toParams({ params: [{ name: 'x', kind: 'iri', default: 'http://a/b' }] })[0].type).toBe('uri');
  });

  test('keeps a different variable name', () => {
    expect(EI.toParams({ params: [Object.assign({}, PATHWAY, { variable: 'pathway' })] })[0].variable).toBe('pathway');
  });

  test('drops parameters whose name or variable could break the page or the query', () => {
    const bad = [
      { name: 'a"b', kind: 'literal', default: 'x' },
      { name: 'ok', variable: 'x}) .*', kind: 'literal', default: 'x' }
    ];
    expect(EI.toParams({ params: bad })).toEqual([]);
  });
});

describe('sparqlTerm', () => {
  const [pathway, species, entity] = (() => {
    const sb = { window: {} };
    vm.createContext(sb);
    vm.runInContext(code, sb);
    return sb.window.ExamplesIndex.toParams({ params: [PATHWAY, SPECIES, ENTITY] });
  })();

  test('a string value is escaped', () => {
    expect(EI.sparqlTerm(species, 'Mus musculus')).toBe('"Mus musculus"');
    expect(EI.sparqlTerm(species, 'a"b\\c\nd')).toBe('"a\\"b\\\\c\\nd"');
  });

  test('an IRI value goes through the template, percent-encoded', () => {
    expect(EI.sparqlTerm(pathway, 'WP254')).toBe('<https://identifiers.org/wikipathways/WP254>');
    expect(EI.sparqlTerm(pathway, 'x> } DROP ALL { <y')).toBe('<https://identifiers.org/wikipathways/x%3E%20%7D%20DROP%20ALL%20%7B%20%3Cy>');
  });

  test('an enum value must be one of the options', () => {
    expect(EI.sparqlTerm(entity, 'Metabolite')).toBe('<http://vocabularies.wikipathways.org/wp#Metabolite>');
    expect(EI.sparqlTerm(entity, 'Pathway')).toBeNull();
  });

  test('a full IRI without template is checked', () => {
    const uri = EI.toParams({ params: [{ name: 'x', kind: 'iri', default: 'http://a/b' }] })[0];
    expect(EI.sparqlTerm(uri, '<http://a/c>')).toBe('<http://a/c>');
    expect(EI.sparqlTerm(uri, 'http://a/c> . ?s ?p <x')).toBeNull();
  });
});

describe('substituteValues', () => {
  const query = 'SELECT ?g WHERE {\n  VALUES ?pathwayId { <https://identifiers.org/wikipathways/WP1560> }\n' +
    '  ?p dc:identifier ?pathwayId ; wp:organismName ?species .\n  VALUES ?species { "Homo sapiens" }\n}';

  test('replaces the value in each VALUES block', () => {
    const params = EI.toParams({ params: [PATHWAY, SPECIES] });
    const values = { pathwayId: 'WP254', species: 'Mus musculus' };
    const out = EI.substituteValues(query, params, (p) => values[p.name]);
    expect(out).toContain('VALUES ?pathwayId { <https://identifiers.org/wikipathways/WP254> }');
    expect(out).toContain('VALUES ?species { "Mus musculus" }');
  });

  test('falls back to the default for a value that is not acceptable', () => {
    const params = EI.toParams({ params: [ENTITY] });
    const q = 'SELECT * { VALUES ?entityType { <http://vocabularies.wikipathways.org/wp#DataNode> } ?x a ?entityType }';
    expect(EI.substituteValues(q, params, () => 'Nope')).toBe(q);
  });

  test('a $ in the value is not taken as a replacement pattern', () => {
    const params = EI.toParams({ params: [SPECIES] });
    const out = EI.substituteValues('VALUES ?species { "x" }', params, () => "$&$1$'");
    expect(out).toBe('VALUES ?species { "$&$1$\'" }');
  });

  test('uses the variable name when it differs from the parameter name', () => {
    const params = EI.toParams({ params: [Object.assign({}, PATHWAY, { variable: 'pathway' })] });
    const out = EI.substituteValues('VALUES ?pathway { <https://identifiers.org/wikipathways/WP1> }', params, () => 'WP2');
    expect(out).toBe('VALUES ?pathway { <https://identifiers.org/wikipathways/WP2> }');
  });
});

describe('versions', () => {
  const history = {
    examples: {
      WPQ036: [
        { version: '1.0.0', commit: 'aaaaaaa1111111111111111111111111111111aa', date: '2026-11-11', path: 'x.ttl' },
        { version: '1.1.0', commit: 'bbbbbbb2222222222222222222222222222222bb', date: '2026-12-01', path: 'y.ttl' }
      ]
    },
    releases: { 'v2026.11': { commit: 'aaaa', versions: { WPQ036: '1.0.0' } } }
  };

  test('a ref resolves through a commit at which the example got a version', () => {
    expect(EI.resolveRef(history, 'WPQ036', 'bbbbbbb')).toBe('1.1.0');
    expect(EI.resolveRef(history, 'WPQ036', 'AAAAAAA1')).toBe('1.0.0');
  });

  test('or through a release tag', () => {
    expect(EI.resolveRef(history, 'WPQ036', 'v2026.11')).toBe('1.0.0');
  });

  test('unknown refs', () => {
    expect(EI.resolveRef(history, 'WPQ036', 'ccccccc')).toBeNull();
    expect(EI.resolveRef(history, 'WPQ999', 'v2026.11')).toBeNull();
    expect(EI.resolveRef(null, 'WPQ036', 'bbbbbbb')).toBeNull();
  });

  test('version URL only for a well-formed identifier and version', () => {
    expect(EI.versionUrl('https://x/', 'WPQ036', '1.0.0')).toBe('https://x/versions/WPQ036/1.0.0.json');
    expect(EI.versionUrl('https://x/', '../x', '1.0.0')).toBeNull();
    expect(EI.versionUrl('https://x/', 'WPQ036', '1.0.0/../../y')).toBeNull();
  });

  test('version options, newest first, with the shown one selected', () => {
    const html = EI.versionOptionsHtml(history, 'WPQ036', '1.0.0');
    expect(html.indexOf('1.1.0 (current)')).toBeLessThan(html.indexOf('>1.0.0'));
    expect(html).toContain('value="1.0.0" selected');
  });
});

describe('metadataHtml', () => {
  test('shows identifier, version, people with ORCID links, licence and keywords', () => {
    const html = EI.metadataHtml(example({
      contributors: [{ iri: 'https://github.com/laurent2207', name: 'Laurent Winckers' }],
      federatesWith: ['https://query.wikidata.org/sparql']
    }));
    expect(html).toContain('WPQ001');
    expect(html).toContain('href="https://orcid.org/0000-0003-2230-0840"');
    expect(html).toContain('Laurent Winckers');
    expect(html).toContain('GPL-3.0');
    expect(html).toContain('https://query.wikidata.org/sparql');
    expect(html).toContain('<span class="label label-info">general</span>');
  });

  test('lists creators and contributors together, each person once', () => {
    const html = EI.metadataHtml(example({
      creators: [{ iri: 'https://orcid.org/0000-0003-2230-0840', name: 'Marvin Martens' }],
      contributors: [
        { iri: 'https://github.com/laurent2207', name: 'Laurent Winckers' },
        { iri: 'https://orcid.org/0000-0003-2230-0840', name: 'Marvin Martens' }
      ]
    }));
    const people = html.match(/<div class="example-people">(.*?)<\/div>/)[1];
    expect(people).not.toMatch(/contributions/);
    expect(people.match(/Marvin Martens/g)).toHaveLength(1);
    expect(people.indexOf('Marvin Martens')).toBeLessThan(people.indexOf('Laurent Winckers'));
  });

  test('federated endpoints are named without a warning', () => {
    const html = EI.metadataHtml(example({ federatesWith: ['https://query.wikidata.org/sparql'] }));
    expect(html).toContain('Also uses data from <code>https://query.wikidata.org/sparql</code>.');
    expect(html).not.toMatch(/slower/);
  });

  test('escapes everything that comes from the index', () => {
    const html = EI.metadataHtml(example({
      id: 'WPQ001',
      keywords: ['<img src=x onerror=alert(1)>'],
      creators: [{ iri: 'javascript:alert(1)', name: '<b>x</b>' }],
      license: 'javascript:alert(2)',
      federatesWith: ['"><script>alert(3)</script>']
    }));
    expect(html).not.toMatch(/<img|<script|<b>|javascript:/);
  });

  test('deprecated example with a replacement, and an old version', () => {
    const html = EI.metadataHtml(example({ deprecated: true, replacedBy: BASE + 'WPQ040' }), { version: '1.0.0', current: '2.0.0' });
    expect(html).toContain('deprecated');
    expect(html).toContain('href="?example=WPQ040"');
    expect(html).toContain('the current version is 2.0.0');
  });
});

describe('tree text is escaped (bootstrap-treeview renders it as HTML)', () => {
  test('example titles, identifiers and category labels', () => {
    const tree = EI.buildTree(index([example({ label: '<img src=x onerror=alert(1)>' })], [
      { iri: CAT + 'General', label: '<b>General</b>', parent: null }
    ]));
    expect(tree[0].text).toBe('&lt;b&gt;General&lt;/b&gt;');
    expect(tree[0].nodes[0].text).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(tree[0].nodes[0].tags).toEqual(['WPQ001']);
  });
});
