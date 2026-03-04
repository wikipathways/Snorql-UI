# Testing Patterns

**Analysis Date:** 2026-03-04

## Test Framework

**Runner:**
- Jest 29.7.0
- Config: `jest.config.js`
- Environment: jsdom (browser-like DOM environment)

**Assertion Library:**
- Jest built-in expect API

**Run Commands:**
```bash
npm test              # Run all tests
npm run test:watch   # Watch mode (re-run on file changes)
npm run test:coverage # Generate coverage report
```

## Test File Organization

**Location:**
- `__tests__/` directory at project root
- Files follow pattern: `__tests__/[module-name].test.js`

**Naming:**
- Test files: `namespaces.test.js`, `sparql.test.js`

**Structure:**
```
__tests__/
├── namespaces.test.js
└── sparql.test.js
```

## Test Configuration

**Jest Config (`jest.config.js`):**
```javascript
module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'assets/js/**/*.js',
    '!assets/js/**/*.min.js',
    '!assets/js/lib/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true
};
```

**Coverage Reports Generated:**
- text (console output)
- lcov (for CI integration)
- html (browsable report in `coverage/` directory)

## Test Structure

**Suite Organization:**
```javascript
describe('SPARQL namespace', () => {
  test('should be defined', () => {
    expect(SPARQL).toBeDefined();
  });

  test('should have statistics object', () => {
    expect(SPARQL.statistics).toBeDefined();
    expect(SPARQL.statistics.queries_sent).toBe(0);
  });
});
```

**Patterns:**

1. **Setup Pattern - Sandbox Execution:**
   Each test file loads legacy global script code in an isolated sandbox to avoid conflicts:
   ```javascript
   const fs = require('fs');
   const path = require('path');
   const vm = require('vm');

   const sparqlCode = fs.readFileSync(
     path.join(__dirname, '../assets/js/sparql.js'),
     'utf8'
   );

   let SPARQL;

   beforeEach(() => {
     const sandbox = {
       window: { setInterval: jest.fn(), clearInterval: jest.fn() },
       XMLHttpRequest: jest.fn(() => ({ /* mocked */ })),
       document: { domain: 'localhost' },
       alert: jest.fn(),
       performance: { now: jest.fn(() => Date.now()) }
     };

     vm.createContext(sandbox);
     vm.runInContext(sparqlCode, sandbox);
     SPARQL = sandbox.SPARQL;
   });
   ```

2. **Assertion Pattern:**
   Tests check object existence, type, and expected values:
   ```javascript
   test('should create service with endpoint', () => {
     const service = new SPARQL.Service('http://example.org/sparql');
     expect(service).toBeDefined();
     expect(service.endpoint()).toBe('http://example.org/sparql');
   });
   ```

3. **Error Testing Pattern:**
   ```javascript
   test('should throw for invalid HTTP method', () => {
     const service = new SPARQL.Service('http://example.org/sparql');
     expect(() => service.setMethod('PUT')).toThrow();
   });
   ```

## Test Coverage by Module

**`sparql.test.js` (130 lines):**
Tests for SPARQL protocol implementation:

- **SPARQL namespace tests (5 tests):**
  - Namespace definition
  - Statistics object initialization
  - Query transformations availability

- **SPARQL._query_transformations tests (6 tests):**
  - `query()` transformation (identity)
  - `ask()` transformation (boolean extraction)
  - `selectValues()` transformation (single column array)
  - `selectSingleValue()` transformation (single cell)
  - `selectValueArrays()` transformation (grouped by variable)
  - `selectValueHashes()` transformation (array of objects)

- **SPARQL.Service tests (9 tests):**
  - Service creation with endpoint
  - Initialize with empty graphs/prefixes
  - Add default graphs
  - Add named graphs
  - Set prefixes
  - HTTP method defaults (POST) and configuration
  - Invalid method rejection
  - Query object creation
  - Request header setting
  - Max simultaneous queries configuration

- **SPARQL.Query tests (7 tests):**
  - Prefix inheritance from service
  - Query-specific prefix addition
  - Query string generation with prefixes
  - Default and named graph handling
  - Query-specific request headers
  - Method inheritance and override
  - Verify service unchanged when query method overridden

**`namespaces.test.js` (82 lines):**
Tests for namespace prefix definitions:

- **Object definition tests (2 tests):**
  - `snorql_namespacePrefixes` is defined
  - Is an object, not null

- **Specific namespace tests (7 tests):**
  - RDF (`http://www.w3.org/1999/02/22-rdf-syntax-ns#`)
  - RDFS (`http://www.w3.org/2000/01/rdf-schema#`)
  - OWL (`http://www.w3.org/2002/07/owl#`)
  - Dublin Core (`dc`, `dcterms`)
  - FOAF (`http://xmlns.com/foaf/0.1/`)
  - XSD (`http://www.w3.org/2001/XMLSchema#`)
  - Wikidata (`wd`, `wdt`, `wds`, `wdv`)

- **Data validation tests (2 tests):**
  - All URIs are valid strings starting with "http"
  - All URIs are unique (no duplicates)

## Mocking

**Framework:** Jest mocking functions via `jest.fn()`

**Patterns:**

1. **XMLHttpRequest Mock:**
   ```javascript
   XMLHttpRequest: jest.fn(() => ({
     open: jest.fn(),
     send: jest.fn(),
     setRequestHeader: jest.fn(),
     readyState: 0,
     status: 0,
     responseText: ''
   }))
   ```

2. **Browser API Mocks:**
   ```javascript
   window: {
     setInterval: jest.fn(),
     clearInterval: jest.fn()
   },
   alert: jest.fn(),
   performance: {
     now: jest.fn(() => Date.now())
   }
   ```

3. **No Mocking of SPARQL Logic:**
   Tests verify actual transformation functions work correctly - no mocks for business logic

## What to Mock

- **DO mock:**
  - Browser APIs (`XMLHttpRequest`, `window`, `document`, `alert`)
  - Async utilities (`setInterval`, `clearInterval`)
  - Performance measurement (`performance.now()`)

- **DO NOT mock:**
  - SPARQL transformation logic (test real behavior)
  - Namespace definitions (test actual data)
  - Service/Query object methods (test actual implementation)

## Fixtures and Fixtures Data

**Test Data Pattern:**
Input objects defined inline in tests:

```javascript
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
```

**Location:** Test data defined within test functions (no separate fixture files)

**Pattern:** Minimal test data - only include fields needed for test assertion

## Coverage

**Requirements:** None enforced (no threshold configured)

**View Coverage:**
```bash
npm run test:coverage
# Generates HTML report in coverage/index.html
```

**Collected Coverage From:**
- `assets/js/**/*.js` (all source files)
- Excludes: `*.min.js` (minified libraries), `assets/js/lib/**` (third-party)

**Current Coverage Status:**
- Coverage directory exists at `coverage/` (generated by test runs)
- No specific coverage targets enforced in CI

## Test Types

**Unit Tests:**
- **Scope:** Individual functions and methods
- **Approach:** Test transformation functions with various input shapes, verify service/query initialization and configuration
- **Example:** `sparql.test.js` tests each query transformation independently with different result structures

**Integration Tests:**
- **Scope:** Not implemented
- **Note:** No tests verify interaction between files (e.g., snorql.js calling sparql.js)

**E2E Tests:**
- **Framework:** Not used
- **Note:** UI behavior not tested automatically; browser-based manual testing only

## Special Test Patterns

**Sandbox Isolation Pattern (`sparql.test.js`):**
Uses Node.js `vm` module to execute global script code safely:

```javascript
beforeEach(() => {
  const sandbox = {
    window: { setInterval: jest.fn(), clearInterval: jest.fn() },
    XMLHttpRequest: jest.fn(() => ({ /* mocks */ })),
    document: { domain: 'localhost' },
    alert: jest.fn(),
    performance: { now: jest.fn(() => Date.now()) }
  };

  vm.createContext(sandbox);
  vm.runInContext(sparqlCode, sandbox);
  SPARQL = sandbox.SPARQL;
});
```

This allows testing legacy global script code without polluting Node.js global scope.

**Transformation Function Testing:**
Tests verify transformations work with realistic SPARQL JSON result structures:

```javascript
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
```

## Untested Code

**Not covered by tests:**
- `snorql.js` - Main application logic (DOM manipulation, AJAX calls, event handlers)
- `script.js` - Event handler code
- `namespaces.js` - Only the exported object is tested

**Why untested:**
- Browser-dependent code (DOM manipulation, jQuery plugins)
- External dependencies (GitHub API, SPARQL endpoints)
- UI interaction testing would require browser automation tools not configured

---

*Testing analysis: 2026-03-04*
