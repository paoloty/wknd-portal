# Leaders (`/leaders`)

**Kind:** page
**Status:** built

## Routes
- `GET /leaders` — public, `server.js:4798-4810`
- Sibling: `GET /roast` — public, `server.js:4812-4837` (`views/roast.js` — `roastPage({ players, season, isLoggedIn })`; "worst performers" leaderboard, reuses `buildLeaderPlayers()` but is otherwise a separate page)
- Sibling: `GET /leaders/share/:id` — public, `server.js:4333` (`views/leader-share.js`; standalone shareable stat-card, independent of the `awards` table — see [[awards]] for how that differs)

## Primary files
- Route handler: `server.js:4798`
- View: `views/leaders.js` (509 lines) — `leadersPage({ players, playoffPlayers, season, gameRecords, currentSeason, asOfLabel, isLoggedIn })`

## Data flow
1. `buildLeaderPlayers()` — regular-season leader board (also used by [[home]] and `/roast`).
2. `getPlayoffLeaders()` — separate playoff-only leader set.
3. `getGameRecords()` — single-game records (high scoring games etc.), distinct from career/season leaders.
4. `asOfLabel` — built from `getSeasonLatestWeek(season)?.week`, e.g. `"S3 · WK 7"` — shows data currency, not just a static "current season" label.
5. `isLoggedIn` gates UI (not data) — computed as `!!(session.isAdmin || session.playerRegId)`.

## Edge cases / gotchas
- Do not confuse this with the **awards** "Statistical Leaders" section on `/awards` — that one reads confirmed `awards` rows; this page computes leaders live from stats every request. See [[awards]].

## Related docs
- [[home]] — shares `buildLeaderPlayers()`
- [[awards]] — separate, DB-backed "Statistical Leaders" concept
