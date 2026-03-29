/**
 * Tests for snorql.js - enum value=label parsing, sanitization, panel rendering, escapeHtml
 * Gaps 1-4: TMPL-05, TMPL-01 through TMPL-04 infrastructure
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const snorqlCode = fs.readFileSync(
  path.join(__dirname, '../assets/js/snorql.js'),
  'utf8'
);

let sandbox;

function createSandbox() {
  // Minimal DOM stubs required by snorql.js
  const domElements = {};

  const mockElement = (tagName) => ({
    tagName,
    appendChild: function(child) {
      this._child = child;
      // For createTextNode + innerHTML pattern used by escapeHtml
      if (child && child._text !== undefined) {
        // Simulate browser HTML escaping via text node
        this.innerHTML = child._text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }
      return child;
    },
    innerHTML: '',
    html: jest.fn(),
    value: '',
    id: ''
  });

  const sb = {
    window: {},
    document: {
      createElement: jest.fn((tag) => mockElement(tag)),
      createTextNode: jest.fn((text) => ({ _text: text })),
      getElementById: jest.fn((id) => domElements[id] || null),
      _elements: domElements
    },
    $: jest.fn((selector) => ({
      html: jest.fn(),
      on: jest.fn(),
      val: jest.fn(),
      find: jest.fn(() => ({ on: jest.fn(), each: jest.fn(), html: jest.fn() })),
      each: jest.fn(),
      length: 0
    })),
    jQuery: jest.fn(),
    console: console,
    alert: jest.fn(),
    setTimeout: jest.fn(),
    clearTimeout: jest.fn(),
    setInterval: jest.fn(),
    clearInterval: jest.fn(),
    XMLHttpRequest: jest.fn(() => ({
      open: jest.fn(),
      send: jest.fn(),
      setRequestHeader: jest.fn()
    })),
    performance: { now: jest.fn(() => Date.now()) },
    window: { SNORQL_CONFIG: null },
    // Mustache stub — minimal render that passes values through
    Mustache: {
      escape: function(text) { return text; },
      render: function(template, view) {
        return template.replace(/\{\{(\w+)\}\}/g, function(_, key) {
          return view[key] !== undefined ? view[key] : '';
        });
      }
    },
    // CodeMirror editor stub
    editor: {
      getDoc: jest.fn(() => ({ setValue: jest.fn() }))
    },
    // _paramIgnoreChange is used in buildParamPanel
    _paramIgnoreChange: false
  };

  // Load config.js first so SNORQL_CONFIG is defined, then snorql.js
  const configCode = fs.readFileSync(
    path.join(__dirname, '../assets/js/config.js'),
    'utf8'
  );

  vm.createContext(sb);
  vm.runInContext(configCode, sb);
  vm.runInContext(snorqlCode, sb);

  return sb;
}

beforeEach(() => {
  sandbox = createSandbox();
});

// ─── Gap 1: parseRqHeaders produces {value,label} objects from value=label syntax ───

describe('parseRqHeaders: enum value=label parsing (eqIdx)', () => {
  test('plain enum options without = produce identical value and label', () => {
    const content = '# param: entityType|enum:Foo,Bar,Baz|Foo|Entity Type\n\nSELECT * WHERE {}';
    const result = vm.runInContext('parseRqHeaders(' + JSON.stringify(content) + ')', sandbox);
    const opts = result.params[0].options;

    expect(opts).toHaveLength(3);
    expect(opts[0]).toEqual({ value: 'Foo', label: 'Foo' });
    expect(opts[1]).toEqual({ value: 'Bar', label: 'Bar' });
    expect(opts[2]).toEqual({ value: 'Baz', label: 'Baz' });
  });

  test('enum value=label syntax splits on = to produce distinct value and label', () => {
    const content = '# param: entityType|enum:DataNode=Data Nodes,GeneProduct=Gene Products|DataNode|Entity Type\n\nSELECT * WHERE {}';
    const result = vm.runInContext('parseRqHeaders(' + JSON.stringify(content) + ')', sandbox);
    const opts = result.params[0].options;

    expect(opts).toHaveLength(2);
    expect(opts[0]).toEqual({ value: 'DataNode', label: 'Data Nodes' });
    expect(opts[1]).toEqual({ value: 'GeneProduct', label: 'Gene Products' });
  });

  test('mixed enum: options with and without = coexist correctly', () => {
    const content = '# param: x|enum:Simple,Key=Human Label|Simple|X\n\nSELECT * WHERE {}';
    const result = vm.runInContext('parseRqHeaders(' + JSON.stringify(content) + ')', sandbox);
    const opts = result.params[0].options;

    expect(opts[0]).toEqual({ value: 'Simple', label: 'Simple' });
    expect(opts[1]).toEqual({ value: 'Key', label: 'Human Label' });
  });

  test('TMPL-01 countOfEntityType.rq param header parses all 5 entity type options', () => {
    const header = '# param: entityType|enum:DataNode=Data Nodes,GeneProduct=Gene Products,Interaction=Interactions,Metabolite=Metabolites,Protein=Proteins|DataNode|Entity Type';
    const content = header + '\n\nSELECT * WHERE {}';
    const result = vm.runInContext('parseRqHeaders(' + JSON.stringify(content) + ')', sandbox);
    const opts = result.params[0].options;

    expect(opts).toHaveLength(5);
    expect(opts.map(o => o.value)).toEqual(['DataNode', 'GeneProduct', 'Interaction', 'Metabolite', 'Protein']);
    expect(opts.map(o => o.label)).toEqual(['Data Nodes', 'Gene Products', 'Interactions', 'Metabolites', 'Proteins']);
    expect(result.params[0].defaultValue).toBe('DataNode');
  });

  test('TMPL-03 pathwaysForDatasource.rq param header parses all 6 datasource options', () => {
    const header = '# param: datasource|enum:Chemspider=ChemSpider,Ensembl=Ensembl,HgncSymbol=HGNC,Hmdb=HMDB,EntrezGene=NCBI Gene,PubChem=PubChem|Ensembl|Data Source';
    const content = header + '\n\nSELECT * WHERE {}';
    const result = vm.runInContext('parseRqHeaders(' + JSON.stringify(content) + ')', sandbox);
    const opts = result.params[0].options;

    expect(opts).toHaveLength(6);
    expect(opts[0]).toEqual({ value: 'Chemspider', label: 'ChemSpider' });
    expect(opts[2]).toEqual({ value: 'HgncSymbol', label: 'HGNC' });
    expect(opts[4]).toEqual({ value: 'EntrezGene', label: 'NCBI Gene' });
    expect(result.params[0].defaultValue).toBe('Ensembl');
  });
});

// ─── Gap 2: sanitizeEnumValue checks .value property on option objects ───

describe('sanitizeEnumValue: object-aware validation', () => {
  test('returns value when it matches an option .value property', () => {
    const allowedOptions = [
      { value: 'GeneProduct', label: 'Gene Products' },
      { value: 'Metabolite', label: 'Metabolites' }
    ];
    const result = vm.runInContext(
      'sanitizeEnumValue("GeneProduct", ' + JSON.stringify(allowedOptions) + ')',
      sandbox
    );
    expect(result).toBe('GeneProduct');
  });

  test('returns null when value does not match any option .value', () => {
    const allowedOptions = [
      { value: 'GeneProduct', label: 'Gene Products' },
      { value: 'Metabolite', label: 'Metabolites' }
    ];
    const result = vm.runInContext(
      'sanitizeEnumValue("InvalidType", ' + JSON.stringify(allowedOptions) + ')',
      sandbox
    );
    expect(result).toBeNull();
  });

  test('returns null for label text that does not match .value', () => {
    const allowedOptions = [
      { value: 'GeneProduct', label: 'Gene Products' }
    ];
    // "Gene Products" is the label, not the value — should NOT be allowed
    const result = vm.runInContext(
      'sanitizeEnumValue("Gene Products", ' + JSON.stringify(allowedOptions) + ')',
      sandbox
    );
    expect(result).toBeNull();
  });

  test('returns null when allowedOptions is null', () => {
    const result = vm.runInContext(
      'sanitizeEnumValue("anything", null)',
      sandbox
    );
    expect(result).toBeNull();
  });

  test('returns null when allowedOptions is undefined', () => {
    const result = vm.runInContext(
      'sanitizeEnumValue("anything", undefined)',
      sandbox
    );
    expect(result).toBeNull();
  });
});

// ─── Gap 3: buildParamPanel renders opt.value in value attr and opt.label in display text ───

describe('buildParamPanel: enum HTML rendering with {value, label} objects', () => {
  test('enum options render with value attribute from .value and display text from .label', () => {
    // We test the HTML string generation via the DOM mock
    // Strategy: intercept the $panel.html() call to capture the generated HTML
    let capturedHtml = null;
    sandbox.$= jest.fn((selector) => {
      if (selector === '#desc-params') {
        return { html: jest.fn((h) => { capturedHtml = h; }) };
      }
      return { html: jest.fn(), on: jest.fn(), find: jest.fn(() => ({ on: jest.fn(), each: jest.fn() })) };
    });

    const params = JSON.stringify([{
      name: 'entityType',
      type: 'enum',
      autocompleteType: null,
      defaultValue: 'DataNode',
      label: 'Entity Type',
      options: [
        { value: 'DataNode', label: 'Data Nodes' },
        { value: 'GeneProduct', label: 'Gene Products' }
      ]
    }]);

    vm.runInContext('buildParamPanel(' + params + ', "")', sandbox);

    expect(capturedHtml).not.toBeNull();
    // value attribute should contain the RDF class name (ontology value)
    expect(capturedHtml).toContain('value="DataNode"');
    expect(capturedHtml).toContain('value="GeneProduct"');
    // Display text should contain human-friendly label
    expect(capturedHtml).toContain('Data Nodes');
    expect(capturedHtml).toContain('Gene Products');
    // The default should be marked as selected
    expect(capturedHtml).toContain('value="DataNode" selected');
  });

  test('enum option with XSS payload in label is escaped in display text', () => {
    let capturedHtml = null;
    sandbox.$ = jest.fn((selector) => {
      if (selector === '#desc-params') {
        return { html: jest.fn((h) => { capturedHtml = h; }) };
      }
      return { html: jest.fn(), on: jest.fn(), find: jest.fn(() => ({ on: jest.fn(), each: jest.fn() })) };
    });

    const params = JSON.stringify([{
      name: 'testParam',
      type: 'enum',
      autocompleteType: null,
      defaultValue: 'safe',
      label: 'Test',
      options: [
        { value: 'safe', label: '<script>alert(1)</script>' }
      ]
    }]);

    vm.runInContext('buildParamPanel(' + params + ', "")', sandbox);

    expect(capturedHtml).not.toBeNull();
    // Raw script tag must NOT appear in output
    expect(capturedHtml).not.toContain('<script>');
    // Escaped form should be present
    expect(capturedHtml).toContain('&lt;script&gt;');
  });
});

// ─── Gap 4: escapeHtml XSS prevention ───

describe('escapeHtml: XSS prevention helper', () => {
  test('escapes < and > characters', () => {
    const result = vm.runInContext('escapeHtml("<b>bold</b>")', sandbox);
    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
    expect(result).not.toContain('<b>');
  });

  test('escapes & ampersand', () => {
    const result = vm.runInContext('escapeHtml("A & B")', sandbox);
    expect(result).toContain('&amp;');
    expect(result).not.toBe('A & B');
  });

  test('escapes double quotes', () => {
    const result = vm.runInContext('escapeHtml(\'say "hello"\')', sandbox);
    expect(result).toContain('&quot;');
  });

  test('plain text with no special characters is returned unchanged', () => {
    const result = vm.runInContext('escapeHtml("Gene Products")', sandbox);
    expect(result).toBe('Gene Products');
  });

  test('script injection is neutralized', () => {
    const result = vm.runInContext('escapeHtml("<script>alert(1)</script>")', sandbox);
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });
});
