# Handoff for plush-titans (from Plush Squad v1.2.0)

Audience: an AI coding agent starting the NEW repo `plush-titans` (a tap-idle game on Phaser, same owner, same chief tester).
Source: the Plush Squad repo at `main` v1.2.0 (the worktree this file lives in). Facts come from code, `docs/gdd/decisions.md`,
`docs/qa/*.md`, `docs/CHANGELOG.md`, git log, tests, CI and `supabase/schema.sql`. Guesses are marked [?].

The repo is public. Same rules for plush-titans: no secrets, no e-mails, no recovery codes, no names of the child or the family
(say "the chief tester, age 10" and "the owner (Kondrat)"). Only the Supabase project URL and the PUBLISHABLE key may be in code.

Read this whole file once, then use section 15 as your first-day checklist.

Known doc drift in Plush Squad (do not copy blindly):
- `CLAUDE.md` says `game.js` is "~2600 lines"; it is 5269 lines now. One file that big was a cost (see sections 2 and 13).
- `CLAUDE.md` says `?local` loads toy models from `models/`. The real switch is `?localmodels` on the page URL
  (`getWorker()` in `js/game.js` tests `/[?&]localmodels/` and passes `?local` to the worker URL).

---

## 1. Project at a glance

- Game: kid-friendly pillow-fight game (players 6-11, chief tester is 10 and plays on iPhone and iPad). Hero is Jack the plush
  dragon, plus the player's own toys made from a photo, on the device.
- Stack: **Phaser 3.90.0** (`vendor/phaser.min.js`, the string "3.90.0" is inside it), plain static files, **no build step, no bundler,
  no npm runtime dependency**. `package.json` exists only for the browser tests (`@playwright/test` pinned to 1.56.0).
- Hosting: GitHub Pages from `main`, repo root. Merge = live in about a minute.
- PWA: `manifest.json` (display fullscreen, orientation any, icons 192 and 512, a separate maskable entry),
  `sw.js` (offline), Home Screen icon `assets/apple-touch-icon.png`. iPhone web app meta tags are in `index.html`
  (`apple-mobile-web-app-capable`, `black-translucent` status bar, `viewport-fit=cover`).
- Size at v1.2.0: `js/game.js` 5269 lines, `js/extra.js` 786, `js/net.js` 735, `js/audio.js` 395, `js/adventure.js` 328,
  `js/toys.js` 252, `js/settings.js` 163, `js/toyworker.js` 73, `js/emoji.js` 44. `assets/` 6.1 MB, `vendor/` 23 MB (22 MB of it is `vendor/tjs`).
- Tests: 29 spec files, about 220 `test()` calls, Playwright, run in 5 CI shards.

File map (Plush Squad):

| Path | What it is |
|---|---|
| `index.html` | shell, PWA meta, script order, service worker registration (reload once on a new version), no SW on itch.io hosts |
| `js/game.js` | core: `main()`, scenes, `Save`, `IDB`, layout helpers, rivals/moves/boosters data, battle engine, rotation rebuild, `PS` helper object, `emit()` |
| `js/extra.js` | plugin: Me, Sticker Album, Quests, Parents (multiplication gate), Bedtime, What's new, Pillow Week streak |
| `js/net.js` | plugin: Supabase accounts, cloud save, friends, mail, weekly Kraken boss, museum, Star Catch board |
| `js/settings.js` | plugin: `PSPrefs`, device-only prefs, calm mode hooks, `keep()` |
| `js/adventure.js` | plugin: toys go on adventures instead of being deleted (v1.0) |
| `js/emoji.js` | pure data: 16 preset emoji for duel chat (v1.2) |
| `js/audio.js` | `PSAudio`: all sound synthesized with Web Audio, procedural music tracks |
| `js/toys.js` | toy types (44), elements, quirks, hero generator, kid-safe name filter `badName()` |
| `js/toyworker.js` | module Web Worker: background removal + type guess |
| `js/config.js` | Supabase URL, publishable key, user domain (public by design) |
| `vendor/` | `phaser.min.js`, `supabase.js`, `tjs/` (transformers.js + onnxruntime-web, wasm) |
| `supabase/schema.sql` | whole DB schema v2, applied by hand by the owner |
| `tests/` | Playwright specs + `helpers.js` |
| `tools/itch-build.sh` | zips the game for itch.io |
| `docs/gdd/` | GDD, `decisions.md`, `ideas.md`, `findings.md` (G-IDs), design docs `<version>-<feature>.md` |
| `docs/qa/` | one QA report per version, written by the `qa-tester` agent |
| `docs/CHANGELOG.md` | news feed, every PR adds a line; `docs/index.html` is a docsify site that reads `docs/` from `main` (no build) |
| `.claude/agents/` | `qa-tester.md`, `game-designer.md` |
| `.github/workflows/test.yml` | CI |

Load order in `index.html` (scripts, plain tags, order matters): phaser, supabase, `config.js`, `audio.js`, `emoji.js`, `toys.js`,
`extra.js`, `settings.js`, `net.js`, `adventure.js`, `game.js` last. Plugins push themselves to `window.PSPlugins` before `game.js` runs.

---

## 2. Architecture

### 2.1 Core (`js/game.js`)
- The whole file is one IIFE. `main(RESUME)` builds the whole Phaser game for the current orientation. Rotation destroys the game and
  calls `main(snapshot)` again (section 6).
- Scenes: Boot, Title, Map, Squad, Studio (+ Toy), Battle, Catch (Star Catch), Hockey, Comic, Gacha (capsules), plus plugin scenes
  (Me, Album, Quests, Parents, Bedtime, Friends, Account, Boss, Adventures...). They are listed in `new Phaser.Game({... scene: [...] })`.
- `Save` (inside `main()`): `Save.data`, `Save.load()`, `Save.store()` (writes `localStorage['plushsquad_v1']`, then calls `window.PSOnSave(data)`),
  `Save.migrate(d)` (section 7).
- Layout helpers, all taking the scene first: `txt(scene,x,y,str,size,color,opts)` (Poppins, stroke, shadow, `wrap`),
  `fit(textObj, maxW)` (scales a text down to a width), `button(scene,x,y,w,h,label,color,cb,opts)`, `img(scene,x,y,key)`
  (`'i:name'` = frame of atlas `icons`, `'j:name'` = `icons2`, `'e:name'` = `icons3`, else a texture key), `iconScale(key,size)` (scale so an
  icon is about `size` px; it has a per-texture base-size table, so a NEW texture needs an entry or it assumes 220),
  `panel`, `chip`, `fitImage`, `starRow`, `fade(scene,key,data)` (scene change), `press`, `backButton`, `muteButton`, `tw` and `wait`
  (promise wrappers around tweens and timers).
- Play area: `W x H` in game units. Portrait: `W = 1080`, `H = clamp(1080/aspect, 1500, 2340)`. Landscape: `H = 1080`,
  `W = clamp(1080*aspect, 1440, 2340)`. `PORTRAIT` is a constant per build. Everything is laid out from `W`, `H`, `PORTRAIT`. No fixed pixel positions.
- Scenes are REUSED by Phaser: `scene.start('battle')` again runs `init`/`create` on the same instance. State on `this` survives unless reset
  (bugs B30, logBg, section 13).
- Debug handles (only with `?debug`): `__game`, `__save`, `__RIVALS`, `__BOOSTS`, `__IDB`, `PSAudio`, `PSExtra`, `PSNet`,
  `__psRotatePending`, `__psTryRebuild`, `__psRebuild`, `__psSnapshot`. Tests live on these. Build them from day one.
- Never name a scene method `sound` (clashes with Phaser's `scene.sound`).

### 2.2 Plugin system (copy this idea)
- `window.PSPlugins` is an array. A plugin is `{ name, scenes(PS) -> [SceneClass], onEvent(name, data, scene, PS) }`.
- `game.js` builds `PS`, an object of helpers and data (`VERSION, W, H, PORTRAIT, C, A, FONT, Save, IDB, ... txt, fit, tw, wait, rnd, clamp,
  img, iconScale, button, panel, chip, fade, backButton, muteButton, addTexture, emit, ...`) and hands it to every plugin. Plugins never
  import from `game.js`, they only use `PS`. Plugin scenes are added to the Phaser config.
- `emit(name, data, scene)` calls every plugin's `onEvent` inside try/catch (one broken plugin never kills the game).
  Events used: `scene` (every scene `create`), `duel`, `move`, `block`, `catch`, `capsule`, `toyAdded`, `friendAdded`, `giftSent`, plus
  `save`, `found`, `alarm`, `lucky`, `push`, `copyflop`, `hockey`, `toyHome`.
- Why it worked: stickers, quests, bedtime, cloud save and streaks all hang on events and never touch battle code. Why it hurt: the core file still grew to 5000+ lines.
  For plush-titans split the core earlier (scenes in separate files, shared helpers in one `ui.js`).

### 2.3 `js/extra.js` (offline extras)
- Me (player card, titles, costumes), Sticker Album (achievements `ACH`), real-life Quests (`QUESTS`, `todaysQuests`, `pendingQuests`),
  Parents area, Bedtime, What's new, Pillow Week daily streak. Exposed as `window.PSExtra`.
- **Parents gate** (`parentGate`): a multiplication question (6-9 x 6-9) typed on a number pad. Owner decision: keep it. Anything for grown-ups
  (approve quests, bedtime, play-time limit, real delete of a toy) sits behind it.
- **Bedtime / daily limit** (`blockedReason`): checked when a menu screen opens and before a NEW duel, never in the middle of a duel (QA B03).
  One date helper `todayKey()` (local date `YYYY-MM-DD`) for all day logic; `dayNum()` counts calendar days so DST days do not matter.
- **What's new**: `WHATS_NEW` keyed by `major.minor` (`'1.2'`, `'1.1'`, ...). Patch versions show the minor's list. Shown once per version
  (`save.seenVersion`), brand-new players (no xp, no wins) are marked seen silently. Hotfixes never add an entry (owner rule). Settings has a
  WHAT'S NEW replay that falls back to the newest list.
- Toast helper keeps `window.__psToasts` (count of live toasts). Rotation waits while it is above 0 (sections 6 and 13).

### 2.4 `js/net.js` (online, optional)
- Everything works offline if `js/config.js` is empty or the network fails. Supabase client from `vendor/supabase.js`.
- Accounts: username + password only. `Net.email(name)` = `name@players.plushsquad.app` (a fake domain from `PS_CONFIG.userDomain`, nothing is ever sent).
  Names: 3-16 chars `[a-z0-9_]`, checked against a bad-word regex plus `PSToys.badName`. Recovery code instead of e-mail reset
  (`init_profile` returns it once, `reset_password(name, code, new)`, `new_recovery_code()`).
- Cloud save: table `saves` (one JSON row per user). Methods: `sync()` (one at a time), `_sync()`, `reconcile()` (after login),
  `adoptLocal()`, `applyCloud(data, streak)`, `schedulePush()` (15 s debounce), `pushNow()`, `resolve(which)` (kid picks cloud or local on conflict),
  `setMem(data)` (replace the in-memory save too). Sections 7 and 8.
- Friends by code only (`add_friend`, `my_friends`), inbox mail through RPC (`send_inbox`, `claim_inbox`), kinds: sticker, beat, gift_capsule, gift_boost.
  Mail list shows the 30 newest in pages. **MARK ALL READ** (v1.1.1): seen ids kept per user in `localStorage['plushsquad_mailseen_<userId>']`
  (max 300), badge `Net.unread` counts only unseen, nothing is deleted or claimed.
- Weekly co-op boss (the Pillow Kraken): `boss_status`, `boss_start`, `boss_hit`, `boss_claim`, fixed 220 pep for everyone, 3 tries a day.
- Museum (`museum()`, `toggle_like`), Star Catch board (`submit_catch`, `catch_board`). All names from other devices go through `okUser`/`okName` kid-safe filters.
- Pushes on `pagehide` AND on `visibilitychange` to hidden (iOS sends no `pagehide` on app switch or lock). Back to visible: `sync()` if the last one was over 20 s ago.

### 2.5 Other plugins
- `js/settings.js`: `window.PSPrefs`, localStorage key `plushsquad_prefs` = `{ music 0-4, sfx 0-4, calm, hand: right|left, buzz, skipCaps, emoji }`.
  **Device-only, never in the synced save.** First run: calm follows the OS "reduce motion" setting. Calm mode works through three small hooks on Phaser
  itself (camera shake, endless tweens, confetti). `keep(cfg)` marks an endless tween that must still run in calm mode (it tells the kid what is happening).
- `js/adventure.js`: a toy leaves for a world, sends up to 3 postcards, comes home with a souvenir. "Delete" became "go explore"; a real delete is behind the parent gate.
- `js/emoji.js`: 16 fixed emoji ids 0-15. `clean(arr)` keeps only integers 0-15, max 6 (mail is untrusted input). Rival personality tags decide the answer.
- `js/audio.js`: section 4.

### 2.6 How to build the same layer for an idle game
- Keep: `window.PSPlugins`-style registry, `PS` helper object, `emit()` with try/catch, plugin scenes, `onEvent('scene')` hook for popups.
- Idle events to emit: `tap`, `upgrade`, `prestige`, `offlineReward`, `milestone`, `achievement`, `scene`. Quests, stickers and cloud sync subscribe.
- Put game data (generators, upgrades, worlds) in plain data tables keyed by string ids, not array positions (section 7).
- Keep the core file small: boot, scenes, save, shared UI. Everything else in plugins.

---

## 3. Photo -> hero pipeline (the toy generator)

Flow (Studio scene in `js/game.js`, worker in `js/toyworker.js`, rules in `js/toys.js`):
1. `pickFile()` makes a hidden `<input type=file accept=image/*>` and returns the file.
2. `fileToRGBA(file, 1024)`: `createImageBitmap` with `imageOrientation: 'from-image'` (fallback without), scaled so the long side is at most 1024,
   returns RGBA pixels plus a JPEG preview (quality 0.85).
3. The pixels go to the worker as a transferable buffer (`{type:'process', rgba, w, h}`).
4. Worker: background removal -> alpha mask -> crop -> composite on white -> image embedding -> cosine similarity with 44 pre-computed type
   embeddings -> softmax x100 -> top 6 scores. Replies `{type:'done', rgba, w, h, scores}` (also `progress`, `stage`, `error`, `ready`).
5. Main thread `finishCutout()`: smooth the alpha, keep the biggest blob (prefers the one near the centre), soften edges, crop, add a white sticker outline.
6. The kid confirms or picks the type from a grid of icons ("who is it?"), edits the name. `toys.js` builds the hero from rules (no LLM):
   type -> signature move, main colour -> element move, a random quirk -> extra move.
7. The picture (PNG data URL) is stored in IndexedDB under the toy id. Metadata is in `Save.data.toys`.

Models and libraries (all verified in the files):
- **transformers.js 3.8.1** (`env.version` "3.8.1" in `vendor/tjs/transformers.min.js`, 888 KB).
- **onnxruntime-web 1.22.0-dev.20250409-89f8206ba4** (`vendor/tjs/ort.bundle.min.mjs` 398 KB, `ort-wasm-simd-threaded.jsep.mjs` 44 KB,
  `ort-wasm-simd-threaded.jsep.wasm` 21.6 MB). The `jsep` build contains WebGPU support, but the worker forces `device: 'wasm'`.
- Background removal: `pipeline('background-removal', 'onnx-community/ormbg-ONNX', { dtype: 'q8', device: 'wasm' })`. Model is Apache-2.0, about 44 MB (GDD).
- Type guess: `Xenova/mobileclip_s0` via `AutoProcessor` + `CLIPVisionModelWithProjection`, `dtype` `'fp32'` by default
  (worker URL param `?vdt=` can override), `device: 'wasm'`. License: Apple sample-code licence (README). Whole download about 90 MB (README).
- `assets/arch_emb.json`: 44 type embeddings, 512 numbers each (the `mystery` entry is skipped in scoring). The script that made it is NOT in the repo [?]
  (probably the CLIP text tower on "a photo of a <type>" prompts). Keep the file; if you change the type list you must regenerate it.
- Worker config at the top of `toyworker.js`: `env.allowLocalModels = LOCAL`, `env.allowRemoteModels = !LOCAL`,
  `env.localModelPath = ../models/`, `env.backends.onnx.wasm.wasmPaths = ../vendor/tjs/`, `numThreads = 1`, `proxy = false`.
  One thread because GitHub Pages cannot send the cross-origin-isolation headers that multi-thread WASM needs [?].
- First use downloads the models from Hugging Face (remote). Status text: "Downloading toy magic (first time only)... N%", from `progress` messages.
  The browser HTTP cache keeps them afterwards (the service worker does not list model files). `vendor/tjs` files are cache-first via the SW's fallback.
- Local dev without network: put the models under `models/` (git-ignored; layout is the HF repo layout, `models/onnx-community/ormbg-ONNX/...`,
  `models/Xenova/mobileclip_s0/...` [?]) and open the page with `?localmodels`.
- Worker lifetime: one worker per page, kept on `window.__psToyWorker` so a rotation rebuild reuses it and its loaded models (QA B22, v0.8.1).
  Before that, every rebuild re-created the worker and re-loaded 90 MB. `cancelJob()` terminates and nulls it (a late reply can never land).
  A 90 s timer is re-armed on every progress message; on timeout the worker is terminated and the photo is used as it is ("MYSTERY PLUSH").
  Rotation is blocked while the Studio scene is active (`__psBlockRotate`), and also while an `<input>` has focus (the keyboard changes the window size).
- A CANCEL button during processing (QA B41/B56): top right, 300 x 100, clear of the mute button.
- Storage: `IDB` (database `plushsquad`, store `img`, key = toy id, value = data URL). Exposed as `__IDB` with `?debug`. With an account, pictures also
  go to the Supabase Storage bucket `toys` at `<userId>/<toyId>.png` (section 8).

What to copy into plush-titans if you want the photo feature: `js/toyworker.js`, `vendor/tjs/` (all 4 files), `assets/arch_emb.json`, the Studio scene
parts `getWorker`, `pickFile`, `fileToRGBA`, `finishCutout`, `addTexture`, the `IDB` object, and the type/hero rules in `js/toys.js`.
What to avoid: loading the worker at boot (load it only when the Studio opens, then keep it), more than one worker, multi-thread WASM, re-loading models on rotation.
Not verified: iOS memory limits and WebGPU behaviour on Safari. The code has no WebGPU path; assume WASM only and test on a real older iPhone [?].

---

## 4. Sound (`js/audio.js`): no audio files at all

- Everything is synthesized with Web Audio: `tone(freq, dur, opts)`, `noise(dur, opts)` (band-pass filtered noise), effects such as `click`, `whoosh`,
  `thump`, `levelUp`, `catchStar`, `fizzle`, `countdown`. No `<audio>` tags, no assets, no licensing, tiny download.
- iOS unlock: the `AudioContext` is created in `A.init()`, which is called inside user taps (`pointerup` handlers call `A.init()` first, then `A.startMusic()`).
  If the context is not `running`, `init()` calls `resume()`. Never create the context at load.
- Mute: `A.setMuted(m)` ramps `master` gain; the saved flag is `Save.data.muted`. One mute button per screen (QA B17: there were two, bedtime B21).
- Gain graph: `sfxGain` and `musicGain` -> `master` -> destination. Volumes are 5 steps (OFF, 1-4) from Settings: `MUSIC_STEPS` and `SFX_STEPS`.
- `visibilitychange`: hidden -> `ctx.suspend()`, visible -> `ctx.resume()`.
- Music: procedural tracks in `A.TRACKS`, each `{ bpm, div, len, gain, play(A, n, t, sp) }` where `play` schedules the notes of step `n` at time `t`.
  Tracks: `calm` (menus), `battle` (D minor 144 bpm, 16 bars), `boss` (C minor 112 bpm), `north` (Canada, 126 bpm), `sea` (108), `lullaby` (72), `garden` (132), `parade` (116).
  A lookahead scheduler (`setInterval` 60 ms, schedules 250 ms ahead) in `startMusic()`. If the clock fell behind (`_next < now - 0.1`) it resets instead of firing a backlog
  (verified in QA v0.7.6: no note burst after a background pause).
- `A.music(name)` stores `_want`; `_switch(name)` makes a new bus gain, fades the old bus out (`setTargetAtTime`) and the new one in (0.35 s): a crossfade.
  The scene `create` hook picks the track; `Boot` is skipped (B34: rotation restarted the duel music through a `calm` blip). `finish()` silences music for the jingle,
  `result()` returns to `calm`.
- Building blocks you can reuse: `voice(midi, at, dur, opts)` (oscillator + gain envelope + optional low-pass with a closing filter), `hit()` (noise burst),
  `drum(kind, at, v)` (kick, snare, hat, ohat, taiko, tom, crash), `swell()` (slow noise wave for sea sounds), `mtof()`.
- Testing music: `tests/music.spec.js` swaps `PSAudio.ctx` for an `OfflineAudioContext(1, 44100*4, 44100)` with fake `master/musicGain/_bus/noiseBuf`,
  calls `T.play(A, i, ...)` for every step of every track, renders, and checks the peak is not silent and not clipping. Note: it needs `waitFor toasts === 0`
  because a sticker toast calls `levelUp()` on the swapped context (QA v0.9.0 section 2.7).
- **OST rendering trick** (the soundtrack was rendered once for YouTube): the same `OfflineAudioContext` idea, loop each track's `play()` for N bars at faster-than-real-time,
  `startRendering()`, encode the buffer to WAV. The render script itself is NOT in the repo, so this is described from the test approach only [?].
- Idle-game tips: a soft tap sound must be cheap (one oscillator). Do not start music before the first tap. Keep a sound budget per second (the `emoji12` cooldown is 1.2 s).

---

## 5. iOS specifics (the part that cost the most time)

- **Full-bleed canvas:** `#game` is `position:fixed` on all four edges, the Phaser canvas covers the whole screen including under the status bar and home bar.
  `html,body` background is the night colour; `overscroll-behavior:none; touch-action:none; user-select:none; -webkit-touch-callout:none`.
- **`#safe` div:** hidden (`visibility:hidden`, 0 x 0) with `padding: env(safe-area-inset-top/right/bottom/left)`. `insets()` reads its computed padding to get the safe
  areas in CSS px. `viewSize()` reads `#game`'s bounding rect.
- **Layout in a play area:** usable size `UW x UH` = view minus insets. `KU` = game units per CSS px. Margins in game units: `ST, SB, SL, SR`. Canvas is
  `GW = W + SL + SR` by `GH = H + ST + SB`. Layout code works in `0..W x 0..H`; each scene's camera is scrolled by `(-SL, -ST)` (`safeCam(scene)`, applied on
  scene `start` and `create`). Result: buttons stay inside the safe area, backgrounds bleed to the screen edges.
- **Patched full-screen rectangles:** `Phaser.GameObjects.GameObjectFactory.prototype.rectangle` is wrapped once (`__psRect`): a rectangle created at exactly
  `(W/2, H/2, W, H)` is swapped for the bleed rectangle (`window.__psBleed`). So `add.rectangle(W/2, H/2, W, H, color)` for dims and flashes just works.
  Ground strips use `bottomGround()` which stretches into the home-bar margin.
- **Pointer rule:** always use `p.worldX / p.worldY` (camera-aware), never `p.x / p.y`.
- **iOS 26 WebKit bug 301108:** a Home Screen web app with `black-translucent` status bar is one status-bar height short, and the strip below the page can only take the
  html background colour (it cannot be drawn on). Handling: `insets().dead` = `screen long side - innerHeight` when `navigator.standalone` (ignored under 8 px);
  `bottomFade(scene)` adds a `fadeB` gradient image at the bottom edge tinted with `window.__psFadeCol`; `tintPage(game)` samples a pixel with
  `renderer.snapshotPixel` just above the fade (at the right edge, the version label sits bottom-left) and sets `documentElement`/`body` background to that colour.
  `tintPage` runs 700 ms and 2200 ms after every scene create. Result: the scene fades into one flat colour that matches the strip.
- **Launch inset rechecks (v0.8.2):** a freshly added Home Screen web app can settle its size and insets after launch with no resize event, so top buttons sat under
  the status bar where iOS eats taps. Fix: `window.__psTryRebuild()` is also called 700, 2000 and 4000 ms after load, on `orientationchange` (+400 ms) and on `pageshow` (+400 ms).
  `viewChanged()` compares insets (2 px tolerance), orientation and aspect (3 %).
- **Home Screen icon:** `assets/apple-touch-icon.png` (linked with `?v=` cache buster), `icon-192.png`, `icon-512.png`, and a separate manifest entry with
  `purpose: "maskable"` (B29, v0.8.1). iOS CACHES the icon: after a change the kid has to remove and re-add the app. Make the icon a close-up that fills most of the frame
  (the first full-body icon was too small; owner note, fixed in v0.8.1).
- **Service worker (`sw.js`):** code (`.html .js .json .mjs`, not under `/vendor/`) is network-first with `cache: 'no-cache'` and falls back to cache offline; pictures,
  fonts, libraries are cache-first. `install` does `addAll` of the `FILES` list with `cache: 'reload'` then `skipWaiting`; `activate` deletes old `plushsquad*` caches and
  `clients.claim()`. `index.html` registers it with `updateViaCache: 'none'`, calls `reg.update()` on load, and reloads ONCE on `controllerchange` (only if a controller
  already existed). **Every new file must be added to `FILES` by hand** (there is no build step to generate it) or it will not work offline.
  No SW on `claude.ai`, `itch.io`, `itch.zone`, `hwcdn.net` hosts.
- **DOM inputs above the canvas:** Phaser `add.dom` inputs float above the canvas and ignore scene depth. Hide them under overlays (`FriendsScene.overlay`,
  `AccountScene.hideInputs`). v0.7.1 shipped fields showing through the recovery-code screen. Rotation is blocked while an input has focus (the keyboard resizes the window).
- **Touch:** `input: { activePointers: 2 }`. Buttons give press-down feedback (B27). `navigator.vibrate` is guarded (iOS Safari has none) and has a Settings switch.
- **Fonts:** Poppins Bold and Medium loaded with `@font-face` plus two hidden `.pre` spans and `document.fonts.load()` before `main()`, with a 3 s cap
  (`Promise.race`), so first text is never in a fallback font. QA checked that special letters exist in both files.
- **itch.io build:** `tools/itch-build.sh` zips `index.html manifest.json js assets vendor` (from `git ls-files`) to `dist/plush-squad-itch-<version>.zip`
  (version read from `js/game.js` with `sed`). Docs for the page in `docs/itch/`.

---

## 6. Rotation (whole-game rebuild)

- On a viewport change the game is destroyed and rebuilt: `rebuild(target)` stores the save (`__save.store()`; stats bumped in memory would be lost otherwise, B47),
  `old.destroy(true)`, then `main(snap)`. `snapshot(game)` returns `{ key, data }` of the active non-boot scene; for a duel also `battle: sc.snapshot()` and,
  if the result panel is up, `result: sc.shown`. A scene the player already tapped out of (`_leaving`, `_psTarget`) restores to the target scene (B38).
  Studio restores to Title. An over battle without a panel restores to the map.
- Triggers: `resize` (300 ms debounce), `orientationchange`, `pageshow`, plus the launch rechecks (section 5). All go through `window.__psTryRebuild()`.
- **Blocking:** `__psBlockRotate()` is true while: Studio is active, a text input has focus, a duel turn is playing (`busy && !shown`) or the end celebration runs
  (`celebrating`), a capsule is opening (`gacha.busy`), or a toast is alive (`__psToasts > 0`). Then `__psRotatePending = true` and the rebuild is retried at the next
  safe moment: YOUR TURN, the end of the celebration, the last toast ending, and every scene `create` (100 ms later).
- Lessons:
  - Rotating mid-turn used to give a free turn (B02). Hold it until YOUR TURN.
  - Rotating on the winning move lost the celebration or the rewards, or gave them twice (B31, B35, B36). Hold until the stars/XP/LEVEL UP! has played, then rebuild into the restored panel.
  - Sticker toasts were lost on every rebuild (B37) and a toast on an already-left screen blocked rotation forever (B40: toast code must die with its scene).
  - A tap during the 300 ms debounce was lost (B38).
  - Rotation restarted the duel music (B34).
  - Rotating during capsule opening lost the opened prizes (fixed in v1.1.1: `__psBlockRotate` checks `gacha.busy`).
  - BACK during OPEN 10 spent 10 capsules and showed no summary (B78): ignore BACK while `busy`.
  - Scene-reuse bug: a log strip `logBg` from the previous Brock Lee duel was a destroyed object when the scene was re-entered (crash). Reset such fields in `create()`
    and restore them after a rotation (v1.1.1 test: re-enter the duel).
  - Rotation test T7 (QA v0.7.6): 20 flips must leave exactly one `<canvas>`.
- For an idle game rebuild is simpler if state is all in the save: snapshot only `{scene key, data}`. Consider locking orientation per scene instead of rebuilding [?].

---

## 7. Saves and migrations

- Local: `localStorage['plushsquad_v1']` (JSON), written by `Save.store()`. Toy pictures in IndexedDB (section 3). Device-only prefs in `plushsquad_prefs` (separate on purpose).
  Mail-seen ids in `plushsquad_mailseen_<userId>`. Auth session in `plushsquad-auth` (Supabase `storageKey`).
- `PSOnSave(d)` (set by `net.js`) runs on every `store()`: `d.savedAt = Date.now()` and, if logged in and `d.owner === user.id`, `schedulePush()` (15 s). So `savedAt` bumps on
  ANY store, even one with no progress (that caused B60, section 8).
- `Save.migrate(d)` runs on every load AND on every cloud save before it is applied (the cloud path was missed in v1.1: a v1.0 cloud save put `lastWorld` on the wrong world;
  `applyCloud` now calls it). It never takes anything away. It fills missing fields so a **partial save never throws** (B76: `Save.migrate` threw when `stars` was missing,
  now `stars`, `toys`, `diff`, `caps`, `boosts`, `seen`, `stats`, `ach`, `costumes` get defaults first).
- One-time flags, each set after its block ran: `mig08` (boss hats for old winners, gift toasts `gifts08`), `mig09` (Hills comic unlocked for players who already played),
  `mig10` (Spooky world index 3 -> 5), `mig11` (Spooky 5 -> 6, Countryballs took 5). Plus the streak shape fix (no flag, checks the shape).
- **World indexes moved twice** (Spooky was 3, then 5, then 6) because worlds were an array order and `lastWorld` stored an index. Each insertion needed a migration, a test fix in
  `BASE_SAVE` and care for cloud saves from older clients. For plush-titans: world and season ids are STRING KEYS (`'hills'`, `'space'`), never indexes. Order lives in a separate array.
- `seenVersion` (What's new) is `major.minor`. `BASE_SAVE` in the tests sets all `migXX` flags, all `comics` seen and `streak.seen = TODAY` so no popup or gift toast appears
  in unrelated tests (this removed random CI failures: toasts called `levelUp()` and counted as extra text).
- Save has `owner` (Supabase user id) and `savedAt`. A guest save has no owner. Toys sent away have their own `away` list. `gone` lists toy ids deleted on this device (section 8).
- Logout: pushes first, signs out, removes the local key, empties the in-memory save with `setMem({})` and clears IndexedDB `img`. The device goes back to a fresh guest.

---

## 8. Supabase

Setup facts:
- URL and PUBLISHABLE key are in `js/config.js` (public by design; do not paste them elsewhere). Never ask for, accept, or commit the secret / service_role key.
- Schema changes: edit `supabase/schema.sql`, then ASK the owner to run it in the SQL editor. Nothing on the live project without his OK. The file is idempotent
  (`create ... if not exists`, `create or replace`, `drop policy if exists`).
- Confirm e-mail must be OFF in the Supabase auth settings (usernames map to fake e-mails). `signup()` throws a hint if there is no session after sign-up.
- Tests block `*.supabase.co` (`page.route(/supabase\.co/, r => r.abort())` in `boot()`). Online behaviour is tested with a stubbed `PSNet.sb` and listed as "not tested" (ON-xx) in QA reports.

Schema v2 tables (`supabase/schema.sql`): `profiles` (username unique `^[a-z0-9_]{3,16}$`, friend `code`, `avatar` jsonb, `title`, `level`, `stars`, `stickers`, `wins`),
`recovery` (code hash, tries, last try), `saves` (one row per user, `data` jsonb), `toys` (id `<userId>:<toyId>`, `owner`, `meta` jsonb, `img` url), `friends` (a, b),
`inbox` (to_user, from_user, from_name, kind, payload, done), `daily_limits` (user, day, kind, n), `boss`, `boss_hits`, `catch_scores`, `likes`.
Index `inbox_to`. Extension `pgcrypto`.

Security model:
- **Row Level Security is enabled on every table.** Policies: own profile (+ friends can read via `is_friend()`), own save (`for all`), toys readable by owner or friend and
  writable only by owner, own friends rows, own inbox (select only).
- Writes that cross users go through `security definer` RPCs with `set search_path = public`: `init_profile`, `username_free`, `reset_password`, `new_recovery_code`,
  `add_friend`, `remove_friend`, `my_friends`, `send_inbox`, `claim_inbox`, `boss_status`, `boss_start`, `boss_hit`, `boss_claim`, `submit_catch`, `catch_board`, `museum`,
  `toggle_like`, `is_friend`. A `do $$` block revokes execute from `public, anon` and grants it to `authenticated` (except `reset_password` and `username_free`, which anon needs).
- `ps_take(kind, max)` is a per-user per-day counter (table `daily_limits`); `send_inbox` uses it (sticker 40, beat 40, gift_capsule 1, gift_boost 3; unknown kind = 0 = refused).
  Execute on `ps_take` is revoked from everyone. `ps_week()` gives the ISO week for the boss.
- Clients never insert into `inbox` directly (no insert policy). Payloads from other players are untrusted: clean them on read (`cleanEmo`, `okToy` clamps toy XP to 0..300 and keeps only known badge ids).
- Storage bucket `toys` (public read). Policies on `storage.objects`: insert / select / update / delete only where the first folder of the object name equals `auth.uid()`
  ("toy pics upload own", "read own", "update own", "delete own"). Picture URL: `<url>/storage/v1/object/public/toys/<userId>/<toyId>.png`.
- Kid-safety in the data model: friends only by code, no free-text chat, mail kinds are a closed set, names pass a filter on every read path (QA B13, B61 fixed Cyrillic look-alikes and transliteration).

Sync design and the two-devices bugs (read this before writing any sync):
- **#64 / B60 (S2, nearly S1):** with a kept login the game never pulled the cloud save, and every store pushed blindly, so the device that saved last overwrote the other.
  v0.8.2 made it worse: any store at start bumped `savedAt`, so an idle second device pushed its OLD save over the newer cloud save. Fix (v0.8.3): `sync()` runs once after the game
  has loaded the save and again when the app becomes visible; the newer `savedAt` wins; **nothing is pushed before that first sync** (`this.synced` gate in `pushNow`).
- First login on a new device or re-added Home Screen app overwrote cloud progress with the empty local save (v0.8.2 #61): the rebuild after login stored the in-memory save, which
  was still the empty one, over the cloud copy `applyCloud` had just written. Fix: **`setMem(data)` replaces the in-memory save too**, on login and logout. Any code path that writes
  localStorage then rebuilds must also replace the in-memory object.
- Push on app switch (iOS has no `pagehide` there) and on start when the local save is newer (v0.8.2).
- `_sync()` captures `lt0 = d.savedAt` and a copy of the streak BEFORE the fetch (v1.0 review): a Pillow Week day counted during a slow fetch bumps `savedAt` and must not make an old
  save win over a newer cloud save. The cloud save is applied with the pre-fetch streak so the day is counted once.
- Never swap a newer cloud save in under a running `battle, studio, comic, catch, hockey, gacha, account`: retry in 10 s. After applying, call `__psRebuild()`.
- Streak merge: `mergeStreak(into, other)` keeps the better streak of the two saves when they meet.
- Conflict on login (a different owner's save is local): `reconcile()` returns `{cloud, local}` summaries and the kid picks. A fresh local save (no xp, toys, wins) just takes the cloud.
- **REMOVE must not delete other devices' photos.** The first delete implementation pushed deletes for any cloud toy missing from the local save, which is a toy created on another device.
  Fix (v1.0, #76): the device records the toys a grown-up deleted HERE in `save.gone`; `dropGone()` deletes only those rows and pictures, never a toy still in the save, clears the id only after the
  delete went through (offline: retry on the next push); `applyCloud` keeps gone toys gone; a toy row missing from the cloud is re-uploaded from IndexedDB. Unknown cloud toys are left alone.
- Weekly boss lessons: B23 "Loading..." forever on RPC error (show a friendly error with RETRY and BACK), B33 REMATCH on the Kraken result skipped the daily try check (the Kraken result goes to the Weekly Boss screen).

For an idle game: do you need accounts at all? If yes, reuse this design (fake e-mail, recovery code, one JSON save row, newer `savedAt` wins, no push before first sync). For offline progress
(section 15) the cloud save needs a server-independent timestamp strategy [?].

---

## 9. Playwright tests

Config (`playwright.config.js`): `testDir: tests`, `timeout: 360000` (6 min per test), `expect.timeout: 30000`, `fullyParallel: true`, `workers: 2`,
`retries: process.env.CI ? 1 : 0`, reporters `list` + `html` on CI, `baseURL http://localhost:8765`, Chromium launch args
`--enable-unsafe-swiftshader --autoplay-policy=no-user-gesture-required`, trace and screenshot on failure,
`webServer: python3 -m http.server 8765` with `reuseExistingServer: true`. Plain static server, no build.

`tests/helpers.js` (copy it; adapt names):
- `BASE_SAVE`: a mid-game save with all migration flags, all comics seen, today's streak counted, `seenVersion` current, muted. It exists so no popup, gift toast or comic appears in unrelated tests.
- `boot(page, save, query)`: collects `pageerror` into `page._errors`, blocks `*.supabase.co`, **seeds the save on `/manifest.json`** (a same-origin page that does not start the game; a booting
  game could overwrite the seed, QA T29), then opens `/index.html?debug`, waits for `__game` with an active scene, then `fast()`.
- `fast(page)`: `setLagSmooth(5000, 33)` on every scene's tween manager. **Run it again after every scene start or rebuild.** Reason: headless Chromium renders through SwiftShader at
  2-3 fps and Phaser's tween manager treats a frame over 500 ms as 33 ms, so tweens crawl and duels look frozen. `game.step()` does NOT advance tweens.
- `wait(page, ms)` loops 500 ms slices calling `fast()`. `go(page, key, data)` starts a scene and waits for it. `waitTurn()` waits until the duel is ready.
- `offscreen(page, scene)`: layout checker, walks the display list (including containers) and returns interactive objects whose bounds leave `0..W x 0..H`.
- `noErrors(page)`: asserts `page._errors` is empty. Call it at the end of every test.

Rules learned the hard way:
- **`page.evaluate` must not return Phaser objects.** `scene.restart()` returns the scene plugin; Playwright hung serializing it (fixed `f8e99e7`). Use `void expr` or braces: `() => { x.restart(); }`.
- **Do many UI steps inside ONE `evaluate`** on slow CI (open tray + tap cell + read result). Between two evaluates, real-time timers (6 s tray auto-close, 1.2 s cooldown, comic auto-advance)
  can fire on a 2 fps runner. Add debug hooks (`b.emoTrayMs`) so tests can stretch or shorten a timer, or pause the scene clock (`scene.time.paused = true`).
- **Comic auto-advance race:** a long CI frame advanced a fresh comic to the title page before the test looked at it. The test now pauses the comic clock right at `create`.
- **Double-counted bonus:** the COPYCAT strip test read a number twice because the booster's +5 was added on top; it failed only on high rolls. Reset booster/RNG state before reading derived numbers.
- **CPU throttling switch:** `EMO_THROTTLE=5 npx playwright test emoji12` sends CDP `Emulation.setCPUThrottlingRate` (rate 5 or 6 reproduces CI slowness locally; 2 failures reproduced, then 23 passed).
- **One test per mode with generous timeouts** for `result()`: the v1.2 result test was split into 8 tests (mode x win/lose). The growth every-mode test runs five duels and got a 20 min timeout (6 min timed out on CI).
- **Test every world's map opens** (`tests/map.spec.js`): a decor change for one world broke another world's map (section 13).
- Tests that depend on today's date (Halloween: `?halloween`, streak: `TODAY`) must pin it in the query or the save.
- Parallel agents (QA, dev) on one machine: give each its own port and its own config file (copy `playwright.config.js` with a different port and `reuseExistingServer: false`)
  or two runs will share one server and one `test-results/` folder.
- **NEVER `pkill -f <pattern>`**: the pattern also matches your own shell command line and kills the session. Find the PID (`ss -ltnp`, `pgrep`) and `kill <pid>`.
- The suite is big on purpose: `result.spec.js` (every battle mode), `rotate.spec.js`, `music.spec.js`, `cloudsave.spec.js`, `layout081.spec.js`, `map.spec.js` are the ones that caught real bugs.

Test ideas that came from QA reports (add the same kinds early): a layout checker on 5 sizes with a max-content save; result screen in every mode, win and lose; 20 viewport flips; BACK at the
worst moment; re-enter a scene right after leaving it; migrations on old saves and on partial saves; two-device sync with a stubbed cloud.

---

## 10. CI (`.github/workflows/test.yml`)

- Triggers: `push` on all branches and `pull_request`.
- Job `browser-tests`: `runs-on: ubuntu-24.04` (pinned with a comment: Playwright 1.56 has no browsers for `ubuntu-latest`, which became 26.04; fix commit `a6de385`),
  `timeout-minutes: 60`, `strategy.matrix.shard: [1,2,3,4,5]` with `fail-fast: false`.
- Steps: `actions/checkout@v4`, `actions/setup-node@v4` (Node 22), `npm install --no-audit --no-fund`, `npx playwright install --with-deps chromium`,
  `npx playwright test --shard=N/5`, upload `playwright-report` on failure (7 days).
- History of the limits: 45 min single job (v0.8, 81 tests) -> 3 shards -> 5 shards and 60 min (v0.9, about 130 tests). Raise shards before raising timeouts.
- Playwright version is pinned exactly (`1.56.0`) so browsers and runner image stay in step. When bumping Playwright, bump the pinned runner image deliberately.
- Known noise (not bugs): a Supabase "Preview" check is skipped (the repo has no branching setup); GitHub shows a "Node 20 actions deprecated" warning for the `@v4` actions [?, from the owner's
  notes, not visible in the repo]. Do not chase either.
- CI is the full suite. Light QA passes by the agent do NOT run it (section 12).

---

## 11. Release checklist and process

Process (owner's rule): `game-designer` agent writes a design doc in `docs/gdd/` (new world, rival, move, mechanic, reward, event, balance change; NOT for bug fixes/hotfixes) ->
development on one branch and one PR per task -> `/code-review` -> `qa-tester` agent -> the owner's OK -> merge.

Checklist:
1. Bump `VERSION` in `js/game.js` and `CACHE` in `sw.js` to the same number (`plushsquad-vX.Y.Z`). Without it the old service worker cache can serve old code.
2. `WHATS_NEW` in `js/extra.js` is keyed by major.minor; **hotfixes never go into What's new**; new features go into the next major.minor list.
3. Add a line to `docs/CHANGELOG.md` in every PR (game change for the player, decision, new doc). New docs also go into `docs/_sidebar.md` and `docs/README.md`.
4. `/code-review` before opening the PR (`ultra` for big features). Fix all Important findings. Say in the PR description in a few lines what was found and fixed.
5. `qa-tester` agent on the change. Report goes to `docs/qa/Plush_Squad_vX.Y.Z_QA_Report.md`, committed in the same PR. Verdict goes into the PR description. **Any S1 or S2 blocks the merge.**
6. Tests green on CI. Merge to `main` only after the owner's OK. A **draft PR must be marked ready** before it can be merged [from experience].
7. After merge check that `https://<pages-url>/sw.js` shows the new `CACHE` (live in about a minute).
8. Update `README.md` "Versions" for feature releases. Tell the owner what changed in one short list.
9. Feature releases: the `game-designer` agent syncs `docs/gdd/` with the code (GDD, `decisions.md`, `ideas.md` with a check mark, new G-IDs in `findings.md`).

Tracker: GitHub issues only (the owner reads them in the GitHub app; board = GitHub Project, Todo / In progress / Done). One issue per bug and per task. Labels: `bug` + `S1`-`S4`,
`design`, `gdd`, `hotfix`, version label. Bug titles start with the QA ID (`B38: ...`). Open the PR early (moves the card to In progress). PR description lists `Fixes #N`, one per line.
A new bug found by QA or review and not fixed in the same PR gets an issue at once. Commit messages in English. Commits end with the attribution lines the harness gives you.

Decision log: `docs/gdd/decisions.md` (owner decisions, newest on top; agents treat them as rules, a change is proposed only as an explicit question).
Branch names used: `claude/v1.2-emoji`, `claude/v1.1.1-hotfix`, `claude/handoff-titans`. Pattern: `claude/<version-or-topic>`.
Hotfix exception once (v0.7.8): merge without asking if QA finds nothing new, then tell the owner. Otherwise never merge without the OK.

---

## 12. Agents (`.claude/agents/`)

Both are plain markdown files with front matter (`name`, `description`, `tools`, `model: inherit`). Copy and rename for plush-titans.

- `qa-tester.md` (tools: Read, Grep, Glob, Bash, Write). Independent tester, never edits game code (writes only the report in `docs/qa/`, scratch scripts in `/tmp`, tests when asked).
  Inputs: the diff, `CLAUDE.md`, the last QA report. Method: code review of the diff (modes, negative indexes, state on reused scenes, rotation, timers that survive a scene change) -> run the suite
  -> scripted play in headless Chromium with `?debug` handles -> **layout matrix on 5 sizes** (D1 375x667, D2 390x844, D3 768x1024, D4 1024x768, D5 844x390) with a "max content" save and an
  off-screen / overlap checker plus screenshots -> **fixed regression list** every time (result in every mode, rotation cases, bedtime, boosters, music, map start world) -> exploratory play like a 10-year-old.
  Severity: S1 crash or lost progress, S2 wrong result/exploit, S3 works wrong but game goes on, S4 cosmetic. Report sections: 0 summary + verdict, 1 fix verification, 2 regression results,
  3 bug status (IDs kept, new IDs continue after the highest), 4 layout matrix, 5 ideas for the Playwright suite, 6 not tested (IOS-xx real device, ON-xx online).
- `game-designer.md` (tools: Read, Grep, Glob, Bash, Write, WebSearch, WebFetch). Writes `docs/gdd/<version>-<feature>.md` from the real numbers in the code. Fixed sections: pitch, fit, content tables,
  signature mechanic, balance (current vs proposed), rewards, audio and look, acceptance criteria for QA, What's new text, open questions for the owner. Also GDD sync after a release (G-IDs in
  `findings.md`), difficulty review, idea log. Hard rules: owner decisions stand, kid-safe and fair (no shop, no ads, no loot-box pressure, no FOMO timers aimed at kids, no punishing streak loss),
  feasible with existing art and synthesized sound.
- Reuse notes for an idle game: add to the designer rules "no pay-to-win, no timers that punish leaving, offline reward always positive"; add to QA's fixed list: offline progress after a long
  absence, tab hidden/visible, huge numbers formatting, prestige reset, save migration from the previous version.
- **Cheap default (from the owner's cost experience): light QA on Sonnet with 2 screen sizes** (a phone portrait and an iPad landscape, scope = only the diff) catches most of what matters.
  The v1.0.0, v1.1.0, v1.1.1 and v1.2.0 reports are all "light pass" and found real issues (B69-B78). Run the full 5-size matrix only for big releases.
- Agents must use their OWN ports and config (section 9) and must not run `pkill`.
- Cost lessons: use cheaper subagents for tests and QA; the owner hits usage limits, so **resume an agent with SendMessage instead of starting a new one** (a new agent re-reads everything);
  run at most 2 agents at the same time; give each agent the exact rules and file paths up front so it does not explore.

---

## 13. Lessons from bugs (B01 to B78), by category

IDs are the QA tester's. Full text in `docs/qa/*.md` (13 reports). Fix lines are from the reports and the git log.

### 13.1 Layout and paging
- B01 booster picker did not fit iPad; B07 capsule machine second row; B05 My Squad overflow; B06 Sticker Album overflow (22+ stickers); B15 Parents chart; B16 Quests in landscape;
  B11 Me hat row over the account text on iPad portrait. Lesson: **every list that can grow needs pages or a scroll from the first version.** Test with a max-content save (14 toys, all stickers).
- B09/B32 result notes fit but were 17 px; B59 long quest texts tiny in landscape; B75 COPY strips tiny; B52 "PILLOW HILLS" about 9 css px on phones. Lesson: **set a minimum text size
  (about 24 game px, bigger for anything the kid must read)** and check `fit()` scale, not just fit. A text shrunk to fit a column can be unreadable.
- B39 move-card icon touched card top and title; owner note: greyed cards showed strips (three stacked translucent layers plus container alpha: shadow and highlight bled through).
  Lesson: draw a dedicated disabled look (flat colour) instead of `setAlpha` on a layered container.
- B18/B44/B55 title level panel vs Jack's wing / the hat on 4:3 and 768x1024 iPads. B48/B54/B56 chips and buttons covering each other. B57 comic panel: Jack hidden by a fixed-position snow mound.
  Lesson: **derive positions from object sizes and from W/H, never fixed numbers**; check iPad 4:3 and iPad portrait, not just phones.
- B70 toy page: ADVENTURE overlapped PLAYING on iPad landscape; B71 Adventures list: SAY GOODBYE covered 2 of 3 postcards, day line about 11 px; B74 tutorial hands covered text; B72 map node
  on a lighthouse, log line over trees, HIDING! stamp over card names; B77 bunting over map node labels. Lesson: iPad landscape is the size that breaks new screens; always test it first for any new screen.
- B64/B66/B67 comic bubble tails, bubble covering the hero, Zzz from the tail. B51 Spooky tab covered the capsule button; B53 pines floating in the sky in Star Catch.
- B69 **art cut off by the source image**: `brocklee.png` had its right side cut by a straight line. Check the alpha bounding box of every image with a script; ask for exports with a margin.
  Fixed by mirroring the left side with a soft seam. Add a test that the outer columns of key art are transparent.
- B73 Poland picture had the flag the wrong way round; the owner kept his art (owner decision, "won't fix"). Lesson: owner-supplied art is his call; log the question, do not redraw it. Check flags and
  real-world symbols against the real thing and ask once.

### 13.2 Touch
- B26 touch targets under 90 px; B19 Parents YES/NO overlapped; B27 no press-down feedback; B62 mail arrows tiny (fixed 160 x 100); v1.1.1 capsule checkbox 90 px.
  Lesson: **minimum 90 game px per interactive object, with gaps, and a visible press-down state** (scale tween on `pointerdown`). Kids tap fast and double-tap.
- A hand-pointer tutorial must not cover text (B74). First-use hints appear once (`stats.alarmSeen`, `pushSeen`, `copySeen`).
- Real mouse/touch clicks in tests, not only `emit('pointerup')`, because the real path caught different layers (QA v1.2.0 idea).

### 13.3 Toasts and popups
- B37 sticker toasts lost on rebuild; B40 a toast on a screen the kid already left held rotation; B72 sticker toast covered the title logo; B43 migrated hats were never announced (gift toast).
  Lesson: toasts need a queue that survives rebuilds, die with their scene, never sit on the logo or the hero, and never block input or rotation for long. Count live toasts in one place (`__psToasts`).

### 13.4 Rotation
See section 6: B02, B31, B34, B35, B36, B37, B38, B40, B47, B22, plus the capsule-opening loss (v1.1.1).

### 13.5 Saves and sync
- B60/#64 two devices overwrite each other (S2). #61 login lost cloud progress. B14 logout must push the last seconds. B47 stats bumped in memory lost on rebuild (store before destroying the old game;
  `Save` lived inside `main()`, so a store outside it did not run). B76 `Save.migrate` throws on a partial save. B65 new player got XP before TAP TO PLAY and never got the Hills comic (the "new player" test
  used XP; use a flag or stars). B10 quests carried over days. v1.1: cloud saves from older clients skipped migration. #76 delete removed other devices' photos. Details in sections 7 and 8.

### 13.6 Scene reuse: state not reset
- B30 booster refund worked once per session: `boostRefunded` lived on the reused Battle instance, never reset (reset it, and `acted`, in `init()`).
- v1.1.1 Brock Lee re-entry crash: `logBg` was a destroyed object. v1.2: after REMATCH `emoLog` must be empty, the solo flag reset, and exactly one `pointerdown` listener (listeners added in `create()`
  pile up on a reused scene unless removed in shutdown).
- Lesson: **in `init()`/`create()` reset every field you add; remove listeners and timers on `shutdown`.** Write a "leave and come back" test for every scene with state.

### 13.7 Timers and clocks
- B03 bedtime checked only on menus and before a NEW duel (never mid-duel); B33 REMATCH on the Kraken skipped the daily try check; #65 no daily gift at bedtime; B10 quest day roll-over.
  Streak and day logic share ONE date helper (`todayKey`, local date) and use calendar day numbers (`dayNum`), not 24 h arithmetic. Pillow Week has clock-skew rules (`H36`, a "fix" step when the clock was
  far ahead, no punishment for a missed day beyond a quiet restart).
- Phaser timers are scene-clock based, so a hidden tab or a stalled frame does not behave like wall time: SAVE IT! treats a stall before the launch as never a miss. Mini-game timings must tolerate frame
  stalls (code review in v0.8).
- Slow devices: the audio scheduler resets after a pause instead of firing a backlog.

### 13.8 Battle engine and modes
- **v0.7.5 shipped a `result()` crash in friend and Kraken duels** (B20 regression: `isUnlocked(-1)` with a negative `rivalIdx`). The QA tester only re-tested campaign. Since then: **run the result tests for
  EVERY mode** (campaign, campaign boss, own toy, friend's toy, friend's Jack, Kraken), win and lose, before touching `result()`, `finish()` or any battle code. `tests/result.spec.js` does this; the
  mode is in the fixed regression list.
- Negative `rivalIdx` (toy -1, friend -2, boss -3) is a trap for any array lookup. Code paths that work in one mode only are the top review question.
- B49 EASY text promised a card steal that never happens: text must match mechanics on every difficulty. B45/B46 shared lines assumed singular names ("The Blips" are plural).

### 13.9 Regressions from shared code edits
- **"Decor change broke another world's map":** commit `9847a07`, "Veggie Patch map fence lost its ground line in the B77 change (map did not open)". The B77 fix (bunting off the map nodes) edited a shared
  map-decor function and one world's map stopped opening. Nothing caught it until the next QA. Fix: `tests/map.spec.js` opens EVERY world's map. Lesson: **when you change a shared function, add a test that
  runs every caller**; keep per-world decor in per-world functions.
- B53 `canadaDecor()` placed pines using a value meant for the map in every scene. Per-world code must check which scene is calling it.
- World index shifts (section 7).

### 13.10 Content and filters
- B13 and B61 kid-safe name filter: first Latin only, then Cyrillic look-alikes and transliteration slipped through; it must read real words one at a time and glue only spelled-out letters
  ("Sushi Tiger" and "Kung Fu Kitty" must stay legal; code review caught false positives). Apply the filter on every read path of other players' names, not only at input.
- B24 a reward (Royal Crown) was not announced; B42 reward text too small; B43 gifts never announced. Lesson: every reward gets a visible, readable announcement exactly once.
- B68 What's new said "all 4 comics" while only 3 showed out of season. Check copy against seasonal state.

### 13.11 Process lessons
- QA IDs: B50 was taken by a GitHub issue number, so IDs can clash with issue numbers. Keep B-IDs in titles, issue numbers after `#`.
- Early release of v0.8.1 happened without a full QA run (owner's call); the follow-up QA found B60 (S2). Do not skip QA on anything touching saves or sync.
- B78 (BACK during OPEN 10) came from a hotfix that added a multi-step animation with an early exit. Any animation that spends something must either be un-skippable or take the item at the END.
- "Sleepy Thully never answers an emoji while asleep" (v1.2 note): a silent response looks broken to a kid. Prefer a small reaction over nothing.

---

## 14. Owner preferences (Kondrat)

- Communication: the owner often reads and answers from his phone, in Russian; keep messages SHORT. Ping him only when a decision is needed. **Ask decisions as tappable multiple-choice
  questions (AskUserQuestion), one decision per question, recommended option first.** Write repo docs and code in English. Prose: plain, short, **no em-dashes**, mark guesses with [?], no flattery.
- Small, safe steps; one branch and one PR per task; tests green before merge; his OK before merge; hotfixes never go into What's new; version label bottom-left on the title screen.
- Hotfix vs feature: bug fixes and hotfixes skip the design doc and What's new. Features need a design doc approved by him first (his answers are recorded in `decisions.md`).
- Kid-safety rules (all in `decisions.md`, treat as law):
  - no shop, no ads, no purchases, no paid currency; capsules only from play, quests and friends; no in-game donations;
  - no chat and no free text between players; friends only by code; the one exception is closed preset sets (16 emoji in duels, a few preset stickers), validated on read;
  - parent gate is the multiplication table; real deletes and all time limits sit behind it;
  - bedtime and daily limit apply to every mode and never cut a running duel;
  - funny, never scary or violent (rivals "giggle and give up"), no mockery or politics in country/flag content; seagull-type characters are never hit;
  - calm mode (reduce motion) and left-handed layout exist for comfort;
  - no punishing streak loss (Pillow Week restarts quietly), no FOMO timers aimed at kids.
- The chief tester (age 10) asks for: harder duels ("too easy"), new worlds, mini-games, real-life quests, emoji. The chief tester's ideas became the best parts of the game (the extinguisher block, Polandball). Treat
  tester feedback pasted by the owner as the most important input.
- Art:
  - **Fluent Emoji 3D** (MIT, from the `microsoft/fluentui-emoji` repo via `raw.githubusercontent.com/microsoft/fluentui-emoji`) packed into atlases (`icons.webp`, `icons2.webp`, `icons3.webp` + json) and single PNGs;
  - owner-supplied pictures (made with an image AI or drawn) are cut out with OpenCV / flood fill and given a white sticker outline;
  - avoid trademarks (Godzilla was replaced by Sushi Toss), real people, and logos; owner decisions on art are final (Poland picture, Sasquatch);
  - credits: Poppins (OFL), Fluent Emoji (MIT), ormbg (Apache-2.0), MobileCLIP (Apple sample-code licence).
- Release: itch.io is a second channel (`tools/itch-build.sh`, SW disabled on itch hosts, privacy note in `docs/itch/privacy.md`, a Roblox version is parked in `ideas.md`).
- Docs live in the repo, not in Notes or Reminders. No handshake blocks unless the owner asks for one.

---

## 15. Start here: plush-titans checklist

### 15.1 Copy (then trim)
- `tests/helpers.js` (boot with a seeded save, `fast()`, `wait`, `go`, `offscreen`, `noErrors`) and `playwright.config.js`; keep `package.json` with an exact Playwright version.
- `.github/workflows/test.yml` with `runs-on: ubuntu-24.04` pinned, sharding, 60 min, `fail-fast: false`.
- Layout and safe-area code from `js/game.js`: `viewSize`, `insets`, `main()` sizing block, `safeCam`, rectangle patch, `bottomGround`, `bottomFade`, `tintPage`, and `#game` / `#safe` CSS from `index.html`.
- `txt`, `fit`, `button`, `img`, `iconScale`, `panel`, `chip`, `fade`, `backButton`, `muteButton`, `press`, `tw`, `wait`.
- `rebuild()` / `snapshot()` / `__psBlockRotate` / `__psTryRebuild` plus the launch rechecks and `viewChanged()`.
- `js/audio.js` whole (engine, `voice`, `drum`, `swell`, crossfade); write new tracks.
- Plugin pattern (`PSPlugins`, `PS`, `emit`), `js/settings.js` (device-only prefs, calm mode), What's new (keyed by major.minor), Parents gate, Bedtime, `todayKey`/`dayNum`.
- `sw.js`, `manifest.json`, the `index.html` SW registration (reload once), `tools/itch-build.sh`.
- Photo pipeline only if the product needs it: `js/toyworker.js`, `vendor/tjs/`, `assets/arch_emb.json`, Studio functions, `IDB`.
- `net.js` account/sync core and `supabase/schema.sql` (profiles, recovery, saves, toys, RLS, storage policies) if you want accounts. Drop boss, museum, catch board unless wanted.
- `.claude/agents/*.md`, the release checklist (section 11), the issue/label/PR rules, the `docs/` layout (`gdd/decisions.md`, `ideas.md`, `findings.md`, `qa/`, `CHANGELOG.md`, docsify `index.html`).
- A `CLAUDE.md` modeled on this repo's: run/test commands, debug handles, process, release checklist, gotchas, owner rules. Keep it accurate (this repo's drifted: file sizes, `?localmodels`).

### 15.2 Do differently from day one
- **Keys, not indexes:** worlds, seasons, generators, upgrades, prestige tiers get string ids. Save stores ids. Order is a separate array. Never `lastWorld: 3`.
- **`Save.migrate` from v1:** a `version` number in the save plus ordered steps (`if (d.v < 2) {...}`), idempotent, tolerant of partial saves, run on local load AND on every cloud save, with a test per step on a
  hand-written old save. (Plush Squad used `mig08..mig11` boolean flags; it worked but needed care.)
- **Split the core file** early (scenes in separate files, shared UI in one file). 5000 lines in one IIFE made reviews and merges slow.
- **A test per scene:** open it at 5 sizes with a max-content save and run the layout checker; open EVERY world/zone/screen in a loop test; leave-and-re-enter test for scenes with state.
- **Tests robust to slow CI from the start:** pin dates, seed all "seen" flags, put timers behind debug-overridable fields, do multi-step interactions inside one `evaluate`, never return Phaser objects
  from `evaluate`, run the suite under CPU throttling 4-6 before pushing, one test per mode with long timeouts, no real-time sleeps for game logic.
- Reserve a debug API (`window.__titans` with `?debug`) with: `tick(ms)` to advance the economy, `setSave`, `giveCoins`, `fastForward(hours)`, `forceEvent`. Idle games need time control in tests.
- A text-size and touch-size rule enforced by a helper (`MIN_TEXT = 24`, `MIN_TAP = 90`) that the layout checker also asserts.
- Put `todayKey` / `dayNum` style date helpers in one file; never `new Date()` scattered in scenes.

### 15.3 Idle-game specific advice (new advice, not from Plush Squad code; verify before relying on it)
- **Offline progress:** store `savedAt` (ms) in the save on every store and on `visibilitychange` hidden / `pagehide`. On load and on becoming visible compute
  `elapsed = clamp(now - savedAt, 0, MAX_OFFLINE)` (for example 8 h, owner to decide; kid-safe, no punishment). Treat `elapsed < 0` (clock moved back) as 0. Award progress once, show a "welcome back"
  popup, and save immediately so a second launch cannot pay twice. Plush Squad's clock rules to mirror: calendar-day helper, "fix quietly" if the clock was far ahead (`streakStep`, `H36`).
- **Tab visibility:** `requestAnimationFrame` and Phaser timers stop or throttle in a hidden tab, and iOS suspends the page entirely. Drive the economy from `Date.now()` deltas (capped per frame, with
  a catch-up step), not from frame counts. On visible, run the offline path.
- **Cloud vs offline progress:** newer `savedAt` wins (section 8). With an idle game both devices keep earning, so decide the rule early (take the bigger total, or the newer) and ask the owner
  [?]. Never push before the first sync.
- **Number formatting:** use a single formatter for big numbers (K, M, B, then letters or scientific), safe for `NaN`/`Infinity`; keep values in doubles, decide where a big-number library is needed
  (past 1e300) before it is too late. Add a test that formats edge values.
- **Tap handling:** a tap is a `pointerup` handler on a big target (90 px or more), with press-down feedback, throttled sound and capped particles (calm mode must drop shake and confetti).
  Support two simultaneous pointers (`activePointers: 2`) since kids tap with two fingers.
- **Fairness rules from the owner's list apply:** no shop, no ads, no paid currency, no FOMO timers, no punishing absence, bedtime and daily limit respected (idle progress must not tempt the kid to
  stay up: consider that parents' play-time limits still count real play only).
- **Photo heroes in an idle game:** the toy generator gives a type, an element and a quirk; map them to idle bonuses instead of moves. Keep the cut-out picture as the tap target.
- Ask the owner (as AskUserQuestion buttons) before locking: max offline hours, prestige design, whether accounts and friends are in v1, and the world list.

---

## Appendix A: commands

```
python3 -m http.server 8765            # play: http://localhost:8765/index.html?debug
npm install && npx playwright install chromium && npm test
npx playwright test tests/result.spec.js     # one spec
EMO_THROTTLE=5 npx playwright test emoji12  # slow-CPU reproduction
sh tools/itch-build.sh                  # dist/plush-squad-itch-<version>.zip
```

Query switches: `?debug` (handles), `?halloween` (force the October event), `?localmodels` (toy models from `models/`).

## Appendix B: facts I could not fully verify

- The OST render script for YouTube is not in the repo; section 4 only describes the approach from `tests/music.spec.js`.
- How `assets/arch_emb.json` was produced (no generator in the repo).
- The Hugging Face local folder layout under `models/` (inferred from `env.localModelPath`).
- Why `numThreads = 1` (assumed: no cross-origin isolation on GitHub Pages).
- iOS memory and WebGPU behaviour for the toy worker (the code is WASM only; no notes in the repo).
- The "Supabase Preview check skipped" and "Node 20 deprecation warning" notes come from the owner's session lessons, not from files in the repo.
- Draft PR must be marked ready, SendMessage resume advice, at-most-2-agents advice, private test configs per port, never `pkill -f`: from session lessons, not documented in repo files.
- Fluent Emoji source URL and the OpenCV / flood-fill cut-out method: from session lessons, no script in the repo.
