/**
 * Phase 9 RELIAB-01 — PREFIX prepend behavior in prepareQueryForSend.
 * Loaded via vm.runInContext following the existing __tests__/snorql.test.js pattern.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const snorqlCode = fs.readFileSync(path.join(__dirname, '../assets/js/snorql.js'), 'utf8');
const configCode = fs.readFileSync(path.join(__dirname, '../assets/js/config.js'), 'utf8');

function createSandbox(overrides) {
    const sandbox = {
        window: {},
        document: {
            createElement: () => ({ appendChild: () => {}, setAttribute: () => {}, addEventListener: () => {} }),
            createTextNode: (t) => ({ _text: String(t) }),
            getElementById: () => null,
            getElementsByTagName: () => []
        },
        jQuery: () => ({ on: () => {}, off: () => {}, html: () => {}, text: () => {}, append: () => {}, after: () => {}, length: 0 }),
        console: console,
        setTimeout: () => 0,
        clearTimeout: () => {},
        setInterval: () => 0,
        clearInterval: () => {}
    };
    sandbox.$ = sandbox.jQuery;
    vm.createContext(sandbox);
    vm.runInContext(configCode, sandbox);
    if (overrides) Object.assign(sandbox.window.SNORQL_CONFIG, overrides);
    vm.runInContext(snorqlCode, sandbox);
    return sandbox;
}

function call(sandbox, expr) {
    return vm.runInContext(expr, sandbox);
}

describe('PREFIX prepend (RELIAB-01)', () => {
    test('auto mode prepends used cur: prefix', () => {
        const s = createSandbox();
        const out = call(s, 'prepareQueryForSend(' + JSON.stringify('SELECT * WHERE { ?s cur:type ?o }') + ')');
        expect(out).toMatch(/^PREFIX cur: </);
    });

    test('auto mode does NOT prepend if user already declared inline', () => {
        const s = createSandbox();
        const inp = 'PREFIX cur: <http://example.org/c#>\nSELECT * WHERE { ?s cur:type ?o }';
        const out = call(s, 'prepareQueryForSend(' + JSON.stringify(inp) + ')');
        const matches = out.match(/PREFIX cur:/g) || [];
        expect(matches.length).toBe(1);
    });

    test('string-literal exclusion: cur: inside "..." does not trigger prepend', () => {
        const s = createSandbox();
        const inp = 'SELECT * WHERE { ?x ?p "cur:label" }';
        const out = call(s, 'prepareQueryForSend(' + JSON.stringify(inp) + ')');
        expect(out).not.toMatch(/^PREFIX cur:/);
        expect(out).toBe(inp);
    });

    test('sendPrefixBlock: false returns input unchanged', () => {
        const s = createSandbox({ sendPrefixBlock: false });
        const inp = 'SELECT * WHERE { ?s cur:type ?o }';
        expect(call(s, 'prepareQueryForSend(' + JSON.stringify(inp) + ')')).toBe(inp);
    });

    test('sendPrefixBlock: true prepends every undeclared CONFIG.namespaces entry', () => {
        const s = createSandbox({ sendPrefixBlock: true });
        const out = call(s, 'prepareQueryForSend(' + JSON.stringify('SELECT * WHERE { ?s ?p ?o }') + ')');
        const namespaceKeys = Object.keys(s.window.SNORQL_CONFIG.namespaces);
        namespaceKeys.forEach(k => {
            expect(out).toMatch(new RegExp('PREFIX ' + k + ': <'));
        });
    });

    test('empty query yields empty preamble in auto mode', () => {
        const s = createSandbox();
        expect(call(s, 'prepareQueryForSend("")')).toBe('');
    });

    test('getInlineDeclaredPrefixes detects multiple inline declarations', () => {
        const s = createSandbox();
        const declared = call(s, 'getInlineDeclaredPrefixes(' + JSON.stringify('PREFIX rdf: <a>\nPREFIX rdfs: <b>\nSELECT *') + ')');
        expect(declared.rdf).toBe(true);
        expect(declared.rdfs).toBe(true);
    });

    test('stripSparqlStringLiterals removes content inside double quotes', () => {
        const s = createSandbox();
        const inp = 'SELECT * WHERE {?s ?p "x:y"}';
        const stripped = call(s, 'stripSparqlStringLiterals(' + JSON.stringify(inp) + ')');
        expect(stripped).not.toMatch(/x:y/);
        expect(stripped.length).toBe(inp.length);
    });

    test('inline-PREFIX detection regex shape contains PREFIX, (\\w+), and /gim', () => {
        expect(snorqlCode).toContain('PREFIX');
        expect(snorqlCode).toMatch(/\(\\w\+\)/);
        expect(snorqlCode).toMatch(/\/gim/);
    });
});
