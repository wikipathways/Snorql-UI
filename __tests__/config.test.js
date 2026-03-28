/**
 * Tests for config.js - community autocomplete type and cur: namespace
 * Gaps 5-6: TMPL-05 community config infrastructure
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const configCode = fs.readFileSync(
  path.join(__dirname, '../assets/js/config.js'),
  'utf8'
);

let SNORQL_CONFIG;

beforeEach(() => {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(configCode, sandbox);
  SNORQL_CONFIG = sandbox.window.SNORQL_CONFIG;
});

// ─── Gap 5: community autocomplete type ───

describe('autocompleteTypes.community', () => {
  test('community autocomplete type is defined', () => {
    expect(SNORQL_CONFIG.autocompleteTypes.community).toBeDefined();
  });

  test('community type has a sparql query string', () => {
    const community = SNORQL_CONFIG.autocompleteTypes.community;
    expect(typeof community.sparql).toBe('string');
    expect(community.sparql.length).toBeGreaterThan(0);
  });

  test('community sparql query targets curation tags via ontologyTag predicate', () => {
    const sparql = SNORQL_CONFIG.autocompleteTypes.community.sparql;
    expect(sparql).toContain('wp:ontologyTag');
  });

  test('community sparql query filters to Curation: namespace URI', () => {
    const sparql = SNORQL_CONFIG.autocompleteTypes.community.sparql;
    expect(sparql).toContain('http://vocabularies.wikipathways.org/wp#Curation:');
  });

  test('community type uses REPLACE to extract tag suffix only', () => {
    const sparql = SNORQL_CONFIG.autocompleteTypes.community.sparql;
    expect(sparql.toUpperCase()).toContain('REPLACE');
  });

  test('community type has valueField set to "community"', () => {
    expect(SNORQL_CONFIG.autocompleteTypes.community.valueField).toBe('community');
  });

  test('community type has a placeholder string', () => {
    const community = SNORQL_CONFIG.autocompleteTypes.community;
    expect(typeof community.placeholder).toBe('string');
    expect(community.placeholder.length).toBeGreaterThan(0);
  });
});

// ─── Gap 6: cur: namespace ───

describe('namespaces.cur', () => {
  test('cur namespace is defined in config', () => {
    expect(SNORQL_CONFIG.namespaces.cur).toBeDefined();
  });

  test('cur namespace resolves to the WikiPathways Curation URI prefix', () => {
    expect(SNORQL_CONFIG.namespaces.cur).toBe(
      'http://vocabularies.wikipathways.org/wp#Curation:'
    );
  });

  test('cur namespace is alongside other standard namespaces', () => {
    const ns = SNORQL_CONFIG.namespaces;
    // Verify standard namespaces are still present (not accidentally clobbered)
    expect(ns.rdf).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
    expect(ns.dcterms).toBe('http://purl.org/dc/terms/');
    expect(ns.cur).toBe('http://vocabularies.wikipathways.org/wp#Curation:');
  });
});
