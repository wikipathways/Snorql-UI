/**
 * Tests for examples from a published index in snorql.js (examplesFormat "index"):
 * loading and caching index.json, falling back to the .rq listing when there is
 * no index yet, and opening ?example= links by identifier, old path, version and ref.
 * The functions that update the page are replaced by spies.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const read = (f) => fs.readFileSync(path.join(__dirname, '../assets/js', f), 'utf8');
const snorqlCode = read('snorql.js');
const deeplinksCode = read('deeplinks.js');
const indexCode = read('examples-index.js');

// Minimal synchronous stand-in for jQuery's Deferred.
function Deferred() {
  const d = { state: 'pending', doneFns: [], failFns: [] };
  d.resolve = (v) => { d.state = 'resolved'; d.value = v; d.doneFns.forEach((f) => f(v)); return d; };
  d.reject = (v) => { d.state = 'rejected'; d.value = v; d.failFns.forEach((f) => f(v)); return d; };
  d.done = (f) => { if (d.state === 'resolved') f(d.value); else d.doneFns.push(f); return d; };
  d.fail = (f) => { if (d.state === 'rejected') f(d.value); else d.failFns.push(f); return d; };
  d.promise = () => d;
  return d;
}

const BASE = 'https://raw.githubusercontent.com/wikipathways/SPARQLQueries/examples-index/';
const CAT = 'https://x/category/';
const ENTRY = {
  id: 'WPQ036', iri: 'https://x/WPQ036', label: 'Genes of a Pathway', description: 'd', version: '1.1.0',
  categories: [CAT + 'General'], keywords: [], creators: [], contributors: [], params: [],
  query: 'SELECT 1 {}', path: 'D. General/GenesofPathway.ttl', aliases: ['D. General/GenesofPathway.rq']
};
const INDEX = { schema: 1, categories: [{ iri: CAT + 'General', label: 'General', parent: null }], examples: [ENTRY] };
const HISTORY = {
  examples: { WPQ036: [
    { version: '1.0.0', commit: 'aaaaaaa1111111111111111111111111111111aa', date: '2026-11-11' },
    { version: '1.1.0', commit: 'bbbbbbb2222222222222222222222222222222bb', date: '2026-12-01' }] },
  releases: {}
};

function createSandbox(responses, search) {
  const store = {};
  const calls = [];
  const ajax = jest.fn((opts) => {
    calls.push(opts.url);
    const d = Deferred();
    const r = responses.find((x) => opts.url === x.url || opts.url.startsWith(x.prefix || '\u0000'));
    if (!r) return d.reject({ status: 404 });
    return r.ok ? d.resolve(r.body) : d.reject({ status: r.status });
  });
  const el = () => ({ html: jest.fn(), on: jest.fn(), val: jest.fn(() => 'https://github.com/wikipathways/SPARQLQueries'),
    empty: jest.fn(function () { return this; }), hide: jest.fn(), show: jest.fn(), length: 1 });
  const $ = Object.assign(jest.fn(() => el()), { Deferred, ajax });
  const sb = {
    window: { SNORQL_CONFIG: { examplesFormat: 'index', examplesBranch: 'master' }, location: { search: search || '' } },
    document: { getElementById: jest.fn(() => null), createElement: jest.fn(() => ({})) },
    $, jQuery: $, console, URLSearchParams, Date, JSON,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); }
    },
    setTimeout: jest.fn(), clearTimeout: jest.fn(), setInterval: jest.fn(), clearInterval: jest.fn()
  };
  vm.createContext(sb);
  vm.runInContext(deeplinksCode, sb);
  vm.runInContext(indexCode, sb);
  vm.runInContext('var DeepLinks = window.DeepLinks, ExamplesIndex = window.ExamplesIndex;', sb);
  vm.runInContext(snorqlCode, sb);
  vm.runInContext('var CONFIG = window.SNORQL_CONFIG;', sb);
  // Spies for everything that updates the page.
  ['applyIndexExample', 'loadRqExampleFromUrl', 'showExampleLinkError', 'initTreeview', 'fetchRqExamples',
    'showExamplesError', 'loadIndexVersion'].forEach((f) => { sb[f] = jest.fn(); });
  sb._calls = calls;
  sb._store = store;
  return sb;
}

const OK_INDEX = { url: BASE + 'index.json', ok: true, body: INDEX };
const OK_HISTORY = { url: BASE + 'history.json', ok: true, body: HISTORY };

describe('index loading', () => {
  test('builds the tree from index.json on the examples-index branch', () => {
    const sb = createSandbox([OK_INDEX]);
    vm.runInContext('fetchExamples("")', sb);
    expect(sb._calls).toEqual([BASE + 'index.json']);
    const tree = sb.initTreeview.mock.calls[0][0];
    expect(tree[0].text).toBe('General');
    expect(tree[0].nodes[0].exampleId).toBe('WPQ036');
  });

  test('loads the index once for both trees and caches it', () => {
    const sb = createSandbox([OK_INDEX]);
    vm.runInContext('fetchExamples(""); fetchExamples("-fs")', sb);
    expect(sb._calls).toEqual([BASE + 'index.json']);
    expect(Object.keys(sb._store)).toEqual(['snorql_index_' + BASE]);
    const sb2 = createSandbox([OK_INDEX]);
    sb2._store['snorql_index_' + BASE] = sb._store['snorql_index_' + BASE];
    Object.assign(sb2.localStorage, { getItem: (k) => sb._store[k] || null });
    vm.runInContext('fetchExamples("")', sb2);
    expect(sb2._calls).toEqual([]);
  });

  test('lists the .rq files when the repository has no index yet', () => {
    const sb = createSandbox([{ url: BASE + 'index.json', ok: false, status: 404 }]);
    vm.runInContext('fetchExamples("")', sb);
    expect(sb.fetchRqExamples).toHaveBeenCalledWith('');
  });

  test('reports other errors', () => {
    const sb = createSandbox([{ url: BASE + 'index.json', ok: false, status: 500 }]);
    vm.runInContext('fetchExamples("")', sb);
    expect(sb.showExamplesError).toHaveBeenCalled();
    expect(sb.fetchRqExamples).not.toHaveBeenCalled();
  });

  test('rejects an index in an unknown format', () => {
    const sb = createSandbox([{ url: BASE + 'index.json', ok: true, body: { schema: 99, examples: [] } }]);
    vm.runInContext('fetchExamples("")', sb);
    expect(sb.initTreeview).not.toHaveBeenCalled();
    expect(sb.showExamplesError).toHaveBeenCalled();
  });

  test('without examplesFormat "index" the .rq listing is used', () => {
    const sb = createSandbox([OK_INDEX]);
    sb.window.SNORQL_CONFIG.examplesFormat = undefined;
    vm.runInContext('fetchExamples("")', sb);
    expect(sb.fetchRqExamples).toHaveBeenCalled();
    expect(sb._calls).toEqual([]);
  });
});

describe('?example= links with an index', () => {
  function open(search, responses) {
    const sb = createSandbox(responses || [OK_INDEX, OK_HISTORY], search);
    vm.runInContext('loadExampleFromUrl()', sb);
    return sb;
  }

  test('by identifier, with parameter values', () => {
    const sb = open('?example=WPQ036&pathwayId=WP254');
    expect(sb.applyIndexExample).toHaveBeenCalledTimes(1);
    const [entry, version, values] = sb.applyIndexExample.mock.calls[0];
    expect(entry.id).toBe('WPQ036');
    expect(version).toBeNull();
    expect(values).toEqual({ pathwayId: 'WP254' });
  });

  test('by the old .rq path, as v1.3 links have it', () => {
    const sb = open('?example=D.%20General/GenesofPathway.rq');
    expect(sb.applyIndexExample.mock.calls[0][0].id).toBe('WPQ036');
  });

  test('with a version', () => {
    const sb = open('?example=WPQ036&version=1.0.0');
    expect(sb.loadIndexVersion).toHaveBeenCalledWith('WPQ036', '1.0.0', {});
  });

  test('with a ref that names a version commit', () => {
    const sb = open('?example=WPQ036&ref=aaaaaaa1');
    expect(sb.loadIndexVersion).toHaveBeenCalledWith('WPQ036', '1.0.0', {});
  });

  test('an old .rq link pinned to a commit from before the index reads the .rq file', () => {
    const sb = open('?example=D.%20General/GenesofPathway.rq&ref=c0ffee1');
    expect(sb.loadRqExampleFromUrl).toHaveBeenCalled();
    expect(sb.loadIndexVersion).not.toHaveBeenCalled();
  });

  test('an identifier with an unknown ref is an error', () => {
    const sb = open('?example=WPQ036&ref=c0ffee1');
    expect(sb.showExampleLinkError).toHaveBeenCalled();
  });

  test('an .rq path the index does not know is read as an .rq file', () => {
    const sb = open('?example=X/old.rq');
    expect(sb.loadRqExampleFromUrl).toHaveBeenCalled();
  });

  test('unknown identifier, malformed key or version', () => {
    expect(open('?example=WPQ999').showExampleLinkError).toHaveBeenCalled();
    expect(open('?example=..%2Fx').showExampleLinkError).toHaveBeenCalled();
    const sb = open('?example=WPQ036&version=1.0');
    expect(sb.showExampleLinkError).toHaveBeenCalled();
    expect(sb._calls).toEqual([]);
  });
});
