# CLAUDE.md: Plush Titans

Tap-idle game on Phaser 3 where the heroes are a child's real toys. Spec: `README.md` (read it fully).
Lessons from the sister game: `docs/from-plush-squad.md` (section numbers below like "PS §5" point there).
Owner decisions: `docs/DECISIONS.md` (newest on top). They are rules; propose a change only as an explicit question.

Status: M0 done, battle mock-up approved (`mockup/battle.html`, the layout reference). **M1 in progress**, in PRs:
core (shell, PWA, layout, save, tests) -> battle -> squad -> Bedtime and Dreams -> parents -> + Toy -> audio.

---

## Owner and communication

- Owner / producer: Kondrat. Talk to him in **Russian, briefly**. He works almost only from his phone.
- Ping him only when a decision is needed. Ask decisions as tappable multiple-choice questions
  (AskUserQuestion), 3 to 5 per batch, one decision per question, recommended option first.
  Record each answer in `docs/DECISIONS.md`.
- Repo docs, code, commit messages: English. Plain, short prose, **no em-dashes**, mark guesses with [?], no flattery.
- Feedback from the chief tester (age 10), pasted by the owner, is the most important input.

## Public repo rules (law)

- No child's name, no family names, no e-mails, no real toy photos, no recovery codes.
  Say "our chief tester, age 10" and "the owner".
- No keys except the Supabase URL and PUBLISHABLE key (and only from M2). Never ask for, accept or commit a secret / service_role key.

## Play-fair rules (a feature that breaks one does not ship)

- No ads, no loot boxes, no paid randomness, no shop or purchase code before M3.
- Offline earnings capped at one night (`OFFLINE_CAP_H = 8`). A week away pays the same as one night.
  Clock moved back = 0 elapsed. Pay once, save at once (a second launch must not pay twice).
- Bedtime means bed: at the parent's bedtime the game offers Bedtime, then closes to the Bedtime screen.
  Good timing is rewarded, never punished. Never cut a running boss fight mid-way [?]: check when a screen opens.
- Streaks only add. Missing a day takes nothing away.
- No urgency timers aimed at the kid ("2 minutes left!"), no notifications in v1. The boss timer is
  gentle: drop back one stage, no loss of stars.
- Toy photos stay on the device unless the family shares a toy.
- Parent gate (multiplication 6-9 x 6-9 on a number pad) for settings, limits, resets, any purchase.
- Funny, never scary or violent: Titans giggle and fall asleep, they are not hurt.
- COPPA / GDPR-K in mind from day one.

## Process

1. Feature (new mechanic, world, Titan, hero, reward, balance change): `game-designer` agent writes a doc in
   `docs/gdd/` first, from real code values, with acceptance criteria. Owner approves. Bug fixes and hotfixes skip this.
2. One branch, one PR per task (`claude/<version-or-topic>`). Small, ordered commits.
   **Claude merges its own PRs** (owner decision 2026-10-27) when CI is green and QA found no S1/S2, then tells
   the owner in one short list. Still ask first for: anything waiting on his approval (the battle mock-up, design
   docs), Supabase changes, and anything that breaks a play-fair rule.
3. **Test first** for anything that touches the economy, saving, offline earnings or Bedtime.
   Test behaviour, not implementation. Fix root causes, not symptoms.
4. `/code-review` before the PR; fix Important findings; note them in the PR description.
5. `qa-tester` agent on the change (light pass by default: phone portrait + iPad landscape, diff only;
   full 5-size matrix for big releases). Report in `docs/qa/`. Any S1/S2 blocks the merge.
6. CI green. Every PR lists the **real-device checks** the owner must do on iPhone/iPad.
7. Tracker: GitHub issues. Bug IDs are `T01`, `T02`, ... (never `B`, those are Plush Squad's). Title starts
   with the ID; issue numbers stay after `#`. Labels: `bug` + `S1`-`S4`, `design`, `gdd`, `hotfix`.
8. Every PR adds a line to `docs/CHANGELOG.md`.

Agent cost rules: at most 2 agents at a time; resume an agent with SendMessage instead of starting a new one;
give each agent exact paths and rules up front. Agents use their own port and Playwright config. **Never `pkill -f`**
(it matches your own shell); find the PID and `kill <pid>`.

## Release checklist

1. Bump `VERSION` and the service-worker `CACHE` name together (`plushtitans-vX.Y.Z`).
2. Add every new file to the SW `FILES` list by hand (no build step) or it will not work offline.
3. "What's new" keyed by `major.minor`, only for minor versions, **never for hotfixes**.
4. Version label bottom-left on the title screen.
5. After merge check that the live `sw.js` shows the new `CACHE`.

## Architecture rules (do these from day one, PS §2, §7, §15.2)

- Phaser 3.90 (same major as Plush Squad), plain static files, no bundler, no npm runtime deps.
  `package.json` only for tests, Playwright pinned to an exact version.
- **Small core.** Scenes in separate files, shared UI helpers (`txt`, `fit`, `button`, `img`, `panel`, `fade`, ...)
  in one `js/ui.js`. Plugin registry (`window.PTPlugins`, a `PT` helpers object, `emit()` wrapped in try/catch).
  Idle events: `tap`, `upgrade`, `kill`, `boss`, `bedtime`, `offlineReward`, `milestone`, `scene`.
- **All balance constants in `js/economy.js`**, shared by the game and `sim/`. Nothing hard-coded in scenes.
  Pure functions, no Phaser, runnable in Node.
- Data in `js/data/` keyed by **string ids** (`'hills'`, `'bear'`), never array indexes. Order is a separate array.
- Economy driven by `Date.now()` deltas (capped per frame, with a catch-up step), never by frame counts.
- One number formatter for big numbers (K, M, B, ...), safe for `NaN`/`Infinity`, with a test on edge values.
- One date helper file (`todayKey()` local date, `dayNum()` calendar days). No `new Date()` scattered in scenes.
- Save: `localStorage` in try/catch, `v` schema number from day one, ordered idempotent migration steps
  (`if (d.v < 2) {...}`) that tolerate a partial save and never take anything away; a test per step on a
  hand-written old save. Save keys documented in `docs/save-format.md`. Export/import as JSON.
- Device-only prefs (volume, calm mode, handedness) in a separate key, never in the save.
- Debug API only with `?debug`: `window.__titans` with `tick(ms)`, `fastForward(hours)`, `setSave`, `giveStars`,
  `scene`, plus `__game`, `__save`. Tests live on these.

## Platform gotchas (PS §5, §6, §13)

- iPhone first: portrait, one hand, iPhone SE to iPad. Rotation must not lose state (snapshot `{scene, data}`, rebuild).
- Full-bleed canvas, buttons in the safe area: read `env(safe-area-inset-*)` from a hidden `#safe` div, offset the
  camera (`safeCam`). Handle the iOS 26 home-screen web-app bug (view one status-bar height short, strip below
  can only be coloured: `bottomFade` + `tintPage`). Recheck insets 700/2000/4000 ms after launch.
- Pointer code uses `p.worldX / p.worldY`, never `p.x / p.y`.
- DOM inputs float above the canvas: hide them under overlays. Block rotation while an input has focus.
- Never name a scene method `sound`.
- iOS Safari ignores `user-scalable=no`: fast taps double-tap-zoom the page. Prevent default on `touchend`,
  `gesturestart`, `dblclick` (non-passive) and drive DOM buttons from pointer events, not `click`.
- Scenes are reused by Phaser: reset every field in `init()`/`create()`, remove listeners and timers on `shutdown`.
- Layout from `W`, `H`, `PORTRAIT`, object sizes. No fixed pixel positions. Min text 24 game px, min tap target 90 game px
  with gaps and a press-down state. iPad landscape and iPad 4:3 break new screens first: test them.
- Every list that can grow needs pages or a scroll from the first version.
- Toasts: one queue, counted in one place, die with their scene, never cover the logo or the Titan.
- Audio: everything synthesized (Web Audio), `AudioContext` created inside the first tap, SFX and music buses,
  crossfade, suspend on `visibilitychange` hidden. Cheap tap sound, throttled. No music before the first tap.
- Calm mode (follows OS reduce-motion on first run) drops shake, endless tweens and confetti.
- Animations that spend something take the item at the END or cannot be skipped.
- Every reward gets a visible, readable announcement exactly once.
- Toy capture (later): copy the Plush Squad pipeline into `js/capture/` with a header naming the source commit.
  Load the worker only when + Toy opens, keep one worker for the page (survives rotation), WASM single thread.
  M1 must be fully playable without a camera.

## Tests

- Unit (Node, no deps): economy formulas, Dreams, offline cap (8 h == 7 days), clock back, boss timer fallback, save migration.
- Playwright (`tests/`): `boot()` seeds the save on `/manifest.json` before opening `/index.html?debug`,
  collects `pageerror`, blocks `*.supabase.co`; `fast()` calls `setLagSmooth(5000, 33)` on every scene's tweens
  (headless runs at 2-3 fps) and must run again after every scene start or rebuild; `noErrors()` at the end of every test.
- `page.evaluate` must never return Phaser objects (Playwright hangs). Do multi-step UI inside one `evaluate`.
- Pin dates in tests; seed all "seen" flags in `BASE_SAVE` so no popup appears in unrelated tests.
- After touching any result/reward code, test **every** path that reaches it. When changing a shared function, test every caller
  (e.g. open every world).
- Run 1-2 workers. CI: GitHub Actions on every push and PR, `ubuntu-24.04` pinned, shards before longer timeouts.

## Commands

```
npm test                              # unit tests: node --test 'tests/unit/*.test.js' (no install needed)
npm run sim                           # economy report -> docs/economy/report.md, day1.csv, days.csv
```

CI fails if `docs/economy/` is stale: after any change to `js/economy.js` or `sim/`, run `npm run sim` and commit the output.
Tests named "target: ..." in `tests/unit/sim.test.js` hold the owner's target feel; breaking one needs his OK.

Planned for M1: `python3 -m http.server 8765` (play at `/index.html?debug`), `npx playwright test`.

Keep this file accurate. Update it in the same PR when a command, path or rule changes.
