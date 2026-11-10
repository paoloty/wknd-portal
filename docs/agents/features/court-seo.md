# Court SEO project

Started 2026-11-11. Main targets (reset the same day): the homepage, Gameville Central Park, Activate Hoop Arena and Delta Sports Arena court pages. Then the Mandaluyong and Pasig city pages for general searches like "basketball court mandaluyong". A second goal: Activate Sports (the owner) notices WKND.

Fable audited the plan on 2026-11-10. Its main call: automate measuring and fresh facts, not the page text. With our traffic, a weekly AI change to titles can't be measured, and constant AI edits look like spam to Google.

## What runs by itself (server.js, "SEO jobs")

Live site only, from 7am Manila, once a day. Kill switch and settings: Admin → Site settings → SEO report (`/admin/seo/report`).

| When | Job |
|---|---|
| Daily | Pull Search Console rows into `seo_daily`. Check each tracked page as a crawler would: status, title, canonical, noindex, JSON-LD (`seo_checks`). Send the report email. |
| Monday | Google URL Inspection for each tracked page. Write a "Lately at <court>" note on courts with games or runs in the last 7 days: fact-checked, stored in `papawis_courts.weekly_note`, never in `writeup`. The email gets 28-day totals, new searches and near wins. |
| 1st of month | Check the venue links. Make 3 title and description suggestions per main page. These are suggestions only; a person applies them. |

Every run is a row in `seo_runs` and a line in `/admin/logs`. Every change to what Google reads on a court page (admin save, city intro, weekly note) is a row in `seo_changes`.

## Main pages (reset 2026-11-11)

`/`, Gameville Central Park, Activate Hoop Arena, Delta Sports Arena. Gameville has the most searches (1,132 a quarter for its bare name, at #10.5), Activate converts best, Delta is small but winnable.

## Targets (`lib/seo-report.js` `SEO_TARGETS`)

Reset 2026-11-11 from 90 days of Search Console data and a second Fable audit. For a venue's bare name, its own Facebook, site and booking page hold the top 3 under the Maps pack, so the realistic goal is the first result that isn't the venue (#5-6). The longer searches (…basketball court, …reviews, …parking) and the small venues can reach the top 3. Each target names the page that should rank (`page`).

| Search | Was (90 days) | Goal | By |
|---|---|---|---|
| gameville central park | #10.5 | 6 | 2027-02-10 |
| activate hoop arena | #8.6 | 5 | 2027-01-13 |
| delta sports arena makati | #8.4 | 4 | 2027-01-13 |
| gameville central park mandaluyong | #10.6 | 6 | 2027-02-10 |
| gameville central park basketball court | #4.5 | 3 | 2027-01-13 |
| gameville central park reviews | #5.4 | 3 | 2027-02-10 (needs 5 ratings for stars) |
| gameville central park parking | #6.7 | 4 | 2027-02-10 |
| activate hoops | #10.4 | 7 | 2027-02-10 |
| activate pioneer | #6.8 | 5 | 2027-01-13 |
| delta arena makati / delta sports arena | #8.1 / #7.8 | 4 / 5 | 2027-01-13 / 2027-02-10 |
| wknd basketball | #1 | 1 | 2026-12-01 |
| basketball court / league mandaluyong | not shown | 10 | 2027-05-10 |

## What the 2026-11-11 audit changed (code)

- Automatic titles say what a searcher of the venue wants: "Rates, Photos & Reviews" (rate + 5 ratings), "Rates & Photos", "Indoor Basketball Court", else "Basketball Court Guide". Descriptions lead with the court, its address or building, hours, rate, parking and transit, then what's on the page. Activate's seeded title was cleared to use it.
- Opening hours (one daily range) and the venue's public phone: admin fields, shown under Getting there, sent as `openingHoursSpecification` / `telephone`.
- Good to know asks the venue's questions first (where, hours, parking, getting there), then WKND's.
- Homepage "Where we play" row links every live court and the city pages.
- Owners: "Is this your venue? Claim this page, free" under the court name (partner switch on, not claimed); Partner court pill once claimed; the claim opens Messenger with the court named; partner page clicks count per court; "Could be better" tags stay off the partner page below 5 ratings.
- Monthly court report: from the 4th, 9 AM, to each partner court with an email (`court_reports_enabled`, default on). Players and games, page views (Google split), Google searches, taps for directions and venue links (only when above 0), ratings. Admin: preview, test to me, send now on the court's Partner panel.

## Setup Paolo does once

1. Done 2026-11-11: Search Console API access (`GSC_SERVICE_ACCOUNT_FILE`, `GSC_SITE_URL=sc-domain:wkndbasketball.com` in the production `.env`).
2. Activate Battlegrounds: redirects to Hoop Arena until it's live (`COURT_STAND_INS` in server.js). When WKND plays there, add a photo and map pin and publish it; the redirect ends by itself.
3. Optional: write the city intros on `/admin/seo/report`.

## Stays human

- The About text and the titles.
- Replying to reviews.
- The Activate relationship: tag @activatehooparena and @activatesportsph, and send a personal DM linking `/courts/activate-hoop-arena/partner`.
- Asking for links: Activate, FB groups.
- Whether to pay for a ranking API later. Only worth it if a target search shows nothing for 6+ weeks.
