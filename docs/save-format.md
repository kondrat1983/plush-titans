# Save format

Code: `js/save.js`. Tests: `tests/unit/save.test.js`.

## Keys in localStorage

| Key | What | Synced later (M2) |
|---|---|---|
| `plushtitans_v1` | the game save (JSON, below) | yes |
| `plushtitans_prefs` | device-only prefs (sound on/off, volume, calm mode, handedness), comes with audio | never |

## `plushtitans_v1`, schema `v: 1`

| Field | Type | Meaning |
|---|---|---|
| `v` | int | schema version; never goes down |
| `savedAt` | ms | `Date.now()` at the last store; used for offline earnings |
| `run.stage`, `run.kills` | int | current stage and Titans asleep on it |
| `run.maxStage` | int | best stage of this run (Dreams at Bedtime come from it) |
| `run.stars` | number | stars to spend |
| `run.tapLvl` | int | tap power level |
| `run.heroes` | `{ id: level }` | squad levels by hero class id (`fluffy`, `bear`, `bunny`, `dino`) |
| `run.dreams`, `run.dreamsTotal` | int | Dreams to spend, Dreams ever earned |
| `run.dreamLvls` | `{ id: level }` | Dream upgrades (`nightlight`, `fort`, `lullaby`); kept across Bedtime |
| `bestStage` | int | best stage ever |
| `seen` | `{ flag: 1 }` | one-time announcements already shown |
| `seenVersion` | string | What's new shown for this `major.minor` |
| `parents.bedtime` | `"HH:MM"` or null | parent's bedtime |
| `parents.limitMin` | int or null | daily play limit in minutes |

`run` has the same shape as `PTEconomy.newRun()`, so economy functions take it directly.

## Rules

- Read and write in try/catch: private mode or a full disk never stops the game.
- `migrate()` runs on every load and every import (and on every cloud save in M2). It fills what is missing, repairs bad
  numbers (NaN, negative, fractions where a level is expected), never removes good data, keeps unknown fields and ids,
  and never lowers `v`. A test per future step, on a hand-written old save.
- Ids are strings, never array positions.
- Export / import (Parents screen) moves the whole save as JSON between iPhone and iPad. Import refuses anything that
  is not a Plush Titans save and stores the new one at once.
