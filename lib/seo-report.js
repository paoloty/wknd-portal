// The SEO report: what the daily email and /admin/seo/report show, built from the stored
// Search Console rows (seo_daily), our page checks (seo_checks) and the change log
// (seo_changes). Reads only; the jobs that fill those tables are in server.js (SEO jobs).
import { getSeoLatestDate, getSeoTotals, getSeoFirstSeen, getSeoWeekly, getLatestSeoChecks, getSeoChanges, getLastSeoRun } from './portal-db.js';
import { seoTargetNumbers, seoNearWins, seoCannibalisation, seoWatchRollup, seoRecentFailedRuns } from './seo-insights.js';

// The searches we're trying to win and by when. goal = the average position to reach; page =
// the page that should rank. Reset 2026-11-11 after the Fable SEO audit: the venue's own
// Facebook, site and booking page hold the top 3 for its bare name, so the realistic goal
// there is the first result that isn't the venue (5-6); the longer searches (…basketball
// court, …reviews, …parking) and the smaller venues can reach the top 3. The first three
// draw the trend chart. Ranges and reasoning: docs/agents/features/court-seo.md.
const GV = '/courts/gameville-central-park', AC = '/courts/activate-hoop-arena', DL = '/courts/delta-sports-arena';
export const SEO_TARGETS = [
  { query: 'gameville central park', goal: 6, by: '2027-02-10', group: 'venue', page: GV },
  { query: 'activate hoop arena', goal: 5, by: '2027-01-13', group: 'venue', page: AC },
  { query: 'delta sports arena makati', goal: 4, by: '2027-01-13', group: 'venue', page: DL },
  { query: 'gameville central park mandaluyong', goal: 6, by: '2027-02-10', group: 'venue', page: GV },
  { query: 'gameville central park basketball court', goal: 3, by: '2027-01-13', group: 'venue', page: GV },
  { query: 'gameville central park reviews', goal: 3, by: '2027-02-10', group: 'venue', page: GV },
  { query: 'gameville central park parking', goal: 4, by: '2027-02-10', group: 'venue', page: GV },
  { query: 'activate hoops', goal: 7, by: '2027-02-10', group: 'venue', page: AC },
  { query: 'activate pioneer', goal: 5, by: '2027-01-13', group: 'venue', page: AC },
  { query: 'delta arena makati', goal: 4, by: '2027-01-13', group: 'venue', page: DL },
  { query: 'delta sports arena', goal: 5, by: '2027-02-10', group: 'venue', page: DL },
  { query: 'wknd basketball', goal: 1, by: '2026-12-01', group: 'brand', page: '/' },
  { query: 'basketball court mandaluyong', goal: 10, by: '2027-05-10', group: 'general', page: '/courts/mandaluyong' },
  // Pickup by city, owned by /papawis (keyword audit, 2026-11-16). "basketball league
  // mandaluyong" left the list the same day: /join keeps "community", not "league" (Paolo).
  { query: 'papawis basketball', goal: 1, by: '2027-03-15', group: 'pickup', page: '/papawis', from: '2026-11-16' },
  { query: 'pickup basketball mandaluyong', goal: 5, by: '2027-03-15', group: 'pickup', page: '/papawis', from: '2026-11-16' },
  { query: 'pickup basketball makati', goal: 5, by: '2027-03-15', group: 'pickup', page: '/papawis', from: '2026-11-16' },
];
// The main pages (paths on the live site), the four main pages first. These get goals, the
// weekly AI court notes, the venue link check and title suggestions. Every other live court
// page, city page, /courts and /join are watched (server.js seoWatchPages): checked daily,
// rolled up on Mondays, no goals.
export const SEO_PAGES = ['/', GV, AC, DL, '/courts/mandaluyong', '/courts/pasig', '/courts', '/join', '/papawis'];
export const SEO_PROJECT_START = '2026-11-11';

const addDays = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
const round1 = n => Math.round(n * 10) / 10;

// Where a target stands: reached (7-day position at or under the goal on 30+ impressions),
// on track, behind (past halfway with no impressions, or past the date), or no data.
function targetStatus(t, now, cur, today) {
  const start = t.from || SEO_PROJECT_START;
  const elapsed = daysBetween(start, today) / Math.max(1, daysBetween(start, t.by));
  if (cur && cur.impressions >= 30 && cur.position <= t.goal) return { key: 'reached', label: 'Reached' };
  if (today > t.by) return { key: 'behind', label: 'Past the date' };
  if (!cur || !cur.impressions) return elapsed > 0.5 ? { key: 'behind', label: 'Not showing yet' } : { key: 'waiting', label: 'Not showing yet' };
  // Straight line from position 50 at the start to the goal on the date.
  const expected = 50 - (50 - t.goal) * Math.min(1, elapsed);
  return cur.position <= expected + 5 ? { key: 'ontrack', label: 'On track' } : { key: 'behind', label: 'Behind' };
}

// origin: the live site (https://wkndbasketball.com). today: Manila 'YYYY-MM-DD'.
// weekly: Monday extras (28 days, new searches, near wins, competing pages, the watch roll-up).
// watch: [{ path, label, court }] the watched pages (server.js seoWatchPages). seenCompeting:
// the competing-page keys already reported (only new ones are flagged as new). Extras from
// the jobs: weeklyNotes, suggestions, caption, outreach. Returns plain data for the email and
// the admin page. Alerts are { text, href? }.
export function buildSeoReport({ origin, today, weekly = false, weeklyNotes = [], suggestions = [], watch = [], seenCompeting = null, caption = '', outreach = null }) {
  const through = getSeoLatestDate();
  const report = { today, through, weekly, origin, targets: [], pages: [], changes: [], alerts: [], checks: [], inspect: [], newQueries: [], nearWins: [], competing: [], watch: [], weeklyNotes, suggestions, caption, outreach };
  const alert = (text, href = '') => report.alerts.push(href ? { text, href } : { text });
  const gsc = getLastSeoRun('gsc');
  if (gsc && !gsc.ok) alert(`Search Console pull failed: ${gsc.summary}`);
  if (!through) alert('No Search Console data yet. Check the setup (GSC_SERVICE_ACCOUNT_FILE, GSC_SITE_URL) if this lasts more than a day.');
  // Any other job step that failed in the last day (a broken venue link, old prices, Claude not
  // answering, a step that threw). Page checks and Google's index add their own lines below.
  // 20 hours: today's run only, not yesterday's (the job runs once a day).
  for (const a of seoRecentFailedRuns({ since: Date.now() - 20 * 3600e3, skipKinds: ['gsc', 'checks', 'inspect', 'note', 'email'] })) report.alerts.push(a);

  if (through) {
    const w = { from: addDays(through, -6), to: through }, prev = { from: addDays(through, -13), to: addDays(through, -7) };
    // On the page that should rank (lib/seo-insights.js), not summed across our pages.
    const cur = seoTargetNumbers({ origin, ...w, targets: SEO_TARGETS });
    const old = seoTargetNumbers({ origin, ...prev, targets: SEO_TARGETS });
    report.targets = SEO_TARGETS.map(t => {
      const c = cur[t.query], o = old[t.query];
      return {
        ...t, impressions: c?.impressions || 0, clicks: c?.clicks || 0, position: c?.impressions ? round1(c.position) : null,
        // Lower position is better: a positive change means we moved up.
        change: c?.impressions && o?.impressions ? round1(o.position - c.position) : null,
        status: targetStatus(t, Date.now(), c, today),
        // Google shows another of our pages for it (instead of, or as well as, the target page).
        shownPage: c && !c.ownPage ? c.shownPage : '', other: c?.other || null,
      };
    });
    const pageUrl = p => `${origin}${p === '/' ? '/' : p}`;
    const pc = Object.fromEntries(getSeoTotals({ ...w, by: 'page' }).map(r => [r.k, r]));
    const po = Object.fromEntries(getSeoTotals({ ...prev, by: 'page' }).map(r => [r.k, r]));
    report.pages = SEO_PAGES.map(p => {
      const c = pc[pageUrl(p)], o = po[pageUrl(p)];
      const drop = o?.impressions >= 50 && (c?.impressions || 0) < o.impressions * 0.7;
      if (drop) alert(`${p}: impressions down ${Math.round((1 - (c?.impressions || 0) / o.impressions) * 100)}% on the week before.`);
      return { path: p, clicks: c?.clicks || 0, impressions: c?.impressions || 0, position: c?.impressions ? round1(c.position) : null, prevImpressions: o?.impressions || 0 };
    });
    if (weekly) {
      const m = { from: addDays(through, -27), to: through };
      report.month = getSeoTotals({ ...m, by: 'page' }).reduce((a, r) => ({ clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions }), { clicks: 0, impressions: 0 });
      const weekRows = getSeoTotals(w);
      const first = getSeoFirstSeen(weekRows.map(r => r.k));
      report.newQueries = weekRows.filter(r => first[r.k] >= w.from).slice(0, 10).map(r => ({ query: r.k, impressions: r.impressions, position: round1(r.position) }));
      // Close but not there: page 1 bottom and page 2, with the page that ranks and the search
      // words its title and description lack.
      report.nearWins = seoNearWins({ origin, ...m, checks: getLatestSeoChecks('page') });
      report.trend = getSeoWeekly({ queries: SEO_TARGETS.slice(0, 3).map(t => t.query), since: addDays(through, -84) });
      // Two of our pages competing for one search; new = not in last Monday's list.
      report.competing = seoCannibalisation({ origin, ...m, targets: SEO_TARGETS }).map(c => ({ ...c, isNew: !seenCompeting || !seenCompeting.includes(c.key) }));
      report.watch = seoWatchRollup({ origin, ...m, pages: watch });
    }
  }

  // Our own checks (today's) and Google's index status (Mondays).
  // Only pages still on the lists (checked in the last 3 days / inspected in the last 9).
  report.checks = getLatestSeoChecks('page').filter(c => c.at >= Date.now() - 3 * 864e5);
  for (const c of report.checks) if (!c.ok) alert(`${c.url.replace(origin, '') || '/'}: ${c.detail}`, c.url);
  report.inspect = getLatestSeoChecks('inspect').filter(c => c.at >= Date.now() - 9 * 864e5);
  for (const c of report.inspect) if (!c.ok) alert(`Google: ${c.url.replace(origin, '') || '/'} ${c.detail}`, c.url);
  report.changes = getSeoChanges({ since: Date.now() - 7 * 864e5 });
  report.subject = seoSubject(report);
  return report;
}

function seoSubject(r) {
  const main = r.targets.find(t => t.query === 'activate hoop arena');
  const pos = main?.position != null ? `"activate hoop arena" #${main.position}${main.change ? ` (${main.change > 0 ? '▲' : '▼'}${Math.abs(main.change)})` : ''}` : 'no ranking data yet';
  const ok = r.checks.length ? (r.checks.every(c => c.ok) ? 'all pages OK' : `${r.checks.filter(c => !c.ok).length} page problem(s)`) : '';
  const day = new Date(`${r.today}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `SEO${r.weekly ? ' weekly' : ''} · ${day} · ${pos}${ok ? ` · ${ok}` : ''}`;
}

// Our own check of a page as Google would read it: status, title, canonical, robots, and
// that each JSON-LD block parses. html: the response body. expect: [{ marker, label }] pieces
// the page should have today (server.js seoPageExpect), e.g. a city page's rate table.
export function checkPageHtml({ url, status, html, expectCanonical, expect = [] }) {
  const problems = [];
  if (status !== 200) problems.push(`returns ${status}`);
  if (status === 200) for (const x of expect) if (!html.includes(x.marker)) problems.push(x.label);
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
  if (status === 200 && !title.trim()) problems.push('no title');
  if (/<meta name="robots" content="[^"]*noindex/i.test(html)) problems.push('noindex');
  const canon = (html.match(/<link rel="canonical" href="([^"]+)"/i) || [])[1] || '';
  if (status === 200 && expectCanonical && canon && canon !== expectCanonical) problems.push(`canonical points to ${canon}`);
  let blocks = 0;
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    blocks++;
    try { JSON.parse(m[1]); } catch { problems.push('broken structured data'); break; }
  }
  const desc = (html.match(/<meta name="description" content="([^"]*)"/i) || [])[1] || '';
  return { url, ok: !problems.length, detail: problems.join(', '), data: { status, title, canonical: canon, description: desc, jsonLd: blocks, bytes: html.length } };
}
