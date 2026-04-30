/**
 * Phase 9 RELIAB-05 — XHR timeout in sparql.js.
 * Source-text assertions only (no live XHR; Plan 02 patches a function shape).
 */

const fs = require('fs');
const path = require('path');

const sparqlSrc = fs.readFileSync(path.join(__dirname, '../assets/js/sparql.js'), 'utf8');

describe('xhr timeout (RELIAB-05)', () => {
    test('sparql.js _doQuery sets xhr.timeout from CONFIG.queryTimeoutMs', () => {
        expect(sparqlSrc).toMatch(/xhr\.timeout\s*=\s*_phase9TimeoutMs/);
        expect(sparqlSrc).toMatch(/window\.SNORQL_CONFIG\.queryTimeoutMs/);
    });

    test('xhr.ontimeout sets _timeoutFired and clears the poll interval', () => {
        expect(sparqlSrc).toMatch(/xhr\.ontimeout\s*=\s*function/);
        expect(sparqlSrc).toMatch(/xhr\._timeoutFired\s*=\s*true/);
        const ontimeoutMatch = sparqlSrc.match(/xhr\.ontimeout\s*=\s*function[\s\S]*?\};/);
        expect(ontimeoutMatch).not.toBeNull();
        expect(ontimeoutMatch[0]).toMatch(/clearInterval\(token\)/);
    });

    test('var token is forward-declared so xhr.ontimeout can close over it', () => {
        expect(sparqlSrc).toMatch(/var\s+token\s*;/);
    });

    test('default timeout falls back to 60000 when CONFIG missing', () => {
        expect(sparqlSrc).toMatch(/\|\|\s*60000/);
    });

    test('ontimeout body invokes the existing failure callback (callbackData.failure)', () => {
        const ontimeoutMatch = sparqlSrc.match(/xhr\.ontimeout\s*=\s*function[\s\S]*?\};/);
        expect(ontimeoutMatch[0]).toMatch(/callbackData\.failure/);
    });
});
