// Plush Titans economy simulator (M0). Node only, no Phaser.
// Models a child who taps at a steady rate, buys the best upgrade as soon as it can,
// retries a missed boss when the squad looks strong enough, and goes to Bedtime at the end of the session.
const E = require('../js/economy.js');
const C = E.C;

const DAY_S = 24 * 3600;
const STAGES_PER_WORLD = 30; // M1 world 1 is stages 1 to 30 (README §6)

function clone(run) {
  return Object.assign({}, run, { heroes: Object.assign({}, run.heroes), dreamLvls: Object.assign({}, run.dreamLvls) });
}

function damagePerSec(run, tps) {
  return E.tap(run.tapLvl, run.dreamLvls) * tps + E.squadDps(run.heroes, run.dreamLvls);
}

// Best "damage per second gained per star" option the child can afford right now, or null.
function bestBuy(run, tps) {
  let best = null;
  const tapCost = E.tapCost(run.tapLvl);
  if (tapCost <= run.stars) {
    const gain = (E.tap(run.tapLvl + 1, run.dreamLvls) - E.tap(run.tapLvl, run.dreamLvls)) * tps;
    best = { kind: 'tap', cost: tapCost, ratio: gain / tapCost };
  }
  const fort = E.dreamMult('fort', run.dreamLvls.fort || 0);
  for (const id of C.HERO_ORDER) {
    const l = run.heroes[id] || 0;
    const cost = E.heroCost(id, l);
    if (cost > run.stars) continue;
    const ratio = (E.heroDps(id, l + 1) - E.heroDps(id, l)) * fort / cost;
    if (!best || ratio > best.ratio) best = { kind: 'hero', id, cost, ratio };
  }
  return best;
}

function shop(run, tps) {
  for (let b = bestBuy(run, tps); b; b = bestBuy(run, tps)) {
    run.stars -= b.cost;
    if (b.kind === 'tap') run.tapLvl++;
    else run.heroes[b.id] = (run.heroes[b.id] || 0) + 1;
  }
}

// Spend Dreams: always buy the cheapest Dream upgrade the child can afford.
function dreamShop(run) {
  for (;;) {
    let pick = null;
    for (const id of C.DREAM_ORDER) {
      const cost = E.dreamCost(id, run.dreamLvls[id] || 0);
      if (cost <= run.dreams && (!pick || cost < pick.cost)) pick = { id, cost };
    }
    if (!pick) return;
    run.dreams -= pick.cost;
    run.dreamLvls[pick.id] = (run.dreamLvls[pick.id] || 0) + 1;
  }
}

// Active play for `seconds`. Returns the new run, stars earned and a timeline of first events (seconds from start).
function play(run0, seconds, opts) {
  const tps = opts.tps;
  const run = clone(run0);
  const ev = { firstKill: null, reach: {}, beat: {}, bossMissed: 0 };
  const samples = [];
  let t = 0, earned = 0, missedAt = null, missedBoss = 0, nextSample = 0;
  const sample = () => {
    while (opts.sampleEvery && nextSample <= t && nextSample <= seconds) {
      samples.push({ t: nextSample, stage: run.stage, maxStage: run.maxStage, dreams: E.dreams(run.maxStage), dps: damagePerSec(run, tps) });
      nextSample += opts.sampleEvery;
    }
  };
  ev.reach[run.stage] = 0;
  sample();
  while (t < seconds) {
    const s = run.stage;
    const dps = damagePerSec(run, tps);
    const killTime = E.hp(s) / dps;
    if (E.isBoss(s) && killTime > C.BOSS_TIME) {
      t += C.BOSS_TIME;
      Object.assign(run, E.bossMissed(run), { kills: 0 });
      ev.bossMissed++;
      missedAt = t;
      missedBoss = s;
      sample();
      continue;
    }
    t += killTime + C.TITAN_SWAP_S;
    if (t > seconds) break; // session ended before this Titan fell asleep
    const got = E.stars(s, run.dreamLvls);
    run.stars += got;
    earned += got;
    if (ev.firstKill === null) ev.firstKill = t;
    shop(run, tps);
    if (E.isBoss(s)) {
      if (ev.beat[s] === undefined) ev.beat[s] = t;
      advance(run, ev, t);
    } else if (++run.kills >= C.KILLS_PER_STAGE) {
      const waiting = missedBoss === s + 1;
      const ready = !waiting || E.hp(s + 1) / damagePerSec(run, tps) <= C.BOSS_TIME || t - missedAt >= 60;
      if (ready) {
        missedBoss = 0;
        advance(run, ev, t);
      } else {
        run.kills = 0; // keep farming this stage
      }
    }
    sample();
  }
  t = seconds;
  sample(); // samples up to the end of the session
  return { run, earned, ev, samples };
}

function advance(run, ev, t) {
  run.stage++;
  run.kills = 0;
  if (run.stage > run.maxStage) run.maxStage = run.stage;
  if (ev.reach[run.stage] === undefined) ev.reach[run.stage] = t;
}

// Bedtime policies at the end of a session.
const POLICIES = {
  // Take Bedtime every evening once it pays any Dreams.
  nightly: (run) => E.dreams(run.maxStage) > 0,
  // Take Bedtime only when it adds at least half of all Dreams earned so far; else say Goodnight and keep the run.
  smart: (run) => {
    const d = E.dreams(run.maxStage);
    return d > 0 && d >= 0.5 * run.dreamsTotal;
  },
};

// Days of play: one session of `minutes` per day, offline time until the next day (capped by the economy).
// offlineFrom: 'after' pays last night from the squad after Bedtime (what the spec says),
// 'before' pays it from the squad the child said Goodnight to. offline: false turns offline earnings off.
function days(opts) {
  const { n, minutes, tps, policy } = opts;
  const offlineFrom = opts.offlineFrom || 'after';
  let run = E.newRun();
  let best = 1;
  const rows = [];
  let offlineIn = 0; // stars paid at the start of today for last night
  for (let d = 1; d <= n; d++) {
    run.stars += offlineIn;
    shop(run, tps);
    const p = play(run, minutes * 60, { tps, sampleEvery: 60 });
    run = p.run;
    best = Math.max(best, run.maxStage);
    const row = {
      day: d, minutes, tps, policy,
      maxStage: run.maxStage, bestStage: best, world: Math.floor((best - 1) / STAGES_PER_WORLD) + 1,
      activeStars: p.earned, offlineStars: offlineIn,
      offlineShare: offlineIn / (offlineIn + p.earned || 1),
      bedtime: false, dreamsGot: 0, dreamsTotal: run.dreamsTotal, bossMissed: p.ev.bossMissed,
      plateauMin: plateau(p.samples, run.maxStage),
    };
    const beforeBed = run;
    if (POLICIES[policy](run)) {
      row.bedtime = true;
      row.dreamsGot = E.dreams(run.maxStage);
      run = E.bedtime(run);
      dreamShop(run);
      row.dreamsTotal = run.dreamsTotal;
    }
    const squad = offlineFrom === 'before' ? Object.assign({}, beforeBed, { dreamLvls: run.dreamLvls }) : run;
    offlineIn = opts.offline === false ? 0 : E.offlineStars(squad, DAY_S - minutes * 60);
    rows.push(row);
  }
  return rows;
}

// First minute of the session after which the best stage of the run did not grow any more:
// playing on past it earns no extra Dreams, so it is the good moment for Bedtime.
function plateau(samples, finalMax) {
  const s = samples.find((x) => x.maxStage >= finalMax);
  return s ? s.t / 60 : null;
}

module.exports = { play, days, plateau, damagePerSec, bestBuy, shop, dreamShop, POLICIES, STAGES_PER_WORLD };
