// ── "Who wins?" — odds, pick windows, records ───────────────────────────────
// Pure functions only (same pattern as lib/badges.js): server.js fetches games, picks and
// per-game settings, normalises games with toPickGame(), and passes plain data in.
//
// Odds model, agreed with Paolo 2026-10-07 — plain arithmetic, no AI, recomputed on every
// render from results that existed BEFORE the game's date (so a finished game keeps the
// odds it had going in, which is what "the odds called it" / "upset" are judged against):
//   1. each team's average points margin per game this season,
//   2. damped toward 0 while the sample is small: × n / (n + 3) — counts half after 3 games,
//   3. plus half of the average head-to-head margin over their last 5 meetings (any season),
//   4. projected margin → win chance with a normal curve, σ = 12 points (a typical game's
//      swing around its expected margin in this league).
// No odds until BOTH teams have played this season — last season's numbers would mislead
// once rosters change.

const SHRINK_GAMES = 3;
const H2H_WEIGHT = 0.5;
const H2H_MEETINGS = 5;
const SWING = 12;

// Default game-day cut-off (Manila time, HH:MM) when no admin setting exists. Scheduled games
// carry a date but no tip-off time, so without this picks would stay open mid-game.
export const PICKS_CLOSE_DEFAULT = '06:00';

// Abramowitz–Stegun 7.1.26 erf approximation (error < 1.5e-7) — plenty for a percentage.
function phi(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

const avg = arr => arr.reduce((s, v) => s + v, 0) / arr.length;

// Compact game shape everything below works on. `played` = a final score exists and the
// game is public (not a draft under review).
export function toPickGame(g, ymdOf) {
  const sa = Number(g.team_a_score) || 0, sb = Number(g.team_b_score) || 0;
  return {
    id: g.id, ymd: ymdOf(g.date), season: String(g.season ?? ''), type: g.game_type || 'regular',
    a: g.team_a_name, b: g.team_b_name, sa, sb,
    played: !g.scheduled && !g.under_review && (g.status === 'final' || g.status === 'complete') && sa + sb > 0 && sa !== sb,
  };
}

// Odds for `game` from the played games dated before it. null when there isn't enough data.
export function computeOdds(game, played) {
  const before = played.filter(g => g.ymd && g.ymd < game.ymd && g.id !== game.id);
  const marginsFor = team => before
    .filter(g => g.season === game.season && (g.a === team || g.b === team))
    .map(g => (g.a === team ? g.sa - g.sb : g.sb - g.sa));
  const mA = marginsFor(game.a), mB = marginsFor(game.b);
  if (!mA.length || !mB.length) return null;

  const weight = n => n / (n + SHRINK_GAMES);
  const avgA = avg(mA), avgB = avg(mB);
  const rA = avgA * weight(mA.length), rB = avgB * weight(mB.length);
  const meetings = before
    .filter(g => (g.a === game.a && g.b === game.b) || (g.a === game.b && g.b === game.a))
    .sort((x, y) => y.ymd.localeCompare(x.ymd))
    .slice(0, H2H_MEETINGS);
  const h2hAvg = meetings.length ? avg(meetings.map(g => (g.a === game.a ? g.sa - g.sb : g.sb - g.sa))) : 0;
  const h2hAdj = h2hAvg * H2H_WEIGHT;
  const margin = rA - rB + h2hAdj;
  const pctA = Math.min(99, Math.max(1, Math.round(phi(margin / SWING) * 100)));
  return {
    pctA, pctB: 100 - pctA,
    fav: pctA === 50 ? null : (pctA > 50 ? 'a' : 'b'),
    margin,
    // Everything the "How it's figured" panel shows, so it can't disagree with the number.
    steps: {
      gamesA: mA.length, gamesB: mB.length, avgA, avgB,
      weightA: weight(mA.length), weightB: weight(mB.length), rA, rB,
      meetings: meetings.length, h2hAvg, h2hAdj, swing: SWING,
    },
  };
}

// Manila "HH:MM" right now — the cut-off is compared as a string, same zero-padded format.
export function manilaHmNow() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(11, 16);
}

// Is picking closed for this (still upcoming) game? Admin override first, then the game-day
// cut-off. `setting` is the game's game_pick_settings row (or undefined).
export function picksClosedFor(game, setting, { todayYmd, nowHm, closeTime }) {
  if (setting?.closed === 1) return true;
  if (setting?.closed === 0) return false;
  if (!game.ymd || game.ymd < todayYmd) return true;
  return game.ymd === todayYmd && nowHm >= (closeTime || PICKS_CLOSE_DEFAULT);
}

// ── Records ──────────────────────────────────────────────────────────────────
// `settled` = played games (one season, or all) with their pre-game odds attached:
// [{ ...pickGame, odds, winner: 'a'|'b' }]. Picks on games not in `settled` are ignored.

export function settleGames(played, oddsById) {
  return played
    .map(g => ({ ...g, odds: oddsById[g.id] || null, winner: g.sa > g.sb ? 'a' : 'b' }))
    .sort((x, y) => x.ymd.localeCompare(y.ymd) || String(x.id).localeCompare(String(y.id)));
}

const isUpset = g => !!(g.odds?.fav && g.odds.fav !== g.winner);

// ── Pickmaster scoring (agreed with Paolo 2026-10-10) ────────────────────────
// Net points: +1 correct, −1 wrong, 0 for a game you skipped. A coin-flipper drifts to 0 and a
// skipped game costs nothing, so there's no minimum-picks rule and a late joiner can still win.
//
// "Beat the Odds" points (own board, no prize; tiebreak step 4): a correct pick earns
// 2 × (1 − p) and a wrong one costs 2 × p, where p is the picked side's pre-game chance clamped
// to 35–65% — the model backtested at coin-flip level, so its extremes are not trusted. No odds
// for a game (too early, or hidden on that game) = ±1, the same as a 50/50.
const ODDS_FLOOR = 0.35, ODDS_CEIL = 0.65;
function oddsPoints(side, ok, odds) {
  if (!odds?.pctA) return ok ? 1 : -1;
  const p = Math.min(ODDS_CEIL, Math.max(ODDS_FLOOR, (side === 'a' ? odds.pctA : odds.pctB) / 100));
  return ok ? 2 * (1 - p) : -2 * p;
}

// { [playerId]: { picks, correct, wrong, net, pct, streak, best, upsets, oddsPts,
//                 results: [{ gameId, ymd, side, correct, upset }] } }
// `scoreOdds` = { [gameId]: odds } frozen at pick close, used for oddsPts only (falls back to g.odds).
export function buildPickRecords(picks, settled, scoreOdds = null) {
  const byGame = new Map(settled.map((g, i) => [g.id, { g, i }]));
  const perPlayer = {};
  for (const p of picks) {
    const hit = byGame.get(p.game_id);
    if (!hit) continue;
    (perPlayer[p.player_id] ??= []).push({ ...hit, side: p.side });
  }
  const out = {};
  for (const [playerId, list] of Object.entries(perPlayer)) {
    // Settled order is date then id; streaks run in that order (same-day games count in sequence).
    list.sort((x, y) => x.i - y.i);
    let correct = 0, upsets = 0, run = 0, best = 0, odds = 0;
    const results = list.map(({ g, side }) => {
      const ok = side === g.winner;
      const upset = ok && isUpset(g);
      if (ok) { correct++; run++; best = Math.max(best, run); if (upset) upsets++; } else run = 0;
      odds += oddsPoints(side, ok, scoreOdds ? scoreOdds[g.id] : g.odds);
      return { gameId: g.id, ymd: g.ymd, side, correct: ok, upset };
    });
    const wrong = list.length - correct;
    out[playerId] = {
      picks: list.length, correct, wrong, net: correct - wrong, pct: Math.round((correct / list.length) * 100),
      streak: run, best, upsets, oddsPts: Math.round(odds * 100) / 100, results,
    };
  }
  return out;
}

// Prize tiebreak order. Step 0 is the score itself; once a step splits a group, each part that
// is still tied starts again at head-to-head — two players settle it between themselves first.
//   1 head-to-head: correct calls on games where the tied players picked opposite sides
//   2 more correct picks   3 longest streak   4 Beat the Odds points
//   5 Finals Game 1 margin guess (closest; `guesses` = { playerId: |guess − margin| }, none yet)
//   6 still level → co-Pickmasters
export const TIEBREAK_STEPS = ['Points', 'Head-to-head', 'More correct picks', 'Longest streak', 'Beat the Odds', 'Finals margin guess'];

function headToHead(group) {
  const sides = group.map(r => new Map(r.results.map(x => [x.gameId, x])));
  return group.map((r, i) => r.results.reduce((w, x) => {
    if (!x.correct) return w;
    return w + sides.filter((m, j) => j !== i && m.get(x.gameId) && m.get(x.gameId).side !== x.side).length;
  }, 0));
}

// Orders rows by the full chain. Sets r.sepStep on each row = the step that put it below the row
// above (0 = fewer points; undefined = first row or still fully tied → co-Pickmaster territory).
export function pickmasterOrder(rows, guesses = {}) {
  const keys = [
    g => g.map(r => r.net),
    headToHead,
    g => g.map(r => r.correct),
    g => g.map(r => r.best),
    g => g.map(r => r.oddsPts),
    g => g.map(r => -(guesses[r.playerId] ?? Infinity)),
  ];
  const order = (group, from) => {
    if (group.length < 2) return group;
    for (let s = from; s < keys.length; s++) {
      const vals = keys[s](group);
      const distinct = [...new Set(vals)].sort((a, b) => b - a);
      if (distinct.length < 2) continue;
      return distinct.flatMap((v, bi) => {
        const part = order(group.filter((_, i) => vals[i] === v), 1);
        if (bi > 0) part[0].sepStep = s;
        return part;
      });
    }
    return group;
  };
  rows.forEach(r => { delete r.sepStep; });
  return order(rows, 0);
}

// The season board. Everyone with a settled pick is on it. Rank is shared by points during the
// season (2, 2, 4); row order within a tie already follows the prize tiebreaks. `week` = points
// from the latest game day, `trend` = places moved since the game day before (null = new).
export function pickLeaderboard(records) {
  const rows = pickmasterOrder(Object.entries(records).map(([playerId, r]) => ({ playerId, ...r })));
  const shareRank = (list, val) => list.forEach((r, i) => {
    r._rk = i && val(list[i - 1]) === val(r) ? list[i - 1]._rk : i + 1;
  });
  shareRank(rows, r => r.net);
  rows.forEach(r => { r.rank = r._rk; delete r._rk; });

  const lastYmd = rows.reduce((m, r) => r.results.reduce((mm, x) => (x.ymd > mm ? x.ymd : mm), m), '');
  for (const r of rows) {
    const latest = r.results.filter(x => x.ymd === lastYmd);
    r.week = latest.reduce((s, x) => s + (x.correct ? 1 : -1), 0);
    r.weekPicks = latest.length;
    r.prevNet = r.net - r.week;
    r.hadPrev = r.picks > latest.length;
  }
  const prev = rows.filter(r => r.hadPrev).sort((x, y) => y.prevNet - x.prevNet);
  shareRank(prev, r => r.prevNet);
  for (const r of rows) {
    r.trend = r.hadPrev ? r._rk - r.rank : null;
    delete r._rk; delete r.prevNet; delete r.hadPrev;
  }

  const oddsRows = [...rows].sort((x, y) => y.oddsPts - x.oddsPts || y.net - x.net || y.upsets - x.upsets);
  oddsRows.forEach((r, i) => { r.oddsRank = i && oddsRows[i - 1].oddsPts === r.oddsPts ? oddsRows[i - 1].oddsRank : i + 1; });

  // minPicks stays for callers that still read it: one settled pick puts you on the board.
  return { rows, oddsRows, lastYmd, minPicks: 1 };
}

// Who leads, and how: the chain step that put #1 above #2 when they're level on points.
export function pickmasterLeader(board) {
  const [top, next] = board.rows;
  if (!top) return null;
  const level = board.rows.filter(r => r.net === top.net).length;
  const decidedBy = next && next.net === top.net ? (next.sepStep ? TIEBREAK_STEPS[next.sepStep] : 'shared') : null;
  return { ...top, level, decidedBy };
}

export const fmtPts = n => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

// How the odds and the crowd did across settled games that had picks. Toss-ups (50/50 odds,
// or an even fan split) don't count either way.
export function callerRecords(settled, picks) {
  const counts = {};
  for (const p of picks) {
    const c = (counts[p.game_id] ??= { a: 0, b: 0 });
    c[p.side]++;
  }
  const odds = { called: 0, of: 0 }, fans = { called: 0, of: 0 };
  for (const g of settled) {
    const c = counts[g.id];
    if (!c || c.a + c.b === 0) continue;
    if (g.odds?.fav) { odds.of++; if (g.odds.fav === g.winner) odds.called++; }
    if (c.a !== c.b) { fans.of++; if ((c.a > c.b ? 'a' : 'b') === g.winner) fans.called++; }
  }
  return { odds, fans, counts };
}

// "Who called it?" summary for one settled game. `gamePicks` = that game's picks with names.
export function calledItSummary(g, gamePicks, myPlayerId = null) {
  const a = gamePicks.filter(p => p.side === 'a').length, b = gamePicks.length - a;
  const total = a + b;
  const mine = myPlayerId ? gamePicks.find(p => p.player_id === myPlayerId) : null;
  return {
    game: g,
    total,
    pctWinner: total ? Math.round(((g.winner === 'a' ? a : b) / total) * 100) : 0,
    fansCalled: total > 0 && a !== b && (a > b ? 'a' : 'b') === g.winner,
    oddsCalled: !!(g.odds?.fav && g.odds.fav === g.winner),
    upset: isUpset(g),
    calledIt: gamePicks.filter(p => p.side === g.winner),
    myPick: mine ? mine.side : null,
  };
}
