/**
 * @jest-environment node
 *
 * The parameterized WikiPathways examples, read from the published index
 * (wikipathways/SPARQLQueries, branch examples-index) the way the editor reads
 * them: found by their old .rq path, with the parameters, options and defaults
 * the panel shows, and a VALUES block that takes the user's value.
 *
 * These used to read the .rq files on SPARQLQueries master; the examples are
 * .ttl files now and the .rq files are gone from master.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const INDEX_URL = 'https://raw.githubusercontent.com/wikipathways/SPARQLQueries/examples-index/index.json';
const WP = 'http://vocabularies.wikipathways.org/wp#';

const code = fs.readFileSync(path.join(__dirname, '../assets/js/examples-index.js'), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const EI = sandbox.window.ExamplesIndex;

let index;

beforeAll(async () => {
  const res = await fetch(INDEX_URL);
  if (!res.ok) throw new Error(`Failed to fetch ${INDEX_URL}: ${res.status}`);
  index = await res.json();
});

// The example an old .rq link points at, and its parameter in panel form.
function lookup(oldPath, name) {
  const entry = EI.findExample(index, oldPath);
  expect(entry).not.toBeNull();
  const param = EI.toParams(entry).find((p) => p.name === name);
  expect(param).toBeDefined();
  return { entry, param };
}

// The query with the parameter set to value, as the editor sends it.
function withValue(entry, value) {
  return EI.substituteValues(entry.query, EI.toParams(entry), () => value);
}

function valuesBlock(query, variable) {
  const m = query.match(new RegExp('VALUES\\s+\\?' + variable + '\\s*\\{([^}]*)\\}'));
  return m ? m[1].trim() : null;
}

test('the index is schema 1 and lists the examples', () => {
  expect(index.schema).toBe(1);
  expect(EI.isIndex(index)).toBe(true);
  expect(index.examples.length).toBeGreaterThan(50);
});

// ─── TMPL-01 to TMPL-04: entity type and data source options ───

const ENTITY_TYPES = ['DataNode', 'GeneProduct', 'Interaction', 'Metabolite', 'Protein'];

describe('TMPL-01: countOfEntityType', () => {
  const OLD = 'A. Metadata/datacounts/countOfEntityType.rq';

  test('entityType is an enum of the 5 entity types, with labels', () => {
    const { param } = lookup(OLD, 'entityType');
    expect(param.type).toBe('enum');
    expect(param.options.map((o) => o.value)).toEqual(ENTITY_TYPES);
    expect(param.options.find((o) => o.value === 'GeneProduct').label).toBe('Gene Products');
  });

  test('default is DataNode, bound in the VALUES block', () => {
    const { entry, param } = lookup(OLD, 'entityType');
    expect(param.defaultValue).toBe('DataNode');
    expect(valuesBlock(entry.query, 'entityType')).toBe(`<${WP}DataNode>`);
  });

  test('choosing an option puts its IRI in the VALUES block', () => {
    const { entry } = lookup(OLD, 'entityType');
    expect(valuesBlock(withValue(entry, 'Metabolite'), 'entityType')).toBe(`<${WP}Metabolite>`);
  });

  test('a value that is not an option keeps the default', () => {
    const { entry } = lookup(OLD, 'entityType');
    expect(valuesBlock(withValue(entry, 'Pathway> . ?x ?y ?z'), 'entityType')).toBe(`<${WP}DataNode>`);
  });
});

describe('TMPL-02: averagePerPathway', () => {
  const OLD = 'A. Metadata/datacounts/averagePerPathway.rq';

  test('uses AVG and binds entityType', () => {
    const { entry } = lookup(OLD, 'entityType');
    expect(entry.query.toUpperCase()).toContain('AVG(');
    expect(valuesBlock(entry.query, 'entityType')).toBe(`<${WP}DataNode>`);
  });

  test('entityType has the same 5 options as TMPL-01', () => {
    const { param } = lookup(OLD, 'entityType');
    expect(param.options.map((o) => o.value)).toEqual(ENTITY_TYPES);
  });
});

describe('TMPL-03: pathwaysForDatasource', () => {
  const OLD = 'A. Metadata/datasources/pathwaysForDatasource.rq';

  test('datasource is an enum of 6 data sources with readable labels', () => {
    const { param } = lookup(OLD, 'datasource');
    expect(param.type).toBe('enum');
    expect(param.options.map((o) => o.value).sort())
      .toEqual(['Chemspider', 'Ensembl', 'EntrezGene', 'HgncSymbol', 'Hmdb', 'PubChem']);
    expect(param.options.find((o) => o.value === 'Chemspider').label).toBe('ChemSpider');
    expect(param.options.find((o) => o.value === 'EntrezGene').label).toBe('NCBI Gene');
  });

  test('default is Ensembl, as the wp:bdb predicate', () => {
    const { entry, param } = lookup(OLD, 'datasource');
    expect(param.defaultValue).toBe('Ensembl');
    expect(valuesBlock(entry.query, 'datasource')).toBe(`<${WP}bdbEnsembl>`);
  });

  test('choosing HGNC binds wp:bdbHgncSymbol', () => {
    const { entry } = lookup(OLD, 'datasource');
    expect(valuesBlock(withValue(entry, 'HgncSymbol'), 'datasource')).toBe(`<${WP}bdbHgncSymbol>`);
  });
});

describe('TMPL-04: countEntityPerSpecies', () => {
  const OLD = 'A. Metadata/species/countEntityPerSpecies.rq';

  test('entityType has 4 options, without Interaction', () => {
    const { param } = lookup(OLD, 'entityType');
    expect(param.options.map((o) => o.value)).toEqual(['DataNode', 'GeneProduct', 'Metabolite', 'Protein']);
  });

  test('groups by species', () => {
    const { entry } = lookup(OLD, 'entityType');
    expect(entry.query.toUpperCase()).toContain('GROUP BY');
  });
});

// ─── TMPL-05: community autocomplete ───

describe.each([
  ['B. Communities/communityPathways.rq', 'wp:Pathway'],
  ['B. Communities/communityProteins.rq', 'wp:Protein']
])('TMPL-05: %s', (OLD, type) => {
  test('community autocompletes from the community list, default AOP', () => {
    const { param } = lookup(OLD, 'community');
    expect(param.type).toBe('autocomplete');
    expect(param.autocompleteType).toBe('community');
    expect(param.defaultValue).toBe('AOP');
  });

  test('the value becomes a wp#Curation: tag in the VALUES block', () => {
    const { entry } = lookup(OLD, 'community');
    expect(valuesBlock(entry.query, 'community')).toBe(`<${WP}Curation:AOP>`);
    expect(valuesBlock(withValue(entry, 'Lipids'), 'community')).toBe(`<${WP}Curation:Lipids>`);
  });

  test(`queries ${type}`, () => {
    const { entry } = lookup(OLD, 'community');
    expect(entry.query).toContain(type);
  });
});

// ─── TMPL-06: pathway autocomplete ───

describe.each([
  'D. General/GenesofPathway.rq',
  'D. General/InteractionsofPathway.rq',
  'D. General/MetabolitesofPathway.rq',
  'D. General/OntologyofPathway.rq'
])('TMPL-06: %s', (OLD) => {
  test('pathwayId autocompletes from the pathway list', () => {
    const { param } = lookup(OLD, 'pathwayId');
    expect(param.type).toBe('autocomplete');
    expect(param.autocompleteType).toBe('pathway');
    expect(param.defaultValue).toMatch(/^WP\d+$/);
  });

  test('the VALUES block takes the chosen pathway', () => {
    const { entry, param } = lookup(OLD, 'pathwayId');
    const block = valuesBlock(withValue(entry, 'WP254'), param.variable);
    expect(block).toMatch(/WP254/);
    expect(block).not.toMatch(new RegExp(param.defaultValue + '\\b'));
  });

  test('a quote in the value cannot leave the VALUES block', () => {
    const { entry, param } = lookup(OLD, 'pathwayId');
    const block = valuesBlock(withValue(entry, 'WP254" } ?s ?p ?o { "'), param.variable);
    expect(block).not.toMatch(/\?s \?p \?o/);
  });
});
