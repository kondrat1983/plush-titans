# Plush Titans v0.1.0-core: QA Report (light pass)

Branch `claude/readme-spec-0e8i6f`, diff `6b377b7..HEAD` (4 commits, `docs/gdd/` excluded). Tester: `qa-tester` agent.
Date 2026-10-27. Headless Chromium (Playwright 1.63.0, SwiftShader, about 5 fps). Own ports 8791 (suite) and 8792 (scratch).

## 0. Summary and verdict

Verdict: **ship** (no S1, no S2). Fix T01 and T02 before the battle scene lands on top of them.

- Unit tests 57/57 pass. Playwright 9/9 pass (2 workers, own config copy, `reuseExistingServer: false`).
- 0 page errors in every scripted run (5 sizes plus 1180x820, rotation, corrupt saves, offline, no-debug mode).
- Rotation: 20 fast flips and 20 slow flips leave exactly one `<canvas>`, the save is unchanged.
- Offline: with the service worker installed, the game opens offline from `/`, `/index.html` and `/index.html?debug`.
  Every file the page loads is in `FILES` and in the cache.
- Found 8 issues: 3 x S3, 5 x S4. Two S3 are latent (no UI reaches them in 0.1.0).

## 1. Fix verification

First report, nothing to verify.

## 2. Regression results

| Item | Result |
|---|---|
| Offline 8 h vs 7 days, clock back, second launch | N/A in this change (no offline payout code yet; `tick` and `fastForward` not in the debug API yet) |
| Bedtime resets run, keeps Dreams; bedtime from Parents | N/A (no Bedtime yet) |
| Boss timer runs out | N/A (no battle yet) |
| Rotation, 20 flips, one canvas | PASS. Fast flips (60 ms apart): 3 builds, 1 canvas. Slow flips (800 ms): 23 builds, 1 canvas. Stage 23 and 12400 stars kept. Flip during boot (before fonts and art): 1 build, title opens. Flip and flip back inside 300 ms: no rebuild. |
| Rotation with a toast up | PASS for state (count back to 0, one canvas, 0 errors, rebuild runs right after the last toast). See T01 for how long it waits. |
| Tab hidden / visible | PASS: hidden stores the save (`savedAt` set), toasts keep draining after visible, 0 errors. Real app switch not tested (IOS-08). |
| Huge numbers formatting | PASS: `fmt` on 0, -0, -1, 0.999, 999.999, 1000, 999999.999, 1e15, 2^53, 1.7e308, `Number.MAX_VALUE`, `Infinity`, `-Infinity`, `NaN`, `undefined`, `null`, `[]`, `{}`. Sweep 1e0..1e307 in steps of 10^0.0007: never goes down, never shows more than the value, at most 6 characters. |
| Save migration | PASS for 13 hand-made saves (not JSON, empty, `null`, number, array, string, `run` as array, NaN-ish fields, numeric strings, future `v: 7` with unknown fields, 1.7e308 stars, `savedAt` a year ahead, `__proto__` key): no errors, unknown fields and `v: 7` kept, migrate is idempotent. See T05, T07. |
| Every scene opens with 0 errors, portrait and landscape | PASS (boot, title) on D1-D5 and 1180x820. |
| Leave and re-enter every scene | PASS: title restarted 8 times (also with toasts queued): scene event listener counts stay the same, child count stays 11, toast count goes to 0. |
| `?debug` off | PASS: no `window.__titans` without `?debug`, 0 errors. |

Other checks:
- Fast taps: 20 taps on + TOY in a row: 20 toasts logged, all queued, count drains to 0 (after about 45 s, see T01). 0 errors.
- Two fingers (CDP touch, + TOY and PARENTS at once): both answer, both toasts queue. Buttons spring back to scale 1.00.
- Direct `__ptRebuild()` with a toast up: count goes to 0, no leak.
- Service worker online reload: code files go network-first (server hits for `index.html?debug` and every `js/` file), Phaser and fonts come from the cache.

## 3. Bug status

| ID | Sev | Title |
|---|---|---|
| T01 | S3 | Toast queue has no limit: fast taps queue every copy and block rotation for up to a minute |
| T02 | S3 | A button fires when a finger is lifted on it, even if the press started somewhere else |
| T03 | S4 | iPad portrait 768x1024 (4:3) is not full-bleed: green bars left and right |
| T04 | S4 | Landscape iPad: the title Titan's arm touches the PLAY button |
| T05 | S3 | A save that fails to parse is overwritten with a fresh one at the next store, no backup kept |
| T06 | S3 | `importJSON` accepts any JSON with a number `v` and an object `run` (latent, no import UI yet) |
| T07 | S4 | `migrate` resets numeric strings to defaults and keeps `parents` values unchecked (latent) |
| T08 | S4 | Title differs from GDD 4.1: the Titan is awake and PARENTS is not in a corner [?] |

### T01 (S3) Toast queue has no limit; rotation waits for all of it
Steps: D2 390x844, title. Tap + TOY 20 times fast. Rotate to 844x390.
Expected: one message per tap is not needed; the same text is not queued again while it shows or waits, and a rotation
follows the screen within about a second.
Actual: 20 identical toasts are queued (`__ptToastLog` 20, `__ptToasts` 15 after the taps). Each lasts about 2.35 s.
`__ptBlockRotate` holds the rebuild while `__ptToasts > 0`, so the game stays in the portrait layout, letterboxed small in
the middle of a landscape screen, for 33 s after the flip (measured). A 10-year-old taps a "not yet" button many times
and turns the iPad: the screen looks broken for half a minute. Screenshot: scratchpad `blocked_rotation.png`.
Root cause: `ui.toast` pushes every call; nothing drops duplicates or caps the queue (js/ui.js `toast`).
Idea: skip a text that is already showing or queued, and/or cap the queue (for example 3), or let a rotation drop
waiting toasts that are not reward announcements.

### T02 (S3) Button fires on release without a press on it
Steps: D2, touch emulation. (a) Touch + TOY, slide to PARENTS, lift. (b) Touch the sky 200 px above PLAY, slide down onto PLAY, lift.
Expected: nothing happens (the finger did not press that button), like a native button.
Actual: (a) the PARENTS toast shows; (b) the PLAY toast shows ("The battle is being built..."). Log:
`["Toy photos...", "Parents area...", "Parents area...", "The battle is being built..."]` (first two are a two-finger tap).
Root cause: `ui.button` runs `cb` on any `pointerup` over the container (js/ui.js `button`), with no check that
`pointerdown` happened on the same button. Harmless now; once the Squad list scrolls or a Titan is tapped near LEVEL UP,
a swipe that ends on a buy button would spend stars. Fix before buy buttons exist.

### T03 (S4) iPad portrait 4:3 has side bars
Steps: open at 768x1024 (also iPad 10.2 810x1080).
Expected: full-bleed sky and hills to every edge.
Actual: canvas is 737 px wide at x=15, the page shows green bars (`#7fbf8f`, later the tinted page colour) full height on
both sides; the sky is purple next to them. Root cause: `PTLayout.compute` clamps portrait `H` to at least 1500, so a 0.75
aspect gives 1080x1500 (0.72) and `Scale.FIT` letterboxes. Screenshot: scratchpad `title_D3_768x1024.png`.

### T04 (S4) Titan arm touches PLAY in iPad landscape
Steps: 1024x768 or 1180x820, title.
Actual: Titan right arm reaches about x=627 (1024x768) and x=677 (1180x820) game px; the PLAY card starts at x=619 and x=677.
They touch or overlap a few px, more while the Titan bobs. Screenshot: scratchpad `title_D4_toast.png`.

### T05 (S3) Unreadable save is replaced silently
Steps: `localStorage.plushtitans_v1 = '{not json'` (same for `''`, `null`, an array, a string). Open, then hide the tab.
Expected: the game starts fresh (it does) and the unreadable text is kept somewhere (for example `plushtitans_v1_bad`) so
the owner can recover it.
Actual: the next `store()` (visibilitychange, pagehide, rebuild) writes a fresh save over it. The old text is gone.
Severity S3 not S1: our code never writes bad JSON [?]; the risk is a broken write or a hand-edited save.

### T06 (S3, latent) Import takes a foreign save
Steps (unit): `createSave().importJSON('{"v":3,"run":{"gold":5}}')`.
Expected: refused (not a Plush Titans save, per the comment in js/save.js and docs/save-format.md).
Actual: returns `true`, the whole progress becomes stage 1, 0 stars (plus a stray `gold` field). A parent picking a
Plush Squad export [?] or any other JSON wipes the run. No UI reaches this in 0.1.0; fix before the Parents import ships
(for example a `game: 'plushtitans'` marker on export, or require known fields).

### T07 (S4, latent) Migration edge cases
- `{"run":{"stage":"23","stars":"12400"}}` loads as stage 1, 0 stars. The save rule is "never takes anything away";
  `Number(x)` before the check would keep them. Our code writes numbers, so only a hand-edited or synced save hits this [?].
- `parents.bedtime: 12345`, `parents.limitMin: -7` pass through unchanged. Bedtime and limit code will read these; check
  them in `migrate` when that code lands.
- `run.heroes` keeps an empty-string id (`{"": 2}`).

### T08 (S4) Title vs GDD 4.1 [?]
GDD 4.1: "a sleeping Titan bobbing", "Parents (corner, 90 px or more)". Build: the Titan has open eyes and a smile;
PARENTS is a half-width button next to + TOY. May be on purpose for this core step (mock-up look). Needs the dev or
the owner to say which is right.

## 4. Layout matrix

Light pass sizes D2 and D4, plus D1, D3, D5 and 1180x820 because they were cheap. Checker: display-list walk, text and
tap sizes in game px, items outside W x H, overlaps.

| Size | Game size | Off screen | Text < 24 | Tap < 90 | Overlaps | Notes |
|---|---|---|---|---|---|---|
| D1 375x667 | 1080x1921 | none | none (min 36) | none | logo lines only (by design) | OK |
| D2 390x844 | 1080x2337 | none | none | none | logo lines only | OK; toast sits under the buttons, clear of logo and Titan |
| D3 768x1024 | 1080x1500 | none | none | none | logo lines only | T03 side bars |
| D4 1024x768 | 1440x1080 | none | none | none | logo lines only | T04 arm touches PLAY |
| D5 844x390 | 2337x1080 | none | none | none | logo lines only | OK |
| 1180x820 | 1554x1080 | none | none | none | logo lines only | T04 |

Screenshots (not committed, public repo rule; in the tester's scratchpad):
`title_D1_375x667.png`, `title_D2_390x844.png`, `title_D3_768x1024.png`, `title_D4_1024x768.png`, `title_D5_844x390.png`,
`title_D*_toast.png`, `blocked_rotation.png`, `offline_title.png`.

## 5. Ideas for the test suite

1. Toast flood: 20 real taps on + TOY, then rotate; expect the rebuild within a few seconds (fails today, T01).
2. Slide-onto-button: touch down off a button, move onto it, lift; expect no callback (fails today, T02).
3. Unit: `importJSON` refuses a JSON without the Titans shape (fails today, T06); `migrate` keeps numeric strings (T07).
4. Unit: a corrupt raw save is kept in a backup key after the first store (T05).
5. Offline e2e: register `sw.js` by hand on localhost (the page only registers on https), wait for the controller,
   `context.setOffline(true)`, reload, expect the title with 0 errors. Worked in this pass in about 20 s.
6. Release unit test: also compare `performance.getEntriesByType('resource')` from a boot with `FILES` (catches files
   loaded at runtime, like future workers or audio, that the static walk might miss).
7. Listener leak check: restart the title 5 times, `events.listenerCount('start'|'shutdown')` must not grow.
8. The suite runs with `fps.smoothStep: false` (debug only). One smoke test without `?debug` would cover the real config.
9. Add 768x1024 to the "fits" test with a check that the canvas fills the viewport (catches T03).
10. CI uses `npm install`; `npm ci` would fail on a lockfile drift instead of silently updating.

## 6. Not tested

Real device (the owner's checklist):
- IOS-01 Safe areas on a notched iPhone, portrait and landscape: buttons clear of the notch and the home bar; sky fills behind the status bar.
- IOS-02 iOS 26 home-screen web app: strip under the page is tinted to match the hills (`bottomFade` + `tintPage`), no white band.
- IOS-03 iPad in Stage Manager or Split View as a home-screen app: `insets()` takes `screen` minus `innerHeight` as the iOS 26 strip; on a smaller window this may drop the bottom inset and draw the fade [?].
- IOS-04 Fast double taps on any button never zoom the page; pinch does nothing.
- IOS-05 Poppins shows on first open (no fallback font flash); title text is crisp.
- IOS-06 Pictures (SVG made into textures) show on Safari WebGL, nothing missing or black.
- IOS-07 Rotate the phone and the iPad 20 times on the title, also while a toast shows: one game, no freeze.
- IOS-08 Switch apps and lock the screen on the title, come back: same screen, no reload, no errors.
- IOS-09 Add to home screen: icon, name "Plush Titans", opens full screen; works in flight mode after one online open.
- IOS-10 Update flow: after the next version is deployed, the home-screen app reloads once on the title screen only.
- IOS-11 Two fingers on + TOY and PARENTS: both messages show, one after the other.
- IOS-12 Safari private mode: the game opens and plays (storage may fail silently).

Online: no online code in this change. ON-01: after merge, the live `sw.js` shows `CACHE = 'plushtitans-v0.1.0'` (release checklist 5).
