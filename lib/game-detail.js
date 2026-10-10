// Game detail page (/games/:id) — everything the page derives from a game's own data:
// the scoring-log game flow and key plays, "How it was won", the duel + supporting cast and
// their badges. Pure functions except playerHistory(), which reads earlier box scores.
import { db } from './portal-db.js';

// Dates are "YYYY-MM-DD", or the older "M/D/YYYY h:mm AM" (same rule as server.js gameYmd).
const ymdOf = raw => {
  const s = String(raw || '');
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return isNaN(d) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const num = v => Number(v) || 0;

// "LASTNAME, Firstname" → "Firstname Lastname" with the surname title-cased, for sentences.
export function shortName(raw) {
  const [last, first] = String(raw || '').split(',').map(s => s.trim());
  const tc = s => s.toLowerCase().replace(/(^|[\s-])\S/g, c => c.toUpperCase());
  return first ? `${first} ${tc(last)}` : tc(last || '');
}
export function lastName(raw) {
  const last = String(raw || '').split(',')[0].trim();
  return last.toLowerCase().replace(/(^|[\s-])\S/g, c => c.toUpperCase());
}

// Same formula as the box score's PER column (views/game.js calcPer), as a number.
export function gameScore(p) {
  const fgm = num(p.fg2m) + num(p.fg3m) + num(p.fg4m);
  const fga = fgm + num(p.fg2m_miss) + num(p.fg3m_miss) + num(p.fg4m_miss);
  const ftm = num(p.ftm), fta = ftm + num(p.ft_miss);
  return Math.round((num(p.pts) + 0.4 * fgm - 0.7 * fga - 0.4 * (fta - ftm) +
    0.7 * num(p.reb) + num(p.stl) + 0.7 * num(p.ast) + 0.7 * num(p.blk) - num(p.turnover)) * 10) / 10;
}

// ── Game flow, from the live-scoring log ────────────────────────────────────────────────
// Every scoring entry's text ends with the running score, e.g. "… 3pt Made [WHI 76 - BLU 74]".
// The log is stored newest first. Returns null when there's no usable log (older games).
const SCORE_RE = /\[([A-Za-z]+) (\d+) - ([A-Za-z]+) (\d+)\]/;

function periodLengths(entries) {
  const maxMin = {};
  for (const e of entries) {
    const [m, s] = String(e.clockRemaining || '').split(':').map(Number);
    if (!Number.isFinite(m)) continue;
    const q = num(e.quarter) || 1;
    maxMin[q] = Math.max(maxMin[q] || 0, m + (s || 0) / 60);
  }
  // Snap to the usual lengths so a quarter whose first basket came at 11:20 still counts as 12.
  return q => { const v = maxMin[q] || (q <= 4 ? 12 : 5); return v <= 5 ? 5 : v <= 10 ? 10 : 12; };
}

export function gameFlow(game) {
  let log = [];
  try { log = JSON.parse(game.game_log_json || '[]'); } catch { return null; }
  const scoring = log.filter(e => e.kind === 'stat' && SCORE_RE.test(String(e.text || ''))).reverse();
  if (scoring.length < 6) return null;

  const len = periodLengths(scoring);
  const start = q => { let t = 0; for (let i = 1; i < q; i++) t += len(i); return t; };
  const points = [];
  let last = '0-0', prevT = 0;
  for (const e of scoring) {
    const [, , a, , b] = String(e.text).match(SCORE_RE);
    const key = `${a}-${b}`;
    if (key === last) continue;
    last = key;
    const q = num(e.quarter) || 1;
    const [mm, ss] = String(e.clockRemaining || '0:00').split(':').map(Number);
    const t = Math.max(prevT, start(q) + len(q) - ((mm || 0) + (ss || 0) / 60));
    prevT = t;
    const who = String(e.text).replace(/^[^A-Za-z]*/, '').split(':')[0].trim();
    points.push({ t, a: +a, b: +b, q, clock: String(e.clockRemaining || ''), who });
  }
  if (points.length < 6) return null;
  let total = 0; for (let q = 1; q <= Math.max(4, ...points.map(p => p.q)); q++) total += len(q);

  // Lead changes, ties, biggest leads, runs.
  let leadChanges = 0, ties = 0, prevSign = 0;
  const maxLead = { a: null, b: null };
  const runs = [];
  let run = null, pa = 0, pb = 0;
  for (const p of points) {
    const m = p.a - p.b, s = Math.sign(m);
    if (s === 0) ties++;
    if (s !== 0 && prevSign !== 0 && s !== prevSign) leadChanges++;
    if (s !== 0) prevSign = s;
    if (m > 0 && (!maxLead.a || m > maxLead.a.n)) maxLead.a = { n: m, p };
    if (m < 0 && (!maxLead.b || -m > maxLead.b.n)) maxLead.b = { n: -m, p };
    const side = p.a > pa ? 'a' : 'b';
    const got = side === 'a' ? p.a - pa : p.b - pb;
    if (run && run.side === side) { run.n += got; run.end = p; }
    else { run = { side, n: got, before: { a: pa, b: pb }, end: p }; runs.push(run); }
    pa = p.a; pb = p.b;
  }
  const best = side => runs.filter(r => r.side === side).sort((x, y) => y.n - x.n)[0] || null;

  // When the eventual winner took the lead for good (null if they never trailed or tied after
  // their first lead — i.e. wire to wire).
  const fa = num(game.team_a_score), fb = num(game.team_b_score);
  const winner = fa > fb ? 'a' : fb > fa ? 'b' : null;
  let forGood = null, trailedBy = 0;
  if (winner) {
    const ws = winner === 'a' ? 1 : -1;
    let lastBad = -1;
    points.forEach((p, i) => { if (Math.sign(p.a - p.b) !== ws) lastBad = i; });
    const neverTrailed = points.every(p => Math.sign(p.a - p.b) * ws >= 0);
    if (lastBad >= 0 && lastBad + 1 < points.length && !neverTrailed) forGood = points[lastBad + 1];
    trailedBy = winner === 'a' ? (maxLead.b?.n || 0) : (maxLead.a?.n || 0);
  }
  const half = [...points].reverse().find(p => p.q <= 2) || null;

  return { points, total, len, leadChanges, ties, maxLead, runs, bestA: best('a'), bestB: best('b'), forGood, trailedBy, half, winner };
}

const qLabel = q => (q <= 4 ? `Q${q}` : `OT${q - 4}`);
const ordinal = q => ['1st', '2nd', '3rd', '4th'][q - 1] || `OT${q - 4}`;
const clockOf = c => String(c || '').replace(/^0(\d:)/, '$1');

// Up to 7 moments, oldest first: big runs, each side's biggest lead, halftime, the go-ahead
// basket for good, and how the last quarter went. Text comes as { strong, rest } so the view
// escapes it.
export function keyPlays(flow, game, quarterScores = []) {
  if (!flow) return [];
  const T = side => (side === 'a' ? tcTeam(game.team_a_name) : tcTeam(game.team_b_name));
  const plays = [];
  const add = (p, side, strong, rest, big = false, label = null) =>
    plays.push({ t: p.t, q: p.q, clock: label ?? clockOf(p.clock), score: { a: p.a, b: p.b }, side, strong, rest, big });

  const bigRuns = flow.runs.filter(r => r.n >= 8).sort((x, y) => y.n - x.n).slice(0, 3);
  for (const r of bigRuns) {
    const mb = r.side === 'a' ? r.before.a - r.before.b : r.before.b - r.before.a;
    const ma = r.side === 'a' ? r.end.a - r.end.b : r.end.b - r.end.a;
    const what = mb < 0 && ma > 0 ? `flips a ${-mb}-point deficit into a ${ma}-point lead`
      : mb < 0 && ma === 0 ? `erases a ${-mb}-point deficit`
      : mb < 0 ? `cuts it to ${-ma}`
      : mb === 0 ? `breaks a tie, up ${ma}`
      : `stretches the lead to ${ma}`;
    add(r.end, r.side, `${T(r.side)} ${r.n}–0 run`, what, true);
  }
  for (const side of ['a', 'b']) {
    const ml = flow.maxLead[side];
    if (!ml || ml.n < 8) continue;
    if (bigRuns.some(r => r.end === ml.p)) continue;
    add(ml.p, side, `${T(side)}’s biggest lead`, `${ml.n} points`);
  }
  // Halftime, only when the log agrees with the quarter scores the hero shows (the scorer
  // sometimes advances the quarter late, which shifts baskets between quarters in the log).
  const firstHalf = quarterScores.filter(s => s.quarter <= 2 && s.a != null);
  const halfOk = flow.half && firstHalf.length === 2 &&
    firstHalf.reduce((t, s) => t + s.a, 0) === flow.half.a && firstHalf.reduce((t, s) => t + s.b, 0) === flow.half.b;
  if (halfOk) {
    const h = flow.half, m = h.a - h.b;
    plays.push({ t: flow.len(1) + flow.len(2), q: 2, clock: 'HALF', score: { a: h.a, b: h.b }, side: m > 0 ? 'a' : m < 0 ? 'b' : null,
      strong: m === 0 ? 'Tied at the half' : `${T(m > 0 ? 'a' : 'b')} lead at the break`, rest: '', big: false });
  }
  if (flow.forGood) {
    const p = flow.forGood;
    add(p, flow.winner, `${shortName(p.who)}`, `puts ${T(flow.winner)} ahead for good`, true);
  }
  const lastQ = Math.max(...quarterScores.filter(s => s.a != null).map(s => s.quarter), 0);
  const lq = quarterScores.find(s => s.quarter === lastQ);
  const fa = num(game.team_a_score), fb = num(game.team_b_score);
  if (lq && flow.winner && lq.a !== lq.b && (lq.a > lq.b) === (flow.winner === 'a')) {
    plays.push({ t: flow.total, q: lastQ, clock: 'FINAL', score: { a: fa, b: fb }, side: flow.winner,
      strong: `${T(flow.winner)} take the ${ordinal(lastQ)}`, rest: `${Math.max(lq.a, lq.b)}–${Math.min(lq.a, lq.b)}`, big: false });
  } else {
    plays.push({ t: flow.total, q: lastQ || 4, clock: 'FINAL', score: { a: fa, b: fb }, side: flow.winner, strong: flow.winner ? `${T(flow.winner)} win` : 'Tied', rest: '', big: false });
  }
  // Same moment from two rules (a run ending on the go-ahead basket): keep the first.
  const seen = new Set();
  return plays.sort((x, y) => x.t - y.t)
    .filter(p => { const k = `${p.score.a}-${p.score.b}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(-7)
    .map(p => ({ ...p, qLabel: p.clock === 'HALF' || p.clock === 'FINAL' ? p.clock : qLabel(p.q) }));
}

const tcTeam = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1).toLowerCase();

// SVG geometry for the lead tracker: a step line of the margin (team A up, team B down).
export function flowChart(flow, { w = 760, h = 200 } = {}) {
  const maxAbs = Math.max(10, ...flow.points.map(p => Math.abs(p.a - p.b)));
  const k = (h / 2 - 8) / maxAbs, mid = h / 2;
  const x = t => +(t / flow.total * w).toFixed(1);
  const y = m => +(mid - m * k).toFixed(1);
  let d = `M0 ${mid}`;
  for (const p of flow.points) d += ` H${x(p.t)} V${y(p.a - p.b)}`;
  d += ` H${w}`;
  const qLines = [];
  let t = 0;
  for (let q = 1; t + flow.len(q) < flow.total - 0.01; q++) { t += flow.len(q); qLines.push({ x: x(t), half: q === 2 }); }
  const qs = [];
  t = 0;
  for (let q = 1; t < flow.total - 0.01; q++) { qs.push({ label: qLabel(q), w: flow.len(q) / flow.total * 100 }); t += flow.len(q); }
  const tick = Math.max(5, Math.round(maxAbs / 2 / 5) * 5);
  return { w, h, mid, line: d, area: `${d} V${mid} Z`, x, y, qLines, qs, tick, tickY: y(tick) };
}

// ── How it was won: the biggest gaps in the box score ───────────────────────────────────
export function teamTotals(stats, teamName, teamTo = 0) {
  const pl = stats.filter(s => String(s.team_name || '').toUpperCase() === String(teamName).toUpperCase());
  const sum = k => pl.reduce((t, p) => t + num(p[k]), 0);
  const fg2m = sum('fg2m'), fg3m = sum('fg3m'), fg4m = sum('fg4m');
  const fg2a = fg2m + sum('fg2m_miss'), fg3a = fg3m + sum('fg3m_miss'), fg4a = fg4m + sum('fg4m_miss');
  const ftm = sum('ftm'), fta = ftm + sum('ft_miss');
  return { pts: sum('pts'), reb: sum('reb'), ast: sum('ast'), stl: sum('stl'), blk: sum('blk'), to: sum('turnover') + num(teamTo),
    fg2m, fg2a, fg3m, fg3a, fg4m, fg4a, ftm, fta, fgm: fg2m + fg3m + fg4m, fga: fg2a + fg3a + fg4a, players: pl.length };
}

export function howItWasWon(game, A, B) {
  const T = side => tcTeam(side === 'a' ? game.team_a_name : game.team_b_name);
  const f = (key, label, va, vb, detail, lowerIsBetter = false) => {
    const diff = lowerIsBetter ? vb - va : va - vb;
    return { key, label, side: diff > 0 ? 'a' : 'b', team: T(diff > 0 ? 'a' : 'b'), n: Math.abs(diff), detail };
  };
  const points = [
    f('3pt', 'From three', 3 * A.fg3m, 3 * B.fg3m, `${A.fg3m} of ${A.fg3a} vs ${B.fg3m} of ${B.fg3a}`),
    f('ft', 'At the line', A.ftm, B.ftm, `${A.ftm} of ${A.fta} vs ${B.ftm} of ${B.fta}`),
    f('2pt', 'Inside the arc', 2 * A.fg2m, 2 * B.fg2m, `${A.fg2m} twos vs ${B.fg2m}`),
    ...(A.fg4a + B.fg4a ? [f('4pt', 'From deep', 4 * A.fg4m, 4 * B.fg4m, `${A.fg4m} fours vs ${B.fg4m}`)] : []),
  ].filter(x => x.n > 0).sort((x, y) => y.n - x.n);
  const poss = [
    f('reb', 'On the glass', A.reb, B.reb, `${A.reb} rebounds vs ${B.reb}`),
    f('to', 'Ball security', A.to, B.to, `${A.to} turnovers vs ${B.to}`, true),
  ].filter(x => x.n >= 3).sort((x, y) => y.n - x.n);
  const out = [...points.slice(0, 2), ...poss.slice(0, 1)];
  for (const x of points.slice(2)) if (out.length < 3) out.push(x);
  return out.slice(0, 3);
}

// ── Duel + supporting cast ───────────────────────────────────────────────────────────────
// Earlier box scores for these players (everything dated before this game), for career and
// season highs and season averages.
export function playerHistory(playerIds, game) {
  if (!playerIds.length) return {};
  const rows = db.prepare(`
    SELECT gps.player_id, g.season, g.date, gps.pts, gps.reb, gps.ast, gps.stl, gps.blk, gps.fg3m
    FROM game_player_stats gps JOIN games g ON g.id = gps.game_id
    WHERE gps.player_id IN (${playerIds.map(() => '?').join(',')})
      AND g.id != ? AND COALESCE(g.under_review, 0) = 0`).all(...playerIds, game.id);
  const ymd = ymdOf(game.date);
  const out = {};
  for (const r of rows) {
    if (!(ymdOf(r.date) < ymd)) continue;
    const h = out[r.player_id] ||= { gp: 0, max: { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fg3m: 0 }, sGp: 0, sMax: 0, sPts: 0 };
    h.gp++;
    for (const k of Object.keys(h.max)) h.max[k] = Math.max(h.max[k], num(r[k]));
    if (String(r.season) === String(game.season)) { h.sGp++; h.sMax = Math.max(h.sMax, num(r.pts)); h.sPts += num(r.pts); }
  }
  for (const h of Object.values(out)) h.sAvg = h.sGp ? h.sPts / h.sGp : 0;
  return out;
}

const STAT_WORD = { reb: 'rebounds', ast: 'assists', stl: 'steals', blk: 'blocks', fg3m: 'threes' };
const CAREER_MIN = { reb: 8, ast: 5, stl: 4, blk: 3, fg3m: 3 };

// One badge per player — the most notable thing about their night — or null.
export function badgeFor(s, h) {
  const v = { pts: num(s.pts), reb: num(s.reb), ast: num(s.ast), stl: num(s.stl), blk: num(s.blk), fg3m: num(s.fg3m) };
  const doubles = ['pts', 'reb', 'ast', 'stl', 'blk'].filter(k => v[k] >= 10).length;
  if (doubles >= 3) return 'Triple-double';
  const careerOk = h && h.gp >= 3;
  if (careerOk && v.pts >= 10 && v.pts > h.max.pts) return `Career-high ${v.pts}${doubles >= 2 ? ' · double-double' : ''}`;
  if (careerOk) {
    const k = Object.keys(CAREER_MIN).find(k => v[k] >= CAREER_MIN[k] && v[k] > h.max[k]);
    if (k) return `Career-high ${v[k]} ${STAT_WORD[k]}`;
  }
  if (doubles >= 2) {
    const two = ['pts', 'reb', 'ast', 'stl', 'blk'].filter(k => v[k] >= 10);
    return v.pts >= 20 && v.reb >= 15 ? `${v.pts} & ${v.reb}` : two.length ? 'Double-double' : null;
  }
  if (v.fg3m >= 5) return `${v.fg3m} threes`;
  if (h && h.sGp >= 2 && v.pts >= 10 && v.pts > h.sMax) return `Season-high ${v.pts}`;
  if (h && h.sGp >= 2 && h.sAvg >= 3 && v.pts >= 2 * h.sAvg) return '2× season average';
  return null;
}

// A short line for a cast row: the 2–3 biggest non-points numbers, plus threes when there were some.
export function castLine(s) {
  const parts = [['reb', 'REB'], ['ast', 'AST'], ['stl', 'STL'], ['blk', 'BLK']]
    .map(([k, l]) => ({ v: num(s[k]), l })).filter(x => x.v >= 2).sort((x, y) => y.v - x.v).slice(0, 3)
    .map(x => `${x.v} ${x.l}`);
  const tm = num(s.fg3m), ta = tm + num(s.fg3m_miss);
  if (tm >= 2) parts.push(`3PT ${tm}/${ta}`);
  return parts.join(' · ');
}

// The best player on each side by game score, and up to 3 more per side with a game score of
// 10+. Each carries its badge. Returns null without box scores for both teams.
export function duelAndCast(stats, game, history) {
  const side = name => stats.filter(s => String(s.team_name || '').toUpperCase() === String(name).toUpperCase())
    .map(s => ({ ...s, gs: gameScore(s), badge: badgeFor(s, history[s.player_id]) }))
    .sort((x, y) => y.gs - x.gs || num(y.pts) - num(x.pts));
  const a = side(game.team_a_name), b = side(game.team_b_name);
  if (!a.length || !b.length) return null;
  return {
    a: a[0], b: b[0],
    castA: a.slice(1).filter(s => s.gs >= 10).slice(0, 3),
    castB: b.slice(1).filter(s => s.gs >= 10).slice(0, 3),
  };
}

// One plain sentence on the duel, from the numbers alone.
export function duelVerdict(da, db_, game) {
  const pa = num(da.pts), pb = num(db_.pts);
  const na = lastName(da.name), nb = lastName(db_.name);
  const first = pa === pb ? 'Even on points.' : pa > pb ? `${na} outscored ${nb} ${pa}–${pb}.` : `${nb} outscored ${na} ${pb}–${pa}.`;
  const fgp = s => { const m = num(s.fg2m) + num(s.fg3m) + num(s.fg4m); const a = m + num(s.fg2m_miss) + num(s.fg3m_miss) + num(s.fg4m_miss); return a >= 8 ? Math.round(m / a * 100) : null; };
  const edge = (x, y) => {
    const c = [
      { n: (num(x.reb) - num(y.reb)) / 5, t: 'owned the glass' },
      { n: (num(x.ast) - num(y.ast)) / 3, t: 'ran the offense' },
      { n: (num(x.stl) + num(x.blk) - num(y.stl) - num(y.blk)) / 3, t: 'made the plays on defense' },
      { n: (num(y.turnover) - num(x.turnover)) / 3, t: `took care of the ball, <b>${num(x.turnover)} turnover${num(x.turnover) === 1 ? '' : 's'} to ${num(y.turnover)}</b>` },
      ...(fgp(x) != null && fgp(y) != null ? [{ n: (fgp(x) - fgp(y)) / 15, t: `shot <b>${fgp(x)}% to ${fgp(y)}%</b>` }] : []),
    ].filter(e => e.n >= 1).sort((p, q) => q.n - p.n);
    return c[0]?.t || null;
  };
  const ea = edge(da, db_), eb = edge(db_, da);
  const fa = num(game.team_a_score), fb = num(game.team_b_score);
  const won = fa === fb ? '' : `, and ${tcTeam(fa > fb ? game.team_a_name : game.team_b_name)} won`;
  // Loser's edge first, winner's last, so the sentence ends on the result.
  const aWon = fa > fb;
  const parts = aWon ? [[nb, eb], [na, ea]] : [[na, ea], [nb, eb]];
  const said = parts.filter(([, e]) => e).map(([n, e]) => `${n} ${e}`);
  if (!said.length) return `${first}${won ? ` ${tcTeam(fa > fb ? game.team_a_name : game.team_b_name)} won.` : ''}`;
  return `${first} ${said.join('; ')}${won}.`;
}

// ── Records, streaks, game number ────────────────────────────────────────────────────────
// `games` sorted oldest first; only finals count. Records include this game when it's final.
export function seasonContext(games, game) {
  const ymd = ymdOf(game.date);
  const season = String(game.season ?? '');
  const isFinal = g => !g.under_review && (g.status === 'final' || g.status === 'complete') && num(g.team_a_score) + num(g.team_b_score) > 0;
  const seasonGames = games.filter(g => String(g.season ?? '') === season && !g.under_review);
  const upTo = seasonGames.filter(g => isFinal(g) && (ymdOf(g.date) < ymd || g.id === game.id));
  const rec = team => {
    const list = upTo.filter(g => g.team_a_name === team || g.team_b_name === team);
    const res = list.map(g => ((g.team_a_name === team) === (num(g.team_a_score) > num(g.team_b_score)) ? 'W' : 'L'));
    let streak = 0;
    for (let i = res.length - 1; i >= 0 && res[i] === res[res.length - 1]; i--) streak++;
    return { w: res.filter(r => r === 'W').length, l: res.filter(r => r === 'L').length, streak: res.length ? `${res[res.length - 1]}${streak}` : '' };
  };
  const ordered = seasonGames.slice().sort((x, y) => ymdOf(x.date).localeCompare(ymdOf(y.date)) || String(x.id).localeCompare(String(y.id)));
  const number = ordered.findIndex(g => g.id === game.id) + 1;
  // All-time series between the two, including this game when final.
  const pair = games.filter(g => isFinal(g) && (ymdOf(g.date) < ymd || g.id === game.id) &&
    ((g.team_a_name === game.team_a_name && g.team_b_name === game.team_b_name) || (g.team_a_name === game.team_b_name && g.team_b_name === game.team_a_name)));
  const winsOf = t => pair.filter(g => (num(g.team_a_score) > num(g.team_b_score) ? g.team_a_name : g.team_b_name) === t).length;
  return { recA: rec(game.team_a_name), recB: rec(game.team_b_name), number, series: { a: winsOf(game.team_a_name), b: winsOf(game.team_b_name), n: pair.length } };
}
