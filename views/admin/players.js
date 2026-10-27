// /admin/players: every player (admin redesign, 2026-10-15). Rebuilt from scratch on
// views/admin/ui.js: one data grid (search, Active / Inactive / All / No photo, Team and
// Season filters, sortable OVR and games) with Recompute ratings in the header. Each row
// opens /admin/players/:id (views/admin/player-detail.js). Browser bits:
// public/admin-players.js.
import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';
import { pageHeader, dataGrid, badge, button, avatar } from './ui.js';

const attr = s => escHtml(String(s ?? ''));

export function parsePositions(raw) {
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || []);
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch { return []; }
}

// players: getPlayersWithRatings(season) rows. gpById: games played in that season (or all
// time). canViewAs: player ids with an approved account (super admin only, else empty).
export function adminPlayersBody({ players = [], seasons = [], season = '', teams = [], gpById = {}, colorByTeam = {}, canViewAs = new Set(), query = {}, ver = '' } = {}) {
  const rows = players.map(p => ({
    ...p,
    display: displayPlayerName(p.name),
    pos: parsePositions(p.positions),
    gp: Number(gpById[p.id] || 0),
    inactive: p.status === 'inactive',
  }));
  const active = rows.filter(r => !r.inactive).length;
  const seasonLabel = season ? `Season ${season}` : 'all time';
  const enc = encodeURIComponent;

  const grid = dataGrid({
    id: 'players', baseUrl: '/admin/players', query,
    rows, rowKey: r => r.id, noun: ['player', 'players'], perPage: 50,
    views: [
      { key: 'active', label: 'Active', test: r => !r.inactive },
      { key: 'inactive', label: 'Inactive', test: r => r.inactive },
      { key: 'all', label: 'All', test: () => true },
      { key: 'nophoto', label: 'No photo', test: r => !r.inactive && !r.picture_url },
    ],
    // Also matches a player's GA User-ID (server.js gaUserId), to put a name to one from GA.
    search: { placeholder: 'Search name, team, number or GA ID', text: r => `${r.display} ${r.team_name || ''} #${r.number || ''} ${r.ga || ''}` },
    filters: [
      { key: 'team', label: 'Team', options: [...teams.map(t => [t.name, t.name]), ['__none', 'No team']], test: (r, v) => (v === '__none' ? !r.team_name : r.team_name === v) },
      // Season only picks which ratings and games the grid shows (the server reads it).
      { key: 'season', label: 'Season', options: seasons.map(s => [String(s), `Season ${s}`]), test: () => true },
    ],
    defaultSort: '-ovr',
    columns: [
      { key: 'name', label: 'Player', primary: true, sort: r => r.display.toLowerCase(), cell: r => `<span class="aui-who">${avatar(r.display, colorByTeam[r.team_name] || '', { size: 32, playerId: r.id })}<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(r.display)}</span><span class="aui-cell__sub">${escHtml(r.team_name || 'No team')}</span></span></span>` },
      { key: 'number', label: '#', num: true, nowrap: true, sort: r => (r.number === '' || r.number == null ? null : (Number(r.number) || 0)), cell: r => (r.number !== '' && r.number != null ? `<span class="aui-num">${escHtml(r.number)}</span>` : '<span class="aui-muted">—</span>') },
      { key: 'pos', label: 'Positions', phone: false, cell: r => (r.pos.length ? `<span class="aui-cell__badges">${r.pos.map(p => badge(p, 'gray')).join('')}</span>` : '<span class="aui-muted">—</span>') },
      { key: 'gp', label: 'GP', num: true, sort: r => r.gp, cell: r => `<span class="aui-num">${r.gp}</span>` },
      { key: 'ovr', label: 'OVR', num: true, sort: r => r.eff_overall ?? null, cell: r => (r.eff_overall != null ? `<span class="apl-ovr apl-ovr--sm">${escHtml(r.eff_overall)}</span>` : '<span class="aui-muted">—</span>') },
      { key: 'status', label: 'Status', bare: true, phone: false, sort: r => (r.inactive ? 1 : 0), cell: r => badge(r.inactive ? 'Inactive' : 'Active', r.inactive ? 'gray' : 'green') },
    ],
    rowHref: r => `/admin/players/${enc(r.id)}`,
    rowMenu: r => [
      { label: 'Open', href: `/admin/players/${enc(r.id)}` },
      { label: 'Ratings and stats', href: `/admin/players/${enc(r.id)}?tab=ratings${season ? `&season=${enc(season)}` : ''}` },
      { label: 'Public profile', href: `/players/${enc(r.id)}`, external: true },
      canViewAs.has(r.id) ? 'sep' : null,
      canViewAs.has(r.id) ? { label: 'View as this player', post: `/admin/impersonate/${enc(r.id)}`, then: '/me', done: `Viewing as ${r.display}`,
        confirm: { title: `View the site as ${r.display}?`, body: 'Read-only. Stop from the bar at the top of the site.', send: 'View as' } } : null,
    ],
    empty: { title: 'No players yet', sub: 'Players are created when a registration is approved.' },
  });

  const recompute = button('Recompute ratings', { kind: 'secondary', attrs: `data-apl-recompute-all data-season="${attr(season)}" data-title="Recompute ratings for ${attr(seasonLabel)}?" data-body="Rebuilds every player’s ratings from their games. Overrides you set stay as they are."` });

  return `<div class="aui-page">
    ${pageHeader({ title: 'Players', sub: `${active} active · ${rows.length} in all · ratings for ${seasonLabel}`, actionsHtml: recompute })}
    ${grid}
  </div>
  <script src="/admin-players.js${ver ? `?v=${ver}` : ''}" defer></script>`;
}
