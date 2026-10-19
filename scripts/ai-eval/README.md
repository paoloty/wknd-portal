# AI writer eval harness

Re-runnable quality check for the AI writers (recap, POTG / co-POTG, game-page sections,
homepage blocks, /standings and /playoffs sections, matchup storyline). It drives the real
admin routes on an **isolated copy** of the project, so nothing touches the repo's database,
the dev server on :4000, or any email/outbound integration.

## One command

```
node scripts/ai-eval/setup.js --scratch <dir> --provider-order gemini --gemini-models gemini-2.5-flash
node scripts/ai-eval/run.js   --scratch <dir> --name <run-name> [--full] [--only recap:oct18,potg:]
node scripts/ai-eval/setup.js --scratch <dir> --clean      # removes junctions safely, then the copy
```

`setup.js` copies the project (no `.git`, `node_modules`, `data`, `assets`), junctions
`node_modules` and `assets` from the repo (removed with `rmdir`, never `rm -rf`), snapshots
`data/portal.db` with better-sqlite3 `.backup()` from a readonly handle, and writes a `.env` with
`RESEND_API_KEY`, `SMTP_*`, `FACEBOOK_APP_SECRET`, `DB_EXPORT_KEY`, `ROSTER_API_KEY` removed, the
eval port (default 4100) and the two trace files. Options: `--port`, `--provider-order
openai|gemini|groq,...`, `--openai-model`, `--openai-models a,b`, `--gemini-model`,
`--gemini-models a,b` (pins the whole fallback chain).

`run.js` starts the copy's server, logs in with the copy's `PORTAL_ADMIN_USER/PASS`, posts to
`/admin/games/:id/generate-recap`, `/generate-potg` (with `shared_with` for a co-POTG),
`/admin/section-summary/regenerate`, `/admin/home-summary/regenerate` and
`/admin/games/matchup-story/regenerate`, stops the server, and writes
`<scratch>/results/<name>/`:

- `cases.json` — per case: the output, the facts and full prompt it was given, every attempt's
  copy and check results, the final pick, AI calls, models and tokens
- `digest.md` — the drafts and rejections, readable
- `server.log` — the copy's server output (every rejection line)

The test set is `cases.js` (`tier: 'core'` runs by default, `--full` adds the rest). The
grading rubric is `RUBRIC.md`; grades are a judge's job (read `digest.md` against `facts`).

## How the traces work

Two opt-in env vars, inert unless set (the copy's `.env` sets them):

- `AI_WRITER_LOG=<file>` — `lib/writer.js` `runWriter` appends one JSON line per attempt (full
  prompt on the first, copy, every problem) and one for the final pick.
- `AI_CALL_LOG=<file>` — `lib/ai.js` appends one JSON line per provider call (provider, model,
  kind, ok/status, token usage, ms). The run's call count comes from here.

## Cost

A core run (16 cases) is roughly 40–60 provider calls; `--full` (45 cases) roughly 110–150.
A recap is ~4–5k input tokens per attempt plus a ~2k fact-check call; a POTG ~2.5k; a section
~1.5k + 1.5k. On gemini-2.5-flash that is about $0.002–0.004 per piece; on gpt-4o-mini about
$0.001–0.002.

## Free-tier reality (2026-10-20)

Measured on the repo's keys: OpenAI answers 429 "no credits remaining" on every model; Gemini's
free tier is **20 requests per model per day** (2.5-flash-lite and 2.5-flash both hit it, the
3.x models each have their own bucket); Groq is 8k tokens/minute and **200k tokens/day per
model** (gpt-oss-120b was at 198,712/200,000 by the afternoon). A core run needs 40–60 calls, so
on free tiers it has to be spread over model buckets (`--gemini-models a,b,c` falls through a
daily-exhausted model at once) or run on a paid key. `lib/ai.js` waits out a 429 that names a
short delay (`AI_RETRY_WAIT_MAX_MS` in total per model, default 20s; `--retry-wait-ms 70000`
for Groq's minute window) before moving to the next model.
