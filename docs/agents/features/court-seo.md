# Court SEO project

Started 2026-11-11. Main target: the Activate Hoop Arena court page. Then the Mandaluyong and Pasig city pages for general searches like "basketball court mandaluyong". A second goal: Activate Sports (the owner) notices WKND.

Fable audited the plan on 2026-11-10. Its main call: automate measuring and fresh facts, not the page text. With our traffic, a weekly AI change to titles can't be measured, and constant AI edits look like spam to Google.

## What runs by itself (server.js, "SEO jobs")

Live site only, from 7am Manila, once a day. Kill switch and settings: Admin → Site settings → SEO report (`/admin/seo/report`).

| When | Job |
|---|---|
| Daily | Pull Search Console rows into `seo_daily`. Check each tracked page as a crawler would: status, title, canonical, noindex, JSON-LD (`seo_checks`). Send the report email. |
| Monday | Google URL Inspection for each tracked page. Write a "Lately at <court>" note on courts with games or runs in the last 7 days: fact-checked, stored in `papawis_courts.weekly_note`, never in `writeup`. The email gets 28-day totals, new searches and near wins. |
| 1st of month | Check the venue links. Make 3 title and description suggestions per main page. These are suggestions only; a person applies them. |

Every run is a row in `seo_runs` and a line in `/admin/logs`. Every change to what Google reads on a court page (admin save, city intro, weekly note) is a row in `seo_changes`.

## Targets (`lib/seo-report.js` `SEO_TARGETS`)

These are estimates from the audit. The first weeks of real data should reset them.

| Search | Goal | By | Range |
|---|---|---|---|
| activate hoop arena | top 5 | 2027-01-06 | 4–8 weeks; top 3 is 2–4 months and may never hold |
| activate hoops arena | page 1 | 2027-01-06 | 4–8 weeks |
| activate sports mandaluyong | page 1 | 2027-02-10 | |
| basketball league mandaluyong | page 1 | 2027-02-10 | 1–3 months |
| indoor basketball court mandaluyong | page 1 | 2027-03-10 | 2–4 months |
| basketball court mandaluyong | page 1 | 2027-05-10 | 3–6 months, about 50/50; needs links |
| basketball court pasig / indoor … pasig | page 1 | 2027-07-10 | 4–8 months |

## Setup Paolo does once

1. Search Console API access, following the steps at the top of `lib/seo-gsc.js`. Then set `GSC_SERVICE_ACCOUNT_FILE` and `GSC_SITE_URL` in the production `.env`.
2. Activate Battlegrounds: add a photo and map pin in court admin, then switch on "Publish before anything is played here".
3. Optional: write the city intros on `/admin/seo/report`.

## Stays human

- The About text and the titles.
- Replying to reviews.
- The Activate relationship: tag @activatehooparena and @activatesportsph, and send a personal DM linking `/courts/activate-hoop-arena/partner`.
- Asking for links: Activate, FB groups.
- Whether to pay for a ranking API later. Only worth it if a target search shows nothing for 6+ weeks.
