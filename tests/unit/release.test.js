// Release checklist rules that a machine can check (CLAUDE.md "Release checklist"). Run: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const sw = read('sw.js');
const FILES = JSON.parse(sw.match(/const FILES = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));

function walk(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((d) => {
    const p = dir + '/' + d.name;
    return d.isDirectory() ? walk(p) : [p];
  });
}

test('the service worker cache name matches VERSION', () => {
  const version = read('js/main.js').match(/const VERSION = '([\d.]+)'/)[1];
  assert.match(sw, new RegExp(`const CACHE = 'plushtitans-v${version.replace(/\./g, '\\.')}'`));
  assert.match(read('index.html'), new RegExp(`apple-touch-icon\\.png\\?v=${version.replace(/\./g, '\\.')}`), 'icon cache buster follows VERSION');
});

test('every game file is in the service worker list (or it will not work offline)', () => {
  const game = ['js', 'assets', 'vendor'].flatMap(walk).filter((f) => !/README\.md$/.test(f));
  const missing = game.filter((f) => !FILES.includes(f));
  assert.deepEqual(missing, [], 'add these to FILES in sw.js');
  const gone = FILES.filter((f) => f !== './' && !fs.existsSync(path.join(ROOT, f)));
  assert.deepEqual(gone, [], 'these are in FILES but do not exist');
});

test('every script index.html loads exists and is cached', () => {
  const scripts = [...read('index.html').matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(scripts.length > 3);
  for (const s of scripts) {
    assert.ok(fs.existsSync(path.join(ROOT, s)), s);
    assert.ok(FILES.includes(s), s + ' not in sw.js FILES');
  }
  assert.equal(scripts[scripts.length - 1], 'js/main.js', 'main.js loads last');
});
