# Ratings + Rate & Win — plan (all phases)

Agreed with Paolo, 2026-10-22. Goal: get players rating players, rating courts, and coming back to the site.
Phase 1 is built first; Phases 2–3 are recorded here so later work starts from the same decisions.

## Decisions that hold across phases

- **Player ratings are about conduct, not skill.** Skill is already covered by box-score ratings (`lib/ratings.js`).
- **Ratings never decide qualification.** They surface players on an admin "Conduct watch" list; fines and upheld
  player reports (which have evidence, admin votes and appeals) are what count toward next-season qualification.
  Players are told this.
- **Anonymous to players, never to admins.** Player ratings are always anonymous to other players. Court reviews
  are named by default with an optional "Post anonymously" toggle. Admins (rater names: super admin) always see who.
- **Scores given never affect raffle tickets.** "Skip" counts as a response.
- **Raffle prizes are vouchers, never ledger entries.** Nothing named `Papawis%` may be written for a prize: the
  probation deposit hold is waived when Papawis credit covers it (`papawisProbationHold`, `lib/portal-db.js`).

## Phase 1 — rating + the post-game ask (built)

- **Rate your game page** (`/rate/:kind/:ref`, kind = `papawis` | `league`): one screen per game with the court
  (stars; a written review on a player's first rating of that court) and every other player from that game.
- **Player rating form**: "Would you play with them again?" Yes / Maybe / No / Skip, plus optional tags.
  Good tags: Good sport, Kept cool, Team-first, Played safe, On time. Bad tags (admin-only): Lost temper,
  Dirty play, Blamed teammates, Late / no-show. "No" requires at least one bad tag.
- **Eligibility**: rater and ratee both played that game. Papawis = confirmed signups of a completed run (guests
  excluded); league = the game's box score (`game_player_stats`). One rating per (game, rater, ratee), editable
  during the rating window (3 days after the game).
- **Post-game ask**: one email per game + a bell for every player. Papawis: the rating block is folded into the
  existing close-out tab email for players who got one; others get a stand-alone rating email. League: a rating
  email once the game is final. Per-game dedupe (`game_rate_asks`). Email follows `checkActivePlayer` and the new
  `rating_email_optout`; the bell always goes.
- **Signed one-tap links**: the email links carry an HMAC token for that player + that game, valid through the
  rating window. They let the player rate that game only (no general login). The page shows "Rating as X · Not you?".
  Admins can turn one-tap links off per player.
- **Court ask**: first time at a court, then at most once per re-ask interval (setting, default 30 days).
- **Court reviews**: optional "Post anonymously" toggle → shown as "A WKND player · Played here".
- **Player profile**: old roast-style ratings card retired (rows kept read-only); the player sees their own good
  tags; the public sees positive highlights only once enough raters exist.
- **Admin**: `/admin/ratings` rewritten — every game rating (rater name for super admin), per-player summary,
  per-game response rates, rater checks, delete; Conduct watch (several distinct "No"s across 3+ games, with bad
  tags, fines and reports alongside); legacy roast ratings archive; "Reviews waiting" count on the admin home.
- **Settings**: game ratings on/off, post-game rating email on/off, court re-ask interval.

## Phase 2 — Rate & Win raffle (built)

- 1 ticket per game for finishing the Rate your game page (every player answered, Skip counts, plus the court),
  +2 one-time bonus for a first court review that an admin approves (50+ characters). Within the 3-day window.
- Draw every other Sunday 8:00 PM Manila, automatic (server job; idempotent: draw if `scheduled_at < now` and no
  draw row; catches up after downtime). Minimum 10 distinct players, else tickets roll over once (prize does not
  stack). Tickets reset after each draw. Weighted random; commit–reveal fairness (seed hash stored at round open,
  seed revealed at draw).
- Excluded: admins, probation / unpaid players (silently); one win per player per 3 months.
- Prize: free-run voucher. The winner taps "Use my free run here" on a run they're confirmed in; close-out skips
  that slot's charge and marks it paid; cancelling releases it. Expiry: end of next season (per-prize setting).
- Code: lib/raffle.js (model, draw, vouchers, job), views/raffle.js, views/admin/raffle.js. Switch: raffle_enabled.
- UI: `/raffle` (countdown, your tickets and odds, games to rate, entrants, history, past winners, rules, fairness
  code), nav ticket pill, "+1 ticket" on finishing a Rate your game page, ticket line in post-game emails,
  homepage banner, horizontal reel draw animation at 8 PM (10 s polling, no websocket). 7:45 PM bell optional.
- Open data model from day one: `raffles`, `raffle_ticket_rules`, `raffle_tickets`, `raffle_prizes`,
  `raffle_draws`, `raffle_winners`, `raffle_vouchers`. Rate & Win seeded as fixed config. Admin: entries, draw
  log, pause / skip, vouchers.
- Open question before launch: confirm a DTI sales-promo permit isn't needed (free entry, members only).

## Phase 3 — custom raffles (when the first event comes up)

- Admin "New raffle" form: basics + banner, recurring / one-time schedule, ways to earn with amounts (rating,
  Papawis runs or attendance targets, picks, correct picks, early season confirmation, admin-granted), per-player
  cap, prizes (free run, Papawis credit in its own non-`Papawis%` category, season fee discount, physical item with
  handover tracking, profile badge, custom), who can win, what happens below the minimum.
- `/raffles` hub with several raffles at once and "Your prizes"; multi-prize draws, smallest first.

Mockup: https://claude.ai/artifact/24HJkSzxx6qDfXS4vBkNcu
