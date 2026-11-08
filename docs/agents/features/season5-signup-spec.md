# Season 5 sign-up: final spec (v2, after Fable's second audit, 2026-11-08)

Agreed with Paolo on 2026-11-08 and audited twice by Fable. One flow, the same logic on the site (`/season-signup`) and in the players app (`/app`). The app posts to the site's routes. One shared module, `lib/season-signup.js`, holds the questions, the validator, the rather-not list, drafts and the deal text.

## Goals
1. Players who sign up can pay, and they pay on time without Paolo chasing them.
2. Players will be there on Sundays.
3. The mindset is about winning, not just playing.
4. No playing-time drama: players accept that the coach picks who plays in the playoffs.

## Facts
- **Games:** Sundays, 6 AM and 8 AM. The season runs about 4 months. **Double round robin** (4 teams → 6 games per team), then playoffs: **minimum 7 games** per team (Paolo, 2026-11-08). Two-thirds attendance = at least 5 of 7; missing 3 or more is a mark. There is no exact start date when sign-ups open.
- **Season fee:** ₱3,750 for everyone (same as Season 4). There is no price difference between plans and no fake discounts.
- **Jerseys:** new for Season 5, so every player buys one. The jersey is a separate charge and is paid first.
  - Top ₱550 (setting `jersey_top_price`, was ₱600 in Season 4).
  - Shorts ₱550, optional. Pockets +₱100.
  - **NBA cut +₱50, top only (Paolo, 2026-11-08): new option.** Needs a `jersey_nba_cut_price` setting and a `jersey_cut` field (regular / nba) on the sign-up. Include it in `computeJerseyBreakdown` (top amount), the jersey order list and the charge.
  - Sizes past XL +₱50 per size (`jersey_surcharge_step`).
  - Example: top L regular + shorts M with pockets = ₱1,200.
- **Spots:** 4 teams, 48 spots.
- **Sign-ups:** open as soon as the build is done. The window is 10 days, with reminders 3 days and 1 day before close.
- **Confirmations:** one batch, sent right after close when Paolo picks the 48. Everyone's clock starts on the same day. Promotions from the waitlist come later, one by one.

## The flow

### Start screen
- **Season facts:** closing date, 48 spots, fee ₱3,750 + jersey.
- **Your record** (returning players only), from a per-player helper `playerRecord(playerId)`:
  - "Season 4: you played X of Y team games (all team games, excused or not)."
  - Payment in plain words: "paid on time", "needed reminders" or "paid after the season".
- **Links:** How we choose the 48, and the conduct rules.
- No "filling up" bar.
- **Finish later:** progress is saved in a separate `season_signup_drafts` table. Admins never see drafts.

### Start screen, still owing (≥ ₱100 from before)
- Red "Unpaid balance" card at the top: the amount, "You can sign up now, but you can't be picked until it's paid. Settle it before sign-ups close on [date]." Three steps (settle, fill in, admin confirms payment). "Already paid? Message an admin."
- Main button **Settle ₱X**; **Start my sign-up** under it. The form is not blocked.
- Otherwise the same as the normal Start screen: the 6-step list and the "How we choose the 48" / conduct links stay (Paolo, 2026-11-08).
- Record line "Still owing after the season", and only Pay in full is offered (pay-first rule).
- Banned players (auto-ban) keep today's blocked status page with Settle; the ban lifts on settle and the form opens.

### Step 1 · The deal
One card. Checkbox: **"I've read this and I agree."** Stored as `expectations_agreed_at` and `expectations_version`.

> **We pick players who help their team win, not players who want the most minutes.**
>
> At least 7 games: a double round robin (6 games), then the playoffs. **Double round robin: everyone plays in every game** (the Pasarella rule). **Semis and finals: the coach picks who plays.** Some players will sit. That's part of the deal.
>
> If you have a problem with your role, talk to your coach or captain in private. Not in the group chat. Not during a game.
>
> **Sundays, 6 AM and 8 AM.** Can't make a Sunday? Tell your captain by Friday.
>
> **Money.**
> - Jersey first, then the season fee on the plan you pick.
> - Your first payment is due on the first payday (the 15th or the 30th) at least 5 days after we confirm you. Miss it and your spot goes to the next player.
> - The other payments fall on fixed paydays after that.
> - No extensions.
> - Everything is paid before the semis, or you don't play in the playoffs.
> - Pay late this season, and next season you pay in full before you're confirmed.
> - The jersey is yours once it's paid, even if you don't play. The season fee is refunded only if you withdraw before the first game.
>
> The conduct rules apply. Technicals, fines and reports count toward next season.

### Step 2 · Can you commit?
1. **"Your team plays at least 7 Sunday games (6 AM or 8 AM) over about 4 months. How many will you miss?"**
   - Choices: None / 1 / 2 / 3 or more / Not sure yet.
   - Under it: "Missing 3 or more is a mark against you next season."
2. **"Anything planned in the next few months?"** (optional, more than one allowed)
   - Choices: Trip abroad · Work travel or shifts · School · Family event · Injury recovery.
   - Each one ticked asks "roughly when?" with month chips. Short note optional.
   - The form says: "This is for planning. It doesn't excuse missed games."
3. **How you'll pay:** pick a plan (see Payments). The form shows the amounts and the rule for when each one falls. Exact dates are fixed at confirmation.

### Step 3 · Your role
Asked fresh every season. Nothing is prefilled except Q5.

1. **Pick the playoffs you'd rather have:**
   - A. We win the title. You play about 8 minutes a game.
   - B. We lose in the semis. You play 30 minutes and have your best games of the year.
   - Shown to admins as a fact. It is not a trigger on its own.
2. **Semifinal, close game. You haven't played since the 2nd quarter. What do you do?**
   - Stay ready and cheer
   - Ask the coach after the game, in private
   - Ask the coach face to face after the game, with the team there
   - Ask the coach on the bench, during the game *(amber)*
   - Keep quiet, then post about it in the team chat later *(red)*
3. **Your team lost. A teammate complains about the rotation in the team chat. What do you do?**
   - Stay out of it
   - Tell them privately to talk to the coach
   - Say it should be talked about at the next game, not in the chat
   - Agree with them in the chat *(amber)*
4. **The coach tells you one part of your game needs real work. What do you do?**
   - Ask what exactly, and work on it
   - Listen, but I think they're wrong
   - Push back *(amber)*
   - Ignore it. I know my game. *(amber)*
5. **What would a teammate say you need to work on?**
   - Typed, at least 40 characters. Helper text: "One real thing. Not 'nothing'."
   - Prefilled from last season for returning players.
6. **Rate yourself against players in WKND:** scoring, defense, overall.
   - Today's 4 tiers. The top tier is labelled "One of the best in WKND".
   - Not prefilled.

**Playing-time risk** (an admin tag, never an automatic mark). The triggers are:
- Q2 amber or red
- Q3 amber
- Q4 amber
- a self-rating gap

**Amber** = 2 triggers. **Red** = Q2 red, or 3 or more triggers. Candidates shows the exact answers.

Dropped from the current form: q1 why playing, q2 losing badly, q3 ref call, q4 heated 1–5, q5 feedback style, q6 benched 1–5, q8 disagreement style. Their old columns stay for history.

### Step 4 · You and the league
- **Help run WKND** (optional, multi; Paolo 2026-11-08: admins are short-staffed and nobody earns from the league). Intro line: "WKND runs on volunteers. Nobody here gets paid. Can you help?" Chips: Keep stats (scorer app, we'll teach you) · Take videos · Take photos · Edit videos · Help on game day · Anything you need. Free-text box "Something else you can do?" (Paolo: any help is open). Stored in `season_volunteers` (reg_id, season, roles JSON, note). Admins get a Volunteers list (by role) on the Season page. Saying yes is not a plus by itself: the existing **Contributed** plus (`season_contributions`, ticked by admins) is earned by actually helping, so it can't be gamed at sign-up. Public text: "Helping run the league counts once you've actually helped."
- **Team** (returning players only): Stay with [team] / Shuffle me.
- **Rather not play with again** (optional, up to 2).
  - The list is only players they shared a court with:
    - **Season 4 league games:** teammate or opponent, from box scores not under review.
    - **Papawis:** both confirmed in the same completed run.
  - Each row says how they know the person: "Teammate · 9 games together", "Opponent · faced 3 times", "Papawis · 4 runs".
  - Search, plus a filter: All / Teammates / Opponents / Papawis.
  - Note on the screen: admins see this, including who named whom; the player is never told; anything serious goes to Report a player.
  - The server rejects anyone outside the list. The site's dropdown gets the same limit.
- The shuffle poll leaves the sign-up and runs as a normal poll.

### Step 5 · Kit and details
- **Jersey top** (required), **shorts** (optional), **pockets**.
  - Prefilled from last season, with: "Season 4 size. New jersey this year, so check the chart."
  - The jersey price for the chosen sizes shows on the spot.
- **Emergency contact, number, birthday:** shown from file with Edit. Changes are still flagged for admins.
- **Jersey number:** picked after payment, with full payers first.

### Step 6 · Review, game face, send
- **Review:** one line per step, each with Edit.
- **Comments or suggestions** (optional): "How can we make Season 5 better? Format, schedule, venue, the app, anything. Admins read every one."
- **Waiver:** one reconfirm checkbox. Players with no waiver on file get the full text plus a typed name, as today.
- **Game face:** required every season, taken last so the person who presses Send is the one in the photo.
  - Uses this season's random pose prompt.
  - App: a real button opens the camera (`<input type="file" accept="image/*" capture="user">`).
  - Site: keeps the QR-to-phone path.
  - Clear help if the camera is blocked.
  - Stored per season: `UNIQUE(reg_id, season)`, keeping the last 2 seasons.
- **Button:** "Count me in for Season 5". Under it: "You can change your answers until sign-ups close on [date]."

### Game Face contest (Paolo, 2026-11-08)
- Built on the liveness photo; no extra upload.
- **4 contest poses for Season 5 sign-up** (from `LIVENESS_PROMPTS`): Best "and-one!" face · "too small" celebration · "ref, that was clean!" face · Finals MVP pose (tumbler or mug). Season sign-up uses only these 4; the other 17 poses stay for activation (admin-only photos). Money poses (GCash, receipt, barya) never go public.
- **Assignment:** random but balanced (each new player gets one of the poses with the fewest photos so far), stored with the draft, fixed once given (no reload re-roll).
- **Opt-in** tick under the photo, off by default: "Enter the Game Face contest". Only entries are public. Admin approves (or hides) each entry; entries post to the feed during sign-ups. A player can withdraw until voting starts.
- **Voting** opens when sign-ups close, for 3 days: one vote per category per member, no self-votes (reuse polls). Results hidden until close.
- **Prize:** 4 winners, one per pose, a free Papawis run each (`grantVoucher`). Never affects selection. Open (Paolo): whether non-winning entries come down after the contest (default: yes, winners stay).

### Sent screen
- "You're on the list" and what happens next.
- **Edit my sign-up** until close. Assessments are updated in place, with `updated_at`. Nominations are replaced on save.
- **Who do you click with?** Optional, up to 3. New table, used only for team building.

## Payments

| Plan | 1st payment | 2nd | 3rd | Tie-break |
|---|---|---|---|---|
| **Pay in full** | Jersey + ₱3,750 | — | — | best |
| **Down payment + 1** | Jersey + ₱1,000 | ₱2,750, 2 paydays later | — | middle |
| **Down payment + 2** | Jersey + ₱1,000 | ₱1,375, 2 paydays later | ₱1,375, 4 paydays later | last |

**Dates**
- The **1st payment** is due on the first payday (15th or 30th) at least 5 days after confirmation. That gives every player 5–15 days.
- **"2 paydays later"** is about 1 month; **"4 paydays later"** is about 2 months. The dates are fixed, not chosen by the player.
- **"The 30th"** means the last day of the month when the month is shorter. A Sunday or holiday doesn't move the due date.
- At confirmation the plan's dates are written out and locked in `pay_dates`.
- **Confirmed late** (a waitlist promotion): the plans are offered again from the paydays left before the semis. If fewer than 4 paydays are left, only Full and Down payment + 1 are offered. The form says: "Your plan may change if you're confirmed late."

**Confirmation**
- Sets `confirmed_at`.
- Posts the jersey charge and the season-fee charge.
- Sends a notice with the dates and a Settle link (bell, push and email).

**Strict rules (Paolo)**
- No extensions.
- Paid means the amount paid so far reaches what's due, within ₱100 (the same tolerance grading already uses).

**Missed first payment**
- A daily job marks the sign-up `payment_overdue`.
- It also creates an admin item that suggests the top-ranked waitlisted player from Candidates. Paolo confirms with one tap.
- There is no automatic promotion by sign-up time.

**Later payments**
- Reminders 3 days before, on the day, 3 days late and 7 days late. They go through `createNotification` (bell + push) plus email, each with a one-tap Settle.
- **14 days late:** an admin item for Paolo.
- **Not fully paid before the semis:** no playoffs.
- There is no benching during the round robin.
- The existing 90-day ban sweep still applies on top.

**Pay-in-full perks**
- First pick of jersey number (the headline).
- A free Papawis run, through a new exported `grantVoucher(playerId, label, expiresSeason)`, revoked if the fee is refunded.
- Full payers get no reminders once they've paid.

**Grading**
- `gradeSeason` grades against each player's own `pay_dates`.
- "Your payments" card on Me (site and app): dates, what's paid, what's next, Settle. Always loaded from the server, never stored on the phone.

## Selection: how we choose the 48
The code changes to match this exact order.

1. **Can't be picked:** didn't sign up; banned; owing ₱100 or more; no account.
2. **Groups, in order:**
   1. Played at least half of their team's Season 4 games.
   2. Papawis regulars (4 or more confirmed runs in the last 12 months).
   3. Everyone else.
3. **Inside a group:**
   - fewest marks
   - then most pluses
   - then payment plan (full first), but only for players not already forced to pay first
   - then most league games
   - then most Papawis runs
   - then a fixed random draw

   Online weeks are dropped as a tie-break because they're already a mark.
4. **Marks:**
   - Not active online. For Season 5 only: seen in at least half of the weeks since 2026-10-15, because site data starts there. Members who joined in the last 3 months are exempt.
   - Pay first.
   - Attendance under two-thirds.
   - Conduct: a fine, or 2 or more technicals in a season.
   - 2 or more late Papawis cancellations in a year.
5. **Pluses:** plays both league and Papawis; contributed.
6. **Discuss:** 2 or more fines, a disqualification, a suspension, a Level 3 or higher, or 6 or more points. Admins decide these before any spot is given.
7. **Admins decide** the final list. Tags (Playing-time risk, Named by others, availability) are for reading only.
8. **Admin no-marks exemption:** stays internal (Paolo). The public page doesn't claim marks are identical for everyone.
9. **After the season:** what the player said about availability vs what they played becomes a fact on Candidates.

### Player page: "How we choose the 48"
> **How we choose the 48**
>
> Every season more people want in than we have spots. This is how we choose.
>
> **You have to sign up.** No sign-up, no spot, whatever your record.
>
> **You need to be clear:** no unpaid balance and no ban. Owe something? Settle it before sign-ups close, or you can't be picked.
>
> **Then we go in this order:**
> 1. Season 4 players who played at least half of their team's games.
> 2. Papawis regulars: 4 or more runs in the last 12 months.
> 3. Everyone else: new members and players coming back.
>
> **Inside each group, these count against you:**
> - Playing less than two-thirds of your team's games
> - Needing to be chased for payment, or paying after the season
> - Not being active in the app or on the site (members who joined in the last 3 months don't need this)
> - Fines, or repeated technicals
> - Two or more late Papawis cancellations in a year
>
> **These help:** playing both league and Papawis, and helping run the league.
>
> **When two players are otherwise equal:** paying in full first, then more games played.
>
> **Serious conduct cases** (two or more fines, a suspension, a disqualification) are decided by the admins before any spot. See the [conduct rules](/rules/conduct).
>
> **Admins make the final call** and read every sign-up. What you write about your role and the team matters.
>
> **Once you're picked:** your first payment (jersey + down payment or the full fee) is due on the first payday at least 5 days after we confirm you. Miss it and your spot goes to the next player.

## Data changes
- **`season_signup_drafts`** (`reg_id, season, body_json, updated_at`). The real row is inserted only on Send.
- **`season_signups`:**
  - add `expectations_agreed_at`, `expectations_version`, `games_miss`, `plans` (JSON), `away_note`, `pay_dates` (JSON, set at confirmation), `confirmed_at`, `updated_at`
  - `payment_plan` values become `full | dp1 | dp2`
  - lock the row once status is not waitlisted
- **`player_assessments`:**
  - new columns for the role questions
  - `UNIQUE(reg_id, season)` via a copy-table migration
  - `UPDATE` in place
  - review page maps by `reg_id` and shows "Edited after your review"
- **`liveness_captures`:** `UNIQUE(reg_id, season)`. Three callers need a season. Keep 2 seasons.
- **New:**
  - `season_click_with`
  - `grantVoucher`
  - the daily payment job
  - notification kinds `signup_confirmed`, `payment_due`, `payment_late`, `signup_edit_open`, each with a `pushKindOf` and an `appLinkFor`
- **Candidates:** availability fact, Playing-time risk tag, plan, answers in the expand, the new tie-break order, the Season 5 online window.

## Bugs fixed along the way
1. Unlinked registrants lose their mindset answers.
2. Server errors open the wrong step. Fix: the validator returns `{step, field, message}`.
3. A photo from any past season counts.
4. Waiver and consent ticks are lost after a server error.
5. The fake 55% bar.
6. `withdrawn` shows as raw text.

## Defaults I set (Paolo can change)
- Confirmations go out in one batch after close.
- Refunds: the fee only if the player withdraws before the first game. The jersey is never refunded.
- The perk for non-Papawis players is jersey number first pick; no credit alternative.
- No separate "before the semis" fallback date is needed, because every date is counted from confirmation (about 2 months at most) and confirmations happen before the season starts.
