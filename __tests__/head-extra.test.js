/**
 * script.sh: the optional htdocs/head-extra.html is inserted before </head> of
 * index.html once, and index.html is left alone when there is no such file.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function htdocs(withExtra) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snorql-htdocs-'));
  fs.mkdirSync(path.join(dir, 'assets', 'js'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(dir, 'index.html'));
  fs.copyFileSync(path.join(ROOT, 'assets', 'js', 'config.js'), path.join(dir, 'assets', 'js', 'config.js'));
  if (withExtra) {
    fs.writeFileSync(path.join(dir, 'head-extra.html'),
      '<script type="application/ld+json">{"@type": "Dataset", "name": "Test"}</script>\n');
  }
  return dir;
}

function runScript(dir) {
  // Only SNORQL_HTDOCS: the other variables stay unset, so config.js is not touched.
  execFileSync('bash', [path.join(ROOT, 'script.sh')], {
    env: { PATH: process.env.PATH, SNORQL_HTDOCS: dir },
    stdio: 'pipe',
  });
  return fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
}

describe('script.sh head-extra.html', () => {
  test('inserts the file before </head>, once', () => {
    const dir = htdocs(true);
    const html = runScript(dir);
    const at = html.indexOf('application/ld+json');
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(html.indexOf('</head>'));
    expect(html.match(/snorql:head-extra/g)).toHaveLength(1);
    // A restarted container runs script.sh again on the same files.
    const again = runScript(dir);
    expect(again).toBe(html);
    expect(fs.existsSync(path.join(dir, 'index.html.tmp'))).toBe(false);
  });

  test('leaves index.html unchanged without the file', () => {
    const dir = htdocs(false);
    const before = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    expect(runScript(dir)).toBe(before);
  });
});
