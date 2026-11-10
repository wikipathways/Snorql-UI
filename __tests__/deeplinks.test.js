/**
 * Tests for deeplinks.js - ?example= links to queries in the examples repository.
 *
 * Same vm-sandbox harness as linkouts.test.js: run the file in a context with a
 * `window` object and read the exposed `DeepLinks` namespace from it.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(path.join(__dirname, '../assets/js/deeplinks.js'), 'utf8');

let DL;

beforeEach(() => {
  const sandbox = { window: {}, URLSearchParams: URLSearchParams };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  DL = sandbox.window.DeepLinks;
});

describe('readParams', () => {
  test('reads example, ref and parameter values', () => {
    const r = DL.readParams('?example=D.%20General/GenesofPathway.rq&ref=abc123&pathwayId=WP1560');
    expect(r.example).toBe('D. General/GenesofPathway.rq');
    expect(r.ref).toBe('abc123');
    expect(r.values).toEqual({ pathwayId: 'WP1560' });
  });

  test('decodes + as a space, as typed links often do', () => {
    expect(DL.readParams('?example=a.rq&species=Mus+musculus').values.species).toBe('Mus musculus');
  });

  test('keeps endpoint and q out of the parameter values', () => {
    const r = DL.readParams('?q=SELECT&endpoint=https%3A%2F%2Fx.org%2Fsparql&example=a.rq');
    expect(r.values).toEqual({});
  });

  test('no example parameter', () => {
    expect(DL.readParams('?q=SELECT').example).toBeNull();
    expect(DL.readParams('').example).toBeNull();
  });
});

describe('sanitizeExamplePath', () => {
  test('accepts a path with spaces and folders', () => {
    expect(DL.sanitizeExamplePath('I. DirectedSmallMoleculesNetwork (DSMN)/extracting directed metabolic reactions.rq'))
      .toBe('I. DirectedSmallMoleculesNetwork (DSMN)/extracting directed metabolic reactions.rq');
  });

  test('drops a leading slash', () => {
    expect(DL.sanitizeExamplePath('/A. Metadata/metadata.rq')).toBe('A. Metadata/metadata.rq');
  });

  test.each([
    ['../secret.rq'],
    ['A/../../x.rq'],
    ['A//x.rq'],
    ['./x.rq'],
    ['https://evil.example/x.rq'],
    ['javascript:alert(1).rq'],
    ['A\\x.rq'],
    ['A/x\n.rq'],
    ['A/x\u0000.rq'],
    ['A/x.txt'],
    [''],
    [null],
  ])('rejects %p', (p) => {
    expect(DL.sanitizeExamplePath(p)).toBeNull();
  });

  test('rejects very long paths', () => {
    expect(DL.sanitizeExamplePath('a/'.repeat(200) + 'x.rq')).toBeNull();
  });
});

describe('sanitizeRef', () => {
  test.each([['master'], ['v1.2.0'], ['feature/x'], ['d4ceb96'], ['9fb307f0123456789abcdef0123456789abcdef0']])(
    'accepts %p', (r) => {
      expect(DL.sanitizeRef(r)).toBe(r);
    });

  test.each([['..'], ['a..b'], ['/abs'], ['-x'], ['x/'], ['a b'], ['a?b'], ['a#b'], [''], ['x'.repeat(101)]])(
    'rejects %p', (r) => {
      expect(DL.sanitizeRef(r)).toBeNull();
    });
});

describe('repoPathFromUrl', () => {
  test('GitHub repository URL', () => {
    expect(DL.repoPathFromUrl('https://github.com/wikipathways/SPARQLQueries')).toBe('wikipathways/SPARQLQueries');
    expect(DL.repoPathFromUrl('https://github.com/wikipathways/SPARQLQueries/')).toBe('wikipathways/SPARQLQueries');
  });

  test('local development API is passed through', () => {
    expect(DL.repoPathFromUrl('http://localhost:8000/api/repos/x/y')).toBe('http://localhost:8000/api/repos/x/y');
  });

  test('anything else is refused', () => {
    expect(DL.repoPathFromUrl('https://gitlab.com/a/b')).toBeNull();
    expect(DL.repoPathFromUrl('https://github.com/a')).toBeNull();
    expect(DL.repoPathFromUrl('https://github.com/a/b/tree/main')).toBeNull();
    expect(DL.repoPathFromUrl('')).toBeNull();
  });
});

describe('rawUrl', () => {
  test('GitHub raw URL with encoded path segments', () => {
    expect(DL.rawUrl('wikipathways/SPARQLQueries', 'master', 'D. General/GenesofPathway.rq'))
      .toBe('https://raw.githubusercontent.com/wikipathways/SPARQLQueries/master/D.%20General/GenesofPathway.rq');
  });

  test('a ref with a slash keeps its slash', () => {
    expect(DL.rawUrl('o/r', 'feature/x', 'a.rq')).toBe('https://raw.githubusercontent.com/o/r/feature/x/a.rq');
  });

  test('local development API', () => {
    expect(DL.rawUrl('http://localhost:8000/api/repos/o/r', 'master', 'A/b c.rq'))
      .toBe('http://localhost:8000/raw/o/r/A/b%20c.rq');
  });
});

describe('pathFromRawHref', () => {
  test('recovers the path from a tree node href', () => {
    expect(DL.pathFromRawHref('https://raw.githubusercontent.com/wikipathways/SPARQLQueries/master/A. Metadata/metadata.rq'))
      .toBe('A. Metadata/metadata.rq');
    expect(DL.pathFromRawHref('https://raw.githubusercontent.com/o/r/master/A%20B/c.rq')).toBe('A B/c.rq');
  });

  test('null for other URLs', () => {
    expect(DL.pathFromRawHref('https://example.org/x.rq')).toBeNull();
    expect(DL.pathFromRawHref(undefined)).toBeNull();
  });
});

describe('acceptedValues', () => {
  const params = [
    { name: 'species', type: 'string', defaultValue: 'Homo sapiens' },
    { name: 'entityType', type: 'enum', defaultValue: 'DataNode',
      options: [{ value: 'DataNode', label: 'Data Nodes' }, { value: 'Metabolite', label: 'Metabolites' }] },
  ];

  test('keeps values for known parameters', () => {
    expect(DL.acceptedValues(params, { species: 'Mus musculus', entityType: 'Metabolite' }))
      .toEqual({ species: 'Mus musculus', entityType: 'Metabolite' });
  });

  test('drops unknown names, enum values that are not options, and overlong values', () => {
    expect(DL.acceptedValues(params, { other: 'x', entityType: 'Metabolites', species: 'x'.repeat(501) })).toEqual({});
  });

  test('ignores inherited properties', () => {
    expect(DL.acceptedValues([{ name: 'toString', type: 'string' }], {})).toEqual({});
  });

  test('no params or no values', () => {
    expect(DL.acceptedValues(null, { a: 'b' })).toEqual({});
    expect(DL.acceptedValues(params, null)).toEqual({});
  });
});

describe('buildExampleUrl', () => {
  const base = 'https://sparql.wikipathways.org/';

  test('short link for an example with default values', () => {
    expect(DL.buildExampleUrl(base, {
      path: 'D. General/GenesofPathway.rq',
      params: [{ name: 'pathwayId', value: 'WP1560', defaultValue: 'WP1560' }],
      endpoint: 'https://sparql.wikipathways.org/sparql',
      defaultEndpoint: 'https://sparql.wikipathways.org/sparql',
    })).toBe('https://sparql.wikipathways.org/?example=D.%20General/GenesofPathway.rq');
  });

  test('adds ref, changed values and a non-default endpoint', () => {
    expect(DL.buildExampleUrl(base, {
      path: 'A/b.rq',
      ref: 'd4ceb96',
      params: [{ name: 'species', value: 'Mus musculus', defaultValue: 'Homo sapiens' }],
      endpoint: 'https://other.org/sparql',
      defaultEndpoint: 'https://sparql.wikipathways.org/sparql',
    })).toBe('https://sparql.wikipathways.org/?example=A/b.rq&ref=d4ceb96&species=Mus%20musculus&endpoint=https%3A%2F%2Fother.org%2Fsparql');
  });

  test('never writes reserved names as parameters', () => {
    const url = DL.buildExampleUrl(base, { path: 'a.rq', params: [{ name: 'q', value: 'x', defaultValue: '' }] });
    expect(url).toBe(base + '?example=a.rq');
  });

  test('round trip through readParams', () => {
    const url = DL.buildExampleUrl(base, {
      path: 'B. Communities/Lipids/LipidClassesTotal.rq',
      params: [{ name: 'lipidClass', value: 'GP', defaultValue: 'FA' }, { name: 'species', value: 'A & B=c', defaultValue: '' }],
    });
    const r = DL.readParams(url.substring(url.indexOf('?')));
    expect(r.example).toBe('B. Communities/Lipids/LipidClassesTotal.rq');
    expect(r.values).toEqual({ lipidClass: 'GP', species: 'A & B=c' });
  });
});

describe('published refs only', () => {
  test('sanitizeRef rejects refs/... (pull requests and the like)', () => {
    expect(DL.sanitizeRef('refs/pull/24/head')).toBeNull();
    expect(DL.sanitizeRef('refs/heads/master')).toBeNull();
  });

  test('compareUrl asks GitHub whether the branch contains the ref', () => {
    expect(DL.compareUrl('wikipathways/SPARQLQueries', 'd4ceb96', 'master'))
      .toBe('https://api.github.com/repos/wikipathways/SPARQLQueries/compare/d4ceb96...master');
  });

  test('refIsPublished: ahead or identical only', () => {
    expect(DL.refIsPublished({ status: 'ahead' })).toBe(true);
    expect(DL.refIsPublished({ status: 'identical' })).toBe(true);
    expect(DL.refIsPublished({ status: 'diverged' })).toBe(false); // fork or pull-request commit
    expect(DL.refIsPublished({ status: 'behind' })).toBe(false);
    expect(DL.refIsPublished(null)).toBe(false);
    expect(DL.refIsPublished({})).toBe(false);
  });
});

describe('publishedCommit and isLocalRepo', () => {
  const full = '3f62091a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e';

  test('returns the full hash GitHub resolved, only for published refs', () => {
    expect(DL.publishedCommit({ status: 'ahead', base_commit: { sha: full } })).toBe(full);
    expect(DL.publishedCommit({ status: 'identical', base_commit: { sha: full } })).toBe(full);
    expect(DL.publishedCommit({ status: 'diverged', base_commit: { sha: full } })).toBeNull();
    expect(DL.publishedCommit({ status: 'ahead' })).toBeNull();
    expect(DL.publishedCommit({ status: 'ahead', base_commit: { sha: '3f62091' } })).toBeNull();
    expect(DL.publishedCommit({ status: 'ahead', base_commit: { sha: full + '/../x' } })).toBeNull();
  });

  test('isLocalRepo only matches localhost itself', () => {
    expect(DL.isLocalRepo('http://localhost:8000/api/repos/o/r')).toBe(true);
    expect(DL.isLocalRepo('http://localhost/api/repos/o/r')).toBe(true);
    expect(DL.isLocalRepo('http://localhost.evil.com/api/repos/o/r')).toBe(false);
    expect(DL.isLocalRepo('http://localhost@evil.com/x')).toBe(false);
    expect(DL.repoPathFromUrl('http://localhost.evil.com/api/repos/o/r')).toBeNull();
  });
});
