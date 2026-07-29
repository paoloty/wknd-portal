# Games list (`/games`)

**Kind:** page
**Status:** built

## Routes
- `GET /games` — public, `server.js:4133-4152`

## Primary files
- Route handler: `server.js:4133`
- View: `views/games.js` — `gamesPage({ games, highlights })`

## Data flow
1. Same base fetch pattern as [[home]]: `getAllTeams()`, `getAllPlayers()`, `byDate(getAllGames())`.
2. `completedGames` filtered identically (`!scheduled && !under_review`, combined score > 0).
3. `buildHighlights(completedGames, playerMap, teamMap, 10)` — note the explicit `10` limit here vs. the default limit used on `/` and `/standings`.

## Edge cases / gotchas
- `gamesPage` only receives `{games, highlights}` — team/player maps are used locally to build highlights but not passed through, so the view must resolve names some other way (likely embedded in `games` rows as `team_a_name`/`team_b_name` per the schema in [CLAUDE.md](../../../CLAUDE.md)).
- For individual game detail, see [[game-detail]].

## Related docs
- [[game-detail]] — `/games/:ref`
- [[home]] — near-identical data fetch, different highlight count
