// Smoke: the game boots on every device size with 0 JS errors, the title fits, rotation keeps one canvas.
const { test, expect } = require('@playwright/test');
const { BASE_SAVE, SIZES, KEY, boot, wait, waitScene, active, layoutProblems, noErrors } = require('./helpers');

for (const [id, [w, h]] of Object.entries(SIZES)) {
  test(`title opens and fits on ${id} ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await boot(page);
    expect(await active(page)).toEqual(['title']);
    const p = await layoutProblems(page);
    expect(p.off, 'buttons off screen').toEqual([]);
    expect(p.small, 'buttons below MIN_TAP').toEqual([]);
    expect(await page.evaluate(() => window.__ptBuilds), 'no rebuild without a size change').toBe(1);
    const label = await page.evaluate(() => __game.scene.getScene('title').children.list.some((o) => o.text === 'v' + __titans.VERSION));
    expect(label, 'version label').toBe(true);
    noErrors(page);
  });
}

test('a brand-new player (no save) boots to the title', async ({ page }) => {
  await boot(page, null);
  expect(await page.evaluate(() => __titans.save().run.stage)).toBe(1);
  noErrors(page);
});

test('a broken save never stops the game', async ({ page }) => {
  page._errors = [];
  page.on('pageerror', (e) => page._errors.push(String(e)));
  await page.goto('/manifest.json');
  await page.evaluate((k) => localStorage.setItem(k, '{not json'), KEY);
  await page.goto('/index.html?debug');
  await waitScene(page, 'title');
  noErrors(page);
});

test('rotation: 20 flips leave exactly one canvas, the title and the save', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  for (let i = 0; i < 20; i++) {
    await page.setViewportSize(i % 2 ? { width: 390, height: 844 } : { width: 844, height: 390 });
    await page.waitForTimeout(450);
  }
  await page.waitForTimeout(1500);
  await waitScene(page, 'title');
  expect(await page.locator('canvas').count()).toBe(1);
  expect(await page.evaluate(() => __titans.save().run.stage)).toBe(BASE_SAVE.run.stage);
  noErrors(page);
});

test('PLAY, + TOY and PARENTS answer a tap', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  // tap the real canvas where each button is, not just emit events (PS QA lesson)
  const pos = await page.evaluate(() => {
    const s = __game.scene.getScene('title'), c = __game.canvas.getBoundingClientRect(), k = c.width / __game.config.width, L = __titans.L;
    return s.children.list.filter((o) => o.input && o.label).map((o) => ({ t: o.label.text, x: c.left + (o.x + L.SL) * k, y: c.top + (o.y + L.ST) * k }));
  });
  expect(pos.map((p) => p.t)).toEqual(['PLAY', '+ TOY', 'PARENTS']);
  for (const p of pos) {
    // a finger: down, a short hold, up (at 2-3 fps a 0 ms click can fall between two input updates)
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
    await wait(page, 300);
  }
  // each tap showed its message (a log, not the live toast: at 2-3 fps a toast can come and go between two checks)
  const log = await page.evaluate(() => window.__ptToastLog || []);
  expect(log.length, JSON.stringify(log)).toBe(3);
  noErrors(page);
});
