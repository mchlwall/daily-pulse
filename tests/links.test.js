// Fails if any HTML page references a local file that doesn't exist
// (script src, link href, <a href>, img src, CSS url(...)).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (e.name === 'node_modules' || e.name.startsWith('.')) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? htmlFiles(p) : p.endsWith('.html') ? [p] : [];
  });
}

const isLocal = ref =>
  ref && !/^(https?:|data:|mailto:|javascript:|#|\/\/)/i.test(ref);

test('local references in HTML files resolve to existing files', () => {
  const missing = [];
  for (const file of htmlFiles(root)) {
    // Ignore inline <script> bodies (template strings, blob URLs); keep <script src="..."> tags.
    const src = fs.readFileSync(file, 'utf8')
      .replace(/<script(?![^>]*\bsrc\s*=)[^>]*>[\s\S]*?<\/script>/gi, '');
    const refs = [
      ...[...src.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]),
      ...[...src.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map(m => m[1])
    ];
    for (const ref of refs.filter(isLocal)) {
      const target = path.resolve(path.dirname(file), ref.split('#')[0].split('?')[0]);
      if (!fs.existsSync(target)) missing.push(`${path.relative(root, file)} -> ${ref}`);
    }
  }
  assert.deepEqual(missing, [], 'Missing local files:\n' + missing.join('\n'));
});

test('no runtime CDN dependencies', () => {
  const offenders = [];
  for (const file of htmlFiles(root)) {
    const src = fs.readFileSync(file, 'utf8');
    if (/<script[^>]+src=["']https?:/i.test(src) || /import\(\s*["']https?:/i.test(src)) {
      offenders.push(path.relative(root, file));
    }
  }
  assert.deepEqual(offenders, [], 'Load third-party code from assets/vendor/ instead: ' + offenders.join(', '));
});
