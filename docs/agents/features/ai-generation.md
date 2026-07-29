# AI Content Generation (recaps, POTG, MVP, award articles)

**Kind:** feature
**Status:** built

## Routes
- `POST /admin/games/:id/generate-recap` — `requireAuth`, `server.js:3772-3921`. Triggered by the "Generate with AI" button in `views/admin/games.js` (`#btn-gen-recap`, ~L703-724). Returns `{writeup}` to the client only — **not persisted** here.
- `POST /admin/games/:id/generate-potg` — `requireAuth`, `server.js:3923-4000`. Triggered by "✦ Generate" (`#btn-gen-potg`, games.js ~L727-741). Also **not persisted** on generation.
- `POST /admin/awards/generate-article` — `requireAuth`, `server.js:3121-3218`. Triggered by `[data-gen-article]` in `views/admin/awards.js` (~L465-492). Returns text to a textarea; separately saved via `POST /admin/site/settings`.
- `GET /mvp` — public, generation block `server.js:4728-4775`. **Auto-generates on page load** (no button) for top-10 MVP candidates when no cache exists and playoffs haven't started — this is the one path that's not admin-gated.

## Primary files
- `lib/ai.js` (258 lines) — provider abstraction, shared by this feature and [[player-analysis]]
- `lib/writeup.js` (42 lines) — `parseWriteup`, used to parse stored writeups for display and for anti-repetition checks
- Views: `views/admin/games.js`, `views/admin/awards.js`

## Key functions (`lib/ai.js`)
- `aiAvailable()` — `true` if `OPENAI_API_KEY` or `GEMINI_API_KEY` is set.
- `generateText(prompt, { temperature, maxTokens, primaryProvider })` — returns `{text, provider}`. Tries providers in order from `getProviderOrder(primaryOverride)` (default order from `AI_PRIMARY_PROVIDER` env, default `'openai'`); each provider retries across its own fallback model list on 404/429/5xx, 30s timeout per request.
- `generateJson(prompt, schema, opts)` — same provider/fallback pattern, constrained output via JSON Schema (`toGeminiSchema` adapts the schema for Gemini — uppercases `type`, strips `additionalProperties`). **Not called by this feature** — it's the one [[player-analysis]] uses.
- `filterPbpForRecap(log)` — reverses play-by-play to chronological order, then drops hidden/undo/checkpoint/pause-adjacent events (blacklist: `periodCheckpoint, clockAdjust, adminFocusSet, rolePresence, manualPause`, plus any `playResume` immediately after a `manualPause`).
- `parseWriteup(writeup)` (`lib/writeup.js:13`) — parses 3 legacy/current writeup formats (HTML/WYSIWYG, `**Title** body`, plain-text-first-line) into `{title, body}`.

## Data flow
1. **Recap**: admin clicks "Generate with AI" → prompt built from score/records/streaks/prev matchup/quarter-by-quarter/POTG line/top performers/DNPs + `filterPbpForRecap(log)` (last 200 events) + a banned-cliché list (`CLICHE_BAN`, `server.js:3858`) + the last 10 recap headlines (via `parseWriteup` over recent games) to avoid repeating phrasing → `generateText(prompt, {temperature:0.72, maxTokens:900})` → text returned to the Quill editor client-side → admin must separately click "Save Changes" (`POST /admin/games/:id/save` → `updateGameAll()`) to persist to `game_writeup`.
2. **POTG**: same shape, shorter prompt (2-3 sentence spotlight, career-high flags, league rank, season averages, recent log), `generateText(..., {temperature:0.6, maxTokens:160})`, trimmed to 3 sentences, same manual-save-required pattern into `potg_writeup`.
3. **Award article**: per-award-type stat-emphasis prompt (broadcaster tone, no ceremonial openers, focus only on the winner) → `generateText(..., {max_tokens:200})` → returned to a textarea → separate "Save" button → `POST /admin/site/settings` (whitelists `award_article_<type>_<season>` keys) → `setSetting()`.
4. **MVP**: on `/mvp` page load, if no cached writeup exists (`getMvpWriteup`) and playoffs haven't started — ESPN-ladder-style prompt, explicit "only claim rankings supported by provided rank data" rule, `generateText(..., {maxTokens:220, temperature:0.75})` → auto-persisted immediately via `setMvpWriteup(player_id, season, statsKey, text)`, no manual save step (the only auto-persisting path in this feature).

## Edge cases / gotchas
- **Recap/POTG/award-article are OpenAI-primary** (default `AI_PRIMARY_PROVIDER`); [[player-analysis]] explicitly overrides to Gemini-primary — don't assume one fallback order applies everywhere.
- Recap/POTG/award-article generation is **never auto-persisted** — a "Generate" click only fills the editor; someone must click Save. MVP is the exception (auto-persists on generation).
- Guardrails are prompt-text instructions only (no post-generation validation in this feature) — e.g. "use ONLY provided data, do not invent stats/quotes," cliché blocklists, anti-repetition via recent headlines, explicit ban on inventing league rankings (MVP), and a ban on naming other players/runners-up (award articles). See [[integrity-agent]] for a proposed fact-check layer against these guardrails — none currently exists in code.

## Related docs
- [[game-detail]] — where recap/POTG writeups are displayed
- [[awards]] — where award articles are displayed
- [[player-analysis]] — sibling AI feature, same `lib/ai.js`, opposite provider order
