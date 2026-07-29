# Papawis (Pickup Games)

**Kind:** feature
**Status:** built (renamed from "pickup games" per project memory)

## Routes
**Public:**
- `GET /papawis` — `server.js:5640` — gated by `papawis_enabled` setting; builds OG/Twitter meta with a dedicated share image.
- `GET /api/papawis/og-image.png` — `server.js:2011` — generates/caches a 1200×630 PNG (`buildPapawisOgSvg` + sharp).
- `POST /papawis/:id/join` — `server.js:5687` — logged-in player joins; blocked if outstanding balance > 0 (see [[ledger-balance]]).
- `POST /papawis/:id/cancel` — `server.js:5706` — blocked within `CUTOFF_DAYS` (3 days) of game day once confirmed.
- `POST /papawis/:id/viewed` — `server.js:5731` — fire-and-forget view-beacon for the roster modal.

**Admin** (all `requireAuth`):
- `GET`/`POST /admin/papawis` — `server.js:5743-5752` — list / create session.
- `GET /admin/papawis/activity` — `server.js:5773` — global activity feed + frequent-cancellers report.
- `GET /admin/papawis/:id` — `server.js:5784` — session detail/management.
- `POST /admin/papawis/:id/add` — `server.js:5797` — add player and/or guest(s).
- `POST /admin/papawis/:id/remove/:signupId`, `.../signups/:signupId/status`, `.../signups/reorder` — `server.js:5819-5833`.
- `POST /admin/papawis/:id/complete` — `server.js:5840` — set price/player, charge every confirmed signup, mark completed.
- `POST /admin/papawis/:id/cancel`, `DELETE /admin/papawis/:id` — `server.js:5862-5867`.

## Primary files
- Views: `views/papawis.js` (480 lines, public) — `papawisPage({ games, signupsByGame, viewerPlayerId, isLoggedIn, hasBalance })`
- Views: `views/admin/papawis.js` (713 lines, admin) — `adminPapawisListBody`, `adminPapawisDetailBody`, `adminPapawisActivityBody`
- DB: tables `papawis_games`, `papawis_signups`, `papawis_activity_log`. Key `portal-db.js` functions: `createPapawisGame`, `getPapawisGames`, `getPapawisGame`, `getPapawisSignups`, `getPapawisGamesForPlayer`, `getPapawisActiveSignupForPlayer`, `isPapawisSignupOpen`, `isPapawisGamePassed`, `joinPapawisGame` (txn), `cancelPapawisSignup` (txn, auto-promotes oldest waitlister), `adminAddPapawisSignup`, `adminRemovePapawisSignup`, `setPapawisSignupStatus` (txn), `reorderPapawisSignups`, `completePapawisGame`, `cancelPapawisGame`, `deletePapawisGame`, `logPapawisActivity`, `getPapawisActivityForGame`, `getAllPapawisActivity`, `getFrequentPapawisCancellers`.

## Data flow
1. Admin creates a session (title/date/time/location/max_slots/open_days_before). Session is invisible/unjoinable until the `open_days_before` cutoff (8AM Manila time).
2. Admin can pre-populate the roster via "Add a player or guest" (`views/admin/papawis.js:316-343`, form only shown for open sessions): if guest-names field is left blank, adds the selected player themself; if filled (comma/newline-separated), adds each name as a separate `guest_name` signup billed to that selected player's account — `POST /admin/papawis/:id/add` (`server.js:5797`) splits the names and calls `adminAddPapawisSignup` once per guest (or once for the player).
3. Players log into `/papawis`, see session cards with a live avatar-stack roster summary (`rosterSummary`, capped at 7, full list in a modal) and Join/Cancel actions gated by login state, outstanding balance, and the 3-day cancel cutoff. Join is capacity-gated — full sessions auto-waitlist.
4. Admin can reorder/promote signups between confirmed and waitlist manually.
5. Admin "closes out" a session: enters a flat price per player → `completePapawisGame` charges every confirmed signup as a `papawis`-category ledger transaction (see [[ledger-balance]]) and marks the session completed.
6. Every state change is recorded to `papawis_activity_log`, viewable per-session or globally at `/admin/papawis/activity` (includes a "frequent cancellers" report).

## Edge cases / gotchas
- **No automated notification system exists.** The only Messenger-related feature is a manual "Copy for Messenger" button (`views/admin/papawis.js:290, 396-450`, `buildMessengerText`) that formats a roster blurb for the admin to paste by hand into a group chat — it is not a webhook/API integration, and it is not "paused," it's simply a clipboard helper that's always been manual. This differs from project memory's "Pickup Notifications Plan" (on hold, Messenger API) — that's a *different*, unbuilt, automated feature; don't conflate the two.
- Guest signups are tied to a real player's account for billing purposes — a guest is not a `registrations`/player row, just a name string on a signup.
- Cancelling within `CUTOFF_DAYS` of game day is blocked once confirmed, but the frequent-cancellers report exists precisely because this is evidently still a recurring problem.

## Related docs
- [[players]] — `papawisGames` shown on a player's own profile
- [[ledger-balance]] — session completion charges players via the ledger
