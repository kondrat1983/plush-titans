// Unit tests for the pure part of js/layout.js. Run: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../../js/layout.js');

const ins = (t, b, l, r, dead) => ({ t, b, l, r, dead: dead || 0 });

test('iPhone portrait: 1080 wide, height from the usable aspect, margins for the notch and home bar', () => {
  const g = L.compute({ w: 390, h: 844 }, ins(47, 34, 0, 0));
  assert.equal(g.PORTRAIT, true);
  assert.equal(g.W, 1080);
  assert.equal(g.H, Math.round(1080 / (390 / (844 - 81))));
  assert.ok(g.ST > 0 && g.SB > 0);
  assert.equal(g.SL, 0);
  assert.equal(g.GW, g.W);
  assert.equal(g.GH, g.H + g.ST + g.SB);
});

test('iPhone SE portrait keeps at least 1500 units of height', () => {
  const g = L.compute({ w: 375, h: 667 }, ins(20, 0, 0, 0));
  assert.equal(g.W, 1080);
  assert.ok(g.H >= 1500);
});

test('landscape: 1080 high, width from the aspect, side margins for the notch', () => {
  const g = L.compute({ w: 844, h: 390 }, ins(0, 21, 47, 47));
  assert.equal(g.PORTRAIT, false);
  assert.equal(g.H, 1080);
  assert.ok(g.W >= 1440 && g.W <= 2340);
  assert.ok(g.SL > 0 && g.SR > 0);
});

test('iPad sizes stay inside the clamps', () => {
  for (const v of [{ w: 768, h: 1024 }, { w: 1024, h: 768 }, { w: 1024, h: 1366 }, { w: 1366, h: 1024 }]) {
    const g = L.compute(v, ins(24, 20, 0, 0));
    assert.ok(g.W >= 1080 && g.W <= 2340, JSON.stringify(v));
    assert.ok(g.H >= 1080 && g.H <= 2340, JSON.stringify(v));
  }
});

test('the bleed box covers the whole canvas around the play area', () => {
  const g = L.compute({ w: 390, h: 844 }, ins(47, 34, 0, 0));
  assert.equal(g.BLEED.w, g.GW);
  assert.equal(g.BLEED.h, g.GH);
  assert.ok(g.BLEED.cx - g.BLEED.w / 2 === -g.SL, 'left edge'); // === so that 0 and -0 match
  assert.ok(g.BLEED.cy - g.BLEED.h / 2 === -g.ST, 'top edge');
});

test('tiny or zero sizes never divide by zero', () => {
  const g = L.compute({ w: 0, h: 0 }, ins(0, 0, 0, 0));
  assert.ok(Number.isFinite(g.W) && Number.isFinite(g.H) && Number.isFinite(g.KU));
});
