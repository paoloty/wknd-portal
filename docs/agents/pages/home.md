# Home (`/`)

**Kind:** page
**Status:** built

## Routes
- `GET /` — public, `server.js:3578-3612`

## Primary files
- Route handler: `server.js:3578`
- View: `views/home.js` — `homePage({ teams, players, games, highlights, leaderPlayers, regBanner, signupBanner })`

## Data flow
1. `getAllTeams()`, `getAllPlayers()`, `byDate(getAllGames())` pull the full dataset — no pagination.
2. `completedGames` = games where `!scheduled && !under_review` and combined score > 0.
3. `buildHighlights(completedGames, playerMap, teamMap)` — latest-result / notable-performance blurbs (default limit, no count arg).
4. `buildLeaderPlayers()` — scoring-leaders snapshot, shared with `/leaders` (see [[leaders]]).
5. `regBanner` — shown only to logged-out visitors, only if `getSetting('reg_open', '0') === '1'`; text picked via `pickRegistrationBannerMessage()`.
6. `signupBanner` — shown only to a logged-in player (not admin) who hasn't yet completed the current season's signup (`getSeasonSignup` check against `signup_target_season`/`season_signup_open` settings). See [[registration]].

## Edge cases / gotchas
- `regBanner` and `signupBanner` are mutually exclusive by construction (one requires logged-out, the other requires logged-in-as-player) but both are computed unconditionally on every homepage load — cheap DB reads, not cached.
- `under_review` games are filtered out of `completedGames` for highlights but `games` (full list, unfiltered) is still passed to `homePage` — the view itself must not render under-review games in any other section.

## Related docs
- [[leaders]] — shares `buildLeaderPlayers()`
- [[registration]] — `signupBanner` logic
