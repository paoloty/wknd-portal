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
- Cards are styled (`.sx`, one column each; Paolo, 2026-10-23): **game** = the cover photo (or video thumbnail) as the hero with the score on it (winner bright with an amber W, loser dimmed; a dark gradient when there's no picture or it fails), recap headline + 2 lines, player of the game in an amber strip with a ★, "Your line", 🔥/💬 counts. **Announcement** = amber glow, 📣 + who posted it, 📌 Pinned chip, photo/video. **Papawis** = date pill, court, spots bar, faces of who's in (first 5 confirmed). **News** = the article's first linked picture across the top, headline, 2 lines. A game shows up as soon as it's final; the write-up fills in when added.
- Game screen `/app/games/:id?from=home|team|me|picks` (back goes where you came from): video plays inside the app in our own player (app.js `mountPlayer`: the YouTube IFrame API with `controls: 0`, our bar: seek, time, mute and full screen; tapping the picture plays/pauses). YouTube's frame is 200px taller than the 16:9 stage (`.player__crop`), so its title bar, share/playlist buttons and bottom strip fall outside the visible area and only the video shows. Full screen is the real thing where the phone allows it on a page element (Android, iPad); on iPhone the player fills the window (turn the phone for landscape). iPhone only starts a video with sound from a tap on the YouTube frame itself, so the player loads as soon as the screen shows (feed videos once they scroll near) under our cover picture, which lets taps through: one tap plays. After that our layer takes the taps so YouTube's links can't leave the app, and paused, the picture dims under our ▶. If the IFrame API can't load, YouTube's own embed is used., score, full recap and player-of-the-game write-ups (admin text reduced to plain paragraphs, `textParas`), both box scores with your row lit, comments read-only ("Soon" to write).
- News post `/app/posts/:slug`: the article as the site renders it.
- Pictures are sized (`sizedSrc`): game covers and announcement photos come as `srcset` 640w / 960w WebP (server-resized and cached by `sendPlayerPhoto`), `sizes` = the card width, so a phone downloads only what its screen needs; the admin list uses a 160px thumbnail.
- Feed pictures load straight away (no `loading="lazy"`: iPhone Safari never loads a lazy image added while the list is hidden). One that fails is retried once 1.5 s later, then reported (`img_failed` with its path, on `/admin/app`) and removed: a photo takes its grey box with it, a video keeps its play button (app.js "Pictures that fail").
- Pull to refresh on every screen with the tab bar (app.js "Pull to refresh"): pull down from the top past the mark and let go; the screen re-fetches (`refreshScreen`) and the feed reloads its first page.
- Papawis cards are view-only ("Soon") until Papawis is built into the app.

## One look (app.css "One card look, app-wide")
- Every card, list group and tile shares the feed cards' surface (`--card-bg` + `--card-hi`, 20px corners). `.glow` is the amber-glow card (announcements, your Picks record, your profile, the preview's matchup). Results show as W/L chips (`.res`). The Pickmaster's top 3 use the medal colours. The game screen uses the feed card's hero (`gameHero`: photo + score, or a dark band under the video) and its player-of-the-game strip (`potgBox`). New screens use these, not new card styles.

## Home's rail and the game preview
- Home shows the next game day's games in a sideways rail above Latest (`/app/rail` → JSON `{ html }`, loaded after the screen by app.js `initBlocks`; the copy on the phone shows first). While picks are open they're pick cards (pick right there; same buttons and `POST /games/:id/pick` as the Picks tab; the card's bars grow in after a pick and the tab badges refresh); once picks close, preview cards (last meeting, last 5, players to watch, your pick). After the games the rail is gone and results are feed cards. Open picks aren't repeated in the action strip.
- Every card has Preview › → `/app/games/:id`, which before the result is the preview (`appGamePreview`): the pick card while picks are open, the storyline, records, each team's last 5, last meeting (→ that game), all-time series, players to watch. Built from the site's `gamePreview()` (same matchup and storyline) through `appPreview`. After the final the same URL is the recap.
- Picks shaping for both: `appPickGame` (also used by the Picks tab).

## Papawis (`/app/papawis`)
- `views/app/papawis.js` + server.js `appPapawisRuns` / `appPapawisHistory`. The upcoming runs (`status = 'open'`, not past) as run cards: court photo hero with day/time and an "N open / Full" chip, countdown to tip-off (or to sign-ups opening), who's in (faces, yours in amber), per-head estimate, cancel-by date, waitlist, and one action. Then "Your runs": past runs with what each cost and whether it's paid.
- The states mirror the site's `views/papawis.js` runBlock (scheduled, in with slot, pending deposit, waitlist position, banned, unpaid game, full → waitlist, open → claim). Join / leave / free run post to the site's own `/papawis/:id/join | cancel | voucher`, so every rule stays in one place; a claim inside the 3-day cancel window and any cancel ask first. Deposits and settling a balance are still on the site (shown with "Soon").
- Home's Papawis feed cards open this tab ("Join ›").

## Push notifications (`lib/push.js`, web-push)
- Turned on per phone from Settings → Notifications ("On this phone") or Home's "Turn on notifications?" card (shown while the phone hasn't been asked; "Not now" hides it 2 weeks). iPhone: installed app only (iOS 16.4+), and the permission prompt must come from a tap. Table `push_subscriptions` (one row per phone); re-sent once a day so the server keeps it. Log out unsubscribes the phone; a password reset deletes the account's subscriptions.
- What's pushed: every bell notification (`createNotification` → `onNotificationCreated` listener in server.js → `pushToPlayer`), opening the matching app screen (`appLinkFor`: /papawis → Papawis tab, /games/… → the game, /picks → Picks, else the inbox); announcements (push only, to app players); picks closing in 2 hours with games still to pick (once per day per player, `push_log`). The app icon shows the unread count (Badging API).
- Kinds the player can switch off (`push_prefs`, `PUSH_KINDS`): Picks & MVP, Papawis, Games, Comments, Announcements. Account messages always come through.
- Keys: `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (+ `VAPID_SUBJECT`) from the environment, else a pair is made once and kept in site_settings. Changing keys means everyone turns notifications on again.
- `/admin/app` shows how many accounts have notifications on; `push_on` / `push_off` in the activity log.

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
- `app_events` table (lib/portal-db.js `logAppEvent`): `signin` (detail `password` | `email_code`), `code_sent`, `open` (first open of the Manila day, detail `home_screen` | `browser`), `installed` (first home-screen open per platform, or Android's `appinstalled`), `setup_details`, `setup_done`, `signout`, `photo_failed`, `img_failed` (a feed picture that didn't load, with its path). Platform from the user agent: `ios` | `android` | `desktop`. "View as" sessions are never logged (`logApp`).
- `public/app.js` posts `/app/ping` once per phone per day (localStorage `wknd-ping`); iPhone has no install event, so a home-screen open is how "installed" is known there.
- `/admin/app` (Members): one row per approved player account with sign-in, install, setup and last-opened status, the activity log, and the access settings (`app_open` toggle, `app_beta` tester emails; both saved through `/admin/site/settings`, section `members`).

## Speed
- In-app links don't reload the page: `public/app.js` ("Fast navigation") fetches the screen, swaps `main.app` and the tab bar, and pushes history. Screens are kept in memory for the visit: shown at once when tapped again, then refreshed in the background. The tabs are fetched ahead once the first screen is up; other links start loading on touch. The screen the app opened on is fetched from the server too (not copied from the live page). Forms, sign-in, log out and links out of `/app` are normal page loads. A screen from a newer deploy (different `app-ver`) loads as a full page.
- Back (iPhone's edge swipe, Android's back button, i.e. `popstate`) swaps without our slide: iPhone animates the swipe itself, and ours on top showed a blank screen first.
- Motion: `render()` animates each swap with the View Transitions API (CSS fallback `.enter-*` on older phones). `direction()` picks it: between tabs a cross-fade; into a screen below a tab (notifications, setup) a slide in from the right; back a slide the other way; setup steps by their order. The tab bar holds still only between two screens that both have it. Reduce Motion turns it off.
- Long lists load lazily: `lazyList({ src })` (views/app/layout.js) renders placeholder rows; `initLazyLists()` in app.js fetches `src` → JSON `{ html, next }`, appends the rows, and loads `next` when the bottom comes within ~600px ("Try again" on failure, "Show more" without IntersectionObserver). Pages are keyset-paged (20 rows, `before=<created_at>:<id>`). Use it for the feed too. Screens themselves must be safe to fetch ahead: side effects belong in the list's data request (e.g. `/app/notifications/items` marks notifications read on its first page, and carries `opened` so rows it just marked keep their dot on later pages).
- Fetches give up after 10 s, a tap only shares a request started in the last 4 s, and coming back to the app cancels everything in flight: on iPhone a request caught by the app going to the background can hang for good, which left taps under a stuck progress bar. A tap whose fetch fails loads the page normally.
- Kept screens (app.js "Kept screens"): a screen with a lazy list (Home's feed, notifications) is kept as it was when the player left it (the same DOM: loaded rows, pictures, scroll position) and put back on return (back swipe or its tab) instead of rebuilt and reloaded; only the tab bar's badges are refreshed. Kept 10 minutes; pull to refresh reloads. Lazy lists record where they are (`data-lazy-next`) so a kept one carries on; video players go back to their cover when kept.
- A quiet background refresh waits for an animated swap still in progress (`pendingSwap`), so the stale screen can't land on top of the fresh one.
- Per-screen setup lives in `initPage()`, which runs again after every swap: anything new that hooks into a screen goes there.
- The Picks badge, Home's action strip and Me's picks line use only the close check (`appOpenPicks` → `picksClosedFor`), not `buildPicksContext`/`openPicks` (all picks + odds, ~100 ms); every tab screen computes them.

## Notices
Toasts and bars are coloured by tone (CLAUDE.md "Notices"; tokens `--ok-bg` / `--err-bg` / `--warn-bg` in app.css): `toast(text, tone)` in app.js, tone `ok` (default, green ✓) | `err` (red) | `warn` (amber) | `info` (neutral). The offline bar is red and turns green ("Back online") for 2 s on reconnect; the "New version ready" bar is amber; a lazy list that fails to load and a failed pick show a tinted red block. In-page messages use `.msg--ok/err/warn/info`.

## Time
Dates and times use `manilaFormat` (views/utils.js): shift to UTC+8 and format as UTC. Intl's `Asia/Manila` isn't reliable on the Hetzner build.

## Updates and offline
- `APP_VER` = commit + newest app file mtime. Busts `app.css`/`app.js`, names the SW cache, and `/app/version` returns it. `app.js` checks it when the app comes back to the foreground and reloads (or shows a refresh bar when a form has unsaved input), also after 30 minutes away.
- The service worker (`public/app-sw.js`) keeps as much on the phone as is useful, so the app opens at once and works offline:
  - `wknd-app-<ver>`: the shell (CSS, JS, fonts, icons, `/app/offline`), cache first.
  - `wknd-pages`: the screens (tabs, settings, notifications, games, posts; not sign-in, setup or Face ID). A launch is answered with the copy at once while a fresh one is fetched; app.js sees the page is old (`app-time` meta > 15 s) and swaps in the fresh screen quietly. In-app navigation is network first, the copy after 4 s or offline.
  - `wknd-data`: feed and notification pages (JSON), network first, the copy offline. The feed's first page shows the copy at once, then the network's answer replaces it if different.
  - `wknd-img`: game covers, announcement photos, player photos: `?v=` ones cache first, others from the copy while refreshed; newest 300 kept. Not YouTube thumbnails (another site's pictures are stored padded to megabytes each).
  - Screens and data belong to the signed-in player: wiped when a request lands on the sign-in page (signed out, session ended), on log out (app.js wipes before submitting), and if a page's `app-who` (a hash of the registration, `appWho`) differs from the last one on this phone. Pictures stay (they're the league's, not the player's).
- Offline, the red bar shows; tabs and screens visited before open from the copies, others show `/app/offline`.
- iPhone never updates the home-screen icon or name after install: keep the icon plain.

## Not built yet
App versions of Share my stats / balance / sign-up / jersey / Papawis deposits, the Finals margin guess in the app, writing comments and reactions in the app (F2), awards and picks results as feed cards.
