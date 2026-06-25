# WKND Portal — Project Brief

## What this is
Public-facing MPA (multi-page app) for the WKND Basketball League. Node.js + Express, server-side rendered HTML. Read-only consumer of the shared SQLite database owned by the Admin App.

## Relationship to the Admin App
- **Admin App**: `../wknd-stats/` — the source of truth for all data writes. Do NOT modify it.
- **Shared DB**: `../wknd-stats/data/wknd-stats.db` — opened here in `readonly: true` mode.
- **Admin URL**: `http://localhost:3000` (configured in `.env`)
- This portal runs on port **4000** by default.

## Architecture
- `server.js` — single Express server, ESM (`"type": "module"`), all routes defined here
- `views/layout.js` — exports `layout({ title, currentPath, body })` and `escHtml()`. Renders the full HTML shell: Google Fonts (Archivo + Saira Condensed), `/styles.css`, sticky nav with active-link detection.
- `views/home.js` — exports `homePage({ teams, players, games })`. Homepage template.
- `views/*.js` — one file per page, each exports a single function that returns an HTML string.
- `public/styles.css` — all CSS tokens and utility classes (no inline styles for structural patterns)
- No build step, no bundler, no client-side framework

## Pages (build status)
- [x] `/` — Homepage: latest result, standings snapshot, scoring leaders (`views/home.js`)
- [ ] `/standings` — Full season standings
- [ ] `/games/:id` — Game detail: box score, POTG, recap, YouTube
- [ ] `/games` — All games list
- [ ] `/leaders` — League leaders by stat category
- [ ] `/teams/:id` — Team roster + averages
- [ ] `/teams` — All teams
- [ ] `/players/:id` — Player profile + career stats

## Layout conventions
- Every page calls `layout({ title, currentPath, body })` from `views/layout.js`
- `currentPath` drives nav active state — pass `req.path`
- Nav links: Home `/`, Standings `/standings`, Games `/games`, Leaders `/leaders`, Teams `/teams`
- Page content wraps in `<div class="container"><div class="page-content">…</div></div>`
- Section headers use `.section-header` div with `<h2>` (label) + optional `<a>` (see-all link)
- Cards: `<div class="card">` or `<div class="card card--lg">` — never custom background/border inline

## Design System (strict rules)
- **Accent color**: `#f59332` (amber) — the ONLY UI accent. Never use team colors for UI elements.
- **Team colors** (Blue/Maroon/White/Black): used exclusively for small indicator dots, chips, avatar rings.
- **Fonts**: Archivo (body text) + Saira Condensed (numerals/scores) — loaded from Google Fonts
- **Cards**: 14–16px border-radius, `1px solid var(--border)` border
- **Background**: `#020817` (near-black navy)
- **Surface**: `#0d1424`
- **Border**: `#1e293b`
- **Text primary**: `#e2e8f0`
- **Text muted**: `#64748b`
- All tokens live in `public/styles.css` as CSS custom properties

## Database schema (read-only, key tables)
- `teams` — id (TEXT), name, color, sort_order
- `players` — id (TEXT), team_id, name (format: "LASTNAME, Firstname"), number, positions (JSON array), picture_url, height, birthday, writeup, sort_order
- `player_totals` — player_id, games_played, pts, ast, reb, stl, blk, turnover, pf, fg2m, fg3m, fg2m_miss, fg3m_miss, ftm, ft_miss
- `games` — id, date, team_a_id, team_b_id, team_a_name, team_b_name, team_a_score, team_b_score, game_writeup, potg_writeup, manual_potg_player_id, under_review, season, game_type (regular/playoff), youtube_url
- `game_player_stats` — (game_id, player_id) PK, team_id, pts, ast, reb, stl, blk, turnover, fg2m, fg3m, fg2m_miss, fg3m_miss, ftm, ft_miss, minutes
- `awards` — id, season, award_type, player_id, team_id, notes

## Key conventions
- All DB queries use `better-sqlite3` prepared statements (synchronous)
- `games` ordered by `sort_order ASC, id DESC`; filter `under_review = 0` for public display
- Player name display: parse "LASTNAME, Firstname" → "Firstname LASTNAME" for public-facing output
- Stat averages: always divide by `games_played`, guard against division by zero
- `game_type` values: `'regular'` | `'playoff'`
