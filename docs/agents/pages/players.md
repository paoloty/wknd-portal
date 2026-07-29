# Players (`/players`, `/players/:ref`)

**Kind:** page
**Status:** built (both list and detail — detail is also the `/me` dashboard)

## Routes
- `GET /players` — public, `server.js:4895-4902` — plain list
- `GET /players/:ref` — public, `server.js:4911-4966` — detail; `:ref` resolved via `resolveRef('player', ref, getPlayerById, playerSlug)` with id→slug redirect
- `GET /me` — `server.js:2265-2271` — **not a separate page**. Requires `session.playerRegId`; just redirects to `/players/<own-slug>`. The "player dashboard" is this same detail route with `isOwnProfile === true`.

## Primary files
- Route handlers: `server.js:4895` (list), `server.js:4911` (detail)
- View: `views/players.js` (567 lines) — `playersPage({ players, isAdmin })`
- View: `views/player.js` (693 lines) — `playerPage({ player, totals, statsByType, gameLogs, potgGames, careerHighs, awards, financialSection, isAdmin, isOwnProfile, balanceAmount, papawisGames, coachNote })`

## Data flow (detail route)
1. Base data for every viewer: `getPlayerWithTeam`, `getPlayerTotals` (career totals), `getPlayerStatsByType`, `getPlayerGameLog`, `getPlayerCareerHighs`, `getPlayerAwards`; `displayPlayerName(player.name)` converts `"LASTNAME, Firstname"` → `"Firstname LASTNAME"` per the project-wide convention.
2. POTG-games list: filters `getPlayerPotgCandidates(id)` down to games where this player was POTG, using the same manual-override-then-derive pattern as [[game-detail]] (`manual_potg_player_id` if set, else `derivePotgPlayerId`).
3. **If `session.isAdmin`:** builds `financialSection` via `playerFinancialSection(...)` — the embedded ledger widget, full transaction table included. See [[ledger-balance]].
4. **If `isOwnProfile`** (viewing your own player page while logged in as that player): adds `balanceAmount` (a bare number only — no transaction list, this is the known gap, see [[ledger-balance]]), `papawisGames` via `getPapawisGamesForPlayer` (see [[papawis]]), and `coachNote` via `await getOrGenerateCoachNote(...)` (see [[player-analysis]]) — this last call is where the AI coaching writeup gets generated/cached on page load.

## Edge cases / gotchas
- `isOwnProfile` and `isAdmin` are independent flags — an admin viewing their *own* profile gets both the full ledger widget *and* the own-profile extras (balance/papawis/coach note) rendered in different sections.
- A regular player viewing **someone else's** profile gets neither branch — just the base stats.
- The three "extra" features bolted onto this one route (ledger, papawis, coach analysis) are each documented as their own feature doc precisely because this route is where they converge — see the three linked docs below for the actual logic.

## Related docs
- [[ledger-balance]] — financial section / balance
- [[papawis]] — `papawisGames`
- [[player-analysis]] — `coachNote`
- [[game-detail]] — shares the POTG derivation pattern
- [[teams]] — same `resolveRef`/slug-redirect pattern
