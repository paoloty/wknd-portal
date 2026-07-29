# Coach-Voice Player Analysis

**Kind:** feature
**Status:** built

## Routes
- No dedicated route. Generated inline inside `GET /players/:ref` (`server.js:4911-4966`) when `isOwnProfile` is true — see [[players]]. `/me` (`server.js:2265`) just redirects into this same route.
- `GET /admin/coach-notes` — `requireAuth`, `server.js:2562-2569` — read-only admin review log of all generated analyses.

## Primary files
- `lib/player-analysis.js` (161 lines) — all feature-specific logic
- `lib/ai.js` — `generateJson` (shared with [[ai-generation]], different call pattern)
- View: `views/admin/coach-notes.js` (91 lines) — `adminCoachNotesBody({ analyses, focusLabels })`
- DB: table `ai_player_analysis` in `portal.db` — one row per `player_id` (unique/upsert key), columns `player_id, generated_at, model, provider, stat_snapshot, analysis, focus_tag`

## Key functions (`lib/player-analysis.js`)
- `FOCUS_TAGS` — fixed array of 7 enum strings (`REBOUNDING`, `THREE_POINT_SHOOTING`, `FREE_THROW_SHOOTING`, `BALL_HANDLING`, `PASSING_VISION`, `ON_BALL_DEFENSE`, `FINISHING_AT_RIM`). Deliberately constrains the model to pick from this list rather than emit a URL itself, to avoid hallucinated links.
- `FOCUS_LABELS` — tag → display label. `FOCUS_VIDEOS` — tag → `{title, url}` drill video (hand-picked, not AI-chosen).
- `classifyPositionGroup(positions)` — `'perimeter'` (PG/SG/SF) or `'big'`.
- `aggregatePeerAverages(peerRows, group)` — filters `peerRows` to same position group with `games_played > 0`, returns per-game averages + shooting %s, or `null` if no peers.
- `myPerGameStats(totals)` — career totals → per-game rates + raw shooting splits.
- `statSnapshotFromTotals(totals)` — JSON fingerprint of a fixed stat subset, used as the cache-invalidation key.
- `buildAnalysisPrompt({...})` — coaching-voice prompt: 2nd person, one strength + one focus area + one concrete drill, hedge on small samples, no advanced-metric jargon, 3-5 sentences, JSON response format.
- `generateCoachAnalysis(promptInputs, { primaryProvider = 'gemini' })` — calls `buildAnalysisPrompt` then `generateJson(prompt, ANALYSIS_SCHEMA, { primaryProvider, temperature: 0.7, maxTokens: 400 })`; validates `analysis` is non-empty and `focus_tag` is in `FOCUS_TAGS`, throws otherwise.

## Data flow
1. Trigger: page load of `/players/:ref` with `isOwnProfile === true` calls `await getOrGenerateCoachNote(playerId, player, totals, gameLogs)` (`server.js:4972-5001`).
2. If `totals.games_played` is falsy → returns `null` (no analysis for a player with 0 games).
3. Computes `statSnapshotFromTotals(totals)`, loads any existing `getCoachAnalysis(playerId)`. **If the stored snapshot matches the current one, returns the cached row — no AI call.** Analysis only regenerates when career averages actually change.
4. Otherwise: gathers `classifyPositionGroup`, `getAllPlayerCareerTotals()` (peer pool, self excluded) → `aggregatePeerAverages`, and `getPlayerGameLog(playerId)` filtered to `status === 'played'`, sliced to the 4 most recent → `generateCoachAnalysis(...)` → `saveCoachAnalysis(...)` (upsert into `ai_player_analysis`) → returns the fresh result.
5. On any error, falls back to serving the last stored analysis (or `null`) — a failed regeneration never breaks the page.
6. `/admin/coach-notes` calls `getAllCoachAnalyses()` (joins `players`/`teams`) and renders the full history for review — table shows player, team, generated-at, model+provider, focus badge, and a modal with the full analysis text + pretty-printed `stat_snapshot`.

## Edge cases / gotchas
- **Inputs actually used are `getPlayerTotals`, `getAllPlayerCareerTotals`, and `getPlayerGameLog`** — `getPlayerRecentStats` (`lib/portal-db.js:2141`) exists but is **not used** by this feature; don't assume it's the recent-games source.
- **Provider order is Gemini-primary** here (`primaryProvider: 'gemini'` explicit default), the opposite of [[ai-generation]]'s OpenAI-primary default — a shared `lib/ai.js` change to default provider order would affect both features differently only if one of them stops passing an explicit override.
- `FOCUS_TAGS` is output metadata only — it doesn't steer what goes into the prompt, only classifies the model's own conclusion into a fixed bucket for the UI badge/video link afterward. `coach-notes.js` currently renders `focusLabels` but not `focusVideos`, even though the admin route passes both.
- Regeneration is fully automatic and silent (page-load-triggered, cached by stat fingerprint) — there is no manual "regenerate" button anywhere.

## Related docs
- [[players]] — the `/players/:ref` route this is embedded in
- [[ai-generation]] — sibling AI feature, shared `lib/ai.js`, opposite provider order
- coaching-agent (`.claude/agents/coaching-agent.md`)
