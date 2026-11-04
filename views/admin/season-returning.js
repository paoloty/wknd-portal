// /admin/season/returning: Season → Sign-ups → Returning (rewrite, 2026-11). Last season's players
// against this season's sign-ups, team by team, with the teams missing the most players first:
// that's where outreach helps.
import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';
import { pageHeader, dataGrid, badge, avatar } from './ui.js';

const STATUS = { waitlisted: ['Waitlisted', 'amber'], confirmed: ['Confirmed', 'green'], rejected: ['Rejected', 'gray'], withdrawn: ['Withdrawn', 'red'] };

// Signed up, but asked for the shuffle: not holding their old spot.
const wantsShuffle = p => !!p.signup && (p.signup.status === 'waitlisted' || p.signup.status === 'confirmed') && p.signup.team_pref === 'reshuffle';
const rowPriority = p => (!p.signup ? 0 : wantsShuffle(p) ? 2 : 1);

// players: [{ id, name, team_id, team_name, team_color, signup: signupRowOrNull }]
export function adminReturningBody({ prevSeason = '', sigSeason = '', players = [], query = {} } = {}) {
  const signedUp = players.filter(p => p.signup).length;
  const pct = players.length ? Math.round((signedUp / players.length) * 100) : 0;

  const missingByTeam = {};
  for (const p of players) if (!p.signup) missingByTeam[p.team_id || ''] = (missingByTeam[p.team_id || ''] || 0) + 1;
  const rows = players.map(p => ({ ...p, display: displayPlayerName(p.name), teamLabel: p.team_name || 'No team' })).sort((a, b) =>
    (missingByTeam[b.team_id || ''] || 0) - (missingByTeam[a.team_id || ''] || 0)
    || a.teamLabel.localeCompare(b.teamLabel)
    || rowPriority(a) - rowPriority(b)
    || a.display.localeCompare(b.display));
  const teams = [...new Set(rows.map(r => r.teamLabel))];
  const teamCount = label => {
    const list = rows.filter(r => r.teamLabel === label);
    return `${label} · ${list.filter(r => r.signup).length} of ${list.length} signed up`;
  };

  const grid = dataGrid({
    id: 'returning', baseUrl: '/admin/season/returning', query, minimal: true, perPage: 100,
    rows, rowKey: p => p.id, noun: ['player', 'players'],
    views: [
      { key: 'all', label: 'All', test: () => true },
      { key: 'missing', label: 'Not signed up', test: p => !p.signup },
      { key: 'signed', label: 'Signed up', test: p => !!p.signup },
      { key: 'shuffle', label: 'Want the shuffle', test: wantsShuffle },
    ],
    search: { placeholder: 'Search player', text: p => p.display },
    filters: teams.length > 1 ? [{ key: 'team', label: 'Team', options: teams.map(t => [t, t]), test: (p, v) => p.teamLabel === v }] : [],
    groupBy: p => teamCount(p.teamLabel),
    columns: [
      { key: 'name', label: 'Player', primary: true, cell: p => `<span class="aui-who">${avatar(p.display, p.team_color || '', { size: 28, playerId: p.id })}<span class="aui-cell__title">${escHtml(p.display)}</span></span>` },
      { key: 'status', label: 'Status', bare: true, cell: p => `<span class="aui-cell__badges">${p.signup ? badge(...(STATUS[p.signup.status] || [p.signup.status, 'gray'])) : badge('Not signed up', 'gray')}${wantsShuffle(p) ? badge('Wants shuffle', 'blue') : ''}</span>` },
    ],
    rowHref: p => (p.signup?.id ? `/admin/season/signups/${p.signup.id}` : `/admin/players/${p.id}`),
    empty: { title: `No players found for Season ${prevSeason}` },
  });

  return `<div class="aui-page">
    ${pageHeader({ title: 'Returning', sub: `${signedUp} of ${players.length} Season ${prevSeason} players signed up for Season ${sigSeason} (${pct}%).` })}
    ${grid}
  </div>`;
}
