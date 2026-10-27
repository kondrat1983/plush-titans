// Plush Titans economy: every balance constant and formula lives here.
// Pure functions, no Phaser, no DOM. Shared by the game (window.PTEconomy) and the simulator (require).
// Values marked [?] are proposals waiting for the owner's OK (see docs/economy/).
(function (root) {
  'use strict';

  const C = {
    // Titans
    HP0: 10,             // HP of the stage 1 Titan
    G: 1.35,             // HP growth per stage
    BOSS_EVERY: 10,      // every 10th stage is a boss Titan
    BOSS_MUL: 3,         // boss HP multiplier
    BOSS_TIME: 30,       // seconds to beat a boss, else back one stage (stars kept)
    KILLS_PER_STAGE: 5,  // Titans to defeat on a normal stage before the next one [?]
    TITAN_SWAP_S: 0.6,   // seconds between a Titan falling asleep and the next one arriving

    // Stars
    STAR0: 1,            // stars for a stage 1 Titan
    G_STAR: 1.31,        // star growth per stage (below G, so progress slows down: the wall)
    BOSS_STARS: 8,       // boss star multiplier

    // Taps
    TAP0: 1,             // damage of one tap at tap level 1
    TAP_C0: 5,           // cost of the first tap upgrade
    TAP_R: 1.12,         // tap upgrade cost growth

    // Heroes (stats by class id; a captured toy picks one of these classes)
    R: 1.08,             // hero level cost growth
    HEROES: {
      fluffy: { dps0: 1, c0: 10 },
      bear: { dps0: 6, c0: 120 },
      bunny: { dps0: 40, c0: 1500 },
      dino: { dps0: 250, c0: 20000 },
    },
    HERO_ORDER: ['fluffy', 'bear', 'bunny', 'dino'],

    // Bedtime and Dreams
    D_MIN: 20,           // first stage that pays any Dreams
    D_DIV: 5,
    D_EXP: 1.5,
    // Each level multiplies by (1 + step); cost = round(cost0 * costR^level) + level.
    DREAM_UPGRADES: {
      nightlight: { what: 'tap', step: 1, cost0: 1, costR: 1.3 },     // night-lights: tap damage
      fort: { what: 'dps', step: 1, cost0: 1, costR: 1.3 },               // blanket forts: squad DPS
      lullaby: { what: 'stars', step: 0.5, cost0: 2, costR: 1.4 },    // lullabies: stars per kill
    },
    DREAM_ORDER: ['nightlight', 'fort', 'lullaby'],

    // Offline
    OFFLINE_CAP_H: 8,    // one night, a rule (README §2), not a setting
    OFFLINE_RATE: 0.03,  // share of the squad's passive stars paid while away [?]
  };

  const isBoss = (s) => s % C.BOSS_EVERY === 0;

  function dreamMult(id, lvl) {
    return Math.pow(1 + C.DREAM_UPGRADES[id].step, lvl || 0);
  }

  function dreamCost(id, lvl) {
    const u = C.DREAM_UPGRADES[id];
    return Math.round(u.cost0 * Math.pow(u.costR, lvl)) + lvl; // + lvl: every level costs more than the last
  }

  const lv = (dl, id) => (dl && dl[id]) || 0;

  function hp(s) {
    return C.HP0 * Math.pow(C.G, s - 1) * (isBoss(s) ? C.BOSS_MUL : 1);
  }

  function stars(s, dl) {
    return C.STAR0 * Math.pow(C.G_STAR, s - 1) * (isBoss(s) ? C.BOSS_STARS : 1) * dreamMult('lullaby', lv(dl, 'lullaby'));
  }

  function tap(l, dl) {
    return C.TAP0 * l * dreamMult('nightlight', lv(dl, 'nightlight'));
  }

  function tapCost(l) {
    return C.TAP_C0 * Math.pow(C.TAP_R, l);
  }

  // Doublings reached at a level: 10, 25, 50, then every 50.
  function milestones(l) {
    let n = 0;
    if (l >= 10) n++;
    if (l >= 25) n++;
    if (l >= 50) n += Math.floor(l / 50);
    return n;
  }

  function heroDps(id, l) {
    if (!l) return 0;
    return C.HEROES[id].dps0 * l * Math.pow(2, milestones(l));
  }

  function heroCost(id, l) {
    return C.HEROES[id].c0 * Math.pow(C.R, l);
  }

  function squadDps(heroes, dl) {
    let sum = 0;
    for (const id of C.HERO_ORDER) sum += heroDps(id, (heroes && heroes[id]) || 0);
    return sum * dreamMult('fort', lv(dl, 'fort'));
  }

  function dreams(maxStage) {
    if (!(maxStage >= C.D_MIN)) return 0;
    return Math.floor(Math.pow(maxStage / C.D_DIV, C.D_EXP));
  }

  // Seconds that count as "away", from save time to now. Clock moved back or no save time: 0.
  function offlineSeconds(savedAt, now) {
    const s = (now - savedAt) / 1000;
    if (!Number.isFinite(s) || savedAt == null || s <= 0) return 0;
    return Math.min(s, C.OFFLINE_CAP_H * 3600);
  }

  // Stars the squad earns while away. Passive DPS only, on the last normal stage, capped at one night.
  function offlineStars(run, sec) {
    const t = Math.min(Math.max(sec || 0, 0), C.OFFLINE_CAP_H * 3600);
    let s = Math.max(1, run.stage || 1);
    if (isBoss(s)) s = Math.max(1, s - 1);
    const dps = squadDps(run.heroes, run.dreamLvls);
    if (!dps || !t) return 0;
    const killsPerSec = 1 / (hp(s) / dps + C.TITAN_SWAP_S);
    return Math.floor(t * killsPerSec * stars(s, run.dreamLvls) * C.OFFLINE_RATE);
  }

  // Boss timer ran out: back one stage, nothing taken away.
  function bossMissed(run) {
    return Object.assign({}, run, { stage: Math.max(1, run.stage - 1) });
  }

  // Bedtime: the run resets, Dreams for the best stage of this run are added, Dream upgrades stay.
  function bedtime(run) {
    const got = dreams(run.maxStage || 0);
    return Object.assign(newRun(), {
      dreams: (run.dreams || 0) + got,
      dreamsTotal: (run.dreamsTotal || 0) + got,
      dreamLvls: Object.assign({}, run.dreamLvls),
    });
  }

  function newRun() {
    return { stage: 1, kills: 0, maxStage: 1, stars: 0, tapLvl: 1, heroes: {}, dreams: 0, dreamsTotal: 0, dreamLvls: {} };
  }

  const E = {
    C, isBoss, hp, stars, tap, tapCost, milestones, heroDps, heroCost, squadDps,
    dreams, dreamMult, dreamCost, offlineSeconds, offlineStars, bossMissed, bedtime, newRun,
  };

  if (typeof module === 'object' && module.exports) module.exports = E;
  else root.PTEconomy = E;
})(typeof self !== 'undefined' ? self : this);
