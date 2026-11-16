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

## Two tiers, prices, AI health (2026-11-16)

From a keyword audit and an automation audit by Fable. The cluster to win is the venue-name long tail ("[court] rates / parking / reviews / hours") on every live court, then pickup by city (owned by `/papawis`); city rental terms come later, once 8+ courts have rates and a few venues link to us. League searches were dropped: `/join` keeps "community", not "league" (Paolo).

- **Main tier**: `SEO_PAGES` / `SEO_TARGETS` in `lib/seo-report.js` (now with `/papawis` and three pickup targets, each with its own `from` date). Only these get goals, the trend chart, the weekly AI notes, the venue link check and title suggestions.
- **Watch tier**: `seoWatchPages()` in server.js: every live court page that isn't thin, the city pages, `/courts`, `/join`, `/papawis`. Checked daily (and inspected on Mondays) with the main pages; Monday's email rolls them up, one line per page with the best kind of search ("parking #5"). No goals, no status.
- **Numbers per page**: `lib/seo-insights.js` reads `seo_daily` per query × page. A target's numbers come from its own page, with the other page noted; summing across pages double-counted exactly when two of our pages compete.
- **Competing pages** (Monday): two of our pages on one search over 28 days, brand searches left out; flagged when the wrong page outranks the target page or takes 30%+. The email lists only ones not in last Monday's email (setting `seo_competing_seen`).
- **Near wins** (Monday): positions 8–20, with the page that ranks and the search words its title and description lack. The 1st-of-month suggestions go to at most 3 pages, those with such gaps first; the admin page keeps the latest ones.
- **Court rates**: the title year is the year the rate was checked (`info.checked`), never today's. Never checked = no year. Daily alert at 75 days (or never checked), linking to the court's admin page; past 180 days the price and year leave the title, description and `priceRange` by themselves (`PRICE_ALERT_DAYS`, `PRICE_DROP_DAYS`, lib/court-page.js). The page itself keeps the rate with its "as checked" date. A search title typed in admin with ₱ or an old year is flagged too. A served title or description that changes is logged in `seo_changes` as "(as served)".
- **City pages**: "Runs this week in <city>" (next 7 days) and a rate table once 3+ courts have a fresh rate (`CITY_RATE_TABLE_MIN`, views/court.js). The daily page check fails a city page that should show either and doesn't. Run events stay on the court pages only (one URL per event).
- **AI health**: every AI provider attempt lands in `ai_calls` (lib/ai-health.js). Admin → AI writing shows who answered in the last 7 days and the last failure in plain words, with **Check now** (a tiny request per provider). The daily job tests Claude when it's first in line and hasn't answered for 24 hours, and puts a line in the email when it fails (key expired, no credit, down).
- **Steps never stop the email**: each step runs in `seoStep()`; one that throws is logged as `step-<name>` and shows in "Needs a look" until a later run of it works. Failed steps from the last 20 hours (broken venue links included, which never reached the email before) are alerts.
- **Run now** starts in the background and the admin page updates itself when it's done; "Run with monthly steps" adds the link check, outreach line and suggestions.
- **Monthly outreach line**: which venue websites link to wkndbasketball.com (home page only; Facebook and Instagram block bots). **Monday caption**: plain text for the soonest run in the next 7 days at a live court, linking its court page, only when one exists.

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

## Overtaking the directories (2026-11-13)

Courtslots (courtslots.ph, a Shopify directory of Metro Manila courts since 2023) ranks #1 for "activate hoop arena" on age, site size and links, not content: its page is ~80 words with a stale rate. We sat at ~8.6. What changed:

- Titles lead with the price from the rate text (`courtRateFrom`: lowest ₱ amount) and the year when it fits: "Activate Hoop Arena Mandaluyong: ₱2,800 Rates & Reviews". Courts with 5+ ratings and no rate get "Player Reviews & Photos". Candidates are tried longest first, first one ≤ 60 chars wins.
- "Checked <Mon YYYY>" (`info.checked`): set when the rate, hours or phone change, or the admin ticks "I checked … today"; shown in the description, the opening line and next to Court rental.
- Opening line under the name (`p.lede`): what and where the court is, "also spelled <alt name>", rate and hours, in plain sentences.
- Internal links: Papawis run rows and "Most played at" on player profiles link the court; news posts link the first mention of each live court (`linkCourtMentions`, any of its names); every court page ends with "More basketball courts nearby" (4 tiles, same city first, CTA `court-nearby`).
- Directory guard: a page published early (no runs or games) is `thin` until it has an address plus a ₱ rate or hours: live for visitors, noindexed, out of the sitemap; the admin status line says so.
- Sitemap lists each court's photos (`image:image`); the court JSON-LD sends up to 5 images.

Still human: links from Activate's site/Facebook and WKND's own posts to the court page are what beat a 3-year-old directory.

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
