// Live game extras (scorer phase 7, Paolo 2026-10-26; mockup claude.ai/artifact/UfcErs6BJnQcZjXTTitbGH):
// what the live view adds while a game is scored. Win odds that move, momentum (the run, lead
// changes, ties, biggest leads, time led, points by stretch), who's hot and what to watch for,
// each team's pace against its usual, and how the pickers are doing. Plain numbers from the
// engine's rows (public/score-engine.js foldGame) plus history the server passes in; no DOM.
// Time comes from the scorer's clock as logged, so time-based numbers are estimates.
import { periodIndex } from '../public/score-engine.js';

// ── Time ──
const secsOf = clock => { const m = /^(\d+):(\d{2})$/.exec(String(clock || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
// Seconds played at a play (its period and the clock left), and the regulation length.
export function timeline(rules) {
  const pm = rules.periodMin * 60, om = rules.otMin * 60, P = rules.periods;
  const total = P * pm;
  const at = (period, clock) => {
    const i = periodIndex(period || 'Q1');
    const base = i <= P ? (i - 1) * pm : total + (i - P - 1) * om;
    const len = i <= P ? pm : om;
    const left = secsOf(clock);
    return base + (left == null ? 0 : Math.max(0, len - left));
  };
  return { at, total, pm };
}

// ── Win odds ──
// The normal curve and its inverse (Acklam's approximation), for the margin model below.
const phi = x => 0.5 * (1 + erf(x / Math.SQRT2));
function erf(x) {
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
function phiInv(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - lo) return -phiInv(1 - p);
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
// A's chance to win with `lead` (A minus B) and `left` (share of regulation still to play), from
// the pre-game chance p0: the pre-game edge becomes an expected margin that shrinks with the time
// left, and the final margin's spread shrinks with it too (SIGMA points over a whole game).
const SIGMA = 13;
export function winChance(p0, lead, left) {
  const edge = SIGMA * phiInv(Math.min(0.97, Math.max(0.03, p0)));
  if (left <= 0.0005) return lead > 0 ? 0.995 : lead < 0 ? 0.005 : 0.5;
  const p = phi((lead + edge * left) / (SIGMA * Math.sqrt(left)));
  return Math.min(0.99, Math.max(0.01, p));
}

// ── Everything for the live view ──
// G: foldGame result. ctx: { rules, p0 (A's pre-game chance, or null), names: {a, b},
//   playerName(id), seasonAvg(id) → {pts, gp} | null, seasonHigh(id) → pts | null,
//   teamUsual: { a: {pts, tpm, to, reb} | null, b }, picks: { closed, list: [{side, name, playerId}] } | null, myPick: 'a'|'b'|null }
export function liveExtras(G, ctx) {
  const { rules } = ctx;
  const T = timeline(rules);
  const rows = G.rows;
  const lastClocked = [...rows].reverse().find(r => r.clock && r.type !== 'period_end');
  const ended = !!G.final;
  const nowAt = ended ? Math.max(T.total, lastClocked ? T.at(lastClocked.period, lastClocked.clock) : T.total) : lastClocked ? T.at(lastClocked.period, lastClocked.clock) : 0;
  const share = Math.min(1, nowAt / T.total);
  const clocked = rows.some(r => r.clock && secsOf(r.clock) != null && secsOf(r.clock) < rules.periodMin * 60);

  // The scoring plays, in order, with the score after each and when.
  const scoring = [];
  let prev = { a: 0, b: 0 };
  for (const r of rows) {
    if (!r.score || (r.score.a === prev.a && r.score.b === prev.b)) continue;
    const team = r.score.a !== prev.a ? 'a' : 'b';
    scoring.push({ team, pts: r.score[team] - prev[team], player: r.player || null, score: { ...r.score }, at: T.at(r.period, r.clock), period: r.period });
    prev = { ...r.score };
  }
  const score = G.score;

  // Win odds (games with pre-game odds only): now, the change since tip-off, and the line.
  let odds = null;
  if (ctx.p0 != null) {
    const left = at => Math.max(0, (T.total - at) / T.total);
    const now = ended ? (score.a > score.b ? 1 : score.a < score.b ? 0 : 0.5) : winChance(ctx.p0, score.a - score.b, left(nowAt));
    const line = [{ at: 0, a: ctx.p0 }, ...scoring.map(s => ({ at: s.at, a: winChance(ctx.p0, s.score.a - s.score.b, left(s.at)) }))];
    if (!ended) line.push({ at: nowAt, a: now });
    odds = { a: Math.round(now * 100), b: 100 - Math.round(now * 100), start: Math.round(ctx.p0 * 100), line: line.map(x => ({ at: x.at, a: Math.round(x.a * 100) })), total: T.total, periods: rules.periods, pm: T.pm };
  }

  // Momentum: the current run (one team only scoring, 6+), lead changes, ties, biggest leads,
  // share of the time each side led, points by 2-minute stretch.
  let run = null;
  if (scoring.length) {
    const t = scoring[scoring.length - 1].team;
    let pts = 0, from = null; const by = {};
    for (let i = scoring.length - 1; i >= 0 && scoring[i].team === t; i--) { pts += scoring[i].pts; from = scoring[i]; if (scoring[i].player) by[scoring[i].player] = (by[scoring[i].player] || 0) + scoring[i].pts; }
    const top = Object.entries(by).sort((x, y) => y[1] - x[1])[0];
    if (pts >= 6) run = { team: t, pts, secs: clocked ? Math.max(0, nowAt - (from ? from.at : nowAt)) : null, top: top && top[1] >= 4 ? { name: ctx.playerName(top[0]), pts: top[1] } : null };
  }
  let leadChanges = 0, ties = 0, leader = null; const biggest = { a: 0, b: 0 };
  for (const s of scoring) {
    const d = s.score.a - s.score.b, now = d > 0 ? 'a' : d < 0 ? 'b' : null;
    if (now && leader && now !== leader) leadChanges++;
    if (!now && (s.score.a || s.score.b)) ties++;
    if (now) leader = now;
    if (d > biggest.a) biggest.a = d;
    if (-d > biggest.b) biggest.b = -d;
  }
  let ledA = 0, ledB = 0;
  if (clocked && nowAt > 0) {
    let lastAt = 0, d = 0;
    for (const s of scoring) { const span = Math.max(0, s.at - lastAt); if (d > 0) ledA += span; else if (d < 0) ledB += span; lastAt = Math.max(lastAt, s.at); d = s.score.a - s.score.b; }
    const span = Math.max(0, nowAt - lastAt); if (d > 0) ledA += span; else if (d < 0) ledB += span;
  }
  const STRETCH = 120, bins = Math.max(1, Math.ceil(Math.max(nowAt, 1) / STRETCH));
  const stretch = { a: Array(bins).fill(0), b: Array(bins).fill(0) };
  if (clocked) for (const s of scoring) stretch[s.team][Math.min(bins - 1, Math.floor(s.at / STRETCH))] += s.pts;
  const momentum = scoring.length ? { run, leadChanges, ties, biggest, led: clocked && nowAt > 0 ? { a: Math.round((ledA / nowAt) * 100), b: Math.round((ledB / nowAt) * 100) } : null, stretch: clocked ? stretch : null } : null;

  // Who's hot: tonight against the player's season average. Early on a raw comparison says
  // nothing, so a player counts as hot when ahead of their average for the time played.
  const players = Object.entries(G.players).map(([id, L]) => {
    const fga = L.fg2m + L.fg2m_miss + L.fg3m + L.fg3m_miss + L.fg4m + L.fg4m_miss, fgm = L.fg2m + L.fg3m + L.fg4m;
    return { id, L, fga, fgm, avg: ctx.seasonAvg(id), high: ctx.seasonHigh(id), team: ctx.teamOf(id) };
  }).filter(p => p.team);
  const inRun = run && run.top ? run.top.name : '';
  const note = p => {
    const n = ctx.playerName(p.id);
    if (inRun && n === inRun) return `${run.top.pts} in the run`;
    if (p.L.fg3m >= 3) return `${p.L.fg3m} of ${p.L.fg3m + p.L.fg3m_miss} from three`;
    return p.fga ? `${p.fgm} of ${p.fga} shooting` : '';
  };
  const hotList = players.filter(p => p.avg && p.avg.gp >= 2 && p.L.pts >= 6 && p.L.pts - p.avg.pts * Math.max(share, 0.25) >= 4)
    .sort((x, y) => (y.L.pts - y.avg.pts * share) - (x.L.pts - x.avg.pts * share)).slice(0, 3)
    .map(p => ({ id: p.id, name: ctx.playerName(p.id), team: p.team, pts: p.L.pts, vs: Math.round((p.L.pts - p.avg.pts) * 10) / 10, note: note(p) }));
  const cold = share >= 0.5 ? players.filter(p => p.avg && p.avg.gp >= 2 && p.fga >= 6 && p.fgm / p.fga <= 0.25 && p.avg.pts >= 8)
    .sort((x, y) => x.fgm / x.fga - y.fgm / y.fga)[0] : null;
  const hot = hotList.length || cold ? [...hotList, ...(cold && hotList.length < 3 ? [{ id: cold.id, name: ctx.playerName(cold.id), team: cold.team, pts: cold.L.pts, vs: Math.round((cold.L.pts - cold.avg.pts) * 10) / 10, note: `${cold.fgm} of ${cold.fga} shooting`, cold: true }] : [])] : [];

  // Watch for: close to a season high, a double-double, or one foul from fouling out.
  const watch = [];
  for (const p of players) {
    const n = ctx.playerName(p.id), L = p.L;
    if (p.high && p.high >= 12 && L.pts >= p.high - 5 && L.pts <= p.high) watch.push({ id: p.id, name: n, team: p.team, text: L.pts === p.high ? `${n} is level with their season high (${p.high})` : `${n} is ${p.high - L.pts + 1} off a new season high (${p.high})`, pct: Math.round((L.pts / (p.high + 1)) * 100), rank: 3 });
    const cats = [['points', L.pts], ['rebounds', L.reb], ['assists', L.ast], ['steals', L.stl], ['blocks', L.blk]];
    const tens = cats.filter(c => c[1] >= 10);
    const near = cats.filter(c => c[1] >= 7 && c[1] < 10).sort((x, y) => y[1] - x[1])[0];
    if (tens.length === 1 && near) watch.push({ id: p.id, name: n, team: p.team, text: `${n} needs ${10 - near[1]} ${10 - near[1] === 1 ? near[0].replace(/s$/, '') : near[0]} for a double-double`, pct: near[1] * 10, rank: 2 });
    if (L.pf === rules.foulOut - 1 && !G.flags[p.id]) watch.push({ id: p.id, name: n, team: p.team, text: `${n} has ${L.pf} fouls`, pct: Math.round((L.pf / rules.foulOut) * 100), rank: 1 });
  }
  watch.sort((x, y) => y.pct - x.pct || y.rank - x.rank);

  // Team pace: on pace for, against each team's per-game usual. Hidden until a quarter is played.
  let pace = null;
  if (clocked && share >= 0.25 && !ended && (ctx.teamUsual.a || ctx.teamUsual.b)) {
    const tot = t => players.filter(p => p.team === t).reduce((m, p) => ({ pts: m.pts + p.L.pts, tpm: m.tpm + p.L.fg3m, to: m.to + p.L.turnover, reb: m.reb + p.L.reb }), { pts: 0, tpm: 0, to: (G.teamTO && G.teamTO[t]) || 0, reb: 0 });
    const proj = t => { const x = tot(t); return { pts: Math.round(score[t] / share), tpm: Math.round(x.tpm / share), to: Math.round(x.to / share), reb: Math.round(x.reb / share) }; };
    const row = (key, label, lowGood = false) => ({ key, label, lowGood, a: proj('a')[key], b: proj('b')[key], ua: ctx.teamUsual.a ? ctx.teamUsual.a[key] : null, ub: ctx.teamUsual.b ? ctx.teamUsual.b[key] : null });
    pace = [row('pts', 'Points'), row('tpm', 'Threes'), row('to', 'Turnovers', true), row('reb', 'Rebounds')];
  }

  // Picks: how the pickers are doing if it ended now (only once picks are closed).
  let picks = null;
  if (ctx.picks && ctx.picks.closed && ctx.picks.list.length) {
    const lead = score.a > score.b ? 'a' : score.b > score.a ? 'b' : null;
    const on = { a: ctx.picks.list.filter(p => p.side === 'a'), b: ctx.picks.list.filter(p => p.side === 'b') };
    picks = { total: ctx.picks.list.length, a: on.a, b: on.b, lead, mine: ctx.myPick || null };
  }

  return { share, ended, clocked, odds, momentum, hot, watch: watch.slice(0, 3), pace, picks };
}
