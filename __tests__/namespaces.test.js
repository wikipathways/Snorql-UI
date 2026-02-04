/**
 * Tests for namespaces.js
 */

// Load the namespaces file
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Read and execute the namespaces.js file in a sandbox
const namespacesCode = fs.readFileSync(
  path.join(__dirname, '../assets/js/namespaces.js'),
  'utf8'
);

let snorql_namespacePrefixes;

beforeAll(() => {
  // Create a sandbox context and execute the code
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(namespacesCode, sandbox);
  snorql_namespacePrefixes = sandbox.snorql_namespacePrefixes;
});

describe('snorql_namespacePrefixes', () => {
  test('should be defined', () => {
    expect(snorql_namespacePrefixes).toBeDefined();
  });

  test('should be an object', () => {
    expect(typeof snorql_namespacePrefixes).toBe('object');
    expect(snorql_namespacePrefixes).not.toBeNull();
  });

  test('should contain standard RDF namespace', () => {
    expect(snorql_namespacePrefixes.rdf).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
  });

  test('should contain RDFS namespace', () => {
    expect(snorql_namespacePrefixes.rdfs).toBe('http://www.w3.org/2000/01/rdf-schema#');
  });

  test('should contain OWL namespace', () => {
    expect(snorql_namespacePrefixes.owl).toBe('http://www.w3.org/2002/07/owl#');
  });

  test('should contain Dublin Core namespaces', () => {
    expect(snorql_namespacePrefixes.dc).toBe('http://purl.org/dc/elements/1.1/');
    expect(snorql_namespacePrefixes.dcterms).toBe('http://purl.org/dc/terms/');
  });

  test('should contain FOAF namespace', () => {
    expect(snorql_namespacePrefixes.foaf).toBe('http://xmlns.com/foaf/0.1/');
  });

  test('should contain XSD namespace', () => {
    expect(snorql_namespacePrefixes.xsd).toBe('http://www.w3.org/2001/XMLSchema#');
  });

  test('should contain Wikidata namespaces', () => {
    expect(snorql_namespacePrefixes.wd).toBe('http://www.wikidata.org/entity/');
    expect(snorql_namespacePrefixes.wdt).toBe('http://www.wikidata.org/prop/direct/');
    expect(snorql_namespacePrefixes.wds).toBe('http://www.wikidata.org/entity/statement/');
    expect(snorql_namespacePrefixes.wdv).toBe('http://www.wikidata.org/value/');
  });

  test('should have all namespace values as valid URIs', () => {
    for (const [prefix, uri] of Object.entries(snorql_namespacePrefixes)) {
      expect(uri).toMatch(/^http/);
      expect(typeof uri).toBe('string');
      expect(uri.length).toBeGreaterThan(0);
    }
  });

  test('should have unique namespace URIs', () => {
    const uris = Object.values(snorql_namespacePrefixes);
    const uniqueUris = new Set(uris);
    expect(uniqueUris.size).toBe(uris.length);
  });
});
