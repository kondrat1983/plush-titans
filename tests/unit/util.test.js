// Unit tests for js/util.js (number format, dates). Run: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('../../js/util.js');

test('fmt: small numbers are whole', () => {
  assert.equal(U.fmt(0), '0');
  assert.equal(U.fmt(7.9), '7');
  assert.equal(U.fmt(999), '999');
});

test('fmt: K, M, B, T with 3 significant digits', () => {
  assert.equal(U.fmt(1000), '1.00K');
  assert.equal(U.fmt(12400), '12.4K');
  assert.equal(U.fmt(152000), '152K');
  assert.equal(U.fmt(4.2e6), '4.20M');
  assert.equal(U.fmt(9.99e9), '9.99B');
  assert.equal(U.fmt(1.5e12), '1.50T');
});

test('fmt: past the named units it switches to letters aa, ab, ...', () => {
  assert.equal(U.fmt(1e15), '1.00aa');
  assert.equal(U.fmt(2.5e18), '2.50ab');
  assert.equal(U.fmt(1e15 * Math.pow(1000, 26)), '1.00ba');
});

test('fmt: never shows NaN, Infinity or a minus sign', () => {
  assert.equal(U.fmt(NaN), '0');
  assert.equal(U.fmt(undefined), '0');
  assert.equal(U.fmt(-5), '0');
  assert.equal(U.fmt(Infinity), '∞');
  assert.equal(U.fmt(1e308), U.fmt(1e308)); // does not throw
  assert.ok(!/NaN|undefined/.test(U.fmt(1e308)));
});

test('fmt: never longer than 6 characters for any number a child can reach', () => {
  for (let e = 0; e < 300; e += 0.37) {
    const s = U.fmt(Math.pow(10, e));
    assert.ok(s.length <= 6, `${e}: ${s}`);
  }
});

test('todayKey is the local calendar date', () => {
  assert.equal(U.todayKey(new Date(2026, 9, 27, 23, 59)), '2026-10-27');
  assert.equal(U.todayKey(new Date(2026, 0, 3, 0, 0)), '2026-01-03');
});

test('dayNum counts calendar days, not 24 h blocks (DST safe)', () => {
  const a = U.dayNum(new Date(2026, 9, 24, 23, 0));
  const b = U.dayNum(new Date(2026, 9, 25, 1, 0)); // across a DST change in many places
  const c = U.dayNum(new Date(2026, 9, 26, 0, 30));
  assert.equal(b - a, 1);
  assert.equal(c - b, 1);
  assert.equal(U.dayNum(new Date(2027, 0, 1)) - U.dayNum(new Date(2026, 11, 31)), 1);
});
