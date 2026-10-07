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

// { [playerId]: { picks, correct, pct, streak, best, upsets, results: [{ gameId, correct, upset }] } }
export function buildPickRecords(picks, settled) {
  const byGame = new Map(settled.map((g, i) => [g.id, { g, i }]));
  const perPlayer = {};
  for (const p of picks) {
    const hit = byGame.get(p.game_id);
    if (!hit) continue;
    (perPlayer[p.player_id] ??= []).push({ ...hit, side: p.side });
  }
  const out = {};
  for (const [playerId, list] of Object.entries(perPlayer)) {
    list.sort((x, y) => x.i - y.i);
    let correct = 0, upsets = 0, run = 0, best = 0;
    const results = list.map(({ g, side }) => {
      const ok = side === g.winner;
      const upset = ok && isUpset(g);
      if (ok) { correct++; run++; best = Math.max(best, run); if (upset) upsets++; } else run = 0;
      return { gameId: g.id, correct: ok, upset };
    });
    out[playerId] = { picks: list.length, correct, pct: Math.round((correct / list.length) * 100), streak: run, best, upsets, results };
  }
  return out;
}

// Ranking needs a minimum so 2-for-2 can't top a season: at least 3 picks and at least half
// of the season's settled games that had any picks at all.
export function pickLeaderboard(records, pickableGames) {
  const minPicks = Math.max(3, Math.ceil(pickableGames * 0.5));
  const rows = Object.entries(records)
    .filter(([, r]) => r.picks >= minPicks)
    .map(([playerId, r]) => ({ playerId, ...r }))
    .sort((x, y) => (y.correct / y.picks) - (x.correct / x.picks) || y.correct - x.correct || y.upsets - x.upsets || y.best - x.best);
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.rank = prev && prev.correct === r.correct && prev.picks === r.picks && prev.upsets === r.upsets ? prev.rank : i + 1;
  });
  return { rows, minPicks };
}

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
