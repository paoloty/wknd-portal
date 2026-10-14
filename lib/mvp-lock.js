// MVP reveal lock: the Season MVP order stays secret from the moment the season has a
// playoff/finals game on the schedule until Finals Game 2 is complete (the award is handed
// out there). Every MVP surface asks isMvpLocked(season) so they can't disagree: /mvp,
// the homepage sidebar, the mega menu, share cards, OG tags/images and the AI writeups.
//
// Admin override (site_settings.mvp_reveal_mode, /admin/visibility): 'auto' (default),
// 'locked' or 'revealed'. It only applies to the current portal season; past seasons
// always follow the automatic rule.
import { getAllGames, getSetting, getPortalCurrentSeason } from './portal-db.js';
import { finalsGame2Id } from './picks.js';

export const MVP_REVEAL_MODES = ['auto', 'locked', 'revealed'];

export function mvpRevealMode() {
  const m = getSetting('mvp_reveal_mode', 'auto');
  return MVP_REVEAL_MODES.includes(m) ? m : 'auto';
}

// Regular-season games per team (double round robin). The final-week rule below and the
// MVP score's games-played ratio (server.js) both use it.
export const SEASON_GAMES_PER_TEAM = 6;

const isDone = g => g.status === 'complete' || g.status === 'final';

// Regular-season games each team has finished: { teamId: n }.
export function regularGamesPlayed(games) {
  const n = {};
  for (const g of games) {
    if ((g.game_type || 'regular') !== 'regular' || !isDone(g)) continue;
    for (const t of [g.team_a_id, g.team_b_id]) n[t] = (n[t] || 0) + 1;
  }
  return n;
}

// The automatic rule alone. The lock starts in the regular season's final week (every team
// has one game left, so players can't see the gaps they'd be chasing), or on any non-regular
// game being scheduled, whichever comes first. Under-review games count here, so a game
// pulled for review can't unlock the race early. Done = 'complete' or 'final' (the admin
// app writes both; Season 3's Game 2 is 'final').
export function mvpAutoLock(season) {
  const s = String(season);
  const games = getAllGames().filter(g => String(g.season) === s);
  const played = regularGamesPlayed(games);
  const teams = [...new Set(games.flatMap(g => [g.team_a_id, g.team_b_id]))].filter(Boolean);
  const finalWeek = teams.length >= 2 && teams.every(t => (played[t] || 0) >= SEASON_GAMES_PER_TEAM - 1);
  const postseason = games.some(g => (g.game_type || 'regular') !== 'regular');
  if (!finalWeek && !postseason) {
    return { locked: false, note: 'Not locked: more than one regular-season game left' };
  }
  const pickShaped = games.map(g => ({ id: g.id, season: s, type: g.game_type, ymd: String(g.date || '').slice(0, 10) }));
  const g2 = games.find(g => g.id === finalsGame2Id(pickShaped, s));
  const done = g2 && !g2.under_review && isDone(g2);
  return done
    ? { locked: false, note: 'Revealed: Finals Game 2 is complete' }
    : { locked: true, note: `Locked: ${postseason ? 'playoffs scheduled' : 'final regular-season week'}, reveals after Finals Game 2` };
}

// { season, mode, locked, auto } — mode is the override in force for this season.
export function mvpLockState(season = getPortalCurrentSeason()) {
  const s = String(season);
  const auto = mvpAutoLock(s);
  const mode = s === String(getPortalCurrentSeason()) ? mvpRevealMode() : 'auto';
  const locked = mode === 'locked' ? true : mode === 'revealed' ? false : auto.locked;
  return { season: s, mode, locked, auto };
}

export function isMvpLocked(season = getPortalCurrentSeason()) {
  return mvpLockState(season).locked;
}

// Finalists while locked: the top 3 by `score`, re-sorted alphabetically (by LASTNAME, the
// stored "LASTNAME, Firstname" order) so the list order says nothing about the vote.
export function mvpFinalists(candidates, score, nameOf = c => c.name) {
  return [...candidates]
    .sort((a, b) => score(b) - score(a))
    .slice(0, 3)
    .sort((a, b) => String(nameOf(a)).localeCompare(String(nameOf(b))));
}
