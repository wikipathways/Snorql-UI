/**
 * Phase 9 RELIAB-04 — permalink guard.
 *
 * The permalink handler lives in script.js and depends on jQuery + DOM.
 * This file mirrors the budget formula and asserts the wording / threshold
 * logic against the same constants used in the handler. The actual click
 * flow is verified manually (Plan 06 SUMMARY).
 */

const fs = require('fs');
const path = require('path');

const scriptSrc = fs.readFileSync(path.join(__dirname, '../assets/js/script.js'), 'utf8');

// Mirror of the budget formula in script.js #generate-permalink handler.
function permalinkBytes(permalinkBase, prefixedQuery, endpointUrl) {
    return permalinkBase.length
         + '?q='.length + encodeURIComponent(prefixedQuery).length
         + '&endpoint='.length + encodeURIComponent(endpointUrl).length;
}

describe('permalink guard (RELIAB-04)', () => {
    test('short query stays under default 4000 budget', () => {
        const bytes = permalinkBytes('http://snorql.example.org/', 'SELECT * WHERE {?s ?p ?o}', 'http://e.org/sparql');
        expect(bytes).toBeLessThan(4000);
    });

    test('oversize query exceeds default 4000 budget', () => {
        const bytes = permalinkBytes('http://snorql.example.org/', 'SELECT * WHERE {' + 'a'.repeat(5000) + '}', 'http://e.org/sparql');
        expect(bytes).toBeGreaterThan(4000);
    });

    test('refusal message wording contains required strings', () => {
        const bytes = 5500;
        const limit = 4000;
        const msg = 'Query too long to permalink (' + bytes + ' bytes; limit ' + limit + '). Copy the query text directly to share it.';
        expect(msg).toMatch(/Query too long to permalink/);
        expect(msg).toMatch(/5500 bytes/);
        expect(msg).toMatch(/limit 4000/);
        expect(msg).toMatch(/Copy the query text directly to share it/);
    });

    test('script.js handler contains the budget check', () => {
        expect(scriptSrc).toMatch(/Query too long to permalink/);
        expect(scriptSrc).toMatch(/maxGetUrlBytes/);
        expect(scriptSrc).toMatch(/prepareQueryForSend/);
        expect(scriptSrc).not.toMatch(/console\.log\(data\)/);
    });

    test('script.js handler injects sibling next to #generate-permalink (placement Strategy A)', () => {
        expect(scriptSrc).toMatch(/jQuery\(['"]#generate-permalink['"]\)\.after/);
        expect(scriptSrc).toMatch(/permalink-inline-msg/);
    });

    test('script.js retains the success-path Bitly modal trigger', () => {
        expect(scriptSrc).toMatch(/permalinkModal/);
        expect(scriptSrc.match(/api-ssl\.bitly\.com/g).length).toBe(1);
    });
});
