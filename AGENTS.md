# Agent Guide — WKND Portal

This file is the entry point for any coding agent working in this repo. It exists alongside [CLAUDE.md](CLAUDE.md) (design system, layout conventions, schema reference) — read both, but see the correction below before trusting CLAUDE.md's data-ownership section.

## Correction to CLAUDE.md: this app is no longer read-only

[CLAUDE.md](CLAUDE.md) states the portal is a "read-only consumer of the shared SQLite database owned by the Admin App," opened `readonly: true` from `../wknd-stats/data/wknd-stats.db`. **That is no longer true.** `lib/portal-db.js:7` opens `data/portal.db` — a separate, portal-owned, read-write database. `lib/migrate.js` was a one-time script that copied basketball data from `wknd-stats.db` into `portal.db`; ongoing updates to game data now happen via per-game file export/import (`views/admin/games.js`: export the game file from the wknd-stats admin app, upload it here) rather than a live shared connection. Beyond that, this app now owns significant read-write state of its own that has no equivalent in wknd-stats at all: registrations, season signups, the financial ledger, papawis (pickup games), AI-generated content caches, admin audit logs, and award photo overrides.

Treat `portal.db` as this app's own database. `ADMIN_URL` (default `http://localhost:3000`) is still used, but only to fetch specific assets (player photos) from the wknd-stats app over HTTP — not as a live DB connection.

## Where the complexity actually lives

`server.js` is a single ~5,875-line file with every route. `views/*.js` (public) and `views/admin/*.js` (admin) are one-file-per-page templates. `lib/*.js` holds logic shared across routes. For anything beyond the simplest page, **read [docs/agents/README.md](docs/agents/README.md) first** — it indexes:
- `docs/agents/pages/*.md` — the thin public MPA pages (route + data source + edge cases)
- `docs/agents/features/*.md` — cross-cutting logic spanning admin + public + `lib/` (AI generation, player analysis, registration, papawis, ledger/balance, awards, admin-core/auth)

Those docs describe current code shape and are line-number-specific — verify before trusting a claim you're about to act on, especially after code has moved.

## Specialized subagents

`.claude/agents/` defines three subagents scoped to this repo's AI-content pipeline:
- **coaching-agent** — the coach-voice player-analysis feature (`docs/agents/features/player-analysis.md`)
- **content-agent** — recap/POTG/MVP/award-article generation (`docs/agents/features/ai-generation.md`)
- **integrity-agent** — fact-checks AI-generated writeups against actual box score data before they're trusted

## House rules (from CLAUDE.md, still current)
- ESM (`"type": "module"`), no build step, no client-side framework.
- Player name display: parse `"LASTNAME, Firstname"` → `"Firstname LASTNAME"` for public-facing output.
- Stat averages: always divide by `games_played`, guard against division by zero.
- Accent color `#f59332` is the only UI accent — team colors are for indicator dots/chips/avatar rings only, never UI elements.
- Runs on port 4000 by default (`PORT` env).
