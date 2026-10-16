// /admin/papawis/activity (admin redesign, 2026-10-15; rebuilt on views/admin/ui.js).
// Everything that happened across Papawis runs, on the shared data grid, with the regulars
// and the frequent cancellers alongside.
import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';
import { pageHeader, dataGrid, section, avatar, emptyState } from './ui.js';
import { ACTIVITY_LABELS } from './papawis.js';

const attr = s => escHtml(String(s ?? ''));
const fmtTime = ts => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });

// Which saved view an event belongs to.
const KIND = {
  joined: 'joins', registered: 'joins', promoted: 'joins', waitlisted: 'joins',
  cancelled: 'cancels',
  reminded: 'emails', cancel_notified: 'emails', completion_notified: 'emails', announced: 'emails', slot_alerted: 'emails', team_notified: 'emails', updated_notified: 'emails',
  viewed_roster: 'views',
};
const TONE = { joins: 'is-green', cancels: 'is-red', emails: 'is-blue', views: '' };

function peopleList(rows, countKey, unit, colorById) {
  if (!rows.length) return '';
  return `<div class="aui-panel aui-panel--flush">${rows.map(r => {
    const name = displayPlayerName(r.player_name);
    return `<a class="aui-action" href="/admin/players/${attr(r.player_id)}"><span class="aui-who">${avatar(name, colorById[r.player_id] || '', { size: 26, playerId: r.player_id })}<span class="aui-cell__stack"><span class="aui-action__label">${escHtml(name)}</span><span class="aui-cell__sub">${escHtml(r.team_name || 'No team')}</span></span></span><span class="aui-num" title="${attr(unit)}">${r[countKey]}</span></a>`;
  }).join('')}</div>`;
}

export function adminPapawisActivityBody({ activity = [], cancellers = [], regulars = [], query = {}, colorById = {}, regularsRule = '' }) {
  const rows = activity.map(e => ({ ...e, kind: KIND[e.event_type] || 'other', name: e.player_name ? displayPlayerName(e.player_name) : 'Someone' }));
  const grid = dataGrid({
    id: 'activity', baseUrl: '/admin/papawis/activity', query,
    rows, rowKey: e => e.id, noun: ['event', 'events'], perPage: 50,
    views: [
      { key: 'all', label: 'All', test: () => true },
      { key: 'joins', label: 'Sign-ups', test: e => e.kind === 'joins' },
      { key: 'cancels', label: 'Cancellations', test: e => e.kind === 'cancels' },
      { key: 'emails', label: 'Emails sent', test: e => e.kind === 'emails' },
      { key: 'views', label: 'Roster views', test: e => e.kind === 'views' },
    ],
    search: { placeholder: 'Search player or run', text: e => `${e.name} ${e.game_title || ''}` },
    defaultSort: '-when',
    columns: [
      { key: 'name', label: 'Player', primary: true, sort: e => e.name.toLowerCase(), cell: e => `<span class="aui-who">${avatar(e.name, colorById[e.player_id] || '', { size: 26, playerId: e.player_id })}<span class="aui-cell__title">${escHtml(e.name)}</span></span>` },
      { key: 'what', label: 'What', bare: true, sort: e => e.event_type, cell: e => `<span class="pw-event ${TONE[e.kind] || ''}">${escHtml((ACTIVITY_LABELS[e.event_type] || { label: e.event_type }).label)}</span>${e.notes ? `<div class="aui-cell__sub">${escHtml(e.notes)}</div>` : ''}` },
      { key: 'run', label: 'Run', nowrap: true, sort: e => e.game_title || '', cell: e => (e.game_id ? `<a class="aui-link" href="/admin/papawis/${attr(e.game_id)}?tab=activity">${escHtml(e.game_title || 'Papawis')}</a>` : '<span class="aui-muted">General</span>') },
      { key: 'when', label: 'When', num: true, sort: e => e.created_at, cell: e => escHtml(fmtTime(e.created_at)) },
    ],
    empty: { title: 'No activity yet', sub: 'Sign-ups, cancellations and emails show up here.' },
  });
  return `<div class="aui-page">
    ${pageHeader({ title: 'Activity', sub: `The latest ${activity.length} events across every run.` })}
    <div class="aui-cols">
      <div class="aui-cols__main">${grid}</div>
      <aside class="aui-cols__side">
        ${section({ title: 'Regulars', note: regularsRule ? `· played ${regularsRule}` : '', bodyHtml: peopleList(regulars, 'games_played', 'runs played', colorById) || emptyState({ title: 'No regulars yet' }) })}
        ${section({ title: 'Frequent cancellers', note: '· 2+ cancellations', bodyHtml: peopleList(cancellers, 'cancel_count', 'cancellations', colorById) || emptyState({ title: 'Nobody cancels often', done: true }) })}
      </aside>
    </div>
  </div>`;
}
