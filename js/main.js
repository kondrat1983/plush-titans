// Plush Titans: builds the Phaser game. Loads last (see index.html).
// main() builds the whole game for the current screen shape. On rotation the game is destroyed and main() runs again
// with a snapshot of the scene the child was in (pattern from Plush Squad, commit b4ce94b).
(function () {
  'use strict';
  const VERSION = '0.1.0';
  const DEBUG = /[?&]debug/.test(location.search);

  // one save for the page; it survives rebuilds
  const Save = PTSave.createSave();
  Save.load();
  window.__save = Save;

  function main(RESUME) {
    window.__ptBuilds = (window.__ptBuilds || 0) + 1; // how many times the game was built (tests check rebuilds)
    const INS = PTLayout.insets();
    const L = PTLayout.compute(PTLayout.viewSize(), INS);
    window.__ptBleed = L.BLEED;
    PTLayout.patchRectangles();

    // everything a scene needs, rebuilt for each screen shape
    const PT = { VERSION, DEBUG, RESUME, L, W: L.W, H: L.H, PORTRAIT: L.PORTRAIT, Save, E: window.PTEconomy, U: window.PTUtil };
    PT.ui = PTUI.make(PT);
    // plugins (window.PTPlugins: { name, scenes(PT), onEvent(name, data, scene, PT) }) hang on events and never touch
    // scene code; one broken plugin never stops the game. Events: scene, tap, upgrade, kill, boss, bedtime, offlineReward, milestone
    const plugins = window.PTPlugins || [];
    PT.emit = (name, data, scene) => plugins.forEach((p) => { try { p.onEvent && p.onEvent(name, data, scene, PT); } catch (e) { console.warn('plugin', p.name, e); } });
    const scenes = (window.PTScenes || []).map((f) => f(PT))
      .concat(...plugins.map((p) => { try { return p.scenes ? p.scenes(PT) : []; } catch (e) { console.warn('plugin scenes', p.name, e); return []; } }));

    const safeCam = (sc) => sc.cameras.main.setScroll(-L.SL, -L.ST);
    const game = new Phaser.Game({
      type: Phaser.AUTO, parent: 'game', backgroundColor: '#b9a7f0', width: L.GW, height: L.GH,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      fps: { smoothStep: !DEBUG },
      input: { activePointers: 3 },
      render: { antialias: true, powerPreference: 'high-performance' },
      scene: scenes,
    });
    game.events.once('ready', () => game.scene.scenes.forEach((sc) => {
      sc.events.on('start', () => { safeCam(sc); sc._ptFades = []; sc._ptLeaving = false; sc._ptTarget = null; });
      sc.events.on('create', () => {
        safeCam(sc);
        if (sc.scene.key === 'boot') return;
        PT.emit('scene', { key: sc.scene.key }, sc);
        // a new version arrived during play: reload now, on the title screen, never in the middle of a fight
        if (sc.scene.key === 'title' && window.__ptReloadPending) { Save.store(); location.reload(); return; }
        if (window.__ptRotatePending) sc.time.delayedCall(100, () => window.__ptTryRebuild());
        [700, 2200].forEach((t) => sc.time.delayedCall(t, () => PTLayout.tintPage(game, L)));
      });
    }));

    window.__game = game;
    window.__ptPortrait = L.PORTRAIT;
    window.__ptAspect = L.W / L.H;
    window.__ptInsets = INS;
    window.__ptSnapshot = () => snapshot(game);
    // hold a rotation while a text field has focus (the keyboard resizes the window), a toast is up,
    // or the scene says it is busy (scene.blockRotate())
    window.__ptBlockRotate = () => {
      if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return true;
      if (window.__ptToasts > 0) return true;
      const sc = game.scene.getScenes(true).find((s) => s.scene.key !== 'boot');
      return !!(sc && sc.blockRotate && sc.blockRotate());
    };
    if (DEBUG) {
      window.__titans = {
        VERSION, L,
        scene: (key, data) => { const sc = game.scene.getScenes(true)[0]; sc.scene.start(key, data || {}); },
        active: () => game.scene.getScenes(true).map((s) => s.scene.key),
        save: () => Save.data,
        setSave: (d) => { Save.data = PTSave.migrate(d); Save.store({ keepTime: true }); },
        giveStars: (n) => { Save.data.run.stars += n; Save.store(); },
        // tick(ms) and fastForward(hours) come with the battle scene (the economy loop lives there)
      };
    }
  }

  // { key, data } of the scene to come back to after a rebuild
  function snapshot(game) {
    const sc = game.scene.getScenes(true).find((s) => s.scene.key !== 'boot');
    if (!sc) return null;
    if (sc._ptLeaving && sc._ptTarget) return sc._ptTarget; // the child already tapped their way out
    const data = sc.snapshot ? sc.snapshot() : Object.assign({}, sc.sys.settings.data || {});
    return { key: sc.scene.key, data };
  }

  let built = false, rotT = 0;
  function rebuild(target) {
    const snap = target || (window.__ptSnapshot && window.__ptSnapshot());
    try { Save.store(); } catch (e) {} // anything changed in memory survives the rebuild (PS QA B47)
    const old = window.__game;
    if (old) { try { old.destroy(true); } catch (e) {} }
    window.__game = null;
    window.__ptToasts = 0;
    main(snap);
  }
  window.__ptRebuild = rebuild;

  function viewChanged() {
    const v = PTLayout.viewSize(), i = PTLayout.insets(), o = window.__ptInsets || i;
    const uw = v.w - i.l - i.r, uh = v.h - i.t - i.b, p = uh > uw;
    const g = PTLayout.compute(v, i);
    const same = ['t', 'b', 'l', 'r'].every((k) => Math.abs(i[k] - o[k]) < 2);
    return !(same && p === window.__ptPortrait && Math.abs(g.W / g.H - window.__ptAspect) / window.__ptAspect < 0.03);
  }
  window.__ptTryRebuild = () => {
    if (!built || !viewChanged()) { window.__ptRotatePending = false; return; }
    if (window.__ptBlockRotate && window.__ptBlockRotate()) { window.__ptRotatePending = true; return; }
    window.__ptRotatePending = false;
    rebuild();
  };
  window.addEventListener('resize', () => { clearTimeout(rotT); rotT = setTimeout(() => window.__ptTryRebuild(), 300); });
  window.addEventListener('orientationchange', () => setTimeout(() => window.__ptTryRebuild(), 400));
  window.addEventListener('pageshow', () => setTimeout(() => window.__ptTryRebuild(), 400));
  // a fresh iOS home-screen web app can settle its size and insets after launch with no resize event
  [700, 2000, 4000].forEach((t) => setTimeout(() => window.__ptTryRebuild(), t));
  // save when the app goes to the background (iOS sends no pagehide on app switch or lock)
  document.addEventListener('visibilitychange', () => { if (document.hidden) Save.store(); });
  window.addEventListener('pagehide', () => Save.store());

  // first text must never show in a fallback font: wait for Poppins, but at most 3 s
  const fonts = document.fonts && document.fonts.load
    ? Promise.all([document.fonts.load('700 40px Poppins'), document.fonts.load('500 40px Poppins')]).catch(() => {})
    : Promise.resolve();
  Promise.race([fonts, new Promise((r) => setTimeout(r, 3000))]).then(() => { built = true; main(null); });
})();
