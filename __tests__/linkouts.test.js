/**
 * Tests for linkouts.js - config-driven navbar linkout buttons.
 *
 * Mirrors the vm-sandbox harness from sparql.test.js: read linkouts.js via
 * fs.readFileSync, run it in a vm context that shares jsdom's real document/URL,
 * then pull the exposed `Linkouts` namespace off the sandbox.
 *
 * testEnvironment is jsdom (jest.config.js), so document, window, and URL are real.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const linkoutsPath = path.join(__dirname, '../assets/js/linkouts.js');
const linkoutsCode = fs.readFileSync(linkoutsPath, 'utf8');

let Linkouts;

beforeEach(() => {
  // Reuse jsdom's real DOM/URL/location so anchors and new URL() behave like a browser.
  const sandbox = {
    window: { location: { href: 'http://localhost/' } },
    document: document,
    URL: URL,
    console: console
  };
  // Mirror window.location onto the global location the way the browser exposes it.
  sandbox.window.location = window.location;

  vm.createContext(sandbox);
  vm.runInContext(linkoutsCode, sandbox);
  Linkouts = sandbox.Linkouts;
});

describe('Linkouts namespace', () => {
  test('exposes the four helpers', () => {
    expect(Linkouts).toBeDefined();
    expect(typeof Linkouts.sanitizeLinkoutUrl).toBe('function');
    expect(typeof Linkouts.escapeLinkoutText).toBe('function');
    expect(typeof Linkouts.buildLinkoutNode).toBe('function');
    expect(typeof Linkouts.renderLinkouts).toBe('function');
  });
});

describe('scheme', () => {
  test('rejects javascript: scheme', () => {
    expect(Linkouts.sanitizeLinkoutUrl('javascript:alert(1)')).toBeNull();
  });

  test('rejects obfuscated/whitespace JAVASCRIPT: scheme', () => {
    expect(Linkouts.sanitizeLinkoutUrl('  JAVASCRIPT:alert(1)')).toBeNull();
  });

  test('rejects data: scheme', () => {
    expect(Linkouts.sanitizeLinkoutUrl('data:text/html,<script>')).toBeNull();
  });

  test('rejects empty / non-string input', () => {
    expect(Linkouts.sanitizeLinkoutUrl('')).toBeNull();
    expect(Linkouts.sanitizeLinkoutUrl('   ')).toBeNull();
    expect(Linkouts.sanitizeLinkoutUrl(null)).toBeNull();
    expect(Linkouts.sanitizeLinkoutUrl(undefined)).toBeNull();
    expect(Linkouts.sanitizeLinkoutUrl(42)).toBeNull();
  });

  test('accepts http, https and mailto schemes', () => {
    expect(Linkouts.sanitizeLinkoutUrl('http://example.org')).not.toBeNull();
    expect(Linkouts.sanitizeLinkoutUrl('https://example.org')).not.toBeNull();
    expect(Linkouts.sanitizeLinkoutUrl('mailto:a@b.com')).not.toBeNull();
  });
});

describe('escape', () => {
  test('label with HTML renders as plain text with no child element', () => {
    var node = Linkouts.buildLinkoutNode({
      label: '<img src=x onerror=alert(1)>',
      url: 'https://example.org'
    });
    expect(node).not.toBeNull();
    var anchor = node.querySelector('a');
    expect(anchor).not.toBeNull();
    // No injected element (e.g. <img>) — the markup must be inert text.
    expect(anchor.querySelector('img')).toBeNull();
    expect(anchor.getElementsByTagName('*').length).toBe(0);
    expect(anchor.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  test('escapeLinkoutText neutralises angle brackets', () => {
    var escaped = Linkouts.escapeLinkoutText('<b>x</b>');
    expect(escaped).not.toContain('<b>');
    expect(escaped).toContain('&lt;');
  });
});

describe('empty', () => {
  test('undefined linkouts does not throw and appends nothing', () => {
    var mount = document.createElement('ul');
    expect(() => Linkouts.renderLinkouts({}, mount)).not.toThrow();
    expect(mount.children.length).toBe(0);
  });

  test('empty array does not throw and appends nothing', () => {
    var mount = document.createElement('ul');
    expect(() => Linkouts.renderLinkouts({ linkouts: [] }, mount)).not.toThrow();
    expect(mount.children.length).toBe(0);
  });

  test('null mount element does not throw', () => {
    expect(() => Linkouts.renderLinkouts({ linkouts: [{ label: 'x', url: 'https://e.org' }] }, null)).not.toThrow();
  });

  test('null config does not throw', () => {
    var mount = document.createElement('ul');
    expect(() => Linkouts.renderLinkouts(null, mount)).not.toThrow();
    expect(mount.children.length).toBe(0);
  });
});

describe('order', () => {
  test('three valid entries render as three <li> in config order', () => {
    var mount = document.createElement('ul');
    Linkouts.renderLinkouts({
      linkouts: [
        { label: 'First', url: 'https://a.org' },
        { label: 'Second', url: 'https://b.org' },
        { label: 'Third', url: 'https://c.org' }
      ]
    }, mount);
    expect(mount.children.length).toBe(3);
    expect(mount.children[0].textContent).toContain('First');
    expect(mount.children[1].textContent).toContain('Second');
    expect(mount.children[2].textContent).toContain('Third');
  });

  test('entries with rejected URLs are skipped', () => {
    var mount = document.createElement('ul');
    Linkouts.renderLinkouts({
      linkouts: [
        { label: 'Good', url: 'https://a.org' },
        { label: 'Bad', url: 'javascript:alert(1)' }
      ]
    }, mount);
    expect(mount.children.length).toBe(1);
    expect(mount.children[0].textContent).toContain('Good');
  });
});

describe('attributes', () => {
  test('anchor has target, rel and accessible name', () => {
    var node = Linkouts.buildLinkoutNode({
      label: 'Tutorial',
      url: 'https://example.org/tutorial'
    });
    var anchor = node.querySelector('a');
    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
    // Accessible name from label when no authors given.
    var accName = anchor.getAttribute('aria-label') || anchor.getAttribute('title');
    expect(accName).toBe('Tutorial');
  });

  test('authors override the accessible name', () => {
    var node = Linkouts.buildLinkoutNode({
      label: 'Tutorial',
      url: 'https://example.org/tutorial',
      authors: 'Jane Doe'
    });
    var anchor = node.querySelector('a');
    var accName = anchor.getAttribute('aria-label') || anchor.getAttribute('title');
    expect(accName).toBe('Jane Doe');
  });

  test('valid glyphicon suffix renders an icon span; invalid suffix is dropped', () => {
    var good = Linkouts.buildLinkoutNode({
      label: 'Doc', url: 'https://example.org', icon: 'book'
    });
    expect(good.querySelector('span.glyphicon.glyphicon-book')).not.toBeNull();

    var bad = Linkouts.buildLinkoutNode({
      label: 'Doc', url: 'https://example.org', icon: 'book"><script>'
    });
    // No span injected for a disallowed icon suffix.
    expect(bad.querySelector('span.glyphicon')).toBeNull();
  });
});

describe('render', () => {
  test('a valid {label,url} entry produces one <li><a> button', () => {
    var node = Linkouts.buildLinkoutNode({ label: 'Home', url: 'https://example.org' });
    expect(node).not.toBeNull();
    expect(node.tagName).toBe('LI');
    var anchor = node.querySelector('a');
    expect(anchor).not.toBeNull();
    expect(anchor.getAttribute('href')).toContain('example.org');
    expect(anchor.textContent).toBe('Home');
  });

  test('an entry with a rejected URL yields null', () => {
    var node = Linkouts.buildLinkoutNode({ label: 'Bad', url: 'javascript:alert(1)' });
    expect(node).toBeNull();
  });

  test('anchor carries the snorql-linkout hook class', () => {
    var node = Linkouts.buildLinkoutNode({ label: 'Home', url: 'https://example.org' });
    var anchor = node.querySelector('a');
    expect(anchor.classList.contains('snorql-linkout')).toBe(true);
  });
});

describe('styling', () => {
  test('renderLinkouts injects the stylesheet once', () => {
    var existing = document.getElementById('snorql-linkout-styles');
    if (existing) existing.remove();
    var mount = document.createElement('ul');
    Linkouts.renderLinkouts({ linkouts: [{ label: 'X', url: 'https://e.org' }] }, mount);
    expect(document.querySelectorAll('#snorql-linkout-styles').length).toBe(1);
    // A second render must not duplicate the style element.
    Linkouts.renderLinkouts({ linkouts: [{ label: 'Y', url: 'https://e.org' }] }, mount);
    expect(document.querySelectorAll('#snorql-linkout-styles').length).toBe(1);
  });

  test('empty config injects no stylesheet', () => {
    var existing = document.getElementById('snorql-linkout-styles');
    if (existing) existing.remove();
    var mount = document.createElement('ul');
    Linkouts.renderLinkouts({ linkouts: [] }, mount);
    expect(document.getElementById('snorql-linkout-styles')).toBeNull();
  });
});
