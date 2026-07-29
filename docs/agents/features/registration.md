# Registration & Accounts

**Kind:** feature
**Status:** built (Facebook login currently disabled)

## Routes
- `GET`/`POST /login` — `server.js:2202-2253` — tries admin creds first (`checkCredentials`), then a `registrations` row by email (`status === 'approved'` + `password_hash` set).
- `GET /logout` — `server.js:2253`
- `GET`/`POST /set-password` — `server.js:2273-2320` — consumes a time-limited token (`getRegByPasswordToken`) to scrypt-hash a new password (min 8 chars).
- `GET /auth/facebook`, `GET /auth/facebook/callback`, `POST /auth/facebook/disconnect` — `server.js:2320-2424` — **disabled**, see gotchas.
- `GET /admin/registrations` — redirects to `/admin/users` (legacy path, kept for old links).
- `GET /admin/users`, `GET /admin/users/:id` — `server.js:2444-2463` — list/detail.
- `POST /admin/users/:id/{approve,create,sync,reset,reject,birthday,toggle-admin}` — `server.js:2473-2560` — `toggle-admin` requires `requireSuperAdmin`, all others `requireAuth`.
- `POST /register` (form target of `views/register.js`) and `POST /season-signup` (form target of `views/season-signup.js`) — account creation vs. per-season signup, see below.

## Primary files
- Views: `views/register.js`, `views/season-signup.js`, `views/set-password.js`, `views/admin/users.js`, `views/admin/user-detail.js`, `views/admin/season-waitlist.js`
- **Dead code**: `views/admin/registrations.js` (`adminRegistrationsBody`) is not imported by `server.js` — `admin/users.js`/`admin/user-detail.js` are the live equivalents. Don't extend this file expecting it to be reachable.

## Data flow
1. **Sign up**: `/register` — multi-step form (name, email, phone, 18+-enforced birthday, positions, height/weight, dominant hand, gender, experience, referred-by, emergency contact, social handle, motto) → `POST /register` creates a `registrations` row, `status = 'pending'`. No player/account exists yet.
2. **Admin review**: `/admin/users/:id` → `approve` (sets `status = 'approved'`, optionally links an existing `player_id`, emails a set-password link) or `create` (builds a brand-new player row from the registration fields, links it, approves, emails). `reject` sets `status = 'rejected'` + emails a reason. `reset` reverts to `pending`. `sync` re-merges reg fields into an already-linked player. `birthday` is an admin-editable correction field.
3. **First login**: user follows the emailed `/set-password` link (token-gated) → sets password → logs in at `/login`, which sets `session.playerRegId`/`session.playerPlayerId`.
4. **Per-season re-registration**: separate from account approval. `/season-signup` (only reachable with an approved-account session) collects jersey top/shorts + a `quota_ack` checkbox + (returning players only) a stick-with-team-or-reshuffle preference → creates a `waitlisted` season-signup row, gated by the `season_signup_open` setting for that season. Reviewed independently at `/admin/season-waitlist` (bulk confirm/reject per season) — this is a **different** approval pipeline from account approval.
5. **Facebook OAuth** (when enabled): `state=connect` links `facebook_id` to the currently-logged-in account; `state=login` looks up a registration by `facebook_id` — if found & approved, logs in directly; if not found, stashes `fbPending` in session and redirects to `/register?fb=1` to pre-fill the signup form.

## Edge cases / gotchas
- **`FB_ENABLED = false`** (`server.js:2318`) — Facebook login/connect/disconnect routes exist and are fully implemented but currently short-circuited off; flip to `true` "once requirements are resolved" per the inline comment.
- **No distinct role fields** (admin/editor/head/player) exist in code today — it's a binary `is_admin` flag on the registration row, plus a super-vs-elevated split: `session.isAdmin` alone (from `PORTAL_ADMIN_USER`/`PORTAL_ADMIN_PASS` env creds) = true super admin; a player registration with `is_admin=1` who logs in gets `isAdmin=true` **and** `isElevatedPlayer=true` — can reach `/admin` but is blocked from `requireSuperAdmin` routes (e.g. can't toggle other users' admin flag). See [[admin-core]] for the full auth breakdown. This is a simpler model than the "admin/editor/head/player" hierarchy noted in project memory as a migration target — that hierarchy is not yet in the code.
- Account approval and season-signup approval are two **independent** pipelines with two different status fields — an approved account can still be un-signed-up for the current season, and vice versa isn't possible (signup requires an approved account session).
- All mutating `/admin/*` actions here are audit-logged via `insertAdminLog` (see [[admin-core]]).

## Related docs
- [[admin-core]] — auth middleware, role/session mechanics, audit logging
- [[players]] — where an approved player's own profile (`isOwnProfile`) surfaces
