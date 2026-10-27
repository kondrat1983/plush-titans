// Shared UI helpers for every scene (window.PTUI.make(PT) -> helpers). Ported in spirit from Plush Squad js/game.js.
// Sizes are game units (W = 1080 in portrait). MIN_TEXT and MIN_TAP are the floor for anything a child reads or taps.
(function (root) {
  'use strict';

  const C = {
    sky1: 0xb9a7f0, sky2: 0xffd3c2, hill0: 0xbfe6c4, hill1: 0xa6dcb0, hill2: 0x7fbf8f,
    ink: '#3a2c5c', inkN: 0x3a2c5c, card: 0xfff8f0, gold: 0xffc83d, moon: 0x2d2a6e, pink: 0xff7aa8, white: 0xffffff,
  };
  const FONT = 'Poppins, "Arial Rounded MT Bold", Arial, sans-serif';
  const MIN_TEXT = 36;
  const MIN_TAP = 120;

  function make(PT) {
    const W = PT.W, H = PT.H, L = PT.L;

    function txt(scene, x, y, s, size, color, o) {
      o = o || {};
      if (size < MIN_TEXT && PT.DEBUG) console.warn('text below MIN_TEXT:', s, size);
      const t = scene.add.text(x, y, s, {
        fontFamily: FONT, fontStyle: o.weight || 'bold', fontSize: size + 'px', color: color || C.ink,
        stroke: o.stroke || C.ink, strokeThickness: o.stroke ? Math.round(size / 7) : 0,
        align: o.align || 'center', wordWrap: o.wrap ? { width: o.wrap, useAdvancedWrap: true } : undefined,
      }).setOrigin(o.ox == null ? 0.5 : o.ox, o.oy == null ? 0.5 : o.oy);
      if (o.shadow) t.setShadow(0, Math.round(size / 12), 'rgba(58,44,92,0.6)', 0, true, true);
      return t;
    }
    // shrink a text to a max width, but never below MIN_TEXT (a longer text needs a wrap or a shorter label)
    const fit = (t, maxW) => {
      if (t.width <= maxW) return t;
      const size = parseFloat(t.style.fontSize) || MIN_TEXT;
      t.setScale(Math.max(maxW / t.width, Math.min(1, MIN_TEXT / size)));
      if (PT.DEBUG && t.displayWidth > maxW + 1) console.warn('text does not fit at MIN_TEXT:', t.text);
      return t;
    };
    const tw = (scene, cfg) => new Promise((r) => scene.tweens.add(Object.assign({}, cfg, { onComplete: () => { cfg.onComplete && cfg.onComplete(); r(); } })));
    const wait = (scene, ms) => new Promise((r) => scene.time.delayedCall(ms, r));

    // rounded card with a soft drop shadow, like the mock-up (shadow 0 4px 0 at 25%)
    function card(scene, x, y, w, h, color, o) {
      o = o || {};
      const r = o.r == null ? Math.min(56, h / 2.4) : o.r;
      const g = scene.add.graphics();
      g.fillStyle(C.inkN, 0.25); g.fillRoundedRect(x - w / 2, y - h / 2 + 11, w, h, r);
      g.fillStyle(color == null ? C.card : color, o.alpha == null ? 1 : o.alpha); g.fillRoundedRect(x - w / 2, y - h / 2, w, h, r);
      return g;
    }

    // press-down feedback: shrink on touch, spring back on release (QA lesson B27)
    function press(scene, c, k) {
      k = k || 0.94;
      const rest = c.scaleX;
      let own = null;
      const go = (scale, duration, ease) => { if (own) own.stop(); own = scene.tweens.add({ targets: c, scale, duration, ease }); };
      c.on('pointerdown', () => go(rest * k, 70));
      c.on('pointerup', () => go(rest, 220, 'Back.out'));
      c.on('pointerout', () => go(rest, 120));
      return c;
    }

    // a big rounded button; cb runs on release over the button
    function button(scene, x, y, w, h, label, cb, o) {
      o = o || {};
      w = Math.max(w, MIN_TAP); h = Math.max(h, MIN_TAP);
      const c = scene.add.container(x, y);
      const g = card(scene, 0, 0, w, h, o.color == null ? C.gold : o.color, { r: h / 3 });
      const parts = [g];
      let ix = 0;
      if (o.icon) {
        const ic = scene.add.image(0, 0, o.icon);
        ic.setScale((o.iconSize || h * 0.5) / ic.height);
        parts.push(ic);
        ix = label ? ic.displayWidth / 2 + 12 : 0;
        ic.x = label ? -ix : 0;
      }
      if (label) {
        const t = fit(txt(scene, ix, 0, label, o.size || 60, o.textColor || C.ink), w - 60 - ix * 2);
        if (o.icon) { const total = parts[1].displayWidth + 24 + t.displayWidth; parts[1].x = -total / 2 + parts[1].displayWidth / 2; t.x = parts[1].x + parts[1].displayWidth / 2 + 24 + t.displayWidth / 2; }
        parts.push(t);
        c.label = t;
      }
      c.add(parts);
      c.setSize(w, h).setInteractive({ useHandCursor: true });
      press(scene, c);
      // only a press that started on this button counts: sliding a finger onto it does nothing (QA T02)
      c.on('pointerdown', () => { c._ptDown = true; });
      c.on('pointerout', () => { c._ptDown = false; });
      c.on('pointerup', () => { const ok = c._ptDown; c._ptDown = false; if (ok && c.input && c.input.enabled && cb) cb(); });
      return c;
    }

    // A short message. One at a time: a new one waits in the scene's queue (every message is seen, once).
    // It sits where the scene says (scene.toastY), clear of the logo and the Titan; it dies with its scene.
    // window.__ptToasts counts shown + waiting toasts for the rotation guard.
    const TOAST_MAX = 3; // waiting messages; more taps on the same button never pile up (QA T01)
    function toast(scene, text, ms) {
      const q0 = scene._ptToastQ || [];
      if ((scene._ptToast && scene._ptToast._text === text) || q0.some((x) => x[0] === text) || q0.length >= TOAST_MAX) return;
      if (PT.DEBUG) (window.__ptToastLog = window.__ptToastLog || []).push(text); // tests read what was shown
      window.__ptToasts = (window.__ptToasts || 0) + 1;
      if (!scene._ptToastQ) {
        scene._ptToastQ = [];
        scene.events.once('shutdown', () => {
          window.__ptToasts = Math.max(0, (window.__ptToasts || 0) - scene._ptToastQ.length - (scene._ptToast ? 1 : 0));
          scene._ptToastQ = null; scene._ptToast = null;
        });
      }
      scene._ptToastQ.push([text, ms || 2000]);
      if (!scene._ptToast) showNext(scene);
    }
    function showNext(scene) {
      const q = scene._ptToastQ;
      if (!q || !q.length) return;
      const [text, ms] = q.shift();
      const y = scene.toastY != null ? scene.toastY : H * 0.5;
      const t = txt(scene, 0, 0, text, 44, C.ink, { wrap: Math.min(W - 160, 900) });
      const w = Math.min(t.width + 90, W - 80), h = t.height + 60;
      const c = scene.add.container(W / 2, y, [card(scene, 0, 0, w, h, C.card), t]).setDepth(900).setAlpha(0);
      scene._ptToast = c;
      c._text = text;
      scene.tweens.add({ targets: c, alpha: 1, duration: 150 });
      scene.time.delayedCall(ms, () => scene.tweens.add({ targets: c, alpha: 0, duration: 200, onComplete: () => {
        c.destroy();
        scene._ptToast = null;
        window.__ptToasts = Math.max(0, (window.__ptToasts || 1) - 1);
        showNext(scene);
        if (!scene._ptToast && window.__ptRotatePending && window.__ptTryRebuild) window.__ptTryRebuild();
      } }));
    }

    // the sky, the pillow hills and two clouds, bleeding under the status bar and home bar
    function scenery(scene) {
      const B = L.BLEED, x0 = B.cx - B.w / 2, y0 = B.cy - B.h / 2;
      const g = scene.add.graphics().setDepth(-10);
      const horizon = PT.PORTRAIT ? H * 0.62 : H * 0.58;
      g.fillGradientStyle(C.sky1, C.sky1, C.sky2, C.sky2, 1); g.fillRect(x0, y0, B.w, horizon - y0);
      g.fillStyle(C.hill1); g.fillRect(x0, horizon, B.w, B.h);
      const hill = (color, y, amp) => {
        g.fillStyle(color);
        const pts = [];
        for (let i = 0; i <= 24; i++) {
          const x = x0 + B.w * i / 24;
          pts.push({ x, y: y - amp * Math.sin(i / 24 * Math.PI * 2.2 + y) });
        }
        pts.push({ x: x0 + B.w, y: y0 + B.h }, { x: x0, y: y0 + B.h });
        g.fillPoints(pts, true);
      };
      hill(C.hill0, horizon - 20, 40);
      hill(C.hill1, horizon + (H - horizon) * 0.3, 50);
      hill(C.hill2, horizon + (H - horizon) * 0.62, 40);
      const cl = (x, y, s) => scene.add.image(x, y, 'cloud').setScale(s).setAlpha(0.8).setDepth(-9);
      cl(W * 0.18, horizon * 0.42, 0.75); cl(W * 0.8, horizon * 0.55, 0.95);
      PTLayout.bottomFade(scene, L);
      return g;
    }

    function versionLabel(scene) {
      return txt(scene, 24, H - 16, 'v' + PT.VERSION, MIN_TEXT, C.ink, { ox: 0, oy: 1, weight: '500' }).setAlpha(0.7).setDepth(50);
    }

    function fade(scene, key, data) {
      if (scene._ptLeaving) return;
      scene._ptLeaving = true;
      scene._ptTarget = { key, data: data || {} }; // a rotation during the fade rebuilds straight into it (PS QA B38)
      scene.cameras.main.fadeOut(220, 58, 44, 92);
      scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
    }

    return { C, FONT, MIN_TEXT, MIN_TAP, txt, fit, tw, wait, card, press, button, toast, scenery, versionLabel, fade };
  }

  root.PTUI = { make, C, FONT, MIN_TEXT, MIN_TAP };
})(typeof self !== 'undefined' ? self : this);
