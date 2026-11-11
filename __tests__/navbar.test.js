/**
 * index.html: on narrow screens Bootstrap collapses #navbar (linkouts and the endpoint
 * field), so the navbar needs a toggle button that opens it again.
 */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

describe('navbar', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = html;
  });

  test('has a toggle button for the collapsed #navbar', () => {
    const toggle = document.querySelector('.navbar-header .navbar-toggle');
    expect(toggle).not.toBeNull();
    expect(toggle.getAttribute('data-toggle')).toBe('collapse');
    expect(toggle.getAttribute('data-target')).toBe('#navbar');
    expect(document.querySelector('#navbar.navbar-collapse')).not.toBeNull();
  });

  test('the bar height is set in style.css, not inline (so it can grow on phones)', () => {
    const container = document.getElementById('navbar-container');
    expect(container).not.toBeNull();
    expect(container.getAttribute('style')).toBeNull();
  });
});
