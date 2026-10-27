// Plush Titans local save. Node and browser (window.PTSave). Format: docs/save-format.md.
// Rules: localStorage in try/catch, a schema number `v`, migration that never takes anything away and never throws.
(function (root) {
  'use strict';

  const KEY = 'plushtitans_v1';
  const SAVE_V = 1;

  const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
  const num = (x, min, dflt) => (Number.isFinite(x) && x >= min ? x : dflt);
  const int = (x, min, dflt) => (Number.isFinite(x) && x >= min ? Math.floor(x) : dflt);

  function defaults() {
    return {
      v: SAVE_V,
      savedAt: 0,
      run: { stage: 1, kills: 0, maxStage: 1, stars: 0, tapLvl: 1, heroes: {}, dreams: 0, dreamsTotal: 0, dreamLvls: {} },
      bestStage: 1,
      seen: {},           // one-time announcements already shown (first boss, first Bedtime, ...)
      seenVersion: '',    // What's new shown for this major.minor
      parents: { bedtime: null, limitMin: null },
    };
  }

  // Levels by string id: keep whole numbers >= 1, drop the rest. Unknown ids stay (a newer version may know them).
  function levels(x) {
    const out = {};
    if (!isObj(x)) return out;
    for (const k of Object.keys(x)) {
      const l = int(x[k], 1, 0);
      if (l) out[k] = l;
    }
    return out;
  }

  // Ordered, idempotent steps. Fills what is missing, repairs bad numbers, never removes good data.
  // opts.steps: extra steps for tests (each sees the save with the version it was written with).
  function migrate(d, opts) {
    const base = defaults();
    if (!isObj(d)) d = {};
    const r = isObj(d.run) ? d.run : {};
    const run = {
      stage: int(r.stage, 1, 1),
      kills: int(r.kills, 0, 0),
      maxStage: int(r.maxStage, 1, 1),
      stars: num(r.stars, 0, 0),
      tapLvl: int(r.tapLvl, 1, 1),
      heroes: levels(r.heroes),
      dreams: int(r.dreams, 0, 0),
      dreamsTotal: int(r.dreamsTotal, 0, 0),
      dreamLvls: levels(r.dreamLvls),
    };
    run.maxStage = Math.max(run.maxStage, run.stage);
    const out = Object.assign({}, d, {
      v: int(d.v, 1, 1), // the version the save was written with; raised after the steps below
      savedAt: num(d.savedAt, 0, 0),
      run: Object.assign({}, r, run),
      bestStage: Math.max(int(d.bestStage, 1, 1), run.maxStage),
      seen: isObj(d.seen) ? d.seen : {},
      seenVersion: typeof d.seenVersion === 'string' ? d.seenVersion : '',
      parents: Object.assign({}, base.parents, isObj(d.parents) ? d.parents : {}),
    });
    // future steps go here, in order: if (out.v < 2) { ...; out.v = 2; }
    ((opts && opts.steps) || []).forEach((step) => step(out));
    out.v = Math.max(out.v, SAVE_V); // never lower (a save from a newer version keeps its number)
    return out;
  }

  function createSave(opts) {
    opts = opts || {};
    const storage = opts.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    const now = opts.now || (() => Date.now());
    const S = {
      data: defaults(),
      load() {
        let raw = null;
        try { raw = storage && storage.getItem(KEY); } catch (e) { raw = null; }
        let d = null;
        try { d = raw ? JSON.parse(raw) : null; } catch (e) { d = null; }
        S.data = migrate(d);
        return S.data;
      },
      // keepTime: keep savedAt as it is (debug setSave seeds a past time for offline tests)
      store(o) {
        if (!(o && o.keepTime)) S.data.savedAt = now();
        try { storage && storage.setItem(KEY, JSON.stringify(S.data)); } catch (e) { /* private mode or full: keep playing */ }
        if (opts.onStore) { try { opts.onStore(S.data); } catch (e) {} }
      },
      exportJSON() {
        return JSON.stringify(S.data);
      },
      // Replaces the save with one from another device. Refuses anything that is not a Plush Titans save.
      // savedAt becomes now: moving a save to another device does not pay offline stars.
      importJSON(text) {
        let d;
        try { d = JSON.parse(text); } catch (e) { return false; }
        if (!isObj(d) || !Number.isFinite(d.v) || !isObj(d.run)) return false;
        S.data = migrate(d);
        S.store();
        return true;
      },
      // Fresh start (from the Parents screen). Parent settings stay.
      reset() {
        const parents = S.data.parents;
        S.data = defaults();
        S.data.parents = Object.assign({}, S.data.parents, parents);
        S.store();
      },
    };
    return S;
  }

  const api = { KEY, SAVE_V, defaults, migrate, createSave };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PTSave = api;
})(typeof self !== 'undefined' ? self : this);
