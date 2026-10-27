// Tests for the M0 simulator and the target feel (README §5). Run: node --test 'tests/unit/*.test.js'
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../js/economy.js');
const S = require('../../sim/sim.js');
const C = E.C;

test('the simulator is deterministic', () => {
  const a = S.days({ n: 5, minutes: 15, tps: 5, policy: 'nightly' });
  const b = S.days({ n: 5, minutes: 15, tps: 5, policy: 'nightly' });
  assert.deepEqual(a, b);
});

test('play never spends more stars than it has, no big stage jumps, best stage never drops', () => {
  const p = S.play(E.newRun(), 1800, { tps: 5, sampleEvery: 1 });
  assert.ok(p.run.stars >= 0);
  for (let i = 1; i < p.samples.length; i++) {
    assert.ok(Math.abs(p.samples[i].stage - p.samples[i - 1].stage) <= 3, 'no stage jumps');
    assert.ok(p.samples[i].maxStage >= p.samples[i - 1].maxStage, 'best stage never goes down');
  }
});

test('a missed boss costs one stage and no stars', () => {
  // A squad far too weak for the stage 10 boss.
  const run = Object.assign(E.newRun(), { stage: 10, maxStage: 10, stars: 0 });
  const p = S.play(run, C.BOSS_TIME + 0.01, { tps: 0.0001 });
  assert.equal(p.ev.bossMissed, 1);
  assert.equal(p.run.stage, 9);
  assert.equal(p.run.stars, 0);
});

test('day rows are well formed', () => {
  for (const policy of Object.keys(S.POLICIES)) {
    for (const offlineFrom of ['after', 'before']) {
      const rows = S.days({ n: 14, minutes: 10, tps: 3, policy, offlineFrom });
      for (const r of rows) {
        assert.ok(r.offlineShare >= 0 && r.offlineShare <= 1, `share ${r.offlineShare}`);
        assert.ok(Number.isFinite(r.activeStars) && Number.isFinite(r.offlineStars));
        assert.ok(r.bestStage >= r.maxStage || r.bedtime);
      }
      for (let i = 1; i < rows.length; i++) assert.ok(rows[i].bestStage >= rows[i - 1].bestStage);
    }
  }
});

test('offline pays nothing after a nightly Bedtime when it counts the reset squad', () => {
  const rows = S.days({ n: 7, minutes: 15, tps: 5, policy: 'nightly', offlineFrom: 'after' });
  for (const r of rows) assert.equal(r.offlineStars, 0);
});

// Target feel. These are the owner's targets (README §5); if a balance change breaks one, the change needs his OK.
test('target: first kill in under 5 s, even at 3 taps per second', () => {
  const p = S.play(E.newRun(), 60, { tps: 3 });
  assert.ok(p.ev.firstKill < 5, `first kill at ${p.ev.firstKill} s`);
});

test('target: first boss beaten within 3 minutes, even at 3 taps per second', () => {
  const p = S.play(E.newRun(), 600, { tps: 3 });
  assert.ok(p.ev.beat[10] <= 180, `first boss at ${p.ev.beat[10]} s`);
});

test('target: day 1 progress stalls (good Bedtime moment) after about 15 to 20 minutes', () => {
  const p = S.play(E.newRun(), 3600, { tps: 5, sampleEvery: 60 });
  const m = S.plateau(p.samples.filter((s) => s.t <= 30 * 60), p.samples.find((s) => s.t === 30 * 60).maxStage);
  assert.ok(m >= 13 && m <= 22, `stalls at minute ${m}`);
  assert.ok(E.dreams(p.samples[m].maxStage) > 0, 'Bedtime pays Dreams by then');
});

test('target: offline earnings are under 30% of progress at 10, 15 and 30 minutes a day', () => {
  for (const minutes of [10, 15, 30]) {
    const on = S.days({ n: 14, minutes, tps: 5, policy: 'nightly', offlineFrom: 'before' });
    const off = S.days({ n: 14, minutes, tps: 5, policy: 'nightly', offlineFrom: 'before', offline: false });
    on.forEach((r, i) => {
      const share = (r.bestStage - off[i].bestStage) / (r.bestStage - 1);
      assert.ok(share <= 0.3, `${minutes} min, day ${r.day}: ${Math.round(share * 100)}%`);
    });
  }
});
