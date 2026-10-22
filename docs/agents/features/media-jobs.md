# Media jobs: POTG video + the Processing list

Background video renders. The admin builds a video on a page, saving **queues** it, and a worker renders it one at a time in a child process; `/admin/media` (nav: Game Day → Processing) lists the jobs and serves the finished files.

## Player of the Game video
- **Entry:** game page → Content tab → "🎬 Make POTG video" (`views/admin/game.js`, under the POTG pick) → `/admin/games/:id/potg-video`.
- **Who:** the game's `manual_potg_player_id` and `co_potg_player_id`. On a co-POTG game the editor asks "Make videos for: Both / X only / Y only", and each player has a "Title on the video" choice (Co-Player of the Game, or plain Player of the Game; making just one defaults to plain).
- **Editor** (`views/admin/potg-video.js`, browser: `public/admin-potg-video.js`): jersey # for this game (DB numbers can be wrong, e.g. Paul wore #1), chip text, up to 3 big numbers, and **exactly 6 photos**, each framed by drag/touch (move) and mouse wheel or pinch (zoom). Everything else comes from the DB (`lib/potg-video.js potgVideoContext`): name, team colours, result line `W 83–76 vs White · Oct 18`, avatar (players.picture_url data URL).
- **Photo upload:** `POST /admin/media/potg-photo` (browser pre-shrinks to 2400px). `savePotgPhoto` fixes rotation, applies the WKND grade, guesses a focal point (skin-tone centroid, top 75% of the photo), stores `data/media/uploads/<id>.jpg`.
- **Framing maths:** `frameOf()` exists twice and must match: `assets/media/potg/template.html` and `public/admin-potg-video.js`. Photo covers 1080×1350 × zoom, focal point placed at (50%, 40%) and clamped; the preview shows the photo's final (pushed-in, ×1.10) frame.
- **Queue:** `POST /admin/games/:id/potg-video` → `queuePotgVideos` copies the photos into `data/media/jobs/<id>/` and creates a `media_jobs` row (status `queued`, quality `preview`). A player panel left empty is skipped.
- **Preview → final:** every job renders first as a **preview** (544×680, fast encode, plays inline on /admin/media, no download). "Approve & render hi-res" (`POST /admin/media/:id/final`, `requestFinal`) re-queues the same job as `final` (1080×1350); only finals can be downloaded. "Edit" opens the editor with `?from=<jobId>`, prefilled by `potgPrefill` (photos copied back to uploads).

## Worker / renderer
- `lib/media-jobs.js`: `media_jobs` table, `startMediaWorker()` (called just before `server.listen`), polls every 5 s, runs `nice -n 15 node scripts/render-potg.js <jobId>`, one at a time. A job left `processing` by a restart is re-queued on boot.
- `scripts/render-potg.js`: headless Chrome loads `assets/media/potg/template.html`, `build(DATA)`, then `setT(t)` per frame (frame-exact, 24 fps, 1080×1350, ~33 s) piped to ffmpeg. Sound: a real ball bounce (`assets/media/potg/sfx/bounce*.wav`) at each time in the template's `window.SFX`, plus a quiet court-ambience bed under the photos. Output: `data/media/jobs/<id>/out/potg.mp4` (video with sound, the only deliverable).
- Can be re-run by hand: `node scripts/render-potg.js <jobId>`.

## Server requirements (one-time setup on the Hetzner box)
```
apt-get install -y ffmpeg
cd /opt/wknd-portal
npx --yes @puppeteer/browsers install chrome-headless-shell@stable --path /opt/chrome --install-deps
pm2 restart wknd-portal
```
The renderer finds `/opt/chrome/chrome-headless-shell/*/…/chrome-headless-shell` on its own; `CHROME_PATH` / `FFMPEG_PATH` in `.env` override.

## Gotchas
- Fonts for the video are bundled next to the template (Big Shoulders, Archivo); the server needs no system fonts.
- `data/media/` grows ~140 MB per video (the high-quality MP4s). Delete old jobs from the Processing page.
- Timeline constants (`FL`, `PH`, `OUT`, …) live only in the template; the renderer and sound read them from the page.
