/**
 * Tests for sparql.js - SPARQL protocol implementation
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Read the sparql.js file
const sparqlCode = fs.readFileSync(
  path.join(__dirname, '../assets/js/sparql.js'),
  'utf8'
);

let SPARQL;

beforeEach(() => {
  // Create a fresh sandbox for each test with browser-like globals
  const sandbox = {
    window: {
      setInterval: jest.fn(),
      clearInterval: jest.fn()
    },
    XMLHttpRequest: jest.fn(() => ({
      open: jest.fn(),
      send: jest.fn(),
      setRequestHeader: jest.fn(),
      readyState: 0,
      status: 0,
      responseText: ''
    })),
    document: {
      domain: 'localhost'
    },
    alert: jest.fn(),
    performance: {
      now: jest.fn(() => Date.now())
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(sparqlCode, sandbox);
  SPARQL = sandbox.SPARQL;
});

describe('SPARQL namespace', () => {
  test('should be defined', () => {
    expect(SPARQL).toBeDefined();
  });

  test('should have statistics object', () => {
    expect(SPARQL.statistics).toBeDefined();
    expect(SPARQL.statistics.queries_sent).toBe(0);
    expect(SPARQL.statistics.successes).toBe(0);
    expect(SPARQL.statistics.failures).toBe(0);
  });

  test('should have query transformations', () => {
    expect(SPARQL._query_transformations).toBeDefined();
    expect(typeof SPARQL._query_transformations.query).toBe('function');
    expect(typeof SPARQL._query_transformations.ask).toBe('function');
    expect(typeof SPARQL._query_transformations.selectValues).toBe('function');
    expect(typeof SPARQL._query_transformations.selectSingleValue).toBe('function');
    expect(typeof SPARQL._query_transformations.selectValueArrays).toBe('function');
    expect(typeof SPARQL._query_transformations.selectValueHashes).toBe('function');
  });
});

describe('SPARQL._query_transformations', () => {
  test('query transformation returns object unchanged', () => {
    const input = { head: { vars: ['x'] }, results: { bindings: [] } };
    expect(SPARQL._query_transformations.query(input)).toBe(input);
  });

  test('ask transformation returns boolean value', () => {
    expect(SPARQL._query_transformations.ask({ 'boolean': true })).toBe(true);
    expect(SPARQL._query_transformations.ask({ 'boolean': false })).toBe(false);
  });

  test('selectValues transformation extracts values array', () => {
    const input = {
      head: { vars: ['name'] },
      results: {
        bindings: [
          { name: { value: 'Alice' } },
          { name: { value: 'Bob' } },
          { name: { value: 'Charlie' } }
        ]
      }
    };
    const result = SPARQL._query_transformations.selectValues(input);
    expect(result).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  test('selectSingleValue transformation returns single value', () => {
    const input = {
      head: { vars: ['count'] },
      results: {
        bindings: [{ count: { value: '42' } }]
      }
    };
    const result = SPARQL._query_transformations.selectSingleValue(input);
    expect(result).toBe('42');
  });

  test('selectValueArrays transformation groups by variable', () => {
    const input = {
      head: { vars: ['type', 'name'] },
      results: {
        bindings: [
          { type: { value: 'Person' }, name: { value: 'Alice' } },
          { type: { value: 'Person' }, name: { value: 'Bob' } }
        ]
      }
    };
    const result = SPARQL._query_transformations.selectValueArrays(input);
    expect(result.type).toEqual(['Person', 'Person']);
    expect(result.name).toEqual(['Alice', 'Bob']);
  });

  test('selectValueHashes transformation returns array of hashes', () => {
    const input = {
      head: { vars: ['id', 'label'] },
      results: {
        bindings: [
          { id: { value: '1' }, label: { value: 'First' } },
          { id: { value: '2' }, label: { value: 'Second' } }
        ]
      }
    };
    const result = SPARQL._query_transformations.selectValueHashes(input);
    expect(result).toEqual([
      { id: '1', label: 'First' },
      { id: '2', label: 'Second' }
    ]);
  });
});

describe('SPARQL.Service', () => {
  test('should create service with endpoint', () => {
    const service = new SPARQL.Service('http://example.org/sparql');
    expect(service).toBeDefined();
    expect(service.endpoint()).toBe('http://example.org/sparql');
  });

  test('should have undefined endpoint when created without one', () => {
    const service = new SPARQL.Service();
    expect(service.endpoint()).toBeUndefined();
  });

  test('should initialize with empty graphs and prefixes', () => {
    const service = new SPARQL.Service('http://example.org/sparql');
    expect(service.defaultGraphs()).toEqual([]);
    expect(service.namedGraphs()).toEqual([]);
    expect(service.prefixes()).toEqual({});
  });

  test('should add default graphs', () => {
    const service = new SPARQL.Service('http://example.org/sparql');
    service.addDefaultGraph('http://example.org/graph1');
    service.addDefaultGraph('http://example.org/graph2');
    expect(service.defaultGraphs()).toContain('http://example.org/graph1');
    expect(service.defaultGraphs()).toContain('http://example.org/graph2');
  });

  test('should add named graphs', () => {
    const service = new SPARQL.Service('http://example.org/sparql');
    service.addNamedGraph('http://example.org/named1');
    expect(service.namedGraphs()).toContain('http://example.org/named1');
  });

  test('should set prefixes', () => {
    const service = new SPARQL.Service('http://example.org/sparql');
    service.setPrefix('foaf', 'http://xmlns.com/foaf/0.1/');
    expect(service.prefixes().foaf).toBe('http://xmlns.com/foaf/0.1/');
  });

  test('should use POST method by default', () => {
    const service = new SPARQL.Service('http://example.org/sparql');
    expect(service.method()).toBe('POST');
  });

  test('should allow setting method to GET', () => {
    const service = new SPARQL.Service('http://example.org/sparql');
    service.setMethod('GET');
    expect(service.method()).toBe('GET');
  });

  test('should throw for invalid HTTP method', () => {
    const service = new SPARQL.Service('http://example.org/sparql');
    expect(() => service.setMethod('PUT')).toThrow();
  });

  test('should create query objects', () => {
    const service = new SPARQL.Service('http://example.org/sparql');
    const query = service.createQuery();
    expect(query).toBeDefined();
    expect(query.service()).toBe(service);
  });

  test('should set request headers', () => {
    const service = new SPARQL.Service('http://example.org/sparql');
    service.setRequestHeader('Accept', 'application/json');
    expect(service.requestHeaders()['Accept']).toBe('application/json');
  });

  test('should set max simultaneous queries', () => {
    const service = new SPARQL.Service('http://example.org/sparql');
    service.setMaxSimultaneousQueries(5);
    expect(service.maxSimultaneousQueries()).toBe(5);
  });
});

describe('SPARQL.Query', () => {
  let service;

  beforeEach(() => {
    service = new SPARQL.Service('http://example.org/sparql');
    service.setPrefix('rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#');
  });

  test('should inherit prefixes from service', () => {
    const query = service.createQuery();
    expect(query.prefixes().rdf).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
  });

  test('should allow adding query-specific prefixes', () => {
    const query = service.createQuery();
    query.setPrefix('foaf', 'http://xmlns.com/foaf/0.1/');
    expect(query.prefixes().foaf).toBe('http://xmlns.com/foaf/0.1/');
  });

  test('should generate query string with prefixes', () => {
    const query = service.createQuery();
    query.setPrefix('foaf', 'http://xmlns.com/foaf/0.1/');
    // The queryString method needs to be called after setting up the query
    // For this test, we check that the method exists
    expect(typeof query.queryString).toBe('function');
  });

  test('should add default and named graphs', () => {
    const query = service.createQuery();
    query.addDefaultGraph('http://example.org/default');
    query.addNamedGraph('http://example.org/named');
    expect(query.defaultGraphs()).toContain('http://example.org/default');
    expect(query.namedGraphs()).toContain('http://example.org/named');
  });

  test('should set query-specific request headers', () => {
    const query = service.createQuery();
    query.setRequestHeader('X-Custom', 'value');
    expect(query.requestHeaders()['X-Custom']).toBe('value');
  });

  test('should inherit method from service', () => {
    service.setMethod('GET');
    const query = service.createQuery();
    expect(query.method()).toBe('GET');
  });

  test('should allow overriding method on query', () => {
    const query = service.createQuery();
    query.setMethod('GET');
    expect(query.method()).toBe('GET');
    expect(service.method()).toBe('POST'); // Service unchanged
  });
});

describe('SPARQL.QueryUtilities', () => {
  test('should be defined', () => {
    expect(SPARQL.QueryUtilities).toBeDefined();
    expect(typeof SPARQL.QueryUtilities).toBe('object');
  });
});
