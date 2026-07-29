# Standings (`/standings`)

**Kind:** page
**Status:** built

## Routes
- `GET /standings` — public, `server.js:4154-4170`
- Sibling: `GET /playoffs` — public, `server.js:4172-4181` (separate view, `views/playoffs.js` — `playoffsPage({ standings, games, season })`, backed by `getSeasonStandings(season)` + `getPlayoffGames(season)`; not in the original page checklist but exists and is built).

## Primary files
- Route handler: `server.js:4154`
- View: `views/standings.js` — `standingsPage({ teams, games, highlights, teamStats })`

## Data flow
1. Same base fetch + `completedGames` filter as [[home]] and [[games]].
2. `buildHighlights(completedGames, playerMap, teamMap)` — default limit (no explicit count, same as home).
3. `getTeamSeasonStats()` — the actual standings numbers (W/L, likely streaks/point diff) — this is the one call unique to this route.

## Edge cases / gotchas
- `/playoffs` is a structurally separate route/view with its own season-scoped queries (`getSeasonStandings`, `getPlayoffGames`) rather than reusing `getTeamSeasonStats` — don't assume the two pages share a data source.

## Related docs
- [[home]], [[games]] — same base game-fetch pattern
