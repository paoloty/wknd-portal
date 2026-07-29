# Teams (`/teams`, `/teams/:ref`)

**Kind:** page
**Status:** list built · detail is a stub

## Routes
- `GET /teams` — public, `server.js:4839-4873` — built
- `GET /teams/:ref` — public, `server.js:4875-4893` — **stub only**: resolves the ref via `resolveRef('team', ref, getTeamById, teamSlug)`, redirects id→slug, but on a valid team renders `comingSoonPage({ label: team.name, description: 'Team rosters, stats, and season averages are on their way.' })` — no roster/stats view exists yet. This matches the unchecked `[ ] /teams/:id` box in [CLAUDE.md](../../../CLAUDE.md).

## Primary files
- Route handlers: `server.js:4839` (list), `server.js:4875` (detail stub)
- View: `views/teams.js` — `teamsBody({ teams })` (list only; detail uses `views/coming-soon.js`)

## Data flow (list only)
1. `getAllTeams()`, `getTeamRecords()` (W/L per team), `getPlayersWithRatings('')` (all active players with computed ratings).
2. Players are grouped by team via a name-based lookup (`teamIdByName`, uppercased team name → id) rather than joining on `team_id` directly — a byproduct of `getPlayersWithRatings` returning `team_name` instead of `team_id`.
3. Per team: `avgOvr`/`avgOff`/`avgDef` are computed client-side-in-route by averaging `eff_overall`/`eff_scoring`+`eff_shooting`/`eff_defense` across that team's rated active players (`avgOf` helper, `server.js:4856`); `rosterCount` is just `plrs.length`.

## Edge cases / gotchas
- Only `status === 'active'` players count toward roster/rating averages — inactive/waived players are excluded silently.
- Building `/teams/:id` for real means replacing the `comingSoonPage` call at `server.js:4887-4892` with a real roster+averages view — the team object and OG tags (`buildTeamOgTags`) are already wired, only the body template is missing.

## Related docs
- [[players]] — same `resolveRef`/slug-redirect pattern, and the player detail page this would link to per-roster-row
