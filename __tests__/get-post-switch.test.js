/**
 * Phase 9 RELIAB-03 — chooseMethod: GET → POST length switch.
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

describe('chooseMethod (RELIAB-03)', () => {
    test('short query returns GET', () => {
        const s = createSandbox();
        const r = call(s, 'chooseMethod("http://e.org/sparql", "SELECT * WHERE {?s ?p ?o}")');
        expect(r).toBe('GET');
    });

    test('oversize query returns POST', () => {
        const s = createSandbox();
        const big = 'SELECT * WHERE {' + 'a'.repeat(5000) + '}';
        const r = call(s, 'chooseMethod("http://e.org/sparql", ' + JSON.stringify(big) + ')');
        expect(r).toBe('POST');
    });

    test('honors CONFIG.maxGetUrlBytes override', () => {
        // Default short query encodes to ~82 bytes total; override to 50 to force POST.
        const s = createSandbox({ maxGetUrlBytes: 50 });
        const r = call(s, 'chooseMethod("http://e.org/sparql", "SELECT * WHERE {?s ?p ?o}")');
        expect(r).toBe('POST');
    });

    test('falls back to 4000 when CONFIG.maxGetUrlBytes is missing', () => {
        const s = createSandbox();
        delete s.window.SNORQL_CONFIG.maxGetUrlBytes;
        const med = 'SELECT * WHERE {' + 'a'.repeat(3500) + '}';
        const r = call(s, 'chooseMethod("http://e.org/sparql", ' + JSON.stringify(med) + ')');
        expect(r).toBe('GET');
    });

    test('counts URL-encoded length (whitespace expands)', () => {
        const s = createSandbox({ maxGetUrlBytes: 200 });
        const spaceQuery = ' '.repeat(100);
        const r = call(s, 'chooseMethod("http://e.org/sparql", ' + JSON.stringify(spaceQuery) + ')');
        expect(r).toBe('POST');
    });
});
