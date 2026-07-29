# Agent Documentation Index

This directory exists to save a coding agent (subagent or otherwise) from having to reconstruct cross-file wiring in a codebase where `server.js` alone is ~5,875 lines and routes, views, and `lib/` helpers are three separate files per feature.

Two doc types, same template (`agent-template.md`):

- **`pages/`** — the public MPA pages that are genuinely thin (one route, one view template, a handful of queries). Covers route, data sources, computed fields, edge cases.
- **`features/`** — cross-cutting logic that spans an admin view + a public view + one or more `lib/*.js` files. This is where the real complexity lives. Covers data flow end-to-end, key functions, and gotchas.

Start at whichever one matches what you're touching — a page doc will point to the relevant feature docs (and vice versa) via `[[links]]`.

## Pages
- [home](pages/home.md) — `/`
- [games](pages/games.md) — `/games` (list)
- [game-detail](pages/game-detail.md) — `/games/:ref`
- [standings](pages/standings.md) — `/standings` (+ `/playoffs`)
- [leaders](pages/leaders.md) — `/leaders` (+ `/roast`, `/leaders/share/:id`)
- [teams](pages/teams.md) — `/teams` (list built) + `/teams/:ref` (**stub — not built**)
- [players](pages/players.md) — `/players` (list) + `/players/:ref` (detail — also the `/me` dashboard)

## Features
- [ai-generation](features/ai-generation.md) — recap/POTG/MVP/award-article generation (`lib/ai.js`, `lib/writeup.js`)
- [player-analysis](features/player-analysis.md) — coach-voice `/me` analysis (`lib/player-analysis.js`)
- [registration](features/registration.md) — signup, approval, season re-registration, Facebook login (disabled)
- [papawis](features/papawis.md) — pickup games, public + admin
- [ledger-balance](features/ledger-balance.md) — financial ledger, `/settle-balance`, known gap: no player-facing transaction history
- [awards](features/awards.md) — season awards, graphics, articles
- [admin-core](features/admin-core.md) — auth, session, roles, layout, dashboard — read this first for anything admin-side

## Known gaps as of this writing
- `/teams/:ref` renders a coming-soon stub, not a real roster page.
- Players cannot see their own transaction history (only a current balance number).
- Facebook login is fully implemented but disabled (`FB_ENABLED = false`).
- No editor/head/player role hierarchy exists yet — just a binary `is_admin` flag with a super/elevated split.

## Keeping this in sync
These docs describe current code shape, not decisions or plans (that's what the memory files under `.claude`/project memory are for). A doc that names a specific function, route, or line number is a claim that it existed when the doc was written — verify before trusting it for anything you're about to act on, especially line numbers, which drift fastest. If you find one of these docs wrong, fix it in the same change rather than leaving it stale.
