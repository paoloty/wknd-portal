# Season Awards

**Kind:** feature
**Status:** built

## Routes
- `GET /admin/awards` — `server.js:2799` — loads awards for a season (`getSeasonAwards`) + computed suggestions (`computeAwardSuggestions`) + any saved generated-article text.
- `POST /admin/awards` — `server.js:2823` — three modes via body flags: `from_suggestion` (accept suggestion(s), clears existing entries of that type, `upsertAward` per player), `clear_only` (wipe a type), or manual (`player_id`+`position` → `upsertAward` with deterministic id `<season>_<type>_<pos-or-playerId>`; invalidates OG cache for single-photo types).
- `DELETE /admin/awards/:id` — `server.js:2863` — thin wrapper over `deleteAward`.
- `GET /admin/awards/:season/:type/graphic` — `server.js:2925` — builds the photo-editor data model; branches on `SINGLE_PHOTO_AWARD_TYPES` (MVP/DPOY — one player, N photo slots) vs. team-grid/stat-leader types (multiple players, strip layout).
- `POST /admin/awards/:season/:type/columns` — `server.js:3059` — single-photo types only: sets slot/column count, prunes overrides beyond it, clears OG cache.
- `POST /admin/awards/:season/:type/graphic` — `server.js:3066` — saves photo crop/zoom overrides per player/slot, optionally a new uploaded+compressed photo; deletes the override row if back to default.
- `POST /admin/awards/generate-article` — `server.js:3121` — see [[ai-generation]]; persistence is via `POST /admin/site/settings`, not this route.
- Public: `GET /awards` — `server.js:4463` — read-only display, gated by per-type `award_show_<type>` visibility settings.
- OG images: `GET /api/awards/:season/:type/[:playerId/]og-image.png` (`server.js` ~4495-4558) — server-rendered via `buildTeamAwardOgSvg`/`buildPlayerAwardOgSvg` (`server.js:639, 814`) + sharp.

## Primary files
- Views: `views/awards.js` (341 lines, public), `views/admin/awards.js` (517 lines, admin management), `views/admin/award-graphic-editor.js` (366 lines — interactive CSS/SVG graphic composer, not canvas API; live-preview div `agr-canvas`, drag/zoom photo strips via `photoStripHtml`)
- DB (`lib/portal-db.js:1558-1682`): `getPlayerAwards`, `getSeasonAwards`, `getAwardSeasons`, `upsertAward`, `deleteAward`, `clearAwardType`, `getActivePlayers`, plus photo-override CRUD: `getAwardPhotoOverrides`, `getAwardPhotoOverridesForPlayer`, `upsertAwardPhotoOverride`, `deleteAwardPhotoOverride`, `deleteAwardPhotoOverridesFromSlot`.

## Data flow
1. Admin assigns an award — manually or by accepting a stat-based suggestion (`computeAwardSuggestions`) — row upserted into `awards`.
2. Admin opens the graphic editor to crop/position player photo(s); overrides stored as crop/zoom values, not new image blobs.
3. Admin optionally generates an AI blurb per award/player (see [[ai-generation]]), saved as a `setSetting` key.
4. The actual shareable PNG is rendered on demand (and cached) from the override data via SVG + sharp — not pre-baked at save time.
5. Public `/awards` displays confirmed awards, stats, and article text, respecting per-type visibility toggles from [[admin-core]]'s site settings.

## Edge cases / gotchas
- **`/mvp`, `/roast`, and `/leaders/share/:id` are siblings, not part of this system** — they don't read/write the `awards` table:
  - `/mvp` (`server.js:4674`) computes a live "MVP race" leaderboard from season stats on every load (shares scoring logic conceptually with the MVP award suggestion, but is its own ranked page).
  - `/roast` (`server.js:4812`) is a "worst performers" leaderboard, unrelated to awards.
  - `/leaders/share/:id` (`server.js:4333`, share record via `POST /api/leaders/share` at `server.js:4236`) is a generic shareable stat-leader/record card, independent of confirmed award data.
  - All three reuse the same OG-image/share-card *infrastructure pattern* as this feature, which is why they look related — don't assume they share data.
- Team-award types (`all_wknd_1/2/def`) get **per-player** generated articles (keyed `<type>_<player_id>`); single-winner/stat-leader types get one shared article — the generate-article route branches on this.

## Related docs
- [[ai-generation]] — award article generation
- [[leaders]] — the separate, live-computed "Statistical Leaders" concept vs. this feature's DB-backed one
- [[admin-core]] — visibility toggle settings
