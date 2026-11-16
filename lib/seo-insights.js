// SEO insights (2026-11-16, Fable's design after the keyword audit): the Search Console rows
// read per query × page instead of summed across pages, and what the report builds from them:
// target positions on the page that should rank, competing pages, near wins with the words
// their page is missing, and the Monday roll-up of every watched court page. Pure reads of
// seo_daily / seo_runs plus plain functions; the jobs live in server.js, the report in
// lib/seo-report.js. Its own file so lib/portal-db.js doesn't grow.
import { db } from './portal-db.js';

// Per query × page between two dates (inclusive), impression-weighted position.
// queries: optional list; pages: optional list of full URLs.
export function getSeoQueryPages({ from, to, queries = null, pages = null }) {
  const where = ['date >= ?', 'date <= ?', "query != ''"];
  const args = [from, to];
  if (queries?.length) { where.push(`query IN (${queries.map(() => '?').join(',')})`); args.push(...queries); }
  if (pages?.length) { where.push(`page IN (${pages.map(() => '?').join(',')})`); args.push(...pages); }
  return db.prepare(`SELECT query, page, SUM(clicks) AS clicks, SUM(impressions) AS impressions,
      CASE WHEN SUM(impressions) > 0 THEN SUM(position * impressions) / SUM(impressions) ELSE 0 END AS position
    FROM seo_daily WHERE ${where.join(' AND ')} GROUP BY query, page ORDER BY impressions DESC`).all(...args);
}

const round1 = n => Math.round(n * 10) / 10;
const pathOf = (origin, url) => String(url || '').replace(origin, '') || '/';
const byQuery = rows => rows.reduce((m, r) => ((m[r.query] ??= []).push(r), m), {});

// Each target's numbers on the page that should rank for it, plus the best of our other pages
// when one shows too. Summing across pages double-counted impressions and blended positions
// exactly when two of our pages compete. → { [query]: { impressions, clicks, position, other } }
export function seoTargetNumbers({ origin, from, to, targets }) {
  const rows = byQuery(getSeoQueryPages({ from, to, queries: targets.map(t => t.query) }));
  const out = {};
  for (const t of targets) {
    const list = rows[t.query] || [];
    const own = list.find(r => pathOf(origin, r.page) === t.page);
    const others = list.filter(r => r !== own).sort((a, b) => b.impressions - a.impressions);
    // No row for the target page: report the page Google does show, so it isn't "not showing".
    const main = own || others[0];
    if (!main) continue;
    const other = own && others[0] ? { path: pathOf(origin, others[0].page), position: round1(others[0].position), impressions: others[0].impressions } : null;
    out[t.query] = { impressions: main.impressions, clicks: main.clicks, position: main.position, ownPage: !!own, shownPage: pathOf(origin, main.page), other };
  }
  return out;
}

// What a search is after, for the court roll-up.
const BUCKETS = [
  ['rates', /\b(rate|rates|price|prices|pricing|magkano|how much|rental|rent|renta|fee|fees|cost|php|₱|per hour)\b/],
  ['parking', /\bparking\b/],
  ['reviews', /\b(review|reviews|rating|ratings)\b/],
  ['hours', /\b(hours?|open|opening|schedule|time)\b/],
  ['location', /\b(address|location|where|map|directions?|saan|near)\b/],
];
export const queryBucket = q => (BUCKETS.find(([, re]) => re.test(String(q).toLowerCase())) || ['name'])[0];

const STOP = new Set(['the', 'and', 'for', 'with', 'near', 'from', 'what', 'where', 'how', 'sa', 'ng', 'mga', 'ang', 'wknd', 'basketball']);
const words = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length >= 3 && !STOP.has(w));

// Searches close to page 1 (28 days, positions 8-20, 10+ impressions), each with the page that
// ranks and the search words its title and description don't have. checks: the latest page
// checks (seo_checks 'page' rows, data_json has title/description).
export function seoNearWins({ origin, from, to, checks = [], limit = 10 }) {
  const rows = byQuery(getSeoQueryPages({ from, to }));
  const checkBy = Object.fromEntries(checks.map(c => { let d = {}; try { d = JSON.parse(c.data_json || '{}'); } catch {} return [c.url, d]; }));
  const out = [];
  for (const [query, list] of Object.entries(rows)) {
    const impressions = list.reduce((a, r) => a + r.impressions, 0);
    const best = [...list].sort((a, b) => b.impressions - a.impressions)[0];
    if (impressions < 10 || best.position < 8 || best.position > 20) continue;
    const page = checkBy[best.page];
    const have = new Set(words(`${page?.title || ''} ${page?.description || ''}`));
    // Plural/singular and "hoop"/"hoops" count as present.
    const missing = page ? words(query).filter(w => ![...have].some(h => h === w || h.startsWith(w) || w.startsWith(h) && h.length >= 4)) : [];
    out.push({ query, impressions, position: round1(best.position), page: pathOf(origin, best.page), missing, checked: !!page });
  }
  // Most impressions first: the biggest win for a small change.
  return out.sort((a, b) => b.impressions - a.impressions).slice(0, limit);
}

// Two of our pages showing for the same search (28 days, brand searches left out). For a target
// search: flagged when another page outranks the target page or takes 30%+ of the impressions.
// For any other search with 20+ impressions: flagged when a second page takes 30%+ (10+).
// → [{ query, key, owner, other, ownerShare, note }]
export function seoCannibalisation({ origin, from, to, targets = [], brand = /\bwknd\b/i }) {
  const rows = byQuery(getSeoQueryPages({ from, to }));
  const targetPage = Object.fromEntries(targets.map(t => [t.query, t.page]));
  const out = [];
  for (const [query, list] of Object.entries(rows)) {
    if (brand.test(query) || list.length < 2) continue;
    const total = list.reduce((a, r) => a + r.impressions, 0);
    const sorted = [...list].sort((a, b) => b.impressions - a.impressions);
    const want = targetPage[query];
    if (want) {
      const own = list.find(r => pathOf(origin, r.page) === want);
      const rival = sorted.find(r => r !== own);
      if (!rival || total < 10) continue;
      const outranks = own && rival.impressions >= 5 && rival.position < own.position;
      const share = rival.impressions / total;
      if (!own || outranks || share >= 0.3) {
        out.push({ query, key: `${query}|${pathOf(origin, rival.page)}`, owner: want, other: pathOf(origin, rival.page), ownerShare: Math.round(((own?.impressions || 0) / total) * 100),
          note: !own ? `Google shows ${pathOf(origin, rival.page)}, not ${want}` : outranks ? `${pathOf(origin, rival.page)} ranks above ${want} (#${round1(rival.position)} vs #${round1(own.position)})` : `${pathOf(origin, rival.page)} takes ${Math.round(share * 100)}% of the views` });
      }
      continue;
    }
    if (total < 20) continue;
    const [first, second] = sorted;
    if (second.impressions >= 10 && second.impressions / total >= 0.3) {
      out.push({ query, key: `${query}|${pathOf(origin, second.page)}`, owner: pathOf(origin, first.page), other: pathOf(origin, second.page), ownerShare: Math.round((first.impressions / total) * 100),
        note: `split between ${pathOf(origin, first.page)} and ${pathOf(origin, second.page)}` });
    }
  }
  return out.sort((a, b) => a.ownerShare - b.ownerShare).slice(0, 15);
}

// Monday roll-up, one line per watched page (28 days): how many searches, times shown, clicks,
// and for court pages the best kind of search ("parking #6.7"). pages: [{ path, label, court }].
export function seoWatchRollup({ origin, from, to, pages }) {
  if (!pages.length) return [];
  const urls = pages.map(p => `${origin}${p.path === '/' ? '/' : p.path}`);
  const rows = getSeoQueryPages({ from, to, pages: urls });
  return pages.map((p, i) => {
    const list = rows.filter(r => r.page === urls[i]);
    const impressions = list.reduce((a, r) => a + r.impressions, 0);
    const clicks = list.reduce((a, r) => a + r.clicks, 0);
    let best = null;
    if (p.court) {
      const per = {};
      for (const r of list) { const b = (per[queryBucket(r.query)] ??= { impressions: 0, w: 0 }); b.impressions += r.impressions; b.w += r.position * r.impressions; }
      best = Object.entries(per).filter(([, b]) => b.impressions >= 3).map(([bucket, b]) => ({ bucket, position: round1(b.w / b.impressions), impressions: b.impressions }))
        .sort((a, b) => a.position - b.position)[0] || null;
    }
    const top = [...list].sort((a, b) => b.impressions - a.impressions)[0];
    return { path: p.path, label: p.label, searches: list.length, impressions, clicks, best, top: top ? { query: top.query, position: round1(top.position) } : null };
  }).sort((a, b) => b.impressions - a.impressions);
}

// Job steps that failed lately, for "Needs a look". Each run may carry data.alerts
// ([{ text, href }]) to list several lines; else its summary is the line.
export function seoRecentFailedRuns({ since, skipKinds = [] }) {
  const rows = db.prepare(`SELECT * FROM seo_runs WHERE at >= ? ${skipKinds.length ? `AND kind NOT IN (${skipKinds.map(() => '?').join(',')})` : ''} ORDER BY id DESC`).all(since, ...skipKinds);
  const seen = new Set(), out = [];
  for (const r of rows) {
    // The newest run of each kind only: a later run that worked clears an earlier failure (a
    // step that threw, "step-links", is cleared by a later "links" run too).
    if (seen.has(r.kind) || (r.kind.startsWith('step-') && seen.has(r.kind.slice(5)))) continue;
    seen.add(r.kind);
    if (r.ok) continue;
    let data = {};
    try { data = JSON.parse(r.data_json || '{}'); } catch {}
    if (Array.isArray(data.alerts) && data.alerts.length) out.push(...data.alerts.map(a => (typeof a === 'string' ? { text: a } : a)));
    else out.push({ text: r.summary });
  }
  return out;
}

// The newest run of a kind with its data parsed (suggestions, outreach), or null.
export function seoLatestRun(kind, { okOnly = false } = {}) {
  const r = db.prepare(`SELECT * FROM seo_runs WHERE kind = ?${okOnly ? ' AND ok = 1' : ''} ORDER BY at DESC LIMIT 1`).get(kind);
  if (!r) return null;
  let data = {};
  try { data = JSON.parse(r.data_json || '{}'); } catch {}
  return { ...r, data };
}

// The Monday Facebook caption: plain text from the next confirmed run, never AI.
// run: { court, city, ymd, time, price, url }.
export function outreachCaption(run) {
  if (!run) return '';
  const day = new Date(`${run.ymd}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
  return [
    `Papawis this ${day}${run.time ? `, ${run.time}` : ''} at ${run.court}${run.city ? `, ${run.city}` : ''}.`,
    run.price ? `₱${Number(run.price).toLocaleString('en-US')} per player.` : '',
    `Court details, photos and rates: ${run.url}`,
  ].filter(Boolean).join(' ');
}
