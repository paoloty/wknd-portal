// Playoff mode: the site's look while the playoffs run. One phase drives every surface (the
// header logo, the amber header line + page glow, the homepage hero), so they can't disagree:
//   'playoffs' — semis on the schedule: H3 outline-ribbon logo, scoreboard hero
//   'finals'   — a Finals game on the schedule: trophy-ball logo, scoreboard hero (Finals)
//   'champion' — CHAMPION_DAYS from the Finals clincher: trophy-ball logo, champion hero
//   null       — the normal site
//
// Admin override (site_settings.playoff_mode, /admin/site): 'auto' (default) follows the
// schedule; 'playoffs' / 'finals' / 'champion' force a phase; 'off' forces the normal site.
// It applies to the current portal season only.
import { getAllGames, getSetting, getPortalCurrentSeason } from './portal-db.js';
import { manilaTodayStr } from '../views/utils.js';

export const PLAYOFF_MODES = ['auto', 'playoffs', 'finals', 'champion', 'off'];
export const PLAYOFF_PHASES = ['playoffs', 'finals', 'champion'];
export const CHAMPION_DAYS = 7;

const isPlayed = g => (g.status === 'complete' || g.status === 'final') && (Number(g.team_a_score) + Number(g.team_b_score)) > 0;
const ymd = d => String(d || '').slice(0, 10);
const dayDiff = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

export function playoffModeSetting() {
  const m = getSetting('playoff_mode', 'auto');
  return PLAYOFF_MODES.includes(m) ? m : 'auto';
}

// The automatic rule alone: { phase, note }. Games under review don't count as played, so a
// Finals result pulled for review can't start champion mode early.
export function playoffAutoPhase(season, today = manilaTodayStr()) {
  const s = String(season);
  const post = getAllGames().filter(g => String(g.season) === s && (g.game_type === 'playoff' || g.game_type === 'finals'));
  if (!post.length) return { phase: null, note: 'Off: no playoff games on the schedule yet' };

  const finals = post.filter(g => g.game_type === 'finals')
    .sort((a, b) => ymd(a.date).localeCompare(ymd(b.date)) || String(a.id).localeCompare(String(b.id)));
  const wins = {};
  let clincher = null;
  for (const g of finals) {
    if (g.under_review || !isPlayed(g)) continue;
    const w = Number(g.team_a_score) > Number(g.team_b_score) ? g.team_a_id : g.team_b_id;
    wins[w] = (wins[w] || 0) + 1;
    if (wins[w] === 2) { clincher = g; break; }
  }
  if (clincher) {
    const left = CHAMPION_DAYS - dayDiff(ymd(clincher.date), today);
    return left > 0
      ? { phase: 'champion', note: `Champion: the Finals are decided, ${left} day${left === 1 ? '' : 's'} of champion mode left` }
      : { phase: null, note: 'Off: champion week is over' };
  }
  if (finals.length) return { phase: 'finals', note: 'Finals: a Finals game is on the schedule' };
  return { phase: 'playoffs', note: 'Playoffs: playoff games are on the schedule' };
}

// { season, mode, phase, auto } — phase is what the site shows right now.
export function playoffModeState(season = getPortalCurrentSeason()) {
  const auto = season ? playoffAutoPhase(season) : { phase: null, note: 'Off: no current season' };
  const mode = playoffModeSetting();
  const phase = mode === 'auto' ? auto.phase : mode === 'off' ? null : mode;
  return { season: season ? String(season) : '', mode, phase, auto };
}

export function playoffPhase(season = getPortalCurrentSeason()) {
  return playoffModeState(season).phase;
}
