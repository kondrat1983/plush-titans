// Unit tests for js/economy.js. Run: node --test tests/unit/
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../js/economy.js');
const C = E.C;

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} != ${b}`);

test('every 10th stage is a boss, others are not', () => {
  assert.equal(E.isBoss(10), true);
  assert.equal(E.isBoss(20), true);
  assert.equal(E.isBoss(1), false);
  assert.equal(E.isBoss(9), false);
  assert.equal(E.isBoss(11), false);
});

test('stage HP grows by G per stage, bosses multiply by BOSS_MUL', () => {
  close(E.hp(1), C.HP0);
  close(E.hp(2), C.HP0 * C.G);
  close(E.hp(9), C.HP0 * Math.pow(C.G, 8));
  close(E.hp(10), C.HP0 * Math.pow(C.G, 9) * C.BOSS_MUL);
});

test('stars per kill grow by G_STAR, bosses multiply by BOSS_STARS', () => {
  close(E.stars(1), C.STAR0);
  close(E.stars(3), C.STAR0 * Math.pow(C.G_STAR, 2));
  close(E.stars(10), C.STAR0 * Math.pow(C.G_STAR, 9) * C.BOSS_STARS);
});

test('stars per kill apply the lullaby multiplier', () => {
  close(E.stars(3, { lullaby: 2 }), E.stars(3) * E.dreamMult('lullaby', 2));
});

test('tap damage is TAP0 * level * night-light multiplier', () => {
  close(E.tap(1), C.TAP0);
  close(E.tap(7), C.TAP0 * 7);
  close(E.tap(7, { nightlight: 3 }), C.TAP0 * 7 * E.dreamMult('nightlight', 3));
});

test('hero DPS is zero before the hero joins, linear in level, doubles at milestones', () => {
  const h = C.HERO_ORDER[0];
  const d0 = C.HEROES[h].dps0;
  assert.equal(E.heroDps(h, 0), 0);
  close(E.heroDps(h, 1), d0);
  close(E.heroDps(h, 9), d0 * 9);
  close(E.heroDps(h, 10), d0 * 10 * 2);
  close(E.heroDps(h, 24), d0 * 24 * 2);
  close(E.heroDps(h, 25), d0 * 25 * 4);
  close(E.heroDps(h, 50), d0 * 50 * 8);
  close(E.heroDps(h, 100), d0 * 100 * 16);
});

test('milestones are 10, 25, 50, then every 50', () => {
  assert.deepEqual([1, 9, 10, 24, 25, 49, 50, 99, 100, 149, 150].map(E.milestones), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
});

test('squad DPS sums heroes and applies the blanket-fort multiplier', () => {
  const [a, b] = C.HERO_ORDER;
  const heroes = { [a]: 3, [b]: 2 };
  close(E.squadDps(heroes), E.heroDps(a, 3) + E.heroDps(b, 2));
  close(E.squadDps(heroes, { fort: 2 }), (E.heroDps(a, 3) + E.heroDps(b, 2)) * E.dreamMult('fort', 2));
  assert.equal(E.squadDps({}), 0);
});

test('level costs grow by R per level', () => {
  const h = C.HERO_ORDER[1];
  close(E.heroCost(h, 0), C.HEROES[h].c0);
  close(E.heroCost(h, 5), C.HEROES[h].c0 * Math.pow(C.R, 5));
  close(E.tapCost(1), C.TAP_C0 * C.TAP_R);
  close(E.tapCost(4), C.TAP_C0 * Math.pow(C.TAP_R, 4));
});

test('Dreams: none below D_MIN, then floor((maxStage / D_DIV) ^ D_EXP), never decreasing', () => {
  assert.equal(E.dreams(0), 0);
  assert.equal(E.dreams(C.D_MIN - 1), 0);
  assert.equal(E.dreams(C.D_MIN), Math.floor(Math.pow(C.D_MIN / C.D_DIV, C.D_EXP)));
  assert.ok(E.dreams(C.D_MIN) >= 1, 'reaching D_MIN must pay at least 1 Dream');
  let prev = 0;
  for (let s = 1; s <= 500; s++) {
    const d = E.dreams(s);
    assert.ok(Number.isInteger(d));
    assert.ok(d >= prev);
    prev = d;
  }
});

test('Dream upgrade costs are whole numbers and grow', () => {
  for (const id of C.DREAM_ORDER) {
    assert.equal(E.dreamCost(id, 0), C.DREAM_UPGRADES[id].cost0);
    for (let l = 0; l < 30; l++) {
      assert.ok(Number.isInteger(E.dreamCost(id, l)));
      assert.ok(E.dreamCost(id, l + 1) > E.dreamCost(id, l));
    }
    assert.equal(E.dreamMult(id, 0), 1);
    assert.ok(E.dreamMult(id, 1) > 1);
  }
});

test('offline seconds are capped at one night: 8 h and 7 days pay the same', () => {
  const now = 1_800_000_000_000;
  const h = 3600 * 1000;
  assert.equal(E.offlineSeconds(now - 8 * h, now), C.OFFLINE_CAP_H * 3600);
  assert.equal(E.offlineSeconds(now - 7 * 24 * h, now), C.OFFLINE_CAP_H * 3600);
  assert.equal(E.offlineSeconds(now - 2 * h, now), 2 * 3600);
});

test('offline seconds are 0 when the clock moved back or the save time is missing', () => {
  const now = 1_800_000_000_000;
  assert.equal(E.offlineSeconds(now + 5000, now), 0);
  assert.equal(E.offlineSeconds(undefined, now), 0);
  assert.equal(E.offlineSeconds(NaN, now), 0);
  assert.equal(E.offlineSeconds(null, now), 0);
});

test('offline stars: passive DPS only, farm stage below a boss, 8 h equals 7 days', () => {
  const heroes = { [C.HERO_ORDER[0]]: 20 };
  const sec = C.OFFLINE_CAP_H * 3600;
  const a = E.offlineStars({ stage: 7, heroes }, sec);
  const b = E.offlineStars({ stage: 7, heroes }, sec * 21);
  assert.equal(a, b);
  assert.ok(a > 0);
  assert.ok(Number.isInteger(a));
  // On a boss stage the squad farms the stage before it.
  assert.equal(E.offlineStars({ stage: 10, heroes }, 3600), E.offlineStars({ stage: 9, heroes }, 3600));
  // No heroes, no offline stars (taps do not count).
  assert.equal(E.offlineStars({ stage: 7, heroes: {} }, sec), 0);
  assert.equal(E.offlineStars({ stage: 7, heroes }, -50), 0);
});

test('boss timer: a missed boss sends the player back one stage and keeps every star', () => {
  const st = { stage: 20, stars: 1234 };
  const lost = E.bossMissed(st);
  assert.equal(lost.stage, 19);
  assert.equal(lost.stars, 1234);
  assert.equal(st.stage, 20, 'input is not mutated');
  assert.equal(E.bossMissed({ stage: 1, stars: 0 }).stage, 1, 'never below stage 1');
});

test('bedtime: resets the run, adds Dreams, keeps Dream upgrades', () => {
  const run = {
    stage: 23, maxStage: 31, stars: 5000, tapLvl: 12,
    heroes: { [C.HERO_ORDER[0]]: 30 }, dreams: 4, dreamLvls: { nightlight: 2 }, dreamsTotal: 10,
  };
  const next = E.bedtime(run);
  assert.equal(next.stage, 1);
  assert.equal(next.maxStage, 1);
  assert.equal(next.stars, 0);
  assert.equal(next.tapLvl, 1);
  assert.deepEqual(next.heroes, {});
  assert.equal(next.dreams, 4 + E.dreams(31));
  assert.equal(next.dreamsTotal, 10 + E.dreams(31));
  assert.deepEqual(next.dreamLvls, { nightlight: 2 });
  assert.notEqual(next.dreamLvls, run.dreamLvls, 'returns a copy');
});

test('every constant is a finite number and every id table has an order array', () => {
  for (const [k, v] of Object.entries(C)) {
    if (typeof v === 'number') assert.ok(Number.isFinite(v), k);
  }
  assert.deepEqual(Object.keys(C.HEROES).sort(), [...C.HERO_ORDER].sort());
  assert.deepEqual(Object.keys(C.DREAM_UPGRADES).sort(), [...C.DREAM_ORDER].sort());
});
