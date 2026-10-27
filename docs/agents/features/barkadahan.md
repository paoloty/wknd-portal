# Barkadahan (the app's chat room)

Built 2026-10-27. One chat room for every signed-in player, with who's online. **App only** (Paolo: "make this app exclusive"): a deliberate exception to keeping the site and the app in sync. Off until `barkadahan_enabled` is switched on in Admin → Super Admin → Barkadahan. Mockup: claude.ai/artifact/Jgcp866jfgbxtXMz3JWAyU.

## Files
- `lib/portal-db.js` — "Barkadahan" block: `barkadahan_messages` (kept for good; `deleted_at`/`deleted_by` instead of removing), `barkadahan_reactions` (message, player, emoji), `barkadahan_reads` (last read per player, for the unread count), `barkadahan_reports`. Players' `online_hidden`, `last_seen_at`, `barkadahan_muted_until`. Players see `BARKADAHAN_DAYS` (30); the admin archive sees everything.
- `server.js` — "Barkadahan" block: `/app/barkadahan` (the room, full screen, bundle), `/app/barkadahan/messages` (GET pages, POST send), `…/:id/react`, `…/:id/delete`, `…/:id/report`, `/app/barkadahan/mute/:playerId` (admins: a day / a week), `/app/barkadahan/read`, `/app/barkadahan/online`, `/app/online-visibility` (Settings → Privacy), `/admin/barkadahan` (+ `/:id/delete`, `/:id/keep`), super admins only. `/ws/app` in the upgrade handler.
- `public/app.js` — the app's live connection (`/ws/app`): open while the app is on screen, closed when it's put away (that is what "online" means); pings every minute (`last_seen_at`). Emits `wknd:bk` events; bumps the Home icon's count (`[data-bk-badge]`) for others' messages while you're not in the room. `meta[name=app-bk]` (the player's id) is only on the page when the feature is on.
- `public/barkadahan.js` — the room (loaded on that screen only): draws from the bundle then a fresh fetch, live updates, send with retry, reply, @mentions (`@Full Name` picked from a list; the server keeps only mentions still in the text), hold a message (450 ms) for 6 reactions + Reply / Copy / Report / Delete (own, or any for admins) / Mute (admins), the emoji sheet (32 + recent, `localStorage wknd-bk-emoji`), typing, older pages on scrolling up, the keyboard fit: the room is pinned (`.bk.is-pinned`, position fixed) to the visual viewport's `offsetTop` and `height`, on its resize and scroll. iPhone doesn't shrink the page for the keyboard, it slides the view up; shrinking the room's height alone left the box mid-screen with a gap above the keyboard (2026-10-27). It follows once a frame and only for moves of 2px or more (translate3d), and the page behind is locked (`html:has(.bk.is-pinned)` overflow hidden) so nothing bounces it. Hold a message = a bottom sheet inside the room (`.bk-hold`, absolute), opened after the keyboard is closed.
- `views/app/barkadahan.js` (room shell, online list), `views/app/home.js` (`homeHeader` chat icon, `barkadahanCard`), `views/app/tabs.js` (Show me as online), `views/admin/barkadahan.js` (archive, reports, online, the switch).

## Health (Fable audit, 2026-10-28)
- Sockets: every one the upgrade handler makes has an error handler (a bad frame used to crash the server), `maxPayload` 4 KB, and a 30 s ping/pong heartbeat that closes dead ones (a phone that lost signal stopped counting as online only when a write failed). Switching the room off closes the open app connections (code 4001); the app stops retrying on 4001 or after 5 refusals, until it's brought back.
- Sending: the phone's id for the message (`cid`, stored as `client_id`, unique per player) makes a retried send land once; the live copy carries it, so it replaces the "Sending…" bubble.
- The room's GET never writes (it's also a prefetch and a view as a player): the room posts `/read` when it's on screen. The unread count is kept in app.js and painted on every screen drawn (`wkndBkSync`). Never opened: the badge counts the last day only.
- The fresh fetch after load merges by id (same page size as the bundle, `BK_PAGE`); older pages page by (time, id). Live reactions/deletions patch their message; a new message is appended when it can be.
- Hold: the menu opens when the finger lifts (the bubble dims once the hold counts); opened under the finger, the lift pressed Report/Delete or closed it. Delete asks first. Reactions are one at a time per message.
- Hidden players never send "is typing". 500 characters are counted as characters, so a cut never splits an emoji.

## Rules
- Online = has the app open now; hidden players (`online_hidden`) never show. "Earlier today" = `last_seen_at` since Manila midnight.
- No push per message. An @mention (`barkadahan_mention`) or a reply to you (`barkadahan_reply`) goes through `createNotification` (bell + push; `pushKindOf` → comments).
- Banned players read but can't post or react; muted players read and react, not post. Viewing as a player is read-only.
- Flood guard: one message per 0.6 s, 20 a minute. 500 characters. Plain text and emoji, no links or photos.
- Super admins read and delete in admin; they never post there (Paolo).
