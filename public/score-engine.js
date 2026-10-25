// The scorer's engine: turns a game's plays into everything shown and published — the score by
// period, team fouls and timeouts, every player's line, and the flags (penalty, fouled out,
// ejected). One file for the server and the phone, like public/share-cards.js: plain JS, no
// imports. The server folds the stored plays at publish time; the scorer folds the same plays on
// the phone, offline, after every tap. (Plan and decisions: the scorer-tool memory notes,
// mockups at claude.ai/artifact/6HBcExzSGjoQSzvjpkMPJQ.)
//
// Plays are never edited or deleted. Undo is a `void` play pointing at the one it cancels; an edit
// is a void plus a new play. Order is `pos` (a number): appending takes the last pos + 1, and
// "Go back here" slots a play in between two others with a pos in between, so later plays stay
// and their running scores update.
//
// A play: { id, pos, type, period: 'Q1'…'Q4' | 'OT1'…, clock: '7:24' (time left), team: 'a' | 'b',
//   player, …type fields }. Types:
//   shot    { pts: 2|3|4, made }        ft      { made }
//   reb     { kind?: 'off'|'def' }      (no kind: offensive only when the play right before
//                                         was a miss by the same team)
//   ast     { ref? }  blk { ref? }      stl     { from? }  (from: who lost it; none = the other
//                                         team's turnover, so steals and turnovers always add up)
//   to      { kind? }                    team_to { kind? }  (no player)
//   foul    { kind: personal|shooting|offensive|technical|unsportsmanlike|disqualifying, fts? }
//   team_tech { kind: coach|bench }     timeout (team)      stoppage { kind? }
//   period_end (the period it ends)     sub { in, out }     lineup { ids }
//   dnp     { on }  (player didn't play: a late or absent player; any stat of theirs later
//                   clears it, so a late arrival who plays counts as played)
//   void    { target }
// A correction (Edit on a play) is a void plus the fixed play right where it was: correction().

// WKND's rules (Paolo, 2026-10-25). A game's setup can override any of them.
export const DEFAULT_RULES = {
  periods: 4,             // quarters
  periodMin: 12,
  otMin: 5,
  timeouts: { firstHalf: 2, secondHalf: 3, overtime: 1 }, // unused ones don't carry over
  penaltyAt: 5,           // a team's 5th foul in a period and every one after gives free throws
  foulOut: 5,
  ejectAt: 2,             // technicals + unsportsmanlike, counted together
  waves: 'first half',    // 'first half' | 'whole game' | 'off' (playoffs: off)
};

export const STAT_KEYS = ['pts', 'reb', 'oreb', 'ast', 'stl', 'blk', 'turnover', 'pf', 'fg2m', 'fg2m_miss', 'fg3m', 'fg3m_miss', 'fg4m', 'fg4m_miss', 'ftm', 'ft_miss'];
const emptyLine = () => Object.fromEntries([...STAT_KEYS, 'tech', 'unsp', 'dq'].map(k => [k, 0]));

export const periodIndex = p => (/^Q\d$/.test(p) ? Number(p.slice(1)) : 4 + Number(String(p).slice(2)));
export const periodName = i => (i <= 4 ? `Q${i}` : `OT${i - 4}`);
export const isOvertime = p => String(p).startsWith('OT');
// Timeouts belong to a half, or to one overtime.
const timeoutWindow = p => (isOvertime(p) ? p : periodIndex(p) <= 2 ? 'H1' : 'H2');
const timeoutAllowance = (p, r) => (isOvertime(p) ? r.timeouts.overtime : periodIndex(p) <= 2 ? r.timeouts.firstHalf : r.timeouts.secondHalf);
// Team fouls reset each quarter; overtime carries on from Q4.
const foulWindow = p => (isOvertime(p) || p === 'Q4' ? 'Q4+' : p);

const isMiss = e => (e.type === 'shot' || e.type === 'ft') && !e.made;
// Plays that don't change possession context: skipped when looking at "the play right before"
// for a rebound (a block sits between the miss and the board).
const META = new Set(['timeout', 'stoppage', 'period_end', 'sub', 'lineup', 'blk', 'dnp']);

// The plays that count, in order: voided ones (and the voids) taken out.
export function livePlays(events) {
  const voided = new Set(events.filter(e => e.type === 'void').map(e => e.target));
  return events.filter(e => e.type !== 'void' && !voided.has(e.id)).slice().sort((x, y) => x.pos - y.pos);
}

// Fold every play into the game's state. rosters: { a: [playerId…], b: [playerId…] } (optional,
// only used to seed empty lines so a player with no stats still has a row).
export function foldGame(events, rules = DEFAULT_RULES, rosters = null) {
  const r = { ...DEFAULT_RULES, ...rules, timeouts: { ...DEFAULT_RULES.timeouts, ...(rules && rules.timeouts) } };
  const plays = livePlays(events);
  const players = {};
  const line = id => (players[id] = players[id] || emptyLine());
  if (rosters) for (const t of ['a', 'b']) for (const id of rosters[t] || []) line(id);
  const score = { a: 0, b: 0 };
  const byPeriod = {};
  const teamFouls = {};      // window → { a, b }
  const timeoutsUsed = {};   // window → { a, b }
  const teamTO = { a: 0, b: 0 };
  const lastActive = { a: [], b: [] }; // most recent first
  let periodIdx = 1;
  const rows = [];           // each counted play with the running score after it
  const other = t => (t === 'a' ? 'b' : 'a');
  const bucket = (o, k) => (o[k] = o[k] || { a: 0, b: 0 });
  const dnp = new Set();
  const touch = (t, id) => { if (!t || !id) return; dnp.delete(id); lastActive[t] = [id, ...lastActive[t].filter(x => x !== id)]; };

  plays.forEach((e, i) => {
    const t = e.team, p = e.player;
    const per = e.period || periodName(periodIdx);
    const prev = plays.slice(0, i).reverse().find(x => !META.has(x.type));
    let extra = {};
    switch (e.type) {
      case 'shot': {
        const pts = Number(e.pts) || 2, L = line(p), key = `fg${pts}m`;
        if (e.made) { L[key]++; L.pts += pts; score[t] += pts; bucket(byPeriod, per)[t] += pts; } else L[`${key}_miss`]++;
        touch(t, p); break;
      }
      case 'ft': {
        const L = line(p);
        if (e.made) { L.ftm++; L.pts++; score[t]++; bucket(byPeriod, per)[t]++; } else L.ft_miss++;
        touch(t, p); break;
      }
      case 'reb': {
        const L = line(p);
        const off = e.kind ? e.kind === 'off' : !!(prev && isMiss(prev) && prev.team === t);
        L.reb++; if (off) L.oreb++;
        extra = { off }; touch(t, p); break;
      }
      case 'ast': line(p).ast++; touch(t, p); break;
      case 'blk': line(p).blk++; touch(t, p); break;
      case 'stl': {
        line(p).stl++;
        if (e.from) line(e.from).turnover++; else teamTO[other(t)]++;
        touch(t, p); break;
      }
      case 'to': line(p).turnover++; touch(t, p); break;
      case 'team_to': teamTO[t]++; break;
      case 'foul': {
        const L = line(p), kind = e.kind || 'personal';
        L.pf++;
        if (kind === 'technical') L.tech++;
        if (kind === 'unsportsmanlike') L.unsp++;
        if (kind === 'disqualifying') L.dq++;
        if (kind === 'offensive') L.turnover++; // an offensive foul is also a turnover
        bucket(teamFouls, foulWindow(per))[t]++; // every foul is a team foul (tech + offensive too)
        touch(t, p); break;
      }
      case 'team_tech': bucket(teamFouls, foulWindow(per))[t]++; break;
      case 'timeout': bucket(timeoutsUsed, timeoutWindow(per))[t]++; break;
      case 'period_end': periodIdx = Math.max(periodIdx, periodIndex(e.period) + 1); break;
      case 'dnp': if (e.on === false) dnp.delete(p); else if (p) dnp.add(p); break;
      default: break;
    }
    rows.push({ ...e, ...extra, score: { a: score.a, b: score.b } });
  });

  const period = periodName(periodIdx);
  const fw = bucket(teamFouls, foulWindow(period));
  const tw = bucket(timeoutsUsed, timeoutWindow(period));
  const allow = timeoutAllowance(period, r);
  const flags = {};
  for (const [id, L] of Object.entries(players)) {
    const ejected = L.tech + L.unsp >= r.ejectAt || L.dq > 0;
    const fouledOut = L.pf >= r.foulOut;
    if (ejected || fouledOut) flags[id] = ejected ? 'ejected' : 'fouled out';
  }
  return {
    period, score, rows, players, flags, teamTO, dnp: [...dnp],
    byPeriod: Object.entries(byPeriod).map(([p, s]) => ({ period: p, ...s })).sort((x, y) => periodIndex(x.period) - periodIndex(y.period)),
    teamFouls: { a: fw.a, b: fw.b },
    // A team at penaltyAt - 1 fouls: its next foul gives free throws.
    penalty: { a: fw.a >= r.penaltyAt, b: fw.b >= r.penaltyAt },
    penaltyNext: { a: fw.a === r.penaltyAt - 1, b: fw.b === r.penaltyAt - 1 },
    timeouts: { allowance: allow, left: { a: Math.max(0, allow - tw.a), b: Math.max(0, allow - tw.b) } },
    wavesOn: r.waves === 'whole game' || (r.waves === 'first half' && periodIdx <= 2),
    lastActive,
    rules: r,
  };
}

// Free throws a foul gives by default, before the scorer adjusts them: shooting 2 (3 for a
// three, 1 for an and-one), unsportsmanlike 2, technical 1, a personal foul in the penalty 2,
// an offensive foul never.
export function defaultFreeThrows(kind, { inPenalty = false, shotPts = 2, andOne = false } = {}) {
  if (kind === 'offensive') return 0;
  if (kind === 'technical') return 1;
  if (kind === 'unsportsmanlike' || kind === 'disqualifying') return 2;
  if (kind === 'shooting') return andOne ? 1 : shotPts === 3 ? 3 : 2;
  return inPenalty ? 2 : 0;
}

// Fix a play: a void for the old one and the corrected play in its place (same period, clock
// and spot in the order; later running scores update). fields: what changes (type, pts, made,
// kind, player, team…). ids: [void id, new play id].
export function correction(events, target, fields, ids) {
  const { id, pos, author, ...rest } = target;
  const play = { ...rest, ...fields, id: ids[1], pos: nextPos(events, target.id), fixes: target.id, at: Date.now() };
  for (const k of Object.keys(play)) if (play[k] === undefined || play[k] === null) delete play[k];
  return [{ id: ids[0], type: 'void', target: target.id, pos: play.pos, at: Date.now() }, play];
}

// Where a new play goes. Append: after the last. "Go back here": between that play and the next.
export function nextPos(events, afterId = null) {
  const sorted = events.filter(e => e.type !== 'void').slice().sort((x, y) => x.pos - y.pos);
  if (!afterId) return (sorted.length ? sorted[sorted.length - 1].pos : 0) + 1;
  const i = sorted.findIndex(e => e.id === afterId);
  if (i < 0) return (sorted.length ? sorted[sorted.length - 1].pos : 0) + 1;
  const a = sorted[i].pos, b = i + 1 < sorted.length ? sorted[i + 1].pos : a + 2;
  return (a + b) / 2;
}

// The players app loads this as a module script and finds it here.
if (typeof window !== 'undefined') window.wkndScoreEngine = { DEFAULT_RULES, STAT_KEYS, foldGame, livePlays, defaultFreeThrows, nextPos, correction, periodIndex, periodName, isOvertime };
