// "Call the podium": the MVP ballot that runs while the reveal lock is on (lib/mvp-lock.js).
// Pure timing + scoring rules; the rows live in lib/portal-db.js (mvp_ballots / mvp_ballot_bonus).
//
// Two moments, both Manila time at the picks cut-off hour (picks_close_time, 06:00 by default):
//   bonus cut-off — the last regular-season game day. Only the ballot as it stood then earns
//                   Pickmaster bonus points: once those games are played the MVP order is fixed
//                   and could be rebuilt from the public box scores.
//   ballot close  — Finals Game 2's game day, when the MVP is awarded. Until then anyone can still
//                   make or change a ballot for "Who called it".
import { finalsGame2Id } from './picks.js';
import { SEASON_GAMES_PER_TEAM, regularGamesPlayed } from './mvp-lock.js';

const isDone = g => g.status === 'complete' || g.status === 'final';
const ymdOf = g => String(g.date || '').slice(0, 10);

// { ymd, hm } or null when the moment isn't known yet (games not on the schedule).
// override: site setting mvp_bonus_close ('YYYY-MM-DD HH:MM'), for a schedule that can't say.
export function bonusCutoff(games, season, closeTime, override = '') {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})$/.exec(String(override || '').trim());
  if (m) return { ymd: m[1], hm: m[2] };
  const s = String(season);
  const regular = games.filter(g => String(g.season) === s && (g.game_type || 'regular') === 'regular');
  const played = regularGamesPlayed(regular);
  const teams = [...new Set(regular.flatMap(g => [g.team_a_id, g.team_b_id]))].filter(Boolean);
  if (teams.length < 2) return null;
  const left = t => SEASON_GAMES_PER_TEAM - (played[t] || 0);
  // Season done: the cut-off was the last game day (already past).
  if (teams.every(t => left(t) <= 0)) {
    const last = regular.filter(isDone).map(ymdOf).filter(Boolean).sort().pop();
    return last ? { ymd: last, hm: closeTime } : null;
  }
  if (!teams.every(t => left(t) <= 1)) return null; // not the final week yet
  const next = regular.filter(g => !isDone(g)).map(ymdOf).filter(Boolean).sort()[0];
  return next ? { ymd: next, hm: closeTime } : null;
}

export function ballotClose(games, season, closeTime) {
  const s = String(season);
  const shaped = games.filter(g => String(g.season) === s)
    .map(g => ({ id: g.id, season: s, type: g.game_type, ymd: ymdOf(g) }));
  const id = finalsGame2Id(shaped, s);
  const g2 = id && games.find(g => g.id === id);
  return g2 && ymdOf(g2) ? { ymd: ymdOf(g2), hm: closeTime } : null;
}

export function isPast(at, todayYmd, nowHm) {
  return !!at && (at.ymd < todayYmd || (at.ymd === todayYmd && nowHm >= at.hm));
}

// "Sun, Oct 18 · 6:00 AM"
export function fmtMoment(at) {
  if (!at) return '';
  const d = new Date(`${at.ymd}T00:00:00Z`);
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const [h, mi] = at.hm.split(':').map(Number);
  return `${day} · ${((h + 11) % 12) + 1}:${String(mi).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// Bonus points: +1 for each player in the exact spot (0–3). podium = [id1, id2, id3].
export function podiumPoints(ballot, podium) {
  if (!ballot || !podium) return 0;
  return ['p1', 'p2', 'p3'].reduce((n, k, i) => n + (ballot[k] && ballot[k] === podium[i] ? 1 : 0), 0);
}
