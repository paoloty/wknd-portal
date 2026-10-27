# Players app standards (`/app`)

Every new or changed app screen follows these. They come from the UI/UX and speed audits of 2026-10-24. Design tokens and type sizes are in CLAUDE.md ("Players app type"); this file is how screens are built.

Rules marked **(target)** describe something not built yet: new code follows them, and older screens get them when they're next touched.

## Speed

Each uncached request from the Philippines costs ~1.3–1.7 s (PH → Cloudflare LAX → VPS); the server renders in 10–90 ms. **What costs time is the number of requests a screen makes one after another, not how fast the code runs.**

1. **One request per screen.** Everything above the fold comes in the screen's HTML. Fetch lazily (`lazyList()`, `data-block-src`) only for page 2 onward or content below the fold.
2. **No side effects on a GET.** Screens are prefetched on touch, refreshed in the background and re-fetched by the service worker. Logging, "seen" marks and counters go in a POST, a beacon or the lazy data request.
3. **Server render ≤ 50 ms.** No whole-table work per request (picks context, odds, all registrations); memoise it and bust on write.
4. **HTML ≤ ~150 KB raw.** No large inline scripts or JSON blobs.
5. **No layout shift.** Every picture has `aspect-ratio` (or width/height), is sized (`sizedSrc`: `srcset` 640w/720w/960w WebP, avatars `?w=`), and is versioned with `?v=` when its URL can stay the same for a new picture.
6. **Pictures come from paths the service worker knows** (`isImage` in `public/app-sw.js`). Add a new image route there.
7. **Every screen picks how it's stored on the phone** (`isScreen` in `public/app-sw.js`):
   - **copy is fine:** Home, My Team, games, news, notifications. Shown at once, refreshed quietly: on a launch, and on an in-app tap when the copy is under a day old (`phoneCopy` in `public/app.js`). A push fetches its screen ahead on Android (`warm` in `public/app-sw.js`).
   - **copy, labelled (target):** Picks, Papawis, Me's to-do lines. Show "as of 3:12 PM" when the screen came from the copy, and turn off actions offline.
   - **always from the server:** money (Settle, balances). Never in `isScreen`.
8. **Cache keys never carry per-visit params** (timestamps, `opened=`, cursors beyond page 1). Every cache on the phone has a cap.
9. **Never queue a write for later** (pick, join, payment). Deadlines and slots are checked on the server; offline, the button says it needs a connection.
10. **No new web fonts or weights; no third-party scripts on load.** YouTube loads near or on tap only. One exception: Share my stats loads Saira Condensed Black (`/fonts/sairacondensed-black-latin.woff2`, 18 KB) on that screen only, to draw the premium cards on the phone.
10a. **Work the phone can do, it does, when it saves a request:** the premium share cards are drawn on the phone (`public/share-cards.js`, shared with the server, which still makes locked cards and Receipt). Anything with a lock, a deadline or money stays on the server.
11. **Register new files:** a new `views/app/*.js` or app script in `public/` goes into `APP_VER`'s list (server.js), a new cached screen into `isScreen`.

## Screens and navigation

12. **Every screen is built with `appPage()` / `sendTab()`.** A tab root starts with `.lt` + `h1`. A screen below a tab starts with the shared navbar; the back arrow is always `backChev`, never "‹". (target: one `appNavbar(back, title)` helper in `views/app/layout.js` instead of hand-written navbars.)
13. **Back goes to where the player came from:** a `from=` key in `APP_BACK`. A deep link (push, notification) still gets a sensible back. (target: when the previous history entry is that screen, call `history.back()` instead of pushing a new one.)
14. **Tabs:** `TABS` (layout.js) and `ROOTS` (app.js) change together. A badge shows one fact and has a text label.
15. **Players stay in the app.** Only `isAppHref` links are tappable, including links inside admin-written HTML (rewrite them through `appLinkFor`). Anything the app doesn't have yet shows `soonTag`.

## Touch and layout

16. **Tap targets ≥ 44×44pt**, with 8px between neighbours. A control that should look small keeps its look and gets an invisible hit area (`::after` inset), and its hit area must not overlap a neighbour's.
17. **One main action per card or screen** (solid `.btn`). The rest are `.btn--ghost` / `.btn--plain`. A form's main action sits at the bottom (`.step-actions`).
18. **Safe areas:** anything fixed or sticky uses `--safe-t` / `--safe-b`. Use `dvh`, never `vh`.
19. **Labels fit on one line at 320px.** Shorten the label; don't shrink the type.

## Look

20. **Type:** only the sizes in CLAUDE.md ("Players app type"). (target: sizes in rem from `html { font: -apple-system-body }` so iPhone's Larger Text works.)
21. **Colour:** amber only through `--amber` (fills) and `--amber-text` (text). Text and icons meet 4.5:1 (3:1 for large text and non-text) **in light and dark**. Team colours only on `.dot`, avatar rings and pick bars. A new colour gets a token in all three `:root` blocks of `public/app.css`.
22. **Surfaces:** reuse `.card`, `.group` + `.cell`, `.sx`, `.fc`, `.empty`, `.glow`. Corners are `--r-card`, `--r-in` or round. No new card styles.
22a. **Data tables swipe, names pinned:** a stats table wider than the screen sits in a box with `overflow-x: auto`; `public/table-scroll.js` (site, admin and app) then pins its first column and shows a shadow on that column's edge once swiped. Nothing to add per table, and no hand-made sticky column or shadow. Opt out with `data-xs-off`. Borders: row lines or one-sided dividers only (a boxed-in grid is left unpinned).
23. **No inline `style=`** for layout or type: add a class in the feature's block of `public/app.css`. Inline is fine only for data-driven custom properties (`--c`, `--ring`, `width:%`).
24. **Icons:** only `icons.*` line icons, no emoji or text glyphs (✕ ★ ⏳ 📎 📍). Every icon-only button has an `aria-label`, including its count ("Fire, 3").
25. **Copy:** "WKND Basketball" (never "League"), "Log out", and names that match the real screens (Me → Settings).

## Feedback and states

26. **Transient feedback is `toast(text, tone)`;** messages inside the screen are `.msg--ok / --err / --warn / --info`. Plain info is neutral, not amber. Server errors show with `role="alert"`.
27. **Never a blank area while loading:** lists use `lazyList()` (skeleton, "Try again", "Show more"), later blocks `data-block-src` with a skeleton.
28. **Every list has an `.empty` line** that says what will appear there and when.
29. **A failed write says why; offline it says nothing was sent.**
30. **Writes send once:** a busy flag plus `button.disabled`, checked first in the handler (`.is-busy` alone doesn't stop the keyboard's Go). Optimistic only when it's cheap to undo (picks, fire), with rollback and the server's reason. `refreshScreen()` afterwards.
31. **Anything that can't be undone, involves money or is inside a cancel window asks first.** (target: one app confirm sheet instead of `confirm()`.)

## Forms

32. **Inputs are 16px** (no iOS zoom), with the right `type` / `inputmode` / `autocomplete` / `enterkeyhint`, and `autocapitalize="none"` on emails.
33. **Visible labels** (`.cell__lbl`, `.st__field`), not just placeholders. Messages sit next to the field, with `aria-invalid` on the field that's wrong; check on submit.
34. **File pickers are a real `<button>`** that calls `input.click()`, never a hidden input inside a label.

## Sheets and accessibility

35. **Sheets follow the comments sheet:** it moves with the keyboard via `visualViewport`, keeps the page still, swipes down to close and closes on Escape. (target: focus moves in, `inert` behind, focus returns to the opener, and a history entry so Back closes the sheet.)
36. **Visible focus and screen changes.** (target: a global `:focus-visible` ring, and after each screen change focus moves to the screen title.) Toggles carry `aria-pressed` / `aria-expanded`; never rely on colour alone (unread, selected).
37. **Motion** only under `prefers-reduced-motion: no-preference`.

## One backend for the site and the app

These apply to every backend change, made from either side.

- **Actions go through the site's routes.** The app posts to the site's own routes (picks, Papawis, settle, photo, stat cards) or to a shared function (`postComment`). Never write a second copy of a rule in an `/app` route.
- **A change on one side means checking the other.** When you change what a site page shows, check the matching app screen, and the reverse. The app has its own read helpers (`appFeedIndex`, `appPapawisRuns`, `appOpenPicks`, `/app/team`, `/app/me`), so check:
  - feature flags (`papawis_enabled`, `posts_enabled`, `comments_enabled`);
  - `under_review`;
  - regular season vs playoffs;
  - `potgIdsFor()`;
  - `byDate()` order.
- **Opening a screen never writes while viewing as a player.** The read-only guard only stops non-GET requests. A GET that writes (marking notifications read, activity logs) checks `req.session.impersonating`.
- **Notifications:**
  - Every notification goes through `createNotification`, and the bell comes first. Create it before or apart from any email, so a missing or failed email never drops the bell.
  - A new notification type needs:
    - a push kind in `lib/push.js` `pushKindOf`;
    - a link that `appLinkFor` maps to an app screen, so it doesn't dead-end on the Notifications list.

## Before calling a screen done

38. **Check it:**
    - at 320px and 390px, in light and dark;
    - with the keyboard open;
    - offline;
    - opened from a notification;
    - signed out mid-session.

    The handoff doc has the Playwright mobile setup. (target: also at the largest text size.)

**The scorer's guide.** A change to how the scorer works (`public/scorer.js`) ships with its How to score update (`views/app/help.js`, screenshots in `public/help/scorer/`) in the same commit. `node --test` checks the obvious drift (`test/scorer-guide.test.js`); the rest is reading the chapter again.
