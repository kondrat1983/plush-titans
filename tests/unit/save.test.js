// Unit tests for js/save.js (local save, migration, export/import). Run: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../../js/save.js');

function memStorage(init) {
  const m = Object.assign({}, init);
  return {
    getItem: (k) => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: (k) => { delete m[k]; },
    raw: m,
  };
}
const brokenStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };

test('a new player gets a full default save with the schema version', () => {
  const s = S.createSave({ storage: memStorage() });
  s.load();
  assert.equal(s.data.v, S.SAVE_V);
  assert.equal(s.data.run.stage, 1);
  assert.equal(s.data.run.stars, 0);
  assert.equal(s.data.run.tapLvl, 1);
  assert.deepEqual(s.data.run.heroes, {});
  assert.deepEqual(s.data.run.dreamLvls, {});
  assert.equal(s.data.bestStage, 1);
  assert.deepEqual(s.data.seen, {});
});

test('a partial or broken save never throws and gets defaults', () => {
  for (const raw of ['{}', '{"run":null}', '{"run":{"stage":5}}', 'not json', '[]', '"x"', '{"v":1,"run":{"heroes":null,"dreamLvls":7}}']) {
    const s = S.createSave({ storage: memStorage({ [S.KEY]: raw }) });
    s.load();
    assert.equal(s.data.v, S.SAVE_V, raw);
    assert.equal(typeof s.data.run.heroes, 'object', raw);
    assert.equal(typeof s.data.run.dreamLvls, 'object', raw);
    assert.ok(s.data.run.stage >= 1, raw);
  }
});

test('storage that throws (private mode, blocked) never breaks the game', () => {
  const s = S.createSave({ storage: brokenStorage });
  s.load();
  s.data.run.stars = 5;
  s.store();
  assert.equal(s.data.run.stars, 5);
});

test('migration keeps every valid value and repairs only bad numbers', () => {
  const old = {
    v: 1, run: { stage: 23, kills: 4, maxStage: 31, stars: 1234.5, tapLvl: 12, heroes: { bear: 27, fluffy: 34 }, dreams: 3, dreamsTotal: 40, dreamLvls: { fort: 2 } },
    bestStage: 40, seen: { firstBoss: 1 }, parents: { bedtime: '20:30', limitMin: 45 },
  };
  const d = S.migrate(JSON.parse(JSON.stringify(old)));
  assert.equal(d.run.stage, 23);
  assert.equal(d.run.stars, 1234.5);
  assert.deepEqual(d.run.heroes, { bear: 27, fluffy: 34 });
  assert.deepEqual(d.run.dreamLvls, { fort: 2 });
  assert.equal(d.bestStage, 40);
  assert.deepEqual(d.seen, { firstBoss: 1 });
  assert.deepEqual(d.parents, { bedtime: '20:30', limitMin: 45 });

  const bad = S.migrate({ run: { stage: -3, stars: NaN, tapLvl: 0, maxStage: 'x', heroes: { bear: -1, dino: 2.7, cat: 5 } } });
  assert.equal(bad.run.stage, 1);
  assert.equal(bad.run.stars, 0);
  assert.equal(bad.run.tapLvl, 1);
  assert.equal(bad.run.maxStage, 1);
  assert.deepEqual(bad.run.heroes, { dino: 2, cat: 5 }, 'unknown ids are kept (a newer version may know them), bad levels dropped');
});

test('best stage is never below the run best stage', () => {
  const d = S.migrate({ run: { stage: 12, maxStage: 18 }, bestStage: 3 });
  assert.equal(d.bestStage, 18);
  assert.ok(d.run.maxStage >= d.run.stage);
});

test('migration is idempotent', () => {
  const once = S.migrate({ run: { stage: 7 } });
  const twice = S.migrate(JSON.parse(JSON.stringify(once)));
  assert.deepEqual(twice, once);
});

test('migration steps see the version the save was written with', () => {
  // a step added later reads d.v before it is bumped; simulate it with the step hook
  const seen = [];
  const d = S.migrate({ v: 1, run: { stage: 2 } }, { steps: [(x) => { seen.push(x.v); }] });
  assert.deepEqual(seen, [1]);
  assert.equal(d.v, S.SAVE_V);
});

test('store can keep savedAt (debug setSave seeds a past time for offline tests)', () => {
  const st = memStorage();
  const s = S.createSave({ storage: st, now: () => 5000 });
  s.load();
  s.data.savedAt = 1000;
  s.store({ keepTime: true });
  assert.equal(JSON.parse(st.raw[S.KEY]).savedAt, 1000);
  s.store();
  assert.equal(JSON.parse(st.raw[S.KEY]).savedAt, 5000);
});

test('device settings like sound are not in the game save', () => {
  assert.equal('muted' in S.defaults(), false);
});

test('a save from a newer version is not downgraded', () => {
  const d = S.migrate({ v: S.SAVE_V + 5, run: { stage: 3 }, future: { x: 1 } });
  assert.equal(d.v, S.SAVE_V + 5);
  assert.deepEqual(d.future, { x: 1 });
});

test('store writes JSON with savedAt from the clock', () => {
  const st = memStorage();
  const s = S.createSave({ storage: st, now: () => 1234 });
  s.load();
  s.data.run.stars = 99;
  s.store();
  const back = JSON.parse(st.raw[S.KEY]);
  assert.equal(back.run.stars, 99);
  assert.equal(back.savedAt, 1234);
});

test('export then import moves a save between devices', () => {
  const a = S.createSave({ storage: memStorage() });
  a.load();
  a.data.run.stage = 42;
  a.data.run.heroes.bunny = 9;
  const text = a.exportJSON();
  const st = memStorage();
  const b = S.createSave({ storage: st });
  b.load();
  assert.equal(b.importJSON(text), true);
  assert.equal(b.data.run.stage, 42);
  assert.equal(b.data.run.heroes.bunny, 9);
  assert.equal(JSON.parse(st.raw[S.KEY]).run.stage, 42, 'imported save is stored at once');
});

test('importing garbage is refused and changes nothing', () => {
  const s = S.createSave({ storage: memStorage() });
  s.load();
  s.data.run.stage = 9;
  for (const bad of ['', 'hello', '[]', '42', '{"nope":1}', null]) {
    assert.equal(s.importJSON(bad), false, String(bad));
    assert.equal(s.data.run.stage, 9);
  }
});

test('reset gives a fresh save but keeps the parent settings', () => {
  const st = memStorage();
  const s = S.createSave({ storage: st });
  s.load();
  s.data.run.stage = 50;
  s.data.parents.bedtime = '20:00';
  s.reset();
  assert.equal(s.data.run.stage, 1);
  assert.equal(s.data.parents.bedtime, '20:00');
  assert.equal(JSON.parse(st.raw[S.KEY]).run.stage, 1);
});
