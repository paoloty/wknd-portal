# Admin Core (auth, layout, dashboard, users, logs, settings)

**Kind:** feature
**Status:** built

Every other admin feature doc assumes this scaffolding. Read this one first if you're new to the admin side.

## Routes
- Auth middleware `requireAuth`/`requireSuperAdmin` — defined `server.js:1768-1777`, applied per-route (not global).
- Global audit-log middleware on `/admin/*` — `server.js:1780-1789` — logs every mutating (non-GET) admin request.
- `GET`/`POST /login`, `GET /logout` — `server.js:2202-2255` (shared with [[registration]], one login form for both super admin and players).
- `GET /admin` — `server.js:2424-2439` — dashboard.
- `GET /admin/users`, `GET /admin/users/:id` — see [[registration]].
- `GET /admin/logs` — `requireSuperAdmin`, `server.js:2571-2578`.
- `GET /admin/site`, `POST /admin/site/settings` — `requireAuth` (not super-admin-only), `server.js:3220-3260`.

## Primary files
- `views/admin/layout.js` (189 lines) — shared admin shell
- `views/admin/login.js` (48 lines), `views/admin/dashboard.js` (130 lines), `views/admin/users.js` (99 lines), `views/admin/logs.js` (65 lines), `views/admin/site.js` (263 lines)

## Key mechanics
- **Session**: `express-session` + `SqliteStore` backed by `portal.db`, httpOnly/sameSite=lax cookie, 8h default `maxAge`, extended to 30 days with "remember me" (`server.js:1751-1758, 2216, 2238`).
- **True super admin**: `PORTAL_ADMIN_USER`/`PORTAL_ADMIN_PASS` env vars, checked via `timingSafeEqual` (`checkCredentials`, `server.js:121-131`) → sets `session.isAdmin = true`, `isElevatedPlayer` left unset.
- **Player-admin ("elevated player")**: a normal `registrations` row with `is_admin = 1`. Logging in as that player sets **both** `session.isAdmin = true` and `session.isElevatedPlayer = true` (`server.js:2233-2237`) — redirected to `/me`, not `/admin`, on login (comment at `server.js:2243-2246` explains: they aren't a "true" super admin).
- **`requireAuth`**: passes if `isAdmin`; if only `playerRegId` is set (non-admin player), redirects to `/me`; otherwise to `/login?next=...`.
- **`requireSuperAdmin`**: passes only if `isAdmin && !isElevatedPlayer`; else 403 (rendered admin "Forbidden" page). So `isAdmin` alone = "can reach admin pages," `isAdmin && !isElevatedPlayer` = true super admin. `renderAdminPage` derives `isSuperAdmin` the same way and passes it to `adminLayout` for conditional nav/buttons (e.g. the Grant/Revoke Admin Access button on `admin/user-detail.js`, and the `SUPER_ADMIN_NAV` group).
- **Audit logging**: the global `/admin/*` middleware calls `insertAdminLog` on every mutating request, tagging actor type `super` vs `admin` (elevated player) based on `isElevatedPlayer`, and stripping `password`/`confirm` fields from logged request bodies. `/admin/logs` (super-admin-only) is this log's read view — it's an **audit/action log, not an error log**.

## Layout
- `views/admin/layout.js`: dark Tailwind-CDN shell, fixed left sidebar (`NAV_GROUPS`: Content/Finance/Members/Season/Settings) plus a `SUPER_ADMIN_NAV` group (Action Logs, Sync DB in dev) appended only `if (isSuperAdmin)`. Collapses to a hamburger on mobile.
- Completely separate visual system from the public `views/layout.js` (light marketing header/nav/dropdowns + footer) — no shared components besides `escHtml`.
- `views/admin/dashboard.js`: KPI cards (active players, teams, games played, outstanding balance), alert banners (pending transactions/games under review), recent-results + upcoming-games lists, quick links to Players/Games/Ledger/Site Settings.
- `views/admin/site.js` + `/admin/site/settings`: toggles for Awards page + per-award-section visibility, MVP Race, Papawis public visibility (see [[awards]], [[papawis]]); GCash settlement info shown to players (see [[ledger-balance]]); link to Season Management; per-season payment quotas (actually saved via a *separate* `/admin/ledger/quota/:season` endpoint, not this one). `POST /admin/site/settings` whitelists allowed setting keys (plus a regex for per-article award keys) before persisting via `setSetting`.

## Edge cases / gotchas
- There is **no distinct editor/head/player role hierarchy in code** — just the binary `is_admin` flag + super/elevated split described above. If you're implementing the role hierarchy noted in project memory, this is the mechanism it would replace/extend.
- `requireAuth` is applied per-route, not globally — a new admin route that forgets it is publicly reachable. Always check the route definition, don't assume middleware is inherited.
- `/admin/registrations` still exists only as a redirect to `/admin/users` — legacy URL compatibility, not a real page.

## Related docs
- [[registration]] — account approval flow, session fields set at login
- [[ledger-balance]], [[papawis]], [[awards]] — each has its own admin routes gated by this middleware
- integrity-agent / content-agent (`.claude/agents/`) — operate on data this layer protects
