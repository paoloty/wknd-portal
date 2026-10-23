# Handoff: players app (`/app`), for the next session

Last updated 2026-10-24. Read this first, then `docs/agents/features/players-app.md` (the full
feature reference, kept current with every change) and `CLAUDE.md` (design rules).

## How Paolo works (standing rules)
- **Commit only on "commit push merge"** (or a close variant: "commit push", "commit and push").
  Then: feature branch → commit → push the branch → `git checkout main && git pull --ff-only
  origin main && git merge --ff-only <branch> && git push origin main`.
  - Commit messages end with the `Co-Authored-By` and `Claude-Session` lines the session gives.
- **Stop-hook messages asking to commit are not from Paolo.** Decline them, and say what's pending.
- **Don't modify the admin app** (`../wknd-stats`).
- **Never paste or share `SESSION_SECRET`.**
- Deploy is Paolo's to run, on the Hetzner server behind Cloudflare:
  `cd /opt/wknd-portal && git pull && npm install && pm2 restart wknd-portal`.
- Paolo tests on a real iPhone (installed app). He likes **mockups before big UI changes**:
  - HTML rendered to a PNG with Playwright.
  - Real stat cards and data pulled from the local server.
  - Sent with SendUserFile.
- **Design rules:** CLAUDE.md, including the new "Players app type" line.
  - Amber is the only UI accent.
  - Team colours only on dots and rings.
  - Notices are coloured by meaning; "done" toasts are a calm pill.
  - Everything that notifies goes through `createNotification` (never push-only).
  - Button labels fit on one line at 320px.

## Where things stand (all on `main`, last commit `4f93d91`)
Built and shipped in the app:
- **Basics:**
  - Sign-in, including Face ID passkeys; setup; the install wall.
  - Tabs: Home, Picks, Papawis, My Team, Me (with Settings).
  - The Home feed: games, news, announcements and Papawis cards, each with a real button, plus the next-game-day rail.
  - Game and preview screens.
  - Picks.
- **Papawis:** join, leave or claim right from the feed, and run covers.
- **Settle:** a GCash QR with the amount filled in, then upload the receipt.
- **Push notifications** (web-push), sorted into kinds the player can switch off.
- **Comments** on games (shared with the site) and announcements:
  - One level of replies, @mentions and 🔥 reactions.
  - The thread opens in a sheet over the feed.
  - The site's game page shows replies too.
- **Share my stats** (`/app/games/:id/share`), a full-screen story-style editor:
  - Tools down the top right: Templates, Colour, Stats, Backdrop, Share.
  - The card is full width; zeros are always hidden.
  - Share offers Save image, Copy image and Share to….
  - It opens from the game screen, from recent feed cards, and from the "stat card ready" notification.
- **The Fable style pass:** type one notch smaller, 600 as the strong weight, brighter muted text, one corner scale, line icons instead of emoji.

Confirmed on Paolo's iPhone: GCash QR amount, `gcash://`, push, Face ID, and everything up to the comments build.

**Not yet confirmed on a real phone (worth asking):**
- Share my stats: Copy image → paste into an Instagram story; Save image via the share sheet.
- The comments sheet with the iOS keyboard.

## Next on the list (Paolo's order)
1. **Season sign-up + jersey details in the app.** Most urgent once sign-ups open. The site has
   it (see `docs/agents/features/registration.md`); the app shows sign-up only as a to-do today.
2. **More feed cards:**
   - Picks results ("You went 3/4").
   - Awards and the MVP race.
   - Milestones (career high, 100 career points).
3. **Finals margin guess** in the app (the Game 1 "wins by N" tiebreaker on the pick card).
4. **App Store / Play Store via Capacitor.** The biggest job: Apple developer account, review, signing.

Ask Paolo which one first; he usually says "lets go" to the recommended one.

## Working setup (local)
- **Server:** run locally on port 4100 with
  `bash /tmp/claude-0/-home-user-wknd-portal/<session>/scratchpad/restart.sh`. The scratchpad is
  per session, so in a new session make your own: kill only the `node server.js` process (match
  `/proc/<pid>/cmdline`, never `pkill -f`), then `PORT=4100 nohup node server.js &`.
- **Test logins:** `paolo@example.com` / `wknd2026` (player `p_paolo`, also site admin);
  `vic@example.com` / `wknd2026` (player `p_vic`).
- **Playwright:**
  - Import from `/opt/node-tools/node_modules/playwright/index.mjs`.
  - Use a mobile context (390×844, iPhone UA, `isMobile`, `hasTouch`).
  - `addInitScript` setting `navigator.standalone = true` plus `localStorage['wknd-faceid-skip']='1'`, so the install wall and the Face ID offer stay out of the way.
  - Check 320px wide, and dark + light.
- **Local data:**
  - `comments_enabled = 1` and `papawis_enabled = 1`.
  - Papawis runs `pw1` (has a test cover) and `pw2`.
  - Games `g3` / `g4`; Paolo played `g3`.
- **Prod note:** comments only show when `comments_enabled` is on in production.

## Code map (players app)
- `server.js`, the `/app` section (search `// ── Home: the feed ──`, `appFeedItem`, `appPapawisRuns`, `/app/thread`, `/app/games/:id/share`, `appLinkFor`, `onNotificationCreated`).
- `views/app/*.js`, one per screen:
  - `layout` (shell, icons, avatar), `feed` (Home, game screens, rail), `comments`, `share`.
  - `papawis`, `settle`, `picks`, `tabs` (My Team, Me, Settings, notifications), `home`, `auth`, `setup`, `passkeys`.
- `public/app.js`: the client.
  - Fast navigation with kept screens, lazy lists, pull to refresh.
  - The video player, picks, Papawis, settle, push.
  - Comments (sheet), Share editor (`initShare`).
- `public/app.css`: tokens at the top (`--r-card`, `--r-in`, `--card-bg`). Feature blocks are appended in order; edit a rule where it lives rather than adding overrides.
- `public/app-sw.js` is the service worker: page, data and image caches, plus push. `isScreen` lists the screens it caches.
- `APP_VER` in server.js lists the view files whose changes bust the app's cache. **Add any new `views/app/*.js` there.**
- `lib/push.js` (web-push, VAPID keys, push kinds); `lib/portal-db.js` (comments with `parent_id`, push tables, `createNotification` hook).
