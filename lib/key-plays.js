// Key plays read by the AI (2026-11-11, mockup claude.ai/artifact/MNb5v9oq4KiuvBumemtRZv).
// The rules in lib/game-detail.js keyPlays() pick the same kinds of moments every game (a run,
// the biggest lead, the half, ahead for good). Here the writer reads every play and picks the
// moments that shaped THIS game, saying why each mattered. Pure: no DB, no AI call.
//
// - keyPlayRows(game, nameOf): the scoring log as numbered rows, oldest first, with the running
//   score worked out from the points (the log's own [BLA 3 - BLU 5] tags skip some rows).
// - keyPlayFacts(game, rows, players): what the writer may say: final, quarters, box score, and
//   the patterns counted in code (runs, droughts with the misses and blocks inside them, one
//   player's straight points, big quarters, lead changes), then every play by its number.
// - keyPlayProblems(draft, rows): the format checks (real play numbers, oldest first, lengths).
// - keyPlayCards(stored, rows): the stored picks as the cards the page draws, or null when a
//   picked play is no longer in the log (then it's rewritten).

const num = v => Number(v) || 0;
const clockSec = c => { const m = String(c || '').match(/^(\d+):(\d{2})$/); return m ? num(m[1]) * 60 + num(m[2]) : null; };
const clockOf = c => { const s = clockSec(c); return s == null ? '' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const qName = q => (q <= 4 ? `Q${q}` : q === 5 ? 'OT' : `OT${q - 4}`);
const team = s => String(s || '').toUpperCase();

// "SALENGA, Vin: 2pt Miss [BLA 3 - BLU 5] [Clock Stopped]" → "2pt miss"
function whatOf(text) {
  const after = String(text || '').replace(/^[^:]*:\s*/, '').replace(/\[[^\]]*\]/g, '').trim();
  return after
    .replace(/^\+1 /, '')
    .replace(/^(\dpt) Made$/i, '$1 made').replace(/^(\dpt) Miss$/i, '$1 miss')
    .replace(/^FT$/i, 'free throw made').replace(/^FT Miss$/i, 'free throw miss')
    .replace(/^REB \(OFF\)$/i, 'offensive rebound').replace(/^REB$/i, 'rebound')
    .replace(/^AST$/i, 'assist').replace(/^STL$/i, 'steal').replace(/^BLK$/i, 'block').replace(/^TO$/i, 'turnover').replace(/^FOUL$/i, 'foul')
    .toLowerCase();
}

/**
 * The scoring log as numbered rows, oldest first.
 * @returns {Array<{ n, id, q, clock, sec, side, pid, who, what, pts, a, b, made3, miss, fta, ftm }>}
 */
export function keyPlayRows(game, nameOf = () => '') {
  let log = [];
  try { log = JSON.parse(game.game_log_json || '[]'); } catch { return []; }
  if (!Array.isArray(log)) return [];
  const rows = [];
  let a = 0, b = 0, q = 1;
  for (const e of log.slice().reverse()) {
    if (e?.metaType === 'quarterEnd') { q = Math.max(q, num(e.quarter) + 1); continue; }
    if (e?.kind !== 'stat') continue;
    const side = e.isTeamA ? 'a' : 'b';
    const pts = e.statField === 'pts' ? num(e.changeAmount) : 0;
    if (side === 'a') a += pts; else b += pts;
    const what = whatOf(e.text);
    const raw = String(e.text || '').split(':')[0];
    const fromText = raw.includes(',') ? `${raw.split(',')[1].trim()} ${raw.split(',')[0].trim().toUpperCase()}` : raw.trim();
    rows.push({
      n: rows.length + 1, id: String(e.id || ''), q: Math.max(num(e.quarter) || 1, 1), clock: clockOf(e.clockRemaining), sec: clockSec(e.clockRemaining),
      side, pid: e.playerId || '', who: nameOf(e.playerId) || fromText, what, pts, a, b,
      made3: /^3pt made$/.test(what), miss: /^\dpt miss$/.test(what), fta: /^free throw/.test(what), ftm: what === 'free throw made',
    });
  }
  return rows;
}

// Seconds into the game for a row (quarter lengths taken from the log: the first clock seen in a
// quarter, rounded up to the minute; 12:00 when unknown).
function elapsedFn(rows) {
  const len = {};
  for (const r of rows) if (r.sec != null) len[r.q] = Math.max(len[r.q] || 0, Math.ceil(r.sec / 60) * 60);
  const L = q => len[q] || 720;
  const start = q => { let t = 0; for (let i = 1; i < q; i++) t += L(i); return t; };
  return r => start(r.q) + L(r.q) - (r.sec ?? L(r.q));
}
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * The writer's facts: lines it may use, the patterns counted in code, then every play.
 * players: game_player_stats rows with name (display), team_name.
 * @returns {{ facts: string, numbersFacts: string }} numbersFacts leaves the play numbers out,
 *   so "#423" can't let a made-up 423 through the number check.
 */
export function keyPlayFacts(game, rows, players = []) {
  const A = team(game.team_a_name), B = team(game.team_b_name);
  const T = s => (s === 'a' ? A : B);
  const sc = r => `${A} ${r.a}-${r.b} ${B}`;
  const at = r => `${qName(r.q)} ${r.clock || '?'}`;
  const el = elapsedFn(rows);
  const scoring = rows.filter(r => r.pts > 0);
  const lines = [];
  const fa = num(game.team_a_score), fb = num(game.team_b_score);
  lines.push(`GAME: ${A} vs ${B}, final ${A} ${fa}-${fb} ${B}. Winner: ${fa === fb ? 'tie' : fa > fb ? A : B}.`);

  // Quarter scores (from the plays).
  const qs = [];
  for (let q = 1, pa = 0, pb = 0; q <= Math.max(0, ...rows.map(r => r.q)); q++) {
    const last = rows.filter(r => r.q === q).at(-1);
    if (!last) continue;
    qs.push(`${qName(q)} ${A} ${last.a - pa}-${last.b - pb} ${B} (after ${qName(q)}: ${last.a}-${last.b})`);
    pa = last.a; pb = last.b;
  }
  if (qs.length) lines.push(`QUARTERS: ${qs.join('; ')}.`);

  // Box score, the players who did something.
  const box = players.filter(p => num(p.pts) + num(p.reb) + num(p.ast) + num(p.stl) + num(p.blk) > 0)
    .sort((x, y) => num(y.pts) - num(x.pts))
    .map(p => `${p.name} (${team(p.team_name)}): ${num(p.pts)} points, ${num(p.reb)} rebounds, ${num(p.ast)} assists, ${num(p.stl)} steals, ${num(p.blk)} blocks, ${num(p.turnover)} turnovers`);
  if (box.length) lines.push(`BOX SCORE:\n${box.join('\n')}`);

  // Runs: points by one team with nothing back, 7 or more.
  const runs = [];
  let cur = null;
  for (const r of scoring) {
    if (cur && cur.side === r.side) { cur.pts += r.pts; cur.end = r; continue; }
    if (cur && cur.pts >= 7) runs.push(cur);
    const prev = scoring[scoring.indexOf(r) - 1];
    cur = { side: r.side, pts: r.pts, start: r, end: r, before: prev ? { a: prev.a, b: prev.b } : { a: 0, b: 0 } };
  }
  if (cur && cur.pts >= 7) runs.push(cur);
  // Stretches (runs and droughts) are collected first: the one that swung the last quarter
  // most toward the winner is marked as the deciding stretch.
  const stretches = [];
  for (const x of runs) stretches.push({ swing: x.pts, side: x.side, q: x.end.q, n: x.end.n, text: `RUN: ${T(x.side)} scored ${x.pts} unanswered points, play #${x.start.n} (${at(x.start)}) to #${x.end.n} (${at(x.end)}), from ${A} ${x.before.a}-${x.before.b} ${B} to ${sc(x.end)}.` });

  // Droughts: 3 minutes or more of game time without a point while the other team scored at
  // least 4, with what happened inside (misses, turnovers, who blocked them).
  for (const side of ['a', 'b']) {
    const mine = scoring.filter(r => r.side === side);
    for (let i = 0; i <= mine.length; i++) {
      const from = mine[i - 1] || null, to = mine[i] || null;
      const t0 = from ? el(from) : 0;
      const t1 = to ? el(to) : el(rows.at(-1));
      if (t1 - t0 < 180) continue;
      const inside = rows.filter(r => r.n > (from ? from.n : 0) && r.n < (to ? to.n : rows.length + 1));
      const misses = inside.filter(r => r.side === side && r.miss).length;
      const ftMiss = inside.filter(r => r.side === side && r.fta && !r.ftm).length;
      const tos = inside.filter(r => r.side === side && r.what === 'turnover').length;
      const other = side === 'a' ? 'b' : 'a';
      const otherPts = inside.filter(r => r.side === other).reduce((t, r) => t + r.pts, 0);
      if (otherPts < 4) continue;
      const blockers = {};
      for (const r of inside) if (r.side === other && r.what === 'block') blockers[r.who] = (blockers[r.who] || 0) + 1;
      const blk = Object.entries(blockers).sort((x, y) => y[1] - x[1]).map(([w, n]) => `${w} ${n} ${n === 1 ? 'block' : 'blocks'}`);
      const end = to || rows.at(-1);
      stretches.push({ swing: otherPts, side: other, q: end.q, n: end.n, text: `DROUGHT: ${T(side)} went ${mmss(t1 - t0)} of game time without scoring, ${from ? `after play #${from.n} (${at(from)}, ${sc(from)})` : 'from tip-off'} ${to ? `until play #${to.n} (${at(to)}: ${to.who} ${to.what}, ${sc(to)})` : 'to the end of the game'}. In that time ${T(side)} missed ${misses} shots${ftMiss ? ` and ${ftMiss} free throws` : ''}${tos ? ` and had ${tos} ${tos === 1 ? 'turnover' : 'turnovers'}` : ''}; ${T(other)} scored ${otherPts} points${blk.length ? `; blocks on ${T(side)}: ${blk.join(', ')}` : ''}.` });
    }
  }
  const winSide = fa === fb ? null : fa > fb ? 'a' : 'b';
  const lastQ0 = Math.max(...rows.map(r => r.q));
  const deciding = stretches.filter(x => x.side === winSide && x.q === lastQ0).sort((x, y) => y.swing - x.swing || (y.text.startsWith('DROUGHT') - x.text.startsWith('DROUGHT')))[0];
  for (const x of stretches.sort((p, q) => p.n - q.n)) lines.push(x === deciding ? `DECIDING STRETCH (the biggest swing toward the winner in the last quarter): ${x.text}` : x.text);

  // One player's straight points: every point his team scored for a stretch, 6 or more.
  for (const side of ['a', 'b']) {
    const mine = scoring.filter(r => r.side === side);
    let s = null;
    const close = () => { if (s && s.pts >= 6) lines.push(`STRAIGHT POINTS: ${s.who} scored ${s.pts} straight ${T(side)} points, play #${s.first.n} (${at(s.first)}) to #${s.last.n} (${at(s.last)}), ${A} ${s.from.a}-${s.from.b} ${B} to ${sc(s.last)}.`); };
    for (const r of mine) {
      if (s && s.pid === r.pid && r.pid) { s.pts += r.pts; s.last = r; continue; }
      close();
      s = { pid: r.pid, who: r.who, pts: r.pts, first: r, last: r, from: { a: r.a - (side === 'a' ? r.pts : 0), b: r.b - (side === 'b' ? r.pts : 0) } };
    }
    close();
  }

  // Big quarters: 7+ points, or 3+ threes, steals or blocks in one quarter.
  const byQ = {};
  for (const r of rows) {
    if (!r.pid) continue;
    const k = `${r.pid}|${r.q}`;
    const o = byQ[k] || (byQ[k] = { who: r.who, side: r.side, q: r.q, pts: 0, threes: 0, stl: 0, blk: 0, plays: [] });
    o.pts += r.pts; if (r.made3) { o.threes++; o.plays.push(`#${r.n} ${r.clock}`); }
    if (r.what === 'steal') o.stl++; if (r.what === 'block') o.blk++;
  }
  for (const o of Object.values(byQ)) {
    if (o.pts < 7 && o.threes < 3 && o.stl < 3 && o.blk < 3) continue;
    const bits = [`${o.pts} points`, o.threes ? `${o.threes} ${o.threes === 1 ? 'three' : 'threes'}${o.threes >= 2 ? ` (${o.plays.join(', ')})` : ''}` : '', o.stl ? `${o.stl} ${o.stl === 1 ? 'steal' : 'steals'}` : '', o.blk ? `${o.blk} ${o.blk === 1 ? 'block' : 'blocks'}` : ''].filter(Boolean);
    lines.push(`QUARTER: ${o.who} (${T(o.side)}) in ${qName(o.q)}: ${bits.join(', ')}.`);
  }

  // Leads: changes, ties, each side's biggest, the last lead change.
  let prev = 0, lastLead = 0, changes = 0, ties = 0, lastChange = null;
  const big = { a: null, b: null };
  for (const r of scoring) {
    const m = r.a - r.b, now = Math.sign(m);
    if (now === 0 && prev !== 0) ties++;
    // Taking the lead (from a tie or from behind): the last one is the go-ahead for good.
    if (now !== 0 && now !== prev) { lastChange = r; if (lastLead !== 0 && now !== lastLead) changes++; }
    if (now !== 0) lastLead = now;
    prev = now;
    const s = m > 0 ? 'a' : 'b';
    if (m !== 0 && (!big[s] || Math.abs(m) > Math.abs(big[s].a - big[s].b))) big[s] = r;
  }
  lines.push(`LEADS: ${changes} lead changes, ${ties} ties.`);
  for (const s of ['a', 'b']) if (big[s]) lines.push(`BIGGEST LEAD ${T(s)}: ${Math.abs(big[s].a - big[s].b)} points at play #${big[s].n} (${at(big[s])}, ${sc(big[s])}).`);
  if (lastChange && fa !== fb) lines.push(`AHEAD FOR GOOD: play #${lastChange.n} (${at(lastChange)}): ${lastChange.who} ${lastChange.what}, ${sc(lastChange)}; ${T(lastChange.side)} never trailed or were tied again.`);

  // The last minute's free throws.
  const lastQ = Math.max(...rows.map(r => r.q));
  for (const side of ['a', 'b']) {
    const ft = rows.filter(r => r.q === lastQ && r.sec != null && r.sec <= 60 && r.side === side && r.fta);
    if (ft.length) lines.push(`LAST MINUTE FREE THROWS ${T(side)}: ${ft.filter(r => r.ftm).length} of ${ft.length}.`);
  }

  const patterns = lines.join('\n');
  const plays = rows.map(r => `#${r.n} ${at(r)} ${T(r.side)} ${r.who}: ${r.what} | ${sc(r)}`).join('\n');
  return {
    patterns,
    facts: `${patterns}\n\nEVERY PLAY (oldest first; "#n" is the play number, the score is after the play):\n${plays}`,
    numbersFacts: `${patterns}\n${rows.map(r => `${at(r)} ${r.who}: ${r.what} | ${sc(r)}`).join('\n')}`.replace(/#\d+/g, ''),
  };
}

/** Format checks on a draft { story, plays: [{ play, title, why, big }] }. */
export function keyPlayProblems(draft, rows) {
  const out = [];
  const list = Array.isArray(draft?.plays) ? draft.plays : [];
  if (list.length < 4 || list.length > 7) out.push(`it picks ${list.length} plays (pick 4 to 7)`);
  const ns = list.map(p => Number(p.play));
  const bad = ns.filter(n => !rows[n - 1]);
  if (bad.length) out.push(`it picks play numbers that are not in the list (${bad.join(', ')})`);
  if (ns.some((n, i) => i && n <= ns[i - 1])) out.push('the plays are not oldest first, or a play is picked twice');
  if (list.filter(p => p.big).length > 3) out.push('more than 3 plays are marked big');
  for (const p of list) {
    if (String(p.title || '').length > 70) out.push(`a title is too long ("${String(p.title).slice(0, 40)}…", 70 characters at most)`);
    if (!String(p.why || '').trim()) out.push('a play has no line under it');
    if (String(p.why || '').length > 190) out.push(`a line is too long ("${String(p.why).slice(0, 40)}…", 190 characters at most)`);
  }
  const story = String(draft?.story || '');
  if (!story.trim()) out.push('the story line is missing');
  if (story.length > 170) out.push('the story line is too long (170 characters at most)');
  return out;
}

/** The draft as one block of copy, for the text checks. */
export const keyPlayCopy = d => [d?.story, ...(d?.plays || []).flatMap(p => [p.title, p.why])].filter(Boolean).join('\n');

/**
 * The stored picks as page cards, or null when a picked play is gone (the log changed).
 * Cards match lib/game-detail.js keyPlays() rows, plus why.
 */
export function keyPlayCards(stored, rows) {
  if (!stored?.plays?.length) return null;
  const cards = [];
  for (const p of stored.plays) {
    const r = rows[Number(p.n) - 1];
    if (!r || (p.id && r.id !== p.id)) return null;
    cards.push({ q: r.q, qLabel: qName(r.q), clock: r.clock, score: { a: r.a, b: r.b }, side: r.side, strong: String(p.title || ''), rest: '', why: String(p.why || ''), big: !!p.big });
  }
  return cards;
}
