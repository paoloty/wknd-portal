# Admin rebuild checklist

Full rebuild of every admin page on the shared components in `views/admin/ui.js` (not a restyle). The old view and its markup are deleted once its page ships.

Mockups live on the canvas: https://claude.ai/artifact/D7GHyahGnTcs69a94FAsNP

Legend for the Mockup column:
- **done**: a mockup exists on the canvas.
- **needed**: a mockup comes first; the page isn't built until it's approved.
- **n/a**: no mockup; the page is built straight from the components.

Last updated: 2026-10-15. Home, Users and Team heads are committed (dd179c5); User detail and Papawis Runs + Run page are built but not committed yet.

## Foundation

- [x] Engagement Home design (mockup done: A · Clubhouse v2, plus the phone artboard)
- [x] Component mockups (done: Parts kit, Data grid, Grid on a phone, Forms and overlays)
- [x] Components in `views/admin/ui.js`, styles in `public/admin.css`, behaviour in `public/admin-ui.js`
- [x] Shell: sidebar, season pill, menu with counts, identity, top bar, phone menu (mockup done)
- [x] Vertical centering rule for buttons, pills, badges, tabs and icon boxes

## Pages

| # | Area | Page | Route | Mockup | Built |
|---|------|------|-------|--------|-------|
| 1 | Overview | Home | /admin | done | [x] |
| 2 | Members | Users | /admin/users | n/a | [x] |
| 3 | Members | Team heads | /admin/team-heads | n/a | [x] |
| 4 | Members | User detail | /admin/users/:id | done | [x] |
| 5 | Papawis | Runs, with the New run form | /admin/papawis | done | [x] |
| 6 | Papawis | Run page (roster, teams, money, messages, activity, settings) | /admin/papawis/:id | done (desktop + phone) | [x] |
| 7 | Papawis | Courts | /admin/papawis/courts | n/a | [ ] |
| 8 | Papawis | Activity | /admin/papawis/activity | n/a | [ ] |
| 9 | Game Day | Games | /admin/games | n/a | [ ] |
| 10 | Game Day | Game page (box score, content, picks) | /admin/games/:id | needed | [ ] |
| 11 | Game Day | Who wins? picks | /admin/picks | n/a | [ ] |
| 12 | Game Day | Players | /admin/players | n/a | [ ] |
| 13 | Game Day | Player detail | /admin/players/:id | needed | [ ] |
| 14 | Awards | Overview | /admin/awards | n/a | [ ] |
| 15 | Awards | Season awards | /admin/awards/season | n/a | [ ] |
| 16 | Awards | MVP and Best Defender races | /admin/awards/races | n/a | [ ] |
| 17 | Awards | MVP podium ballot | /admin/awards/podium | n/a | [ ] |
| 18 | Awards | Award graphic editor | /admin/awards/:season/:type/graphic | needed | [ ] |
| 19 | Awards | Award photo picker | /admin/award-photo/… | n/a | [ ] |
| 20 | Season | All seasons | /admin/seasons | n/a | [ ] |
| 21 | Season | Signups and settings | /admin/season | n/a | [ ] |
| 22 | Season | Signup detail | /admin/season/signups/:id | n/a | [ ] |
| 23 | Season | Waitlist | /admin/season/waitlist | n/a | [ ] |
| 24 | Season | Returning | /admin/season/returning | n/a | [ ] |
| 25 | Season | Comments | /admin/season/comments | n/a | [ ] |
| 26 | Season | Assessment reviews | /admin/season/assessment-reviews | n/a | [ ] |
| 27 | Season | Assessment detail | /admin/season/assessments/:id | n/a | [ ] |
| 28 | Season | Liveness checks and detail | /admin/season/liveness | n/a | [ ] |
| 29 | Season | Team builder | /admin/season/teams | needed | [ ] |
| 30 | Season | Team builder review | /admin/season/teams/review | n/a | [ ] |
| 31 | Season | Team builder sandbox | /admin/season/teams/sandbox | needed | [ ] |
| 32 | Community | Polls | /admin/polls | n/a | [ ] |
| 33 | Community | Fines and conduct | /admin/fines | n/a | [ ] |
| 34 | Community | Fine categories | /admin/fines/categories | n/a | [ ] |
| 35 | Marketplace | Listings | /admin/marketplace | n/a | [ ] |
| 36 | Marketplace | New and edit group buy | /admin/marketplace/new | n/a | [ ] |
| 37 | Marketplace | Listing page | /admin/marketplace/:id | n/a | [ ] |
| 38 | Finance | Summary | /admin/finance | n/a | [ ] |
| 39 | Finance | Ledger | /admin/ledger | needed | [ ] |
| 40 | Finance | GCash | /admin/finance/gcash | n/a | [ ] |
| 41 | Content | Posts | /admin/posts | n/a | [ ] |
| 42 | Content | Coach notes | /admin/coach-notes | n/a | [ ] |
| 43 | Content | Compares | /admin/compare | n/a | [ ] |
| 44 | Content | SEO overrides | /admin/seo | n/a | [ ] |
| 45 | Content | AI writing | /admin/ai-writing | n/a | [ ] |
| 46 | Site | Site and homepage | /admin/site | n/a | [ ] |
| 47 | Super admin | Privileges | /admin/privileges | n/a | [ ] |
| 48 | Super admin | Action logs | /admin/logs | n/a | [ ] |
| 49 | Super admin | Share card log | /admin/share-log | n/a | [ ] |
| 50 | Super admin | Birthdays | /admin/birthdays | n/a | [ ] |
| 51 | Super admin | Community ratings | /admin/ratings | n/a | [ ] |
| 52 | Sign-in | Admin login | /login | n/a | [ ] |

## New features from the plan

- [ ] Auto-nudges: pick reminder, podium, notify on publish, season nudges. Includes Papawis email pacing. Mockup n/a.
- [ ] Message players: composer with segments, Sent log. Mockup needed.
- [ ] Insights, after 4 to 6 weeks of tracking data. Mockup needed.

## Cleanup

- [ ] Remove the Tailwind CDN from the admin once no page uses it.
- [ ] Delete the unused rules in `public/admin.css` and the old admin shell rules in `public/styles.css`.
- [ ] Check every admin page at phone width.
- [ ] Replace every remaining `alert()` and `confirm()` call.

## Counts

| | Pages | Mockups still needed | Mockups done | Built |
|---|---|---|---|---|
| Total | 52 | 6 | 4 | 6 |
