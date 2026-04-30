/**
 * Phase 9 CC-A backward-compat regression — v1.1 templates.
 *
 * Asserts that prepareQueryForSend, when applied to each of the 6 v1.1
 * parameterized templates (real .rq fixtures from wikipathways/SPARQLQueries),
 * preserves the body verbatim and prepends every used+undeclared
 * CONFIG.namespaces prefix. Fixtures are committed to the repo
 * (__tests__/fixtures/v1.1-templates/) — no live network at test time.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'v1.1-templates');

const TEMPLATE_NAMES = [
    'datacounts',
    'average-count',
    'datasource-count',
    'entity-per-species',
    'community-stats',
    'X-of-pathway'
];

const snorqlCode = fs.readFileSync(path.join(__dirname, '../assets/js/snorql.js'), 'utf8');
const configCode = fs.readFileSync(path.join(__dirname, '../assets/js/config.js'), 'utf8');

function createSandbox() {
    const sandbox = {
        window: {},
        document: { createElement: () => ({ appendChild: () => {} }), getElementById: () => null, getElementsByTagName: () => [] },
        jQuery: () => ({ on: () => {}, length: 0 }),
        console: console,
        setTimeout: () => 0,
        clearTimeout: () => {},
        setInterval: () => 0,
        clearInterval: () => {}
    };
    sandbox.$ = sandbox.jQuery;
    vm.createContext(sandbox);
    vm.runInContext(configCode, sandbox);
    vm.runInContext(snorqlCode, sandbox);
    return sandbox;
}

function call(sandbox, expr) {
    return vm.runInContext(expr, sandbox);
}

function loadTemplate(name) {
    const p = path.join(FIXTURES_DIR, name + '.rq');
    if (!fs.existsSync(p)) {
        throw new Error('Fixture missing: ' + p + ' — fetch from wikipathways/SPARQLQueries.');
    }
    return fs.readFileSync(p, 'utf8');
}

describe('v1.1 templates regression (CC-A backward-compat — real .rq fixtures)', () => {
    test.each(TEMPLATE_NAMES)('template "%s" — fixture exists and is non-empty SPARQL', (name) => {
        const body = loadTemplate(name);
        expect(body.length).toBeGreaterThan(0);
        expect(body).toMatch(/SELECT|ASK|CONSTRUCT|DESCRIBE/i);
    });

    test.each(TEMPLATE_NAMES)('template "%s" — prepareQueryForSend preserves body verbatim', (name) => {
        const s = createSandbox();
        const body = loadTemplate(name);
        const out = call(s, 'prepareQueryForSend(' + JSON.stringify(body) + ')');
        expect(out.endsWith(body)).toBe(true);
    });

    test.each(TEMPLATE_NAMES)('template "%s" — auto mode prepends every used+undeclared CONFIG.namespaces prefix', (name) => {
        const s = createSandbox();
        const body = loadTemplate(name);
        const out = call(s, 'prepareQueryForSend(' + JSON.stringify(body) + ')');
        const declared = call(s, 'getInlineDeclaredPrefixes(' + JSON.stringify(body) + ')');
        const used = call(s, 'getUsedPrefixes(' + JSON.stringify(body) + ')');
        const ns = s.window.SNORQL_CONFIG.namespaces;
        Object.keys(used).forEach(p => {
            if (ns[p] && !declared[p]) {
                expect(out).toMatch(new RegExp('PREFIX ' + p + ': <'));
            }
        });
    });

    test('all 6 templates exist as fixtures', () => {
        TEMPLATE_NAMES.forEach(name => {
            const p = path.join(FIXTURES_DIR, name + '.rq');
            expect(fs.existsSync(p)).toBe(true);
        });
    });
});
