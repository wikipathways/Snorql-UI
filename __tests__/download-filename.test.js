/**
 * Names of downloaded result files (issue #47): named after the example on screen while it
 * is shown unedited, with its identifier, version and title; otherwise snorql_ and the
 * local date and time. The name is taken when the download starts, not when the results
 * arrive.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const read = (f) => fs.readFileSync(path.join(__dirname, '../assets/js', f), 'utf8');

const ENTRY = { id: 'WPQ036', label: 'Genes of a Pathway', version: '1.1.0' };
const NOW = new Date(2026, 10, 26, 14, 5, 9); // local time, so the test does not depend on the time zone

function createSandbox() {
  const links = [];
  const sb = {
    window: { SNORQL_CONFIG: { examplesFormat: 'index', defaultGraph: '' }, location: { search: '' } },
    document: {
      getElementById: jest.fn(() => null),
      createElement: jest.fn(() => {
        const a = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, click: jest.fn() };
        links.push(a);
        return a;
      })
    },
    $: jest.fn(), jQuery: jest.fn(), console, URLSearchParams, JSON, alert: jest.fn(),
    setTimeout: jest.fn(), clearTimeout: jest.fn(), setInterval: jest.fn(), clearInterval: jest.fn()
  };
  vm.createContext(sb);
  vm.runInContext(read('deeplinks.js'), sb);
  vm.runInContext(read('examples-index.js'), sb);
  vm.runInContext('var DeepLinks = window.DeepLinks, ExamplesIndex = window.ExamplesIndex;', sb);
  vm.runInContext(read('snorql.js'), sb);
  vm.runInContext('var CONFIG = window.SNORQL_CONFIG;', sb);
  sb._links = links;
  return sb;
}

function shown(state) {
  const sb = createSandbox();
  sb._state = state;
  vm.runInContext('_currentExample = _state.example || null; _currentEntry = _state.entry || null;' +
    '_panelState = _state.panel || "active";', sb);
  return sb;
}

const name = (sb, ext) => {
  sb._now = NOW;
  return vm.runInContext('downloadFilename(' + JSON.stringify(ext) + ', _now)', sb);
};

describe('downloadFilename', () => {
  test('an example from the index: identifier, current version and title', () => {
    const sb = shown({ example: { id: 'WPQ036', version: null }, entry: ENTRY });
    expect(name(sb, 'tsv')).toBe('WPQ036_v1.1.0_genes-of-a-pathway.tsv');
  });

  test('an older version on screen is the one named', () => {
    const sb = shown({ example: { id: 'WPQ036', version: '1.0.0' }, entry: ENTRY });
    expect(name(sb, 'csv')).toBe('WPQ036_v1.0.0_genes-of-a-pathway.csv');
  });

  test('each format keeps its own extension, and only once', () => {
    const sb = shown({ example: { id: 'WPQ036', version: null }, entry: ENTRY });
    ['csv', 'tsv', 'json', 'xml'].forEach((ext) => {
      expect(name(sb, ext)).toBe('WPQ036_v1.1.0_genes-of-a-pathway.' + ext);
    });
  });

  test('a long title is cut at a word, to at most 40 characters', () => {
    const entry = { id: 'WPQ086', label: 'Genes as HGNC symbol and NCBI gene IDs per pathway', version: '1.0.0' };
    const sb = shown({ example: { id: 'WPQ086', version: null }, entry });
    expect(name(sb, 'tsv')).toBe('WPQ086_v1.0.0_genes-as-hgnc-symbol-and-ncbi-gene-ids.tsv');
  });

  test('accents are dropped and other characters become single hyphens', () => {
    const entry = { id: 'WPQ001', label: 'Café: 3.5 "fatty" acids / (all)!', version: '2.0.1' };
    const sb = shown({ example: { id: 'WPQ001', version: null }, entry });
    expect(name(sb, 'tsv')).toBe('WPQ001_v2.0.1_cafe-3.5-fatty-acids-all.tsv');
  });

  test('an entry without a valid version is named without one', () => {
    const sb = shown({ example: { id: 'WPQ036', version: null }, entry: Object.assign({}, ENTRY, { version: 'v1' }) });
    expect(name(sb, 'tsv')).toBe('WPQ036_genes-of-a-pathway.tsv');
  });

  test('an .rq example is named after its file', () => {
    const sb = shown({ example: { path: 'D. General/GenesofPathway.rq', ref: null } });
    expect(name(sb, 'tsv')).toBe('GenesofPathway.tsv');
  });

  test('an edited example is no longer that example: date and time instead', () => {
    const sb = shown({ example: { id: 'WPQ036', version: null }, entry: ENTRY, panel: 'stale' });
    expect(name(sb, 'tsv')).toBe('snorql_2026-11-26_14-05-09.tsv');
  });

  test('a query of your own gets the date and time', () => {
    const sb = shown({ panel: 'welcome' });
    expect(name(sb, 'json')).toBe('snorql_2026-11-26_14-05-09.json');
  });

  test('without a date given, it uses the current time', () => {
    const sb = shown({ panel: 'welcome' });
    expect(vm.runInContext('downloadFilename("tsv")', sb)).toMatch(/^snorql_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.tsv$/);
  });
});

describe('exportResults', () => {
  function exporting(type) {
    const sb = shown({ example: { id: 'WPQ036', version: null }, entry: ENTRY });
    vm.runInContext(
      'prepareQueryForSend = function (q) { return q; }; chooseMethod = function () { return "GET"; };' +
      'var _callbacks = null;' +
      'SPARQL = { Service: function () { return { setMethod: function () {}, addDefaultGraph: function () {},' +
      '  setRequestHeader: function () {}, setOutput: function () {},' +
      '  query: function (q, cb) { _callbacks = cb; } }; } };', sb);
    vm.runInContext('exportResults("https://e.example/sparql", "SELECT * {}", ' + JSON.stringify(type) + ')', sb);
    return sb;
  }

  const CSV_RESULTS = { head: { vars: ['a'] }, results: { bindings: [{ a: { type: 'literal', value: '1' } }] } };

  test.each([
    ['tsv', 'a\n1'],
    ['json', CSV_RESULTS],
    ['xml', '<sparql/>'],
    ['csv', CSV_RESULTS]
  ])('%s: named after the example that was on screen when the download started', (type, results) => {
    const sb = exporting(type);
    // Another example is opened before the results come back.
    vm.runInContext('_currentExample = { id: "WPQ099", version: null };' +
      '_currentEntry = { id: "WPQ099", label: "Something else", version: "3.0.0" };', sb);
    sb._results = results;
    vm.runInContext('_callbacks.success(_results)', sb);
    const link = sb._links[sb._links.length - 1];
    expect(link.attrs.download).toBe('WPQ036_v1.1.0_genes-of-a-pathway.' + type);
    expect(link.click).toHaveBeenCalled();
  });
});
