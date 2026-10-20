# DSA Desk

A cozy desktop study companion for placement prep. It's built around the 203-problem
**DSA Prep Guide** (`DSA_Prep_Guide.pdf`) and syncs your progress from LeetCode,
Codeforces, AtCoder and GeeksforGeeks.

- **Today**: a problem of the day from your sheet (fixed for the day), the LeetCode
  Daily, the GFG POTD, and Codeforces/AtCoder picks near your rating.
- **Try next**: unsolved sheet problems scored by priority, your roadmap week, and
  weak topics. Harder problems wait until the easier ones in that topic are done.
- **Revision**: spaced repetition (1 → 3 → 7 → 14 → 30 → 60 days) driven by how
  confident you felt, plus the guide's 10 timed interview simulations.
- **Mistake Log, Stats, streak and heatmap**, a focus-mode timer with hints, ambient
  rain/brown noise, light ("paper") and dark ("night desk") themes, and a tray reminder.

## Run it

```sh
npm install
npm run dev          # development with hot reload
npm run build:win    # Windows installer → dist/DSA Desk Setup x.y.z.exe
```

## Checks

```sh
npm run typecheck
npm test             # offline unit tests (recommender, revision, picks, streaks, guide data)
npm run smoke:sync   # live calls to each platform API (SMOKE_LC / SMOKE_CF / SMOKE_AC / SMOKE_GFG to override accounts)
```

## Data

- `data/guide.json` is generated from the PDF by `npm run guide`
  (`scripts/extract-guide.py`, stdlib-only Python). The script asserts 203 problems and
  checks that every revision-list and simulation name resolves.
- Your progress lives in `%APPDATA%\DSA Desk\dsa-desk.db` (SQLite). Nothing leaves your
  machine except requests to the platforms themselves.
- LeetCode only exposes your 20 most recent solves publicly. To import your full history,
  paste your `LEETCODE_SESSION` cookie in Settings.
- GeeksforGeeks has no official API, so its sync and POTD use the site's own endpoints
  and may break if GFG changes them.

## Layout

```
src/main/        Electron main: SQLite store, IPC, tray + reminders
  engine/        recommend.ts · revision.ts · potd.ts (pure, unit-tested)
  sync/          leetcode · codeforces · atcoder · gfg · tag→topic map
src/preload/     typed window.api bridge (contract in src/shared/api.ts)
src/renderer/    React UI: pages/, components/, lib/
```
