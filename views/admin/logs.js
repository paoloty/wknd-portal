// /admin/logs: the one log (rebuilt on views/admin/ui.js, 2026-11). Admin actions, sign-ins,
// player actions, Papawis, emails, app events, share cards, birthdays, sends and server errors
// in one list, with filters that live in the URL. Rows: lib/activity-log.js.
import { escHtml } from '../layout.js';
import { pageHeader, dataGrid, avatar, badge, facts, button, banner } from './ui.js';

const attr = s => escHtml(String(s ?? ''));
const fmtTime = ts => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
const fmtFull = ts => new Date(ts).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Manila' });

const WHO_OPTIONS = [['admin', 'Admins'], ['player', 'Players'], ['system', 'WKND (automatic)']];

function resultText(r) {
  if (r.status >= 400) return `Failed (${r.status})`;
  if (r.status) return `OK (${r.status})`;
  return r.path && r.path.startsWith('/admin') ? 'Not recorded (older entry)' : '';
}

function expandRow(r) {
  const pairs = [
    ['When', escHtml(fmtFull(r.at))],
    r.path ? ['Request', `<code>${escHtml(`${r.method} ${r.path}`)}</code>`] : null,
    resultText(r) ? ['Result', escHtml(resultText(r))] : null,
    ...r.facts.map(([k, v]) => [k, escHtml(v)]),
    r.href ? ['Open', `<a class="aui-link" href="${attr(r.href)}">${escHtml(r.target || 'Details')}</a>`] : null,
  ];
  return facts(pairs);
}

export function adminLogsPage({ rows = [], query = {}, areas = [], person = null, capped = false, from = '', to = '' }) {
  const grid = dataGrid({
    id: 'logs', baseUrl: '/admin/logs', query, rows, perPage: 50, rowKey: r => r.key,
    noun: ['entry', 'entries'],
    keep: person ? { [person.param]: person.id } : {},
    views: [
      { key: 'all', label: 'All', test: () => true },
      { key: 'failed', label: 'Problems', test: r => r.failed },
      { key: 'admin', label: 'Admins', test: r => r.whoType === 'admin' },
      { key: 'account', label: 'Sign-ins', test: r => r.area === 'Account' },
      { key: 'player', label: 'Players', test: r => r.whoType === 'player' && r.area !== 'Account' },
      { key: 'email', label: 'Emails', test: r => r.source === 'email' || r.source === 'broadcast' },
      { key: 'system', label: 'System', test: r => r.area === 'System' },
    ],
    search: { placeholder: 'Search name, email, action or page', text: r => `${r.who} ${r.what} ${r.sub} ${r.target} ${r.path} ${r.facts.map(f => f[1]).join(' ')}` },
    filters: [
      { key: 'area', label: 'Area', options: areas.map(a => [a, a]), test: (r, v) => r.area === v },
      { key: 'who', label: 'Who', options: WHO_OPTIONS, test: (r, v) => r.whoType === v },
      { key: 'from', label: 'From', type: 'date', test: () => true }, // applied by the query, see the route
      { key: 'to', label: 'To', type: 'date', test: () => true },
    ],
    defaultSort: '-when',
    columns: [
      { key: 'what', label: 'What', primary: true, cell: r => `<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(r.what)}${r.failed ? ` ${badge('Problem', 'red')}` : ''}</span>${r.sub ? `<span class="aui-cell__sub alog-sub">${escHtml(r.sub)}</span>` : ''}</span>` },
      { key: 'who', label: 'Who', bare: true, cell: r => `<span class="aui-who">${avatar(r.who, '', { size: 24, playerId: r.whoPlayerId })}${escHtml(r.who)}</span>` },
      { key: 'on', label: 'On', cell: r => (r.target ? (r.href ? `<a class="aui-link" href="${attr(r.href)}">${escHtml(r.target)}</a>` : escHtml(r.target)) : '') },
      { key: 'area', label: 'Area', phone: false, cell: r => escHtml(r.area) },
      { key: 'when', label: 'When', num: true, nowrap: true, bare: true, sort: r => r.at, cell: r => escHtml(fmtTime(r.at)) },
    ],
    expand: expandRow,
    empty: { title: 'Nothing logged yet' },
  });
  const notes = [
    person ? banner('info', `Only showing entries for ${person.name}.`, `<a class="aui-link" href="/admin/logs">Show everyone</a>`) : '',
    capped ? banner('warn', `Showing the latest ${rows.length.toLocaleString()} entries. Pick a From and To date to see older ones.`) : '',
  ].join('');
  return `<div class="aui-page">
    ${pageHeader({
      title: person ? `Logs: ${person.name}` : 'Logs',
      sub: 'Everything in one place: what admins, players and WKND itself did, and what went wrong. Manila time.',
      actionsHtml: button('Share card stats', { kind: 'ghost', size: 'sm', href: '/admin/share-log' }),
    })}
    ${notes}${grid}
  </div>`;
}
