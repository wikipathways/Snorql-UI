/**
 * @jest-environment node
 *
 * Tests for .rq template files - header syntax validation
 * Gaps 7-9: TMPL-01 through TMPL-06 .rq file structural requirements
 */

const SPARQL_QUERIES_BASE = 'https://raw.githubusercontent.com/wikipathways/SPARQLQueries/master';

async function readRq(relPath) {
  const url = `${SPARQL_QUERIES_BASE}/${encodeURI(relPath)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

// Parse #param header lines from .rq content
function parseParams(content) {
  const params = [];
  for (const line of content.split('\n')) {
    const m = line.trim().match(/^#\s*param:\s*(.+)/i);
    if (m) {
      const parts = m[1].split('|');
      if (parts.length >= 4) {
        params.push({
          name: parts[0].trim(),
          type: parts[1].trim(),
          defaultValue: parts[2].trim(),
          label: parts[3].trim()
        });
      }
    }
  }
  return params;
}

// ─── Gap 7: TMPL-01 through TMPL-04 metadata .rq param headers ───

describe('TMPL-01: countOfEntityType.rq', () => {
  let content;
  beforeAll(async () => { content = await readRq('A. Metadata/datacounts/countOfEntityType.rq'); });

  test('file exists and is non-empty', () => {
    expect(content.length).toBeGreaterThan(0);
  });

  test('has required #param header with entityType enum', () => {
    expect(content).toMatch(/^#\s*param:\s*entityType\|enum:/im);
  });

  test('entityType param has all 5 enum values', () => {
    const params = parseParams(content);
    const entityTypeParam = params.find(p => p.name === 'entityType');
    expect(entityTypeParam).toBeDefined();
    const typeSpec = entityTypeParam.type;
    expect(typeSpec.startsWith('enum:')).toBe(true);
    const enumValues = typeSpec.substring(5).split(',').map(o => o.split('=')[0].trim());
    expect(enumValues).toContain('DataNode');
    expect(enumValues).toContain('GeneProduct');
    expect(enumValues).toContain('Interaction');
    expect(enumValues).toContain('Metabolite');
    expect(enumValues).toContain('Protein');
  });

  test('entityType enum uses value=label syntax (human-friendly labels)', () => {
    const params = parseParams(content);
    const entityTypeParam = params.find(p => p.name === 'entityType');
    const typeSpec = entityTypeParam.type;
    // At least one option should have value=label pair
    expect(typeSpec).toContain('=');
    expect(typeSpec).toContain('GeneProduct=Gene Products');
  });

  test('default value is DataNode', () => {
    const params = parseParams(content);
    const entityTypeParam = params.find(p => p.name === 'entityType');
    expect(entityTypeParam.defaultValue).toBe('DataNode');
  });

  test('SPARQL body contains Mustache entityType substitution', () => {
    expect(content).toContain('{{entityType}}');
  });

  test('does not contain inline PREFIX declarations (uses config.js namespaces)', () => {
    // Templates should rely on Snorql-UI prefix injection, not inline PREFIXes
    const sparqlBody = content.split('\n').filter(l => !l.trim().startsWith('#')).join('\n');
    expect(sparqlBody).not.toMatch(/^\s*PREFIX\s+/im);
  });
});

describe('TMPL-02: averagePerPathway.rq', () => {
  let content;
  beforeAll(async () => { content = await readRq('A. Metadata/datacounts/averagePerPathway.rq'); });

  test('file exists and is non-empty', () => {
    expect(content.length).toBeGreaterThan(0);
  });

  test('has required #param header with entityType enum', () => {
    expect(content).toMatch(/^#\s*param:\s*entityType\|enum:/im);
  });

  test('SPARQL body uses AVG aggregation', () => {
    expect(content.toUpperCase()).toContain('AVG(');
  });

  test('SPARQL body contains Mustache entityType substitution', () => {
    expect(content).toContain('{{entityType}}');
  });

  test('entityType enum has same 5 values as TMPL-01', () => {
    const params = parseParams(content);
    const entityTypeParam = params.find(p => p.name === 'entityType');
    expect(entityTypeParam).toBeDefined();
    const enumValues = entityTypeParam.type.substring(5).split(',').map(o => o.split('=')[0].trim());
    expect(enumValues).toContain('DataNode');
    expect(enumValues).toContain('GeneProduct');
    expect(enumValues).toContain('Interaction');
    expect(enumValues).toContain('Metabolite');
    expect(enumValues).toContain('Protein');
  });
});

describe('TMPL-03: pathwaysForDatasource.rq', () => {
  let content;
  beforeAll(async () => { content = await readRq('A. Metadata/datasources/pathwaysForDatasource.rq'); });

  test('file exists and is non-empty', () => {
    expect(content.length).toBeGreaterThan(0);
  });

  test('has required #param header with datasource enum', () => {
    expect(content).toMatch(/^#\s*param:\s*datasource\|enum:/im);
  });

  test('datasource enum has 6 values with value=label syntax', () => {
    const params = parseParams(content);
    const dsParam = params.find(p => p.name === 'datasource');
    expect(dsParam).toBeDefined();
    const options = dsParam.type.substring(5).split(',');
    expect(options).toHaveLength(6);
    // Values are predicate suffixes (case-sensitive)
    const values = options.map(o => o.split('=')[0].trim());
    expect(values).toContain('Chemspider');
    expect(values).toContain('Ensembl');
    expect(values).toContain('HgncSymbol');
    expect(values).toContain('Hmdb');
    expect(values).toContain('EntrezGene');
    expect(values).toContain('PubChem');
  });

  test('datasource enum labels are human-friendly', () => {
    const params = parseParams(content);
    const dsParam = params.find(p => p.name === 'datasource');
    const typeSpec = dsParam.type;
    expect(typeSpec).toContain('Chemspider=ChemSpider');
    expect(typeSpec).toContain('EntrezGene=NCBI Gene');
  });

  test('default datasource value is Ensembl', () => {
    const params = parseParams(content);
    const dsParam = params.find(p => p.name === 'datasource');
    expect(dsParam.defaultValue).toBe('Ensembl');
  });

  test('SPARQL body uses wp:bdb{{datasource}} predicate pattern', () => {
    expect(content).toContain('wp:bdb{{datasource}}');
  });
});

describe('TMPL-04: countEntityPerSpecies.rq', () => {
  let content;
  beforeAll(async () => { content = await readRq('A. Metadata/species/countEntityPerSpecies.rq'); });

  test('file exists and is non-empty', () => {
    expect(content.length).toBeGreaterThan(0);
  });

  test('has required #param header with entityType enum', () => {
    expect(content).toMatch(/^#\s*param:\s*entityType\|enum:/im);
  });

  test('entityType enum has 4 values (no Interaction for per-species)', () => {
    const params = parseParams(content);
    const entityTypeParam = params.find(p => p.name === 'entityType');
    expect(entityTypeParam).toBeDefined();
    const options = entityTypeParam.type.substring(5).split(',');
    expect(options).toHaveLength(4);
    const values = options.map(o => o.split('=')[0].trim());
    expect(values).toContain('DataNode');
    expect(values).toContain('GeneProduct');
    expect(values).toContain('Metabolite');
    expect(values).toContain('Protein');
    expect(values).not.toContain('Interaction');
  });

  test('SPARQL body contains Mustache entityType substitution', () => {
    expect(content).toContain('{{entityType}}');
  });

  test('SPARQL body has GROUP BY for per-species aggregation', () => {
    expect(content.toUpperCase()).toContain('GROUP BY');
  });
});

// ─── Gap 8: Community .rq templates with autocomplete:community ───

describe('TMPL-05: communityPathways.rq', () => {
  let content;
  beforeAll(async () => { content = await readRq('B. Communities/communityPathways.rq'); });

  test('file exists and is non-empty', () => {
    expect(content.length).toBeGreaterThan(0);
  });

  test('has #param header with autocomplete:community type', () => {
    expect(content).toMatch(/^#\s*param:\s*community\|autocomplete:community/im);
  });

  test('param header has AOP as default value', () => {
    const params = parseParams(content);
    const communityParam = params.find(p => p.name === 'community');
    expect(communityParam).toBeDefined();
    expect(communityParam.defaultValue).toBe('AOP');
    expect(communityParam.type).toBe('autocomplete:community');
  });

  test('SPARQL body uses cur:{{community}} for ontology tag filter', () => {
    expect(content).toContain('cur:{{community}}');
  });

  test('does NOT contain inline PREFIX cur: declaration', () => {
    expect(content).not.toMatch(/PREFIX\s+cur:/i);
  });

  test('SPARQL body filters by wp:Pathway type', () => {
    expect(content).toContain('wp:Pathway');
  });
});

describe('TMPL-05: communityProteins.rq', () => {
  let content;
  beforeAll(async () => { content = await readRq('B. Communities/communityProteins.rq'); });

  test('file exists and is non-empty', () => {
    expect(content.length).toBeGreaterThan(0);
  });

  test('has #param header with autocomplete:community type', () => {
    expect(content).toMatch(/^#\s*param:\s*community\|autocomplete:community/im);
  });

  test('SPARQL body uses cur:{{community}} for ontology tag filter', () => {
    expect(content).toContain('cur:{{community}}');
  });

  test('SPARQL body queries for wp:Protein entities', () => {
    expect(content).toContain('wp:Protein');
  });

  test('does NOT contain inline PREFIX cur: declaration', () => {
    expect(content).not.toMatch(/PREFIX\s+cur:/i);
  });
});

// ─── Gap 9: X-of-pathway queries with autocomplete:pathway ───

describe('TMPL-06: GenesofPathway.rq (autocomplete:pathway migration)', () => {
  let content;
  beforeAll(async () => { content = await readRq('D. General/GenesofPathway.rq'); });

  test('file exists and is non-empty', () => {
    expect(content.length).toBeGreaterThan(0);
  });

  test('param type is autocomplete:pathway (not string)', () => {
    const params = parseParams(content);
    const param = params.find(p => p.name === 'pathwayId');
    expect(param).toBeDefined();
    expect(param.type).toBe('autocomplete:pathway');
  });

  test('does NOT use old "string" param type', () => {
    expect(content).not.toMatch(/\|\s*string\s*\|/i);
  });

  test('SPARQL body contains {{pathwayId}} Mustache substitution', () => {
    expect(content).toContain('{{pathwayId}}');
  });
});

describe('TMPL-06: InteractionsofPathway.rq (autocomplete:pathway migration)', () => {
  let content;
  beforeAll(async () => { content = await readRq('D. General/InteractionsofPathway.rq'); });

  test('file exists and is non-empty', () => {
    expect(content.length).toBeGreaterThan(0);
  });

  test('param type is autocomplete:pathway (not string)', () => {
    const params = parseParams(content);
    const param = params.find(p => p.name === 'pathwayId');
    expect(param).toBeDefined();
    expect(param.type).toBe('autocomplete:pathway');
  });

  test('does NOT use old "string" param type', () => {
    expect(content).not.toMatch(/\|\s*string\s*\|/i);
  });

  test('SPARQL body contains {{pathwayId}} Mustache substitution', () => {
    expect(content).toContain('{{pathwayId}}');
  });
});

describe('TMPL-06: MetabolitesofPathway.rq (autocomplete:pathway migration)', () => {
  let content;
  beforeAll(async () => { content = await readRq('D. General/MetabolitesofPathway.rq'); });

  test('file exists and is non-empty', () => {
    expect(content.length).toBeGreaterThan(0);
  });

  test('param type is autocomplete:pathway (not string)', () => {
    const params = parseParams(content);
    const param = params.find(p => p.name === 'pathwayId');
    expect(param).toBeDefined();
    expect(param.type).toBe('autocomplete:pathway');
  });

  test('does NOT use old "string" param type', () => {
    expect(content).not.toMatch(/\|\s*string\s*\|/i);
  });

  test('SPARQL body contains {{pathwayId}} Mustache substitution', () => {
    expect(content).toContain('{{pathwayId}}');
  });
});

describe('TMPL-06: OntologyofPathway.rq (autocomplete:pathway migration)', () => {
  let content;
  beforeAll(async () => { content = await readRq('D. General/OntologyofPathway.rq'); });

  test('file exists and is non-empty', () => {
    expect(content.length).toBeGreaterThan(0);
  });

  test('param type is autocomplete:pathway (not string)', () => {
    const params = parseParams(content);
    const param = params.find(p => p.name === 'pathwayId');
    expect(param).toBeDefined();
    expect(param.type).toBe('autocomplete:pathway');
  });

  test('does NOT use old "string" param type', () => {
    expect(content).not.toMatch(/\|\s*string\s*\|/i);
  });

  test('SPARQL body contains {{pathwayId}} Mustache substitution', () => {
    expect(content).toContain('{{pathwayId}}');
  });
});
