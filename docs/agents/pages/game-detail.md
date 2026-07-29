# Game detail (`/games/:ref`)

**Kind:** page
**Status:** built

## Routes
- `GET /games/:ref` — public, `server.js:3614-3648`. `:ref` is a slug or raw id — resolved via `resolveRef('game', ref, getGameById, gameSlug)`, 302-redirecting id→slug when needed.

## Primary files
- Route handler: `server.js:3614`
- View: `views/game.js` (688 lines) — `gamePage({ game, stats, dnpPlayers, potgPlayerId, quarterScores, allGames, playerMap, teamMap })`

## Data flow
1. `resolveRef` 404s if the ref doesn't match any game; redirects `/games/<id>` → `/games/<slug>` when the canonical form is a slug.
2. `game.under_review` also 404s — under-review games have no public detail page (matches the `/games` and `/` list filtering).
3. `getGameDetailStats(game.id)` — box score; `getGameDnpPlayers(game.id)` — did-not-play list.
4. POTG resolution: `game.manual_potg_player_id` wins if set (admin override), otherwise `derivePotgPlayerId(game, stats)` computes it. This exact pattern (manual override → derive fallback) also appears on the player page's POTG-candidate list — see [[players]].
5. `extractQuarterScores(game)` — parses stored quarter data for the box score header.
6. `buildGameOgTags(req, game)` — Open Graph/Twitter meta for link previews.

## Edge cases / gotchas
- `game_writeup` and `potg_writeup` (the AI-generated or manually-edited recap/spotlight text) are fields on `game` itself, rendered by `gamePage` — generation is a separate admin-only flow, see [[ai-generation]].
- `allGames` (the full unfiltered list) is passed through, presumably for prev/next game navigation — it is not pre-filtered for `under_review`, unlike the detail game itself.

## Related docs
- [[ai-generation]] — recap/POTG writeup generation for this game
- [[games]] — list view
