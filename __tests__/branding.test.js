/**
 * Tests for branding.js - config-driven logo, favicon, endpoint label, meta tags
 * and footer. Same vm-sandbox harness as linkouts.test.js, sharing jsdom's DOM.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const brandingCode = fs.readFileSync(path.join(__dirname, '../assets/js/branding.js'), 'utf8');

const PAGE = `
  <a class="navbar-brand" id="index-page" href=""><img src="assets/images/default-logo.png" width="200" height="50" /></a>
  <span class="input-group-addon" id="endpoint-label">Load a SPARQL Endpoint:</span>
  <footer id="footer"><div class="container-fluid"><p>Default footer <a id="poweredby" href="#">Snorql</a></p></div></footer>
`;

let Branding;

beforeEach(() => {
  document.head.innerHTML =
    '<meta name="description" content="default description">' +
    '<link rel="icon" href="assets/images/favicon.ico">';
  document.body.innerHTML = PAGE;
  const sandbox = { window: { location: window.location }, document: document, URL: URL, console: console };
  vm.createContext(sandbox);
  vm.runInContext(brandingCode, sandbox);
  Branding = sandbox.Branding;
});

describe('applyBranding: defaults', () => {
  test('an empty config leaves the page unchanged', () => {
    const before = document.documentElement.innerHTML;
    Branding.applyBranding({});
    expect(document.documentElement.innerHTML).toBe(before);
  });
});

describe('applyBranding: logo, favicon, label, meta', () => {
  test('logo src, alt and height are applied; width is dropped when not given', () => {
    Branding.applyBranding({ logo: { src: 'assets/images/aop.png', alt: 'AOP-Wiki RDF', height: 55 } });
    const img = document.querySelector('#index-page img');
    expect(img.getAttribute('src')).toBe('http://localhost/assets/images/aop.png');
    expect(img.getAttribute('alt')).toBe('AOP-Wiki RDF');
    expect(img.getAttribute('height')).toBe('55');
    expect(img.hasAttribute('width')).toBe(false);
  });

  test('a javascript: or data: logo is ignored', () => {
    Branding.applyBranding({ logo: { src: 'javascript:alert(1)' } });
    expect(document.querySelector('#index-page img').getAttribute('src')).toBe('assets/images/default-logo.png');
    Branding.applyBranding({ logo: { src: 'data:image/svg+xml,<svg onload=alert(1)>' } });
    expect(document.querySelector('#index-page img').getAttribute('src')).toBe('assets/images/default-logo.png');
  });

  test('favicon, endpoint label and meta tags', () => {
    Branding.applyBranding({
      favicon: 'assets/images/icon.png',
      endpointLabel: 'SPARQL <b>Endpoint</b>',
      metaDescription: 'Explore AOP-Wiki RDF',
      metaAuthor: 'Someone'
    });
    expect(document.querySelector('link[rel="icon"]').getAttribute('href')).toBe('http://localhost/assets/images/icon.png');
    const label = document.getElementById('endpoint-label');
    expect(label.textContent).toBe('SPARQL <b>Endpoint</b>');
    expect(label.querySelector('b')).toBeNull();
    expect(document.querySelector('meta[name="description"]').getAttribute('content')).toBe('Explore AOP-Wiki RDF');
    expect(document.querySelector('meta[name="author"]').getAttribute('content')).toBe('Someone');
  });
});

describe('footer', () => {
  test('renders text, links and a linked image in order', () => {
    Branding.applyBranding({
      footer: [
        { label: 'AOP-Wiki', url: 'https://aopwiki.org' }, ' | ',
        { label: 'UI: GPL-3.0', url: 'https://www.gnu.org/licenses/gpl-3.0.html', title: 'UI licence' },
        ' ', { image: 'assets/images/tgx.png', url: 'https://example.org/tgx', alt: 'TGX', height: 25 }
      ]
    });
    const p = document.querySelector('#footer .container-fluid p');
    expect(p.textContent).toBe('AOP-Wiki | UI: GPL-3.0 ');
    const links = p.querySelectorAll('a');
    expect(links.length).toBe(3);
    expect(links[0].getAttribute('href')).toBe('https://aopwiki.org/');
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
    expect(links[1].getAttribute('title')).toBe('UI licence');
    const img = links[2].querySelector('img');
    expect(img.getAttribute('alt')).toBe('TGX');
    expect(img.getAttribute('height')).toBe('25');
    expect(document.getElementById('poweredby')).toBeNull();
  });

  test('labels are text, never HTML', () => {
    Branding.applyBranding({ footer: ['<img src=x onerror=alert(1)>', { label: '<script>x</script>', url: 'https://a.org' }] });
    const p = document.querySelector('#footer p');
    expect(p.querySelector('img')).toBeNull();
    expect(p.querySelector('script')).toBeNull();
    expect(p.textContent).toContain('<script>x</script>');
  });

  test('a link with a bad scheme keeps its text but drops the link', () => {
    Branding.applyBranding({ footer: [{ label: 'Click', url: 'javascript:alert(1)' }] });
    const p = document.querySelector('#footer p');
    expect(p.querySelector('a')).toBeNull();
    expect(p.textContent).toBe('Click');
  });

  test('an image with a bad src is skipped; junk items are ignored', () => {
    Branding.applyBranding({ footer: [{ image: 'javascript:x', alt: 'bad' }, null, 42, { nothing: true }, 'end'] });
    const p = document.querySelector('#footer p');
    expect(p.querySelector('img')).toBeNull();
    expect(p.textContent).toBe('42end');
  });
});
