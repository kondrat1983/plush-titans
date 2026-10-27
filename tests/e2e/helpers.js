// Shared helpers for the Plush Titans browser tests (pattern from Plush Squad tests/helpers.js).
// With ?debug the game exposes window.__game, __save and __titans.
const { expect } = require('@playwright/test');

const URL = '/index.html?debug';
const KEY = 'plushtitans_v1';

// a mid-game save; every one-time announcement already seen so no popup shows up in unrelated tests
const BASE_SAVE = {
  v: 1, run: { stage: 23, kills: 4, maxStage: 23, stars: 12400, tapLvl: 12, heroes: { fluffy: 34, bear: 27, bunny: 15, dino: 4 }, dreams: 0, dreamsTotal: 0, dreamLvls: {} },
  bestStage: 23, seen: { all: 1 }, seenVersion: '0.1', muted: true, parents: { bedtime: null, limitMin: null },
};

// device sizes (QA layout matrix)
const SIZES = { D1: [375, 667], D2: [390, 844], D3: [768, 1024], D4: [1024, 768], D5: [844, 390] };

// Opens the game with a given save. Collects page errors in page._errors.
async function boot(page, save = BASE_SAVE, query = '') {
  page._errors = [];
  page.on('pageerror', (e) => page._errors.push(String((e && e.stack) || e)));
  await page.route(/supabase\.co/, (r) => r.abort());
  // seed the save on a same-origin page that does not start the game (a booting game could save over it)
  await page.goto('/manifest.json');
  await page.evaluate(([k, s]) => (s === null ? localStorage.removeItem(k) : localStorage.setItem(k, s)), [KEY, save === null ? null : JSON.stringify(save)]);
  await page.goto(URL + query);
  await waitScene(page, 'title');
  await fast(page);
}

// Phaser treats frames over 500 ms as 33 ms ("lag smoothing"): at 2-3 fps tweens crawl. Re-run after every scene start or rebuild.
async function fast(page) {
  await page.evaluate(() => { (window.__game ? __game.scene.scenes : []).forEach((s) => s.tweens && s.tweens.setLagSmooth(5000, 33)); });
}

async function wait(page, ms) {
  for (let t = 0; t < ms; t += 500) { await fast(page); await page.waitForTimeout(500); }
}

// waits until the scene is active and has run a few frames: Phaser registers new interactive objects on the next
// frame, and headless runs at 2-3 fps, so a tap right after create() would hit nothing
async function waitScene(page, key, ms = 60000) {
  await page.waitForFunction((k) => window.__game && __game.scene && __game.scene.isActive(k), key, { timeout: ms });
  const f0 = await page.evaluate(() => __game.loop.frame);
  await page.waitForFunction((f) => window.__game && __game.loop.frame >= f + 3, f0, { timeout: ms });
}

const active = (page) => page.evaluate(() => __titans.active());

// interactive objects of the active scene that stick out of the play area W x H, and ones smaller than MIN_TAP
const layoutProblems = (page) => page.evaluate(() => {
  const s = __game.scene.getScenes(true).find((x) => x.scene.key !== 'boot');
  const { W, H } = __titans.L, cam = s.cameras.main, off = [], small = [];
  const walk = (list, ox, oy, sc) => list.forEach((o) => {
    if (!o.visible) return;
    const x = ox + (o.x || 0) * sc, y = oy + (o.y || 0) * sc, k = sc * (o.scaleX || 1);
    if (o.input && o.input.enabled && o.width) {
      const sx = x - cam.scrollX - (-cam.scrollX), sy = y, hw = (o.width * k) / 2, hh = (o.height * k) / 2;
      if (sx - hw < -2 || sx + hw > W + 2 || sy - hh < -2 || sy + hh > H + 2) off.push([o.type, Math.round(sx), Math.round(sy)]);
      if (o.width * k < 110 || o.height * k < 110) small.push([o.type, Math.round(o.width * k), Math.round(o.height * k)]);
    }
    if (o.list) walk(o.list, x, y, k);
  });
  walk(s.children.list, 0, 0, 1);
  return { off, small };
});

const noErrors = (page) => expect(page._errors, page._errors.join('\n')).toEqual([]);

module.exports = { BASE_SAVE, SIZES, KEY, boot, fast, wait, waitScene, active, layoutProblems, noErrors };
