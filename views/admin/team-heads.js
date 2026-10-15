// /admin/team-heads: who heads each team (admin redesign, 2026-10-15; rebuilt on ui.js).
// A team head is a normal registered player granted one extra privilege, scoped to their
// team, not folded into is_admin/isElevatedPlayer (docs/agents/features/admin-core.md).
// It gates /fines (file and vote on cases) and /team (the team's payment status).
// The list is short, so it's grouped under team headings (no Team column), and search,
// filters and density only show once it passes 15 heads.
import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';
import { pageHeader, dataGrid, avatar, button, drawer, field, playerPicker } from './ui.js';

const fmtDate = ts => (ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

export function adminTeamHeadsBody({ heads = [], teams = [], players = [], teamColor = {}, query = {} } = {}) {
  const rows = heads.map(h => ({ ...h, name: displayPlayerName(h.player_name), color: teamColor[h.team_id] || '' }));
  const teamName = Object.fromEntries(teams.map(t => [t.id, t.name]));
  const long = rows.length > 15;
  const addBtn = button('+ Add a head', { kind: 'primary', attrs: 'data-drawer-open="add-head"' });

  const grid = dataGrid({
    id: 'heads', baseUrl: '/admin/team-heads', query,
    rows, rowKey: r => r.id, noun: ['head', 'heads'],
    minimal: !long,
    search: long ? { placeholder: 'Search heads', text: r => `${r.name} ${r.team_name}` } : null,
    filters: long && teams.length > 1 ? [{ key: 'team', label: 'Team', options: teams.map(t => [t.id, t.name]), test: (r, v) => r.team_id === v }] : [],
    // Rows come in team order; grouped under team headings unless sorted by a column.
    groupBy: !query.sort ? r => r.team_name : null,
    columns: [
      { key: 'name', label: 'Head', primary: true, sort: r => r.name.toLowerCase(),
        cell: r => `${avatar(r.name, r.color, { playerId: r.player_id })}<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(r.name)}</span>${query.sort ? `<span class="aui-cell__sub">${escHtml(r.team_name)}</span>` : ''}</span>` },
      { key: 'since', label: 'Head since', num: true, sort: r => r.created_at || 0, cell: r => escHtml(fmtDate(r.created_at)) || '<span class="aui-muted">—</span>' },
    ],
    rowHref: r => `/admin/players/${r.player_id}`,
    rowMenu: r => [
      { label: 'Open player', href: `/admin/players/${r.player_id}` },
      'sep',
      { label: 'Revoke access…', danger: true, post: `/admin/team-heads/${r.id}/revoke`, done: `${r.name} is no longer a ${r.team_name} head.`,
        confirm: { title: `Revoke ${r.name}’s head access?`, body: `They can no longer file or vote on fines, or see ${r.team_name}’s payment status. Their player account is unchanged.`, send: 'Revoke' } },
    ],
    actionsHtml: long ? addBtn : '',
    empty: { title: 'No team heads yet', sub: 'Add one with “+ Add a head”.' },
  });

  const add = drawer({
    id: 'add-head', eyebrow: 'Team heads', title: 'Add a head',
    bodyHtml: `<form id="add-head-form" class="aui-stack ath-form" data-json-action="/admin/team-heads" data-done="Head added.">
      ${field({ label: 'Team', name: 'teamId', type: 'select', options: teams.map(t => [t.id, t.name]) })}
      ${playerPicker({ name: 'playerId', label: 'Player', multiple: false, placeholder: 'Search players',
        options: players.map(p => ({ id: p.id, name: displayPlayerName(p.name), color: teamColor[p.team_id] || '', meta: teamName[p.team_id] || '' })) })}
      <p class="aui-field__help ath-help">Heads log in with their normal player account; there’s no separate password.</p>
    </form>`,
    footerHtml: `${button('Cancel', { kind: 'ghost', attrs: 'data-drawer-close' })}${button('Add head', { kind: 'primary', type: 'submit', attrs: 'form="add-head-form"' })}`,
  });

  const teamsN = new Set(rows.map(r => r.team_id)).size;
  return `<div class="aui-page">
    ${pageHeader({
      title: 'Team heads',
      sub: `${rows.length} ${rows.length === 1 ? 'head' : 'heads'} across ${teamsN} ${teamsN === 1 ? 'team' : 'teams'}. They file and vote on fines at /fines and see their team’s payments at /team.`,
      actionsHtml: long ? '' : addBtn,
    })}
    ${grid}
    ${add}
  </div>`;
}
