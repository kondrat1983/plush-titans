# Decisions

Owner decisions, newest on top. Agents treat them as rules; a change is proposed only as an explicit question.

## 2026-10-27 (M0 economy)
- **Stages go on past 30 in M1** (stronger Titans, same art) until M2 adds worlds. The game does not end at Professor Hoot.
- **Offline stars at night count the squad as it was before the Bedtime reset** (a small morning head start).
- **10 Titans per normal stage** (one on a boss stage).
- Accepted: a fast start (world 1 in about 2 days at 15 min a day), then slower. See `docs/economy/README.md`.

## 2026-10-27 (merging)
- **Claude merges its own PRs** after CI is green and QA found no S1/S2, then tells the owner what changed.
  Things that wait on the owner's approval (battle mock-up, design docs, Supabase changes) still wait.

## 2026-10-27 (open questions, spec §11)
- Name: keep **Plush Titans**.
- Game UI language: **English first**, as in Plush Squad; UK/RU later.
- Offline cap: **fixed 8 h in M1** (not tied to the bedtime-to-morning window).
- Accounts in M2: **share Plush Squad's Supabase project**, one account for both games, tables `titans_*`.
- Business model: decide in M3. **No purchase code of any kind before M3.**
- `ub-mode` skill: **not installed.** Its principles are adopted in `CLAUDE.md` (test first for logic, test behaviour
  not implementation, fix root causes, small commits).
- This repo's sessions may read `kondrat1983/plush-squad` to reuse code.

## 2026-10-27 (spec)
- Tech stack: Phaser 3 (same major as Plush Squad), PWA on GitHub Pages, reuse the Plush Squad toy capture and audio. Godot rejected. (spec §3)
- Order of work: M0 economy simulator, then a static battle-screen mock-up approved on iPhone, then M1. (spec §0)
