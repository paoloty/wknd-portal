// /admin/team-heads: who heads each team (admin redesign, 2026-10-15; rebuilt on ui.js).
// A team head is a normal registered player granted one extra privilege, scoped to their
// team, not folded into is_admin/isElevatedPlayer (docs/agents/features/admin-core.md).
// It gates /fines (file and vote on cases) and /team (the team's payment status).
import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';
import { pageHeader, dataGrid, avatar, button, banner, drawer, field, playerPicker } from './ui.js';

const fmtDate = ts => (ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

export function adminTeamHeadsBody({ heads = [], teams = [], players = [], teamColor = {}, query = {} } = {}) {
  const rows = heads.map(h => ({ ...h, name: displayPlayerName(h.player_name), color: teamColor[h.team_id] || '' }));
  const teamName = Object.fromEntries(teams.map(t => [t.id, t.name]));

  const grid = dataGrid({
    id: 'heads', baseUrl: '/admin/team-heads', query,
    rows, rowKey: r => r.id, noun: ['head', 'heads'],
    search: { placeholder: 'Search heads', text: r => `${r.name} ${r.team_name}` },
    filters: teams.length > 1 ? [{ key: 'team', label: 'Team', options: teams.map(t => [t.id, t.name]), test: (r, v) => r.team_id === v }] : [],
    defaultSort: 'team',
    // Grouped under team headings only while sorted by team.
    groupBy: !query.sort || String(query.sort).replace('-', '') === 'team' ? r => r.team_name : null,
    columns: [
      { key: 'name', label: 'Head', primary: true, sort: r => r.name.toLowerCase(),
        cell: r => `${avatar(r.name, r.color, { playerId: r.player_id })}<span class="aui-cell__title">${escHtml(r.name)}</span>` },
      { key: 'team', label: 'Team', sort: r => `${String(r.team_name).padEnd(20)}${r.name}`, bare: true,
        cell: r => `<span class="aui-dot" style="background:${/^#[0-9a-f]{3,8}$/i.test(r.color) ? r.color : '#4a5263'}"></span>${escHtml(r.team_name)}` },
      { key: 'since', label: 'Head since', num: true, sort: r => r.created_at || 0, cell: r => escHtml(fmtDate(r.created_at)) || '<span class="aui-muted">—</span>' },
    ],
    rowHref: r => `/admin/players/${r.player_id}`,
    rowMenu: r => [
      { label: 'Player profile', href: `/admin/players/${r.player_id}` },
      { label: 'Their team page', href: '/team', external: true },
      'sep',
      { label: 'Revoke access…', danger: true, post: `/admin/team-heads/${r.id}/revoke`, done: `${r.name} is no longer a ${r.team_name} head.`,
        confirm: { title: `Revoke ${r.name}’s head access?`, body: `They can no longer file or vote on fines, or see ${r.team_name}’s payment status. Their player account is unchanged.`, send: 'Revoke' } },
    ],
    actionsHtml: button('+ Add a head', { kind: 'primary', attrs: 'data-drawer-open="add-head"' }),
    empty: { title: 'No team heads yet', sub: 'Add one with “+ Add a head”.' },
  });

  const add = drawer({
    id: 'add-head', eyebrow: 'Team heads', title: 'Add a head',
    bodyHtml: `<form id="add-head-form" data-json-action="/admin/team-heads" data-done="Head added." style="display:flex;flex-direction:column;gap:14px">
      ${field({ label: 'Team', name: 'teamId', type: 'select', options: teams.map(t => [t.id, t.name]) })}
      ${playerPicker({ name: 'playerId', label: 'Player', multiple: false, placeholder: 'Search players',
        options: players.map(p => ({ id: p.id, name: displayPlayerName(p.name), color: teamColor[p.team_id] || '', meta: teamName[p.team_id] || '' })) })}
      <p class="aui-field__help" style="margin:0">Heads log in with their normal player account; there’s no separate password.</p>
    </form>`,
    footerHtml: `${button('Cancel', { kind: 'ghost', attrs: 'data-drawer-close' })}${button('Add head', { kind: 'primary', type: 'submit', attrs: 'form="add-head-form"' })}`,
  });

  return `<div class="aui-page">
    ${pageHeader({ title: 'Team heads', sub: `${rows.length} ${rows.length === 1 ? 'head' : 'heads'} across ${new Set(rows.map(r => r.team_id)).size} teams` })}
    ${banner('info', 'Heads file and vote on fine cases at /fines and see their team’s payment status at /team, logged in as themselves.')}
    ${grid}
    ${add}
  </div>`;
}
