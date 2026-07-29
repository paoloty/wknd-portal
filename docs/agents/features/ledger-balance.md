# Ledger & Player Balance

**Kind:** feature
**Status:** built (admin side); public side has a known gap — see below

## Routes
- `GET /admin/ledger` — `server.js:3262` — all players' balances for a season or all-time, plus quota and per-player pending counts.
- `GET /admin/ledger/:id` — `server.js:3281` — single player's financials + transactions + quota.
- `POST /admin/ledger/transaction` — `server.js:3299` — creates a transaction (`type`: `charge`|`payment`, `status`: `confirmed`|`pending`).
- `POST /admin/ledger/transaction/:id/confirm` — `server.js:3312` — only succeeds if currently `pending`.
- `POST /admin/ledger/transaction/:id/void` — `server.js:3320` — only succeeds if currently `confirmed`; reverses balance effect, keeps history.
- `DELETE /admin/ledger/transaction/:id` — `server.js:3326` — hard-deletes, reversing balance if it had been confirmed.
- `POST /admin/ledger/bulk-charge` — `server.js:3332` — one transaction per `player_id` in a list, default `charge`/`confirmed`.
- `GET /admin/finance` — `server.js:3344` — dashboard (season summary, quota, pending, category/team totals, recent).
- `GET`/`POST /admin/ledger/quota/:season` — `server.js:3362-3366` — per-season quota amount.
- `GET`/`POST /settle-balance` — `server.js:5240-5257` — public self-service payment submission.
- `POST /balance-bar/dismiss` — `server.js:2257` — session-only dismissal of the sitewide balance-nag banner, no financial effect.

## Primary files
- Views: `views/admin/ledger.js` (621 lines) — `adminLedgerBody` (list), `adminLedgerPlayerBody` (per-player table w/ inline confirm/void/delete + add-transaction form), `playerFinancialSection` (embedded widget also used on the admin player-profile page)
- Views: `views/admin/finance-dash.js` (217 lines) — `adminFinanceDashBody`
- View: `views/settle-balance.js` (213 lines) — public payment form
- DB (`lib/portal-db.js:537-731`): tables `transaction_ledger` (id, player_id, amount, type, payment_method, date, status, notes, reference_no, season, category, screenshot_url, created_at), `player_financials` (player_id, current_balance, total_paid, total_outstanding, updated_at — denormalized, updated only on confirm/void/delete), `season_quotas` (season, amount). Functions: `recordTransaction`, `confirmTransaction`, `voidTransaction`, `deleteTransaction`, `setTransactionCategory`, `getPlayerFinancials`, `getPlayerTransactions(BySeason)`, `getSeasonBalances`/`getAllBalances`, `getSeasonSummary`/`getAllSummary`, `getSeasonQuota`/`setSeasonQuota`, `getPendingTransactions`, `getCategoryTotals`, `getTeamTotals`, `getRecentTransactions`, `getLedgerSeasons`.

## Data flow
1. Admin creates a charge — manually (single or `bulk-charge`) or automatically via [[papawis]] session completion — as `confirmed` (immediate balance effect) or `pending`.
2. **Player self-service payment**: `/settle-balance` shows current balance + GCash QR/details + a form (amount, category, method, reference no., required screenshot upload as base64) → `POST` creates a `payment`-type transaction that is **always `status = 'pending'`**, never auto-confirmed, and emails the admin with the screenshot attached plus a link to `/admin/ledger/:playerId`. Player then sees a static "submitted, awaiting confirmation" screen.
3. Admin reviews the pending transaction on `/admin/ledger/:id`, tags a category, and confirms (updates `player_financials`) or voids/deletes it.
4. Balance status colors: `pending` (amber) → `confirmed` (green) or `voided` (gray).

## Edge cases / gotchas
- **Confirmed gap, not yet fixed**: on a player's own profile (`isOwnProfile` on `/players/:ref`, see [[players]]), only a bare `balanceAmount` number is passed to the view — **no transaction history list**. `/settle-balance` likewise only shows the current balance strip. A player can see their number and submit a payment, but cannot see *why* they owe it or their payment history. This matches project memory ("read-only transaction history list still not built") — confirmed still true as of this doc.
- `player_financials` totals are denormalized running counters, only recalculated on confirm/void/delete — don't compute balance by summing `transaction_ledger` directly elsewhere; use `getPlayerFinancials`.
- Voiding vs. deleting: void keeps the row (audit trail, reverses effect); delete removes it entirely (also reversing effect if it had been confirmed). Prefer void for anything with a paper trail (e.g. a real payment that bounced).

## Related docs
- [[players]] — where the balance number and (admin-only) full ledger widget surface
- [[papawis]] — session completion creates `papawis`-category charges
- [[admin-core]] — audit logging of ledger mutations
