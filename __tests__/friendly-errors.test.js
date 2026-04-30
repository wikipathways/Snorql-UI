/**
 * Phase 9 RELIAB-02 — onFailure friendly errors.
 *
 * Stubbing strategy (per plan-checker B-1 fix, Option A): snorql.js declares
 * setResult/display/hideQuerySpinner as top-level function declarations, so
 * post-load sandbox property re-assignment cannot rebind them. Instead we
 * stub document.getElementById to return a captured stub element. When
 * onFailure → setResult → display() calls getElementById('result') and then
 * appendChild, our stub records the children. The test inspects the
 * recursive textContent of the captured node.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const snorqlCode = fs.readFileSync(path.join(__dirname, '../assets/js/snorql.js'), 'utf8');
const configCode = fs.readFileSync(path.join(__dirname, '../assets/js/config.js'), 'utf8');

function makeStubElement(tag) {
    const el = {
        tag: tag,
        children: [],
        _text: '',
        className: '',
        id: '',
        href: '',
        style: {},
        innerHTML: '',
        appendChild(c) { this.children.push(c); return c; },
        removeChild(c) {
            const i = this.children.indexOf(c);
            if (i >= 0) this.children.splice(i, 1);
            return c;
        },
        setAttribute() {},
        addEventListener() {},
        get firstChild() { return this.children[0] || null; },
        set textContent(v) { this._text = String(v); this.children = []; },
        get textContent() {
            let t = this._text;
            for (const c of this.children) t += (c.textContent || '');
            return t;
        }
    };
    return el;
}

function makeSandbox(timeoutMs) {
    const resultContainer = makeStubElement('div');
    const sandbox = {
        window: {},
        document: {
            createElement(tag) { return makeStubElement(tag); },
            createTextNode(t) {
                const node = makeStubElement('#text');
                node._text = String(t);
                return node;
            },
            getElementById(id) {
                if (id === 'result') return resultContainer;
                return null;
            },
            getElementsByTagName: () => []
        },
        jQuery: () => {
            const $stub = {
                on: () => $stub, off: () => $stub, html: () => $stub, text: () => $stub,
                append: () => $stub, after: () => $stub, is: () => false, toggle: () => $stub,
                prop: () => $stub, val: () => $stub, find: () => $stub, each: () => $stub,
                addClass: () => $stub, removeClass: () => $stub, attr: () => $stub,
                show: () => $stub, hide: () => $stub, fadeOut: () => $stub, css: () => $stub,
                length: 0
            };
            return $stub;
        },
        console: console,
        alert() {},
        setTimeout: () => 0,
        clearTimeout: () => {},
        setInterval: () => 0,
        clearInterval: () => {}
    };
    sandbox.$ = sandbox.jQuery;
    vm.createContext(sandbox);
    vm.runInContext(configCode, sandbox);
    sandbox.window.SNORQL_CONFIG.queryTimeoutMs = timeoutMs;
    vm.runInContext(snorqlCode, sandbox);
    return { sandbox, resultContainer };
}

function callOnFailure(sandbox, report) {
    return vm.runInContext('onFailure(' + JSON.stringify(report) + ')', sandbox);
}

describe('onFailure friendly errors (RELIAB-02)', () => {
    test('status 504 → "connection to the SPARQL server timed out"', () => {
        const { sandbox, resultContainer } = makeSandbox(60000);
        callOnFailure(sandbox, { status: 504, responseText: '' });
        expect(resultContainer.textContent).toMatch(/connection to the SPARQL server timed out/);
    });

    test('status 524 (Cloudflare) → same wording as 504', () => {
        const { sandbox, resultContainer } = makeSandbox(60000);
        callOnFailure(sandbox, { status: 524, responseText: '' });
        expect(resultContainer.textContent).toMatch(/connection to the SPARQL server timed out/);
    });

    test('status 502 → "bad-gateway"', () => {
        const { sandbox, resultContainer } = makeSandbox(60000);
        callOnFailure(sandbox, { status: 502, responseText: '' });
        expect(resultContainer.textContent).toMatch(/bad-gateway/);
    });

    test('status 503 → "temporarily unavailable"', () => {
        const { sandbox, resultContainer } = makeSandbox(60000);
        callOnFailure(sandbox, { status: 503, responseText: '' });
        expect(resultContainer.textContent).toMatch(/temporarily unavailable/);
    });

    test('status 500 with timeout body → matches 500-with-body entry', () => {
        const { sandbox, resultContainer } = makeSandbox(60000);
        callOnFailure(sandbox, { status: 500, responseText: 'Transaction timed out at 60s' });
        expect(resultContainer.textContent).toMatch(/took longer than the server allows/);
    });

    test('status 500 alone (no timeout body) → does NOT match 500-with-body entry', () => {
        const { sandbox, resultContainer } = makeSandbox(60000);
        callOnFailure(sandbox, { status: 500, responseText: 'Internal Server Error' });
        expect(resultContainer.textContent).not.toMatch(/took longer than the server allows/);
    });

    test('status 0 with _timeoutFired=true and 60s timeout → "Network timeout — query exceeded 60s"', () => {
        const { sandbox, resultContainer } = makeSandbox(60000);
        callOnFailure(sandbox, { status: 0, _timeoutFired: true, responseText: '' });
        expect(resultContainer.textContent).toMatch(/Network timeout/);
        expect(resultContainer.textContent).toMatch(/60s/);
    });

    test('status 0 with _timeoutFired=true and 30s timeout → message contains "30s"', () => {
        const { sandbox, resultContainer } = makeSandbox(30000);
        callOnFailure(sandbox, { status: 0, _timeoutFired: true, responseText: '' });
        expect(resultContainer.textContent).toMatch(/30s/);
    });

    test('status 0 without _timeoutFired → "endpoint health indicator (top-right)"', () => {
        const { sandbox, resultContainer } = makeSandbox(60000);
        callOnFailure(sandbox, { status: 0, responseText: '' });
        expect(resultContainer.textContent).toMatch(/endpoint health indicator \(top-right\)/);
    });

    test('status 200 with Syntax error body → existing body-pattern entry still matches', () => {
        const { sandbox, resultContainer } = makeSandbox(60000);
        callOnFailure(sandbox, { status: 200, responseText: '<pre>Syntax error in query</pre>' });
        expect(resultContainer.textContent).toMatch(/syntax error in your query/i);
    });
});
