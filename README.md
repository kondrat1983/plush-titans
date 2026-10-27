# Plush Titans: spec for Claude Code

**Owner / producer:** Kondrat (call him Кондрат). Talk to him in Russian, briefly.
**What:** a tap-idle game where the heroes are a child's real toys, photographed in the game.
**Grows out of:** Plush Squad (live web game, repo `kondrat1983/plush-squad`). Same family, separate repo.
**Repo:** `plush-titans`, public, GitHub Pages from `main`. Kondrat works almost only from his phone.
**Pitch:** `docs/pitch/Plush_Titans_pitch.pdf` (v0.1, 25 Oct 2026), if Kondrat uploads it.

---

## 0. How to work in this repo

1. Read this file fully. Then read `docs/from-plush-squad.md` if it exists (best practices exported
   from the Plush Squad session). If this session also has access to `kondrat1983/plush-squad`,
   read its `CLAUDE.md`, `docs/`, `js/` and `tests/` before writing anything: reuse, do not reinvent.
2. Write `CLAUDE.md` with the rules below plus what you learned from Plush Squad. Commit it.
3. Create two subagents in `.claude/agents/`, modelled on Plush Squad's:
   - `game-designer`: owns `docs/gdd/`, designs from real code values, one doc per feature,
     writes acceptance criteria for QA.
   - `qa-tester`: owns `docs/qa/`, runs Playwright, files bugs as `T01`, `T02`, ... (T for Titans,
     so IDs never collide with Plush Squad's `B` bugs).
4. Ask Kondrat the open questions (section 11) in batches of 3 to 5, each with a recommended
   answer. Record answers in `docs/DECISIONS.md`.
5. Order of work: **M0 economy simulator, then a static mock-up of the battle screen on Pages for
   Kondrat to approve on his iPhone, then M1.** No production game code before the mock-up is approved.
6. Every change that touches the economy, saving, offline earnings or Bedtime gets a test first.
7. Small, ordered commits. One feature per PR. Kondrat merges.
8. **Public repo rules:** no child's name, no real toy photos, no keys except the Supabase
   publishable key. The chief tester is "our chief tester, age 10".
9. Device checks on a real iPhone/iPad are Kondrat's. List what he must check in each PR.

---

## 1. The game in one paragraph

A child photographs a favourite toy and it becomes a hero. Tapping throws pillows at a giant plush
Titan; the squad also hits on its own (passive DPS). Defeated Titans drop stars, stars level up
heroes and tap power. Every 10th stage is a boss Titan. When the day is done it is **Bedtime**:
the run resets and the **Dreams** earned stay as permanent upgrades, so tomorrow goes further and
faster. Bedtime is the prestige loop and also the game's way of saying goodnight.

## 2. Design rules that never bend (play fair)

These are rules, not settings. A feature that breaks one does not ship.

- No ads. No loot boxes. No paid randomness of any kind.
- **Offline earnings stop at one night (8 h).** A week away pays the same as one night.
- **Bedtime means bed.** When the parent's bedtime arrives, the game offers Bedtime, then closes to
  the Bedtime screen. Good timing is rewarded, never punished.
- Streaks only add. Missing a day never takes anything away.
- Toy photos stay on the device unless the family shares a toy with friends.
- Parent gate (same idea as Plush Squad: a multiplication question) for purchases and settings;
  play-time limits; COPPA and GDPR-K in mind from day one.
- No timers that create urgency ("only 2 minutes left!"). No notifications in v1.

## 3. Tech stack (decided 27 Oct 2026)

- **Phaser 3**, plain static files, no build step if possible (Plush Squad uses Phaser 3.90; use
  the same major version so code can be shared).
- **PWA** on GitHub Pages: installable, works offline after first load. Same service-worker and
  cache-version discipline as Plush Squad.
- **Toy capture: reuse the Plush Squad on-device pipeline** (transformers.js with background
  removal and the MobileCLIP model, vendored, running in the browser). For v1 copy the module into
  `js/capture/` with a header comment naming the Plush Squad commit it came from. Do not rewrite.
- **Audio:** reuse the Plush Squad Web Audio approach (everything synthesized, separate SFX and
  music buses, per-track gain, crossfade between tracks, context suspended on `visibilitychange`).
- **Accounts and cloud saves: not in M1.** M1 saves locally. M2 decides whether to share Plush
  Squad's Supabase project (one account for both games) with separate tables `titans_*`.
- Store builds (Capacitor) are M3. Nothing in M1/M2 may depend on native APIs.
- Godot was considered and rejected for this game: camera pipeline, accounts and tests already
  exist in JS, and Kondrat works from a phone.

## 4. Platform rules (learned on Plush Squad, keep them)

- **iPhone first.** Portrait, one hand, works from iPhone SE to iPad. Rotation must not lose
  state.
- **Full-bleed iOS layout:** the scene bleeds under the status bar and home bar; buttons stay in
  the safe area (read `env(safe-area-inset-*)` from a hidden element, offset the camera). Reuse
  Plush Squad's solution, including the **iOS 26 home-screen web app bug** where the web view is
  one status-bar height short and the strip below can only be coloured, not drawn on.
- Pointer code uses world coordinates (`p.worldX/worldY`) when the camera is offset.
- DOM inputs float above the canvas: hide them under overlays.
- Never name a Phaser scene method `sound`.
- Headless Playwright runs at 2 to 3 fps: Phaser tween lag smoothing turns long frames into 33 ms,
  so call `setLagSmooth(5000, 33)` on scene tweens before waiting. Run with 1 to 2 workers.
- After touching any result/reward code, test **every** mode that reaches it (a Plush Squad
  regression crashed the result screen in two modes that nobody re-ran).

## 5. M0: economy simulator (first deliverable)

Goal: numbers on paper before any art. A Node script (no Phaser) in `sim/` with unit tests.

**Model, all constants in one file `js/economy.js` shared by the game and the sim:**

- Stage HP: `hp(s) = HP0 * G^(s-1)`, boss stages (every 10th) multiply by `BOSS_MUL`.
- Stars per kill: `stars(s) = STAR0 * G_STAR^(s-1)`, boss bonus `BOSS_STARS`.
- Tap damage: `tap(l) = TAP0 * l * TAP_BONUS(dreams)`.
- Hero DPS: each hero has `dps(l) = DPS0_h * l * milestone multipliers` (x2 at levels 10, 25, 50,
  100, ...). Level cost `cost(l) = C0_h * R^l`.
- Boss timer: a boss must fall in `BOSS_TIME` seconds or the player drops back one stage
  (gentle: no loss of stars).
- Dreams at Bedtime: `dreams(maxStage) = floor((maxStage / D_DIV) ^ D_EXP)`, minimum stage to
  earn any: `D_MIN`.
- Dream upgrades (night-lights, blanket forts, lullabies): permanent multipliers, costs grow.
- Offline: passive DPS only, capped at `OFFLINE_CAP_H = 8`, paid as stars on return.
- Taps per second for a child: model 3, 5 and 8 tps.

**Simulator output (a markdown report in `docs/economy/` plus CSV):**

- time to first kill, first boss, stage 10, 20, 50 on day 1;
- best Bedtime timing per day and Dreams earned;
- day-by-day max stage for 14 simulated days at 10, 20 and 30 minutes of play per day;
- how much of each day's progress comes from offline vs active play.

**Target feel (proposals, Kondrat confirms):**

- first kill in under 5 s, first boss within 3 minutes;
- first Bedtime makes sense after about 15 to 20 minutes of total play;
- with 15 minutes a day the child keeps reaching a new world about once a week;
- offline earnings are a pleasant bonus, never more than ~30% of a day's progress.

## 6. M1: vertical slice

**Content:** world 1 **Pillow Hills**, stages 1 to 30, bosses at 10, 20, 30, final boss
**Professor Hoot** (a boss that exists in Plush Squad, here giant). Four heroes.

**Screens:**

1. **Title:** Play, + Toy, Parents. Version label bottom-left (as in Plush Squad).
2. **Battle (main screen):** Titan with HP bar on top, stage and world name, star counter, squad row
   with levels, big TAP area, moon button (Bedtime) always visible. Damage numbers float up,
   pillows fly, crits burst into feathers.
3. **Squad:** heroes, level up buttons (x1, x10, max), tap power upgrade.
4. **+ Toy:** capture a toy with the reused pipeline; if capture fails or the camera is refused,
   choose one of 4 built-in plush heroes. **M1 must be fully playable without a camera.**
5. **Bedtime:** Dreams to be earned now, the reset explained in one line for a child, Dream
   upgrades shop, "Goodnight" ends the session.
6. **Parents:** gate, bedtime time, daily play limit, reset progress.

**Built-in heroes (placeholders until art):** a round fluffy toy, a bear, a bunny, a dinosaur.
Simple vector art in code (SVG/Phaser graphics), no external assets with unclear rights.

**Save:** local only (`localStorage` in try/catch), schema version number in the save from day one,
export/import as JSON for moving between iPhone and iPad.

## 7. Data

- `js/economy.js`: every balance constant, nothing hard-coded in scenes.
- `js/data/worlds.js`: worlds, stage ranges, Titans, boss list.
- `js/data/heroes.js`: built-in heroes. A captured toy becomes a hero with stats picked from the
  built-in hero classes (the classifier only chooses which class it resembles; it never changes
  balance).
- Save keys documented in `docs/save-format.md` with the version.

## 8. Tests

- Unit (Node): economy formulas, Dreams, offline cap, boss timer fallback, save migration.
- Playwright: smoke over every scene in portrait and landscape with 0 JS errors; a 3-minute
  scripted run reaches the first boss; Bedtime resets the run and keeps Dreams; offline return
  after "8 h" and after "7 days" pays the same; rotation mid-battle keeps state.
- CI on GitHub Actions on every PR. Pages deploys from `main`.

## 9. Release checklist

Bump `VERSION` and the service-worker cache name together; add new files to the cache list;
"What's new" only for minor versions, never for hotfixes (Kondrat's rule in Plush Squad); list the
real-device checks for Kondrat in the PR.

## 10. Milestones

- **M0** economy simulator and report.
- **M1** vertical slice above, playable by the chief tester.
- **M2** Space and Ocean worlds (Mothership, Pillow Kraken), friends' toys as helpers, weekly
  Kraken raid, accounts and cloud saves, full parent controls.
- **M3** store builds (Capacitor), the one-time Toy Box purchase behind the parent gate, privacy
  review, family beta.

## 11. Open questions for Kondrat (recommended answer in brackets)

1. Final name? [keep Plush Titans as the working title]
2. Language of the game UI? [English first, as in Plush Squad; UK/RU later]
3. Share accounts with Plush Squad in M2? [yes, one Supabase project, tables `titans_*`]
4. Offline cap 8 h, or tie it to the parent's bedtime-to-morning window? [8 h fixed in M1]
5. Business model is a proposal: free first world, one Toy Box unlock, up to 4 squads per device.
   Decide in M3. [do not build any purchase code before M3]
6. Use the `ub-mode` skill (Uncle Bob) in this repo? [not as-is: adopt its principles in CLAUDE.md
   (test first for logic, test behaviour not implementation, fix root causes, small commits);
   check its license and whether its quality tools support JavaScript before installing it]
