/**
 * Tests for the client-side results table filter and column sorting in snorql.js.
 *
 * Unlike snorql.test.js (mocked document), these run snorql.js against jsdom's real
 * document, because the functions under test walk real table rows and cells.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const configCode = fs.readFileSync(path.join(__dirname, '../assets/js/config.js'), 'utf8');
const snorqlCode = fs.readFileSync(path.join(__dirname, '../assets/js/snorql.js'), 'utf8');

const AOP = 'https://identifiers.org/aop/';

let sb;

beforeEach(() => {
  const jq = jest.fn(() => ({
    html: jest.fn(), on: jest.fn(), val: jest.fn(), each: jest.fn(), length: 0,
    find: jest.fn(() => ({ on: jest.fn(), each: jest.fn(), html: jest.fn() }))
  }));
  sb = {
    window: { SNORQL_CONFIG: null },
    document: document,
    console: console,
    $: jq,
    jQuery: jq,
    alert: jest.fn(),
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Mustache: { escape: (t) => t, render: (t) => t }
  };
  vm.createContext(sb);
  vm.runInContext(configCode, sb);
  vm.runInContext(snorqlCode, sb);
});

function uri(value) { return { type: 'uri', value: value }; }
function lit(value) { return { type: 'literal', value: value }; }

// URIs render as their full text in the results table.
function sampleJson() {
  return {
    head: { vars: ['aop', 'title', 'n'] },
    results: {
      bindings: [
        { aop: uri(AOP + '12'), title: lit('Mitochondrial dysfunction'), n: lit('9') },
        { aop: uri(AOP + '3'), title: lit('Inhibition of complex I'), n: lit('100') },
        { aop: uri(AOP + '150'), title: lit('AhR activation, early life stage mortality'), n: lit('20') }
      ]
    }
  };
}

function column(table, index) {
  return Array.from(table.tBodies[0].rows).map((r) => r.cells[index].textContent.trim());
}

function visibleRows(table) {
  return Array.from(table.tBodies[0].rows).filter((r) => r.style.display !== 'none');
}

describe('compareCellValues', () => {
  test('numbers compare numerically, not as text', () => {
    expect(sb.compareCellValues('9', '100')).toBeLessThan(0);
  });

  test('ids embedded in text compare naturally (aop/3 before aop/12)', () => {
    expect(sb.compareCellValues(AOP + '3', AOP + '12')).toBeLessThan(0);
  });

  test('text comparison ignores case', () => {
    expect(sb.compareCellValues('apple', 'Apple')).toBe(0);
  });
});

describe('filterResultRows', () => {
  test('shows only rows containing the term, case-insensitively', () => {
    const table = sb.jsonToHTML(sampleJson());
    expect(sb.filterResultRows(table, 'MITOCHONDRIAL')).toBe(1);
    expect(visibleRows(table)).toHaveLength(1);
  });

  test('every word must match, in any column', () => {
    const table = sb.jsonToHTML(sampleJson());
    expect(sb.filterResultRows(table, 'ahr aop/150')).toBe(1);
    expect(sb.filterResultRows(table, 'ahr complex')).toBe(0);
  });

  test('a word does not match across a cell boundary', () => {
    const table = sb.jsonToHTML(sampleJson());
    // "aop/12" ends one cell and "Mitochondrial" starts the next
    expect(sb.filterResultRows(table, 'aop/12')).toBe(1);
    expect(sb.filterResultRows(table, 'aop/12mitochondrial')).toBe(0);
  });

  test('an empty term shows every row again', () => {
    const table = sb.jsonToHTML(sampleJson());
    sb.filterResultRows(table, 'complex');
    expect(sb.filterResultRows(table, '   ')).toBe(3);
    expect(visibleRows(table)).toHaveLength(3);
  });
});

describe('sorting', () => {
  test('sortResultTable sorts a numeric column numerically, both directions', () => {
    const table = sb.jsonToHTML(sampleJson());
    sb.sortResultTable(table, 2, false);
    expect(column(table, 2)).toEqual(['9', '20', '100']);
    sb.sortResultTable(table, 2, true);
    expect(column(table, 2)).toEqual(['100', '20', '9']);
  });

  test('clicking a header sorts ascending, a second click descending, and sets aria-sort', () => {
    const table = sb.jsonToHTML(sampleJson());
    sb.attachResultSorting(table);
    const th = table.tHead.rows[0].cells[0];
    th.click();
    expect(th.getAttribute('aria-sort')).toBe('ascending');
    expect(column(table, 0)).toEqual([AOP + '3', AOP + '12', AOP + '150']);
    th.click();
    expect(th.getAttribute('aria-sort')).toBe('descending');
    expect(column(table, 0)).toEqual([AOP + '150', AOP + '12', AOP + '3']);
  });

  test('sorting another column clears the previous aria-sort', () => {
    const table = sb.jsonToHTML(sampleJson());
    sb.attachResultSorting(table);
    const [first, second] = table.tHead.rows[0].cells;
    first.click();
    second.click();
    expect(first.hasAttribute('aria-sort')).toBe(false);
    expect(second.getAttribute('aria-sort')).toBe('ascending');
  });

  test('a filtered row stays hidden after sorting', () => {
    const table = sb.jsonToHTML(sampleJson());
    sb.filterResultRows(table, 'complex');
    sb.sortResultTable(table, 2, true);
    expect(visibleRows(table).map((r) => r.cells[1].textContent)).toEqual(['Inhibition of complex I']);
  });
});

describe('buildResultToolbar', () => {
  test('renders a labelled search input and reports the visible count', () => {
    const table = sb.jsonToHTML(sampleJson());
    const bar = sb.buildResultToolbar(table, 3);
    const input = bar.querySelector('input.results-filter');
    expect(input).not.toBeNull();
    expect(input.getAttribute('aria-label')).toBe('Filter results');
    input.value = 'complex';
    bar._update();
    expect(bar.querySelector('.results-count').textContent).toBe('Showing 1 of 3 rows');
  });

  test('the count is cleared when the filter is emptied', () => {
    const table = sb.jsonToHTML(sampleJson());
    const bar = sb.buildResultToolbar(table, 3);
    const input = bar.querySelector('input.results-filter');
    input.value = 'complex';
    bar._update();
    input.value = '';
    bar._update();
    expect(bar.querySelector('.results-count').textContent).toBe('');
  });
});
