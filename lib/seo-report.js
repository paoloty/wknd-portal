// The SEO report: what the daily email and /admin/seo/report show, built from the stored
// Search Console rows (seo_daily), our page checks (seo_checks) and the change log
// (seo_changes). Reads only; the jobs that fill those tables are in server.js (SEO jobs).
import { getSeoLatestDate, getSeoTotals, getSeoFirstSeen, getSeoWeekly, getLatestSeoChecks, getSeoChanges, getLastSeoRun } from './portal-db.js';

// The searches we're trying to win and by when (estimates from the 2026-11-10 audit; ranges
// in docs/agents/features/court-seo.md). goal = the average position to reach.
export const SEO_TARGETS = [
  { query: 'activate hoop arena', goal: 5, by: '2027-01-06', group: 'brand' },
  { query: 'activate hoops arena', goal: 10, by: '2027-01-06', group: 'brand' },
  { query: 'activate sports mandaluyong', goal: 10, by: '2027-02-10', group: 'brand' },
  { query: 'basketball league mandaluyong', goal: 10, by: '2027-02-10', group: 'general' },
  { query: 'indoor basketball court mandaluyong', goal: 10, by: '2027-03-10', group: 'general' },
  { query: 'basketball court mandaluyong', goal: 10, by: '2027-05-10', group: 'general' },
  { query: 'basketball court pasig', goal: 10, by: '2027-07-10', group: 'general' },
  { query: 'indoor basketball court pasig', goal: 10, by: '2027-07-10', group: 'general' },
];
// The pages we watch (paths on the live site).
export const SEO_PAGES = ['/courts/activate-hoop-arena', '/courts/mandaluyong', '/courts/pasig', '/courts', '/join', '/'];
export const SEO_PROJECT_START = '2026-11-11';

const addDays = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
const round1 = n => Math.round(n * 10) / 10;

// Where a target stands: reached (7-day position at or under the goal on 30+ impressions),
// on track, behind (past halfway with no impressions, or past the date), or no data.
function targetStatus(t, now, cur, today) {
  const elapsed = daysBetween(SEO_PROJECT_START, today) / Math.max(1, daysBetween(SEO_PROJECT_START, t.by));
  if (cur && cur.impressions >= 30 && cur.position <= t.goal) return { key: 'reached', label: 'Reached' };
  if (today > t.by) return { key: 'behind', label: 'Past the date' };
  if (!cur || !cur.impressions) return elapsed > 0.5 ? { key: 'behind', label: 'Not showing yet' } : { key: 'waiting', label: 'Not showing yet' };
  // Straight line from position 50 at the start to the goal on the date.
  const expected = 50 - (50 - t.goal) * Math.min(1, elapsed);
  return cur.position <= expected + 5 ? { key: 'ontrack', label: 'On track' } : { key: 'behind', label: 'Behind' };
}

// origin: the live site (https://wkndbasketball.com). today: Manila 'YYYY-MM-DD'.
// weekly: Monday extras (28 days, new searches, near wins). Returns plain data for the
// email and the admin page.
export function buildSeoReport({ origin, today, weekly = false, weeklyNotes = [], suggestions = [] }) {
  const through = getSeoLatestDate();
  const report = { today, through, weekly, origin, targets: [], pages: [], changes: [], alerts: [], checks: [], inspect: [], newQueries: [], nearWins: [], weeklyNotes, suggestions };
  const gsc = getLastSeoRun('gsc');
  if (gsc && !gsc.ok) report.alerts.push(`Search Console pull failed: ${gsc.summary}`);
  if (!through) report.alerts.push('No Search Console data yet. Check the setup (GSC_SERVICE_ACCOUNT_FILE, GSC_SITE_URL) if this lasts more than a day.');

  if (through) {
    const w = { from: addDays(through, -6), to: through }, prev = { from: addDays(through, -13), to: addDays(through, -7) };
    const queries = SEO_TARGETS.map(t => t.query);
    const cur = Object.fromEntries(getSeoTotals({ ...w, queries }).map(r => [r.k, r]));
    const old = Object.fromEntries(getSeoTotals({ ...prev, queries }).map(r => [r.k, r]));
    report.targets = SEO_TARGETS.map(t => {
      const c = cur[t.query], o = old[t.query];
      return {
        ...t, impressions: c?.impressions || 0, clicks: c?.clicks || 0, position: c?.impressions ? round1(c.position) : null,
        // Lower position is better: a positive change means we moved up.
        change: c?.impressions && o?.impressions ? round1(o.position - c.position) : null,
        status: targetStatus(t, Date.now(), c, today),
      };
    });
    const pageUrl = p => `${origin}${p === '/' ? '/' : p}`;
    const pc = Object.fromEntries(getSeoTotals({ ...w, by: 'page' }).map(r => [r.k, r]));
    const po = Object.fromEntries(getSeoTotals({ ...prev, by: 'page' }).map(r => [r.k, r]));
    report.pages = SEO_PAGES.map(p => {
      const c = pc[pageUrl(p)], o = po[pageUrl(p)];
      const drop = o?.impressions >= 50 && (c?.impressions || 0) < o.impressions * 0.7;
      if (drop) report.alerts.push(`${p}: impressions down ${Math.round((1 - (c?.impressions || 0) / o.impressions) * 100)}% on the week before.`);
      return { path: p, clicks: c?.clicks || 0, impressions: c?.impressions || 0, position: c?.impressions ? round1(c.position) : null, prevImpressions: o?.impressions || 0 };
    });
    if (weekly) {
      const m = { from: addDays(through, -27), to: through };
      report.month = getSeoTotals({ ...m, by: 'page' }).reduce((a, r) => ({ clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions }), { clicks: 0, impressions: 0 });
      const weekRows = getSeoTotals(w);
      const first = getSeoFirstSeen(weekRows.map(r => r.k));
      report.newQueries = weekRows.filter(r => first[r.k] >= w.from).slice(0, 10).map(r => ({ query: r.k, impressions: r.impressions, position: round1(r.position) }));
      // Close but not there: page 1 bottom and page 2, with enough impressions to mean something.
      report.nearWins = getSeoTotals(m).filter(r => r.position >= 8 && r.position <= 20 && r.impressions >= 10).slice(0, 10).map(r => ({ query: r.k, impressions: r.impressions, position: round1(r.position) }));
      report.trend = getSeoWeekly({ queries: SEO_TARGETS.slice(0, 3).map(t => t.query), since: addDays(through, -84) });
    }
  }

  // Our own checks (today's) and Google's index status (Mondays).
  report.checks = getLatestSeoChecks('page');
  for (const c of report.checks) if (!c.ok) report.alerts.push(`${c.url.replace(origin, '') || '/'}: ${c.detail}`);
  report.inspect = getLatestSeoChecks('inspect');
  for (const c of report.inspect) if (!c.ok) report.alerts.push(`Google: ${c.url.replace(origin, '') || '/'} ${c.detail}`);
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
// that each JSON-LD block parses. html: the response body.
export function checkPageHtml({ url, status, html, expectCanonical }) {
  const problems = [];
  if (status !== 200) problems.push(`returns ${status}`);
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
