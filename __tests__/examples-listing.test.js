/**
 * Tests for listing the examples repository: the folder tree, jsDelivr as the
 * first source with GitHub's API as fallback, and the hour-long cache.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const snorqlCode = fs.readFileSync(path.join(__dirname, '../assets/js/snorql.js'), 'utf8');

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

function createSandbox(responses) {
  const store = {};
  const calls = [];
  const ajax = jest.fn((opts) => {
    calls.push(opts.url);
    const d = Deferred();
    const r = responses.find((x) => opts.url.startsWith(x.prefix));
    if (!r) return d.reject({ status: 0 });
    return r.ok ? d.resolve(r.body) : d.reject({ status: r.status });
  });
  const $ = Object.assign(jest.fn(() => ({ html: jest.fn(), on: jest.fn(), val: jest.fn() })), {
    Deferred, ajax
  });
  const sb = {
    window: { SNORQL_CONFIG: null },
    document: { getElementById: jest.fn(() => null), createElement: jest.fn(() => ({})) },
    $, jQuery: $,
    console,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); }
    },
    Date,
    setTimeout: jest.fn(), clearTimeout: jest.fn(), setInterval: jest.fn(), clearInterval: jest.fn()
  };
  vm.createContext(sb);
  vm.runInContext(snorqlCode, sb);
  sb._calls = calls;
  sb._store = store;
  return sb;
}

const REPO = 'wikipathways/SPARQLQueries';
const GITHUB_TREE = {
  tree: [
    { path: 'README.md' },
    { path: 'A. Metadata/metadata.rq' },
    { path: 'A. Metadata/datacounts/countPathways.rq' },
    { path: 'top.rq' }
  ]
};
const JSDELIVR = {
  files: [
    { name: '/README.md' },
    { name: '/A. Metadata/metadata.rq' },
    { name: '/A. Metadata/datacounts/countPathways.rq' },
    { name: '/top.rq' }
  ]
};

function leafPaths(nodes, out = []) {
  for (const n of nodes) {
    if (n.nodes) leafPaths(n.nodes, out);
    else out.push(n.path);
  }
  return out;
}

describe('buildExampleTree', () => {
  test('nests .rq files by folder and skips other files', () => {
    const sb = createSandbox([]);
    sb._paths = GITHUB_TREE.tree.map((t) => t.path);
    const tree = vm.runInContext('buildExampleTree(_paths, ' + JSON.stringify(REPO) + ')', sb);
    expect(tree.map((n) => n.text)).toEqual(['A. Metadata', 'top.rq']);
    expect(tree[0].nodes.map((n) => n.text)).toEqual(['metadata.rq', 'datacounts']);
    expect(tree[0].nodes[1].nodes[0].href)
      .toBe('https://raw.githubusercontent.com/wikipathways/SPARQLQueries/master/A. Metadata/datacounts/countPathways.rq');
    expect(leafPaths(tree)).toEqual(['A. Metadata/metadata.rq', 'A. Metadata/datacounts/countPathways.rq', 'top.rq']);
  });

  test('skips paths with empty, "." or ".." segments', () => {
    const sb = createSandbox([]);
    sb._paths = ['../../other/repo/master/x.rq', 'a/./b.rq', 'a//c.rq', 'ok/d.rq'];
    const tree = vm.runInContext('buildExampleTree(_paths, ' + JSON.stringify(REPO) + ')', sb);
    expect(leafPaths(tree)).toEqual(['ok/d.rq']);
  });
});

describe('mainAjax', () => {
  const apiUrl = 'https://api.github.com/repos/' + REPO + '/git/trees/master?recursive=1';
  const jsdUrl = 'https://data.jsdelivr.com/v1/packages/gh/' + REPO + '@master?structure=flat';
  const EXPECTED = ['A. Metadata/metadata.rq', 'A. Metadata/datacounts/countPathways.rq', 'top.rq'];

  function run(sb, link = apiUrl, repo = REPO) {
    let result;
    vm.runInContext('mainAjax(' + JSON.stringify(link) + ', ' + JSON.stringify(repo) + ')', sb)
      .done((t) => { result = { tree: t }; })
      .fail((x) => { result = { error: x }; });
    return result;
  }

  test('lists the files through jsDelivr and does not call the GitHub API', () => {
    const sb = createSandbox([
      { prefix: 'https://data.jsdelivr.com/', ok: true, body: JSDELIVR },
      { prefix: 'https://api.github.com/', ok: true, body: GITHUB_TREE }
    ]);
    expect(leafPaths(run(sb).tree)).toEqual(EXPECTED);
    expect(sb._calls).toEqual([jsdUrl]);
  });

  test('falls back to the GitHub API when jsDelivr fails', () => {
    const sb = createSandbox([
      { prefix: 'https://data.jsdelivr.com/', ok: false, status: 503 },
      { prefix: 'https://api.github.com/', ok: true, body: GITHUB_TREE }
    ]);
    expect(leafPaths(run(sb).tree)).toEqual(EXPECTED);
    expect(sb._calls).toEqual([jsdUrl, apiUrl]);
  });

  test('falls back to the GitHub API when jsDelivr lists no .rq files', () => {
    const sb = createSandbox([
      { prefix: 'https://data.jsdelivr.com/', ok: true, body: { files: [{ name: '/README.md' }] } },
      { prefix: 'https://api.github.com/', ok: true, body: GITHUB_TREE }
    ]);
    expect(leafPaths(run(sb).tree)).toEqual(EXPECTED);
  });

  test("reports GitHub's error when both fail, so a rate limit or a wrong URL is named", () => {
    const sb = createSandbox([
      { prefix: 'https://data.jsdelivr.com/', ok: false, status: 404 },
      { prefix: 'https://api.github.com/', ok: false, status: 403 }
    ]);
    expect(run(sb).error.status).toBe(403);
  });

  test('a local repository goes to its own API, not to jsDelivr', () => {
    const local = 'http://localhost:8080/api/repos/o/r';
    const sb = createSandbox([{ prefix: 'http://localhost:8080/', ok: true, body: GITHUB_TREE }]);
    const tree = run(sb, local + '/git/trees/master?recursive=1', local).tree;
    expect(leafPaths(tree)).toEqual(EXPECTED);
    expect(sb._calls).toEqual([local + '/git/trees/master?recursive=1']);
  });
});

describe('examples cache', () => {
  test('returns a stored tree within the hour and drops it after', () => {
    const sb = createSandbox([]);
    vm.runInContext('setCachedExamples("https://github.com/x/y", [{ text: "a" }])', sb);
    expect(vm.runInContext('getCachedExamples("https://github.com/x/y")', sb)).toEqual([{ text: 'a' }]);
    const key = 'snorql_examples_https://github.com/x/y';
    const entry = JSON.parse(sb._store[key]);
    entry.time -= 61 * 60 * 1000;
    sb._store[key] = JSON.stringify(entry);
    expect(vm.runInContext('getCachedExamples("https://github.com/x/y")', sb)).toBeNull();
  });

  test('ignores an entry in the old format', () => {
    const sb = createSandbox([]);
    sb._store['snorql_examples_https://github.com/x/y'] = JSON.stringify([{ text: 'a' }]);
    expect(vm.runInContext('getCachedExamples("https://github.com/x/y")', sb)).toBeNull();
  });
});
