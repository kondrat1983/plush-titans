// Screen layout for Plush Titans (window.PTLayout). The pure size maths runs in Node for tests.
// Ported from Plush Squad js/game.js (commit b4ce94b): full-bleed canvas, UI in the safe area, iOS 26 strip fix.
//
// The canvas covers the whole screen, also under the status bar and the home bar. Scenes lay out in a W x H play
// area (W = 1080 in portrait, H = 1080 in landscape); each scene camera is scrolled by (-SL, -ST) so the play area
// sits inside the safe area and backgrounds can bleed to the edges.
(function (root) {
  'use strict';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // view: CSS size of the page; ins: safe-area insets in CSS px (+ dead: iOS 26 strip height)
  function compute(view, ins) {
    const vw = Math.max(view.w, 1), vh = Math.max(view.h, 1);
    const UW = Math.max(vw - ins.l - ins.r, 1), UH = Math.max(vh - ins.t - ins.b, 1);
    const PORTRAIT = UH > UW;
    const ASPECT = UW / UH;
    const W = PORTRAIT ? 1080 : Math.round(clamp(1080 * ASPECT, 1440, 2340));
    // portrait floor 1300: an iPad in portrait (3:4 minus the bars, about 1380) fills the screen with no side bars (QA T03)
    const H = PORTRAIT ? Math.round(clamp(1080 / ASPECT, 1300, 2340)) : 1080;
    const KU = PORTRAIT ? W / UW : H / UH; // game units per CSS px
    const ST = Math.round(ins.t * KU), SB = Math.round(ins.b * KU), SL = Math.round(ins.l * KU), SR = Math.round(ins.r * KU);
    const GW = W + SL + SR, GH = H + ST + SB;
    const BLEED = { W, H, cx: W / 2 + (SR - SL) / 2, cy: H / 2 + (SB - ST) / 2, w: GW, h: GH };
    return { W, H, PORTRAIT, ASPECT, KU, ST, SB, SL, SR, GW, GH, BLEED, DEAD: ins.dead || 0 };
  }

  // ----- browser only below -----

  function viewSize() {
    const el = document.getElementById('game'), r = el && el.getBoundingClientRect();
    return { w: Math.max((r && r.width) || window.innerWidth, 1), h: Math.max((r && r.height) || window.innerHeight, 1) };
  }

  // Safe-area insets in CSS px, read from the hidden #safe div (padding: env(safe-area-inset-*)).
  function insets() {
    const el = document.getElementById('safe');
    if (!el) return { t: 0, b: 0, l: 0, r: 0, dead: 0 };
    const cs = getComputedStyle(el), n = (v) => parseFloat(v) || 0;
    const i = { t: n(cs.paddingTop), b: n(cs.paddingBottom), l: n(cs.paddingLeft), r: n(cs.paddingRight) };
    // iOS 26 home-screen web app (WebKit bug 301108): the page is one status-bar height short and the home bar sits
    // below it, so nothing inside the page needs to keep clear of it
    const sh = Math.max(screen.width, screen.height), sw = Math.min(screen.width, screen.height);
    const full = window.innerHeight > window.innerWidth ? sh : sw;
    i.dead = navigator.standalone ? Math.max(0, full - window.innerHeight) : 0;
    if (i.dead < 8) i.dead = 0;
    i.b = Math.max(0, i.b - i.dead);
    return i;
  }

  // Full-screen rectangles (dims, flashes) cover the safe-area margins too: add.rectangle(W/2, H/2, W, H, c) just works.
  function patchRectangles() {
    const GOF = Phaser.GameObjects.GameObjectFactory.prototype;
    if (GOF.__ptRect) return;
    GOF.__ptRect = GOF.rectangle;
    GOF.rectangle = function (x, y, w, h, c, a) {
      const b = window.__ptBleed;
      if (b && x === b.W / 2 && y === b.H / 2 && w === b.W && h === b.H) { x = b.cx; y = b.cy; w = b.w; h = b.h; }
      return GOF.__ptRect.call(this, x, y, w, h, c, a);
    };
  }

  const FADE = 260;
  // iOS 26 strip: the scene's bottom edge fades into one flat colour and the page behind gets the same colour.
  function bottomFade(scene, L) {
    if (!L.DEAD || !scene.textures.exists('fadeB')) return;
    const f = scene.add.image(L.BLEED.cx, L.H + L.SB, 'fadeB').setOrigin(0.5, 1).setDisplaySize(L.GW + 8, FADE).setDepth(1000)
      .setTint(window.__ptFadeCol || 0x7fbf8f);
    (scene._ptFades = scene._ptFades || []).push(f);
  }
  function tintPage(game, L) {
    const r = game.renderer;
    if (!r || !r.snapshotPixel) return;
    try {
      // sample at the right edge (the version label sits bottom-left), just above the fade when there is one
      r.snapshotPixel(L.DEAD ? L.GW - 6 : L.GW - 6, L.DEAD ? L.GH - FADE - 6 : L.GH - 2, (c) => {
        if (!c) return;
        const n = (c.r << 16) | (c.g << 8) | c.b, col = 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
        document.documentElement.style.background = col;
        document.body.style.background = col;
        window.__ptFadeCol = n;
        game.scene.getScenes(true).forEach((sc) => (sc._ptFades || []).forEach((f) => f.active && f.setTint(n)));
      });
    } catch (e) {}
  }

  const api = { compute, viewSize, insets, patchRectangles, bottomFade, tintPage, FADE };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PTLayout = api;
})(typeof self !== 'undefined' ? self : this);
