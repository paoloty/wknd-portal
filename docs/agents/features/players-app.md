# Players app (`/app`)

Phone-first, players-only app served by this same server: same accounts, sessions and `portal.db`. Installable to the home screen (web app manifest + service worker). Milestones 1–2: shell, sign-in, player setup, Home; the other tabs are read-only or hand off to full-site pages.

## Files
- `server.js`: section "Players app (/app)", right after the site's `/logout` route. All `/app*` routes, gating, sign-in codes, data shaping.
- `views/app/layout.js`: `appPage()` (full HTML document: manifest, theme colours, tab bar), icons, `appAvatar()`.
- `views/app/auth.js`: sign-in, email code, players-only and "not yet" gates, offline page.
- `views/app/home.js`, `views/app/setup.js`, `views/app/tabs.js`: screens.
- `public/app.css` (own light + dark tokens, separate from `styles.css`), `public/app.js` (theme switch, countdown, code boxes, photo upload, install hint, service worker, update check), `public/app-sw.js` (served at `/app/sw.js` with `__VER__` filled in), `public/app-icon-*.png`.

## Access (`appAccess`)
- Hidden until `site_settings.app_open = '1'`. Before that: player-admins (`registrations.is_admin`), "view as" sessions, and anyone listed in `site_settings.app_beta` (emails or registration ids, comma or space separated). Everyone else signed in gets the "almost here" screen.
- Players only: no `player_id` → "This app is for WKND players"; the super-admin login gets the same; pending sign-ups get "waiting for approval".
- Pages send `noindex` and `Cache-Control: private, no-store`.

## Sign-in
- `POST /app/login`: the site's own checks (`getRegistrationByEmail`, `checkPlayerPassword`, `signInRegistration`), logged to the admin log with `via`.
- Email code: `POST /app/login/code` → 6 digits, kept hashed in memory (`appCodes`), 10 min, 5 tries, one email a minute, same response whether or not the email exists. `POST /app/login/code/verify` signs in. Works for approved accounts with no password yet. Codes are typed in the app (not links), because on iPhone an email link opens Safari, not the installed app.
- Session: `markAppSession` sets the cookie to 180 days and re-sets it (via `session.appDay`) on the first app open each day, so the session rolls. The site's own 8 h / 30 d login is unchanged.

## Setup
`/app/setup/photo` → `details` → `season` → `done`. Photo posts to the site's `/me/photo`. Details save to `registrations` (`updateRegistrationProfile`) and are pushed to the player record with `mergeRegistrationIntoPlayer` (the admin "sync"), so the public profile updates immediately. Jersey numbers stay with the team head (`/my-team/number`). `appSetupState` drives the "Finish setting up" card on Home.

## Usage tracking (`/admin/app`)
- `app_events` table (lib/portal-db.js `logAppEvent`): `signin` (detail `password` | `email_code`), `code_sent`, `open` (first open of the Manila day, detail `home_screen` | `browser`), `installed` (first home-screen open per platform, or Android's `appinstalled`), `setup_details`, `setup_done`, `signout`. Platform from the user agent: `ios` | `android` | `desktop`. "View as" sessions are never logged (`logApp`).
- `public/app.js` posts `/app/ping` once per phone per day (localStorage `wknd-ping`); iPhone has no install event, so a home-screen open is how "installed" is known there.
- `/admin/app` (Members): one row per approved player account with sign-in, install, setup and last-opened status, the activity log, and the access settings (`app_open` toggle, `app_beta` tester emails; both saved through `/admin/site/settings`, section `members`).

## Speed
- In-app links don't reload the page: `public/app.js` ("Fast navigation") fetches the screen, swaps `main.app` and the tab bar, and pushes history. Screens are kept in memory for the visit: shown at once when tapped again, then refreshed in the background. The tabs are fetched ahead once the first screen is up; other links start loading on touch. `/app/notifications` is never fetched ahead (opening it marks notifications read). Forms, sign-in, log out and links out of `/app` are normal page loads. A screen from a newer deploy (different `app-ver`) loads as a full page.
- Per-screen setup lives in `initPage()`, which runs again after every swap: anything new that hooks into a screen goes there.
- Home's open-pick To Dos use only the close check (`picksClosedFor`), not `buildPicksContext`/`openPicks` (all picks + odds, ~100 ms).

## Updates and offline
- `APP_VER` = commit + newest app file mtime. Busts `app.css`/`app.js`, names the SW cache, and `/app/version` returns it. `app.js` checks it when the app comes back to the foreground and reloads (or shows a refresh bar when a form has unsaved input), also after 30 minutes away.
- The service worker caches only the shell (CSS, JS, fonts, icons, `/app/offline`). Pages always load from the network; offline navigation shows `/app/offline`.
- iPhone never updates the home-screen icon or name after install: keep the icon plain.

## Not built yet
Push notifications, passkeys (Face ID), app versions of Papawis / Who wins? / Share my stats, the feed.
