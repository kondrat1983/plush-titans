// Renders the app icons from the vector Titan (js/art.js). Run: node tools/icons.js (needs Playwright's Chromium).
const path = require('path');
const { chromium } = require('playwright');
const Art = require('../js/art.js');

const OUT = path.join(__dirname, '..', 'assets', 'icons');
// pad: share of the icon kept clear around the Titan (maskable icons need a large safe zone)
const ICONS = [['apple-touch-icon.png', 180, 0.1], ['icon-192.png', 192, 0.1], ['icon-512.png', 512, 0.1], ['icon-maskable-512.png', 512, 0.22]];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const t = Art.TITANS.snoozy;
  for (const [name, size, pad] of ICONS) {
    const inner = Math.round(size * (1 - 2 * pad));
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;
      background:linear-gradient(#b9a7f0,#ffd3c2 70%,#a6dcb0 70%)">${Art.titan(t.col, t.dark).replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</body>`);
    await p.screenshot({ path: path.join(OUT, name) });
  }
  await b.close();
  console.log('icons written to assets/icons/');
})();
