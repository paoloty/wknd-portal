// How fast the players app really opens on players' phones (Fable speed audit, 2026-11-05). One row
// per launch, posted by public/app.js through /app/ping once the screen has settled. Nothing here says
// who the player was: speed doesn't need it. Read on /admin/app. No database in here.
const ms = v => { if (v == null || v === '') return null; const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n <= 120000 ? n : null; };
const word = (v, re) => { const s = String(v ?? ''); return re.test(s) ? s : ''; };

// What a launch may save: raw is whatever the phone sent, so nothing is taken on trust. null when
// it isn't a usable launch.
export function cleanTiming(raw, { platform = '' } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const fcp = ms(raw.fcp);
  if (fcp == null) return null;
  return {
    platform: word(platform, /^(ios|android|desktop)$/),
    standalone: raw.standalone === true ? 1 : 0,
    from_copy: raw.copy === true ? 1 : 0,
    nav: word(raw.nav, /^(navigate|reload|back_forward|prerender)$/),
    ttfb: ms(raw.ttfb), fcp, ready: ms(raw.ready), fresh: ms(raw.fresh), kb: ms(raw.kb),
    net: word(raw.net, /^(slow-2g|2g|3g|4g)$/),
    colo: word(raw.colo, /^[A-Z]{3}$/),
    ver: word(raw.ver, /^[\w-]{1,20}$/),
  };
}

// The value that share of the list sits at or under. null for no values.
function pct(values, share) {
  const list = values.filter(v => v != null).sort((a, b) => a - b);
  return list.length ? list[Math.min(list.length - 1, Math.ceil(list.length * share) - 1)] : null;
}
const spread = (rows, key) => ({ typical: pct(rows.map(r => r[key]), 0.5), slow: pct(rows.map(r => r[key]), 0.9) });

// rows: app_timings rows → { total, groups, colos }. A launch from the phone's copy and one that
// waited on the network are different experiences, so they never share a line.
export function summarizeTimings(rows = []) {
  const groups = new Map();
  for (const r of rows) {
    const key = `${r.from_copy ? 1 : 0}|${r.platform || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const colos = {};
  for (const r of rows) if (r.colo) colos[r.colo] = (colos[r.colo] || 0) + 1;
  return {
    total: rows.length,
    groups: [...groups.entries()].map(([key, list]) => {
      const [copy, platform] = key.split('|');
      return { fromCopy: copy === '1', platform, count: list.length, fcp: spread(list, 'fcp'), ready: spread(list, 'ready'), fresh: spread(list, 'fresh'), ttfb: spread(list, 'ttfb') };
    }).sort((a, b) => b.count - a.count),
    colos: Object.entries(colos).map(([colo, count]) => ({ colo, count })).sort((a, b) => b.count - a.count),
  };
}
