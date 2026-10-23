# Players app (`/app`)

Phone-first, players-only app served by this same server: same accounts, sessions and `portal.db`. Installable to the home screen (web app manifest + service worker). Milestones 1–2: shell, sign-in, player setup, Home, read-only My Team / Me.

**Players stay in the app.** Only links to `/app` screens are tappable (`isAppHref` in `views/app/layout.js`); the one way out is Me → Settings → "Open full site".

## Tabs and where things live (Fable's review, 2026-10-23)
- Tab bar: **Home · Picks · Papawis · My Team · Me** (`TABS` in layout.js; keep `ROOTS` in public/app.js in step). There's no More tab: Settings is a screen under Me (gear), notifications sit behind the bell on Home.
- **Home** = the feed (below). **Picks** = Who wins? (open games, record, Pickmaster top 10 + your row, your past picks). **My Team** = team + record + standing, Up next countdown, Coming up, this season's results (→ game screen), roster. **Me** = profile (Edit), To do (money/season items + one line pointing to Picks), season averages, your games (→ game screen), photo/details. **Settings** (`/app/settings`; `/app/more` redirects) = Face ID, Notifications, Appearance, Open full site, Log out.
- Badges, one signal per fact (`appBadges`, passed through `sendTab` on every screen with the tab bar): Picks tab = open games not picked yet (amber); Me tab = balance / sign-up / jersey to-dos (red); Home's bell = unread notifications (red). Nothing is counted twice.
- Things not built into the app yet (settling a balance, season sign-up, jersey details) show as information with a "Soon" pill (`soonTag`). Rosters and notifications aren't links.

## Files
- `server.js`: section "Players app (/app)", right after the site's `/logout` route. All `/app*` routes, gating, sign-in codes, data shaping.
- `views/app/layout.js`: `appPage()` (full HTML document: manifest, theme colours, tab bar), icons, `appAvatar()`.
- `views/app/auth.js`: sign-in, email code, players-only and "not yet" gates, offline page.
- `views/app/feed.js` (Home feed, game and news screens), `views/app/home.js` (Up next, To do, setup/install cards, Home header), `views/app/tabs.js` (My Team, Me, Settings, notifications), `views/app/picks.js`, `views/app/setup.js`, `views/app/passkeys.js`: screens. `views/admin/app-announcements.js`: the admin page.
- `public/app.css` (own light + dark tokens, separate from `styles.css`), `public/app.js` (theme switch, countdown, code boxes, photo upload, install hint, service worker, update check), `public/app-sw.js` (served at `/app/sw.js` with `__VER__` filled in), `public/app-icon-*.png`.

## Access (`appAccess`)
- Hidden until `site_settings.app_open = '1'`. Before that: player-admins (`registrations.is_admin`), "view as" sessions, and anyone listed in `site_settings.app_beta` (emails or registration ids, comma or space separated). Everyone else signed in gets the "almost here" screen.
- Players only: no `player_id` → "This app is for WKND players"; the super-admin login gets the same; pending sign-ups get "waiting for approval".
- Pages send `noindex` and `Cache-Control: private, no-store`.

## Home: the feed
- `views/app/feed.js`. Home = Finish setup card (until done), the **action strip** (only things with a deadline: picks closing, balance due, sign-up open; max 3, amber, gone when done), the pinned announcement, then **Latest**: a lazy list (`/app/feed/items`, 20 a page, keyset `before=<at>:<id>`, `day=` carries the last day header so it isn't repeated).
- Items (`appFeedIndex`, newest first, grouped by Manila day): announcements, played games (at tip-off time), published news posts, Papawis runs open for sign-up (by when they were posted). Built per request; the sources are small.
- Game card: cover photo (`/api/photo/:id?w=640`) or YouTube thumbnail with ▶, score, recap headline + 3 lines, player(s) of the game, "Your line" if you played, 🔥 and comment counts (when comments are on). A game shows up as soon as it's final; the write-up fills in when added.
- Game screen `/app/games/:id?from=home|team|me|picks` (back goes where you came from): video plays inside the app in our own player (app.js `playVideo`: the YouTube IFrame API with `controls: 0` under a play/pause button, seek bar and time; a tap layer over the video catches taps so YouTube's own links can't leave the app), score, full recap and player-of-the-game write-ups (admin text reduced to plain paragraphs, `textParas`), both box scores with your row lit, comments read-only ("Soon" to write).
- News post `/app/posts/:slug`: the article as the site renders it.
- Pictures are sized (`sizedSrc`): game covers and announcement photos come as `srcset` 640w / 960w WebP (server-resized and cached by `sendPlayerPhoto`), `sizes` = the card width, so a phone downloads only what its screen needs; the admin list uses a 160px thumbnail.
- Feed pictures load straight away (no `loading="lazy"`: iPhone Safari never loads a lazy image added while the list is hidden); one that fails removes its grey box.
- Papawis cards are view-only ("Soon") until Papawis is built into the app.

## Announcements (`/admin/app/announcements`)
- Table `app_announcements` (lib/portal-db.js): title, body, one photo (JPEG data URL, shrunk to 1600px in the admin's browser, served resized at `/app/announcements/:id/image?w=640|960`) or one YouTube link, `pinned_until`, soft delete. Pinning (1/3/7 days, or "Pin 7 days" / "Unpin" on the list) keeps it on top of Home and out of the dated list until it expires. Linked from the `/admin/app` header.

## Who wins? (`/app/picks`, the Picks tab)
- `views/app/picks.js`: one card per game from the site's `openPicks()` (same object the site's pick cards use), plus the player's record and Pickmaster rank from `seasonPicks()`, the board's top 10 and the player's settled picks.
- Picks are saved through the site's own `POST /games/:id/pick` (public/app.js `initPicks`), so open/closed, deadlines and who may pick live in one place. The tapped side lights up at once, a toast confirms ("change until Sun 6:00 AM"), then the screen refreshes quietly (`refreshScreen`) for the bars, faces and stakes; a failure restores the old pick and shows the server's reason. Same reveal rule as the site: the pickers' split shows once you've picked or picks close. The Finals tiebreaker margin guess isn't in the app yet ("Soon").

## Face ID / fingerprint sign-in (passkeys)
- `@simplewebauthn/server` + `@simplewebauthn/browser` (pinned; the browser bundle is served from `/app/vendor/webauthn.js` and loaded only on screens that use it). Table `passkeys` (lib/portal-db.js). `userVerification: 'required'`, discoverable credentials. The relying party is `SITE_HOST` (wkndbasketball.com) in production, the request's host elsewhere (`passkeyRp`).
- After a password or code sign-in with no passkey saved, `appAfterSignIn` sends the player to `/app/faceid?next=…` ("Use Face ID next time?"), which moves straight on where the phone can't do it or the player chose "Not now" on that phone (localStorage `wknd-faceid-skip`).
- The sign-in screen shows "Sign in with Face ID" (fingerprint on Android, passkey elsewhere) and offers the phone's own passkey suggestion on the email field. `/app/passkeys/login/*` is rate-limited per visitor and signs in through `appAfterSignIn(…, 'passkey', json)`.
- Me → Settings → Face ID & passkeys (`/app/passkeys`) lists and removes them. A password reset deletes all of a player's passkeys. Events: `passkey_added`, `passkey_removed`, `signin` with detail `passkey`.

## Install wall
- On a phone the app only runs installed (`app_require_install`, default on, switch on `/admin/app`). In a phone browser, or Messenger / Facebook / Instagram's in-app browser (which can't install), `views/app/layout.js` `installWallHtml()` replaces the app with install steps for that case: iPhone Safari (Share → Add to Home Screen), Android (Chrome's install prompt behind a button, manual steps as fallback), in-app (open in Safari/Chrome, Copy link). A computer's browser is never walled. Detection runs in a head script before the first paint (`html.needs-install` + `iw-ios` / `iw-android` / `iw-inapp`); it covers sign-in too, since the installed iPhone app has its own sign-in. Behind the wall, app.js doesn't fetch tabs ahead or ping usage.

## Home-screen icons from site pages
- iPhone's "Add to Home Screen" saves whatever page is open. For a signed-in player who can use the app, every site page (server.js `renderPage`, `APP_HOME_TAGS`) carries the app's manifest + home-screen tags and a head script: launched from the home screen, a site page goes straight to `/app`. Fans and guests get none of it, so their site bookmarks stay the site. Settings → "Open full site" links to `/?from=app`, which lets that window browse the site for the visit (sessionStorage `wknd-site`).
- On a phone's browser those players also get a "Use the WKND app" bar (`appUseBar`), hidden inside the installed app and closable for the visit.
- Icons added before this can't be changed remotely; the install wall tells players to remove and re-add one that opens the website.

## Sign-in
- `POST /app/login`: the site's own checks (`getRegistrationByEmail`, `checkPlayerPassword`, `signInRegistration`), logged to the admin log with `via`. Every failure gets the same message (no "you haven't set a password" for real accounts); "not approved" / "not a player" only after a correct password. The site's `POST /login` follows the same rule.
- Every sign-in path (site `/login`, `/app/login`, email codes, set-password) starts a new session: `signInRegistration(req, reg, done)` calls `req.session.regenerate` first, so nothing (e.g. `isAdmin`) carries over on a shared phone and the session id changes.
- Rate limits (in memory, `rateHit`; visitor = `CF-Connecting-IP`): password sign-ins 30 / 15 min per visitor and 10 per email (site and app share them); code emails 1 a minute, 4 an hour per email, 30 an hour per visitor; code checks 20 / 15 min per visitor.
- Email code: `POST /app/login/code` → 6 digits in memory (`appCodes`), 10 min, same response whether or not the email exists. Asking again while a code is valid re-sends the same code (so nobody can keep replacing a player's code). Wrong guesses count per visitor (5 each, 15 in all), so a stranger can't burn a player's tries. `POST /app/login/code/verify` signs in. Works for approved accounts with no password yet. Codes are typed in the app (not links), because on iPhone an email link opens Safari, not the installed app.
- `appSessionValid`: every app request re-checks the registration (approved, still linked to the same player) and signs the session out otherwise. Bans don't block viewing (same as the site); app actions that write (picks, Papawis) must check bans themselves.
- `scripts/app-auth-smoke.js`: an after-deploy check of the sign-in routes (`BASE=… EMAIL=… PASSWORD=… node scripts/app-auth-smoke.js`).
- Session: `markAppSession` sets the cookie to 180 days and re-sets it (via `session.appDay`) on the first app open each day, so the session rolls. The site's own 8 h / 30 d login is unchanged.

## Setup
`/app/setup/photo` → `details` → `season` → `done`. The season step counts as done once seen (`setup_season_seen`), so a balance or open sign-up stays on Me's To do (and Home's action strip) instead of holding setup open; the details form requires everything `appDetailsDone` checks. Photo posts to the site's `/me/photo`: shrunk on the phone to 800 px (profile) + 1600 px (kept original, dropped if the pair is over 6 MB), the reply read as text so a proxy's HTML error page (413 over nginx's ~10 MB limit, Cloudflare 5xx) shows a readable message; one retry with the profile size only, and each failure is logged as `photo_failed` (status · size) for `/admin/app`. Details save to `registrations` (`updateRegistrationProfile`) and are pushed to the player record with `mergeRegistrationIntoPlayer` (the admin "sync"), so the public profile updates immediately. Jersey numbers stay with the team head (`/my-team/number`). `appSetupState` drives the "Finish setting up" card on Home.

## Usage tracking (`/admin/app`)
- `app_events` table (lib/portal-db.js `logAppEvent`): `signin` (detail `password` | `email_code`), `code_sent`, `open` (first open of the Manila day, detail `home_screen` | `browser`), `installed` (first home-screen open per platform, or Android's `appinstalled`), `setup_details`, `setup_done`, `signout`. Platform from the user agent: `ios` | `android` | `desktop`. "View as" sessions are never logged (`logApp`).
- `public/app.js` posts `/app/ping` once per phone per day (localStorage `wknd-ping`); iPhone has no install event, so a home-screen open is how "installed" is known there.
- `/admin/app` (Members): one row per approved player account with sign-in, install, setup and last-opened status, the activity log, and the access settings (`app_open` toggle, `app_beta` tester emails; both saved through `/admin/site/settings`, section `members`).

## Speed
- In-app links don't reload the page: `public/app.js` ("Fast navigation") fetches the screen, swaps `main.app` and the tab bar, and pushes history. Screens are kept in memory for the visit: shown at once when tapped again, then refreshed in the background. The tabs are fetched ahead once the first screen is up; other links start loading on touch. The screen the app opened on is fetched from the server too (not copied from the live page). Forms, sign-in, log out and links out of `/app` are normal page loads. A screen from a newer deploy (different `app-ver`) loads as a full page.
- Motion: `render()` animates each swap with the View Transitions API (CSS fallback `.enter-*` on older phones). `direction()` picks it: between tabs a cross-fade; into a screen below a tab (notifications, setup) a slide in from the right; back a slide the other way; setup steps by their order. The tab bar holds still only between two screens that both have it. Reduce Motion turns it off.
- Long lists load lazily: `lazyList({ src })` (views/app/layout.js) renders placeholder rows; `initLazyLists()` in app.js fetches `src` → JSON `{ html, next }`, appends the rows, and loads `next` when the bottom comes within ~600px ("Try again" on failure, "Show more" without IntersectionObserver). Pages are keyset-paged (20 rows, `before=<created_at>:<id>`). Use it for the feed too. Screens themselves must be safe to fetch ahead: side effects belong in the list's data request (e.g. `/app/notifications/items` marks notifications read on its first page, and carries `opened` so rows it just marked keep their dot on later pages).
- Fetches give up after 10 s, a tap only shares a request started in the last 4 s, and coming back to the app cancels everything in flight: on iPhone a request caught by the app going to the background can hang for good, which left taps under a stuck progress bar. A tap whose fetch fails loads the page normally.
- A quiet background refresh waits for an animated swap still in progress (`pendingSwap`), so the stale screen can't land on top of the fresh one.
- Per-screen setup lives in `initPage()`, which runs again after every swap: anything new that hooks into a screen goes there.
- The Picks badge, Home's action strip and Me's picks line use only the close check (`appOpenPicks` → `picksClosedFor`), not `buildPicksContext`/`openPicks` (all picks + odds, ~100 ms); every tab screen computes them.

## Notices
Toasts and bars are coloured by tone (CLAUDE.md "Notices"; tokens `--ok-bg` / `--err-bg` / `--warn-bg` in app.css): `toast(text, tone)` in app.js, tone `ok` (default, green ✓) | `err` (red) | `warn` (amber) | `info` (neutral). The offline bar is red and turns green ("Back online") for 2 s on reconnect; the "New version ready" bar is amber; a lazy list that fails to load and a failed pick show a tinted red block. In-page messages use `.msg--ok/err/warn/info`.

## Time
Dates and times use `manilaFormat` (views/utils.js): shift to UTC+8 and format as UTC. Intl's `Asia/Manila` isn't reliable on the Hetzner build.

## Updates and offline
- `APP_VER` = commit + newest app file mtime. Busts `app.css`/`app.js`, names the SW cache, and `/app/version` returns it. `app.js` checks it when the app comes back to the foreground and reloads (or shows a refresh bar when a form has unsaved input), also after 30 minutes away.
- The service worker caches only the shell (CSS, JS, fonts, icons, `/app/offline`). Pages always load from the network; offline navigation shows `/app/offline`.
- iPhone never updates the home-screen icon or name after install: keep the icon plain.

## Not built yet
Push notifications, app versions of Papawis / Share my stats / balance / sign-up / jersey, the Finals margin guess in the app, writing comments and reactions in the app (F2), awards and picks results as feed cards.
