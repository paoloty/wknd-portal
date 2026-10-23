// /admin/app: who's using the players app (/app). One row per approved player account:
// signed in yet, installed to the home screen (and on what), how far through setup, when
// they last opened it. Alongside, the activity log (lib/portal-db.js app_events).
import { escHtml } from '../layout.js';
import { pageHeader, dataGrid, section, avatar, badge, kpi, emptyState, ago, button } from './ui.js';
import { manilaFormat } from '../utils.js';

const fmtTime = ts => manilaFormat(ts, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const fmtDay = ts => manilaFormat(ts, { month: 'short', day: 'numeric' });
const PLATFORM = { ios: 'iPhone', android: 'Android', desktop: 'Computer' };
const platformLabel = list => String(list || '').split(',').filter(Boolean).map(p => PLATFORM[p] || p).join(' + ');

const EVENT = {
  signin: (d) => `signed in${d === 'email_code' ? ' with an email code' : d === 'password' ? ' with their password' : d === 'passkey' ? ' with Face ID / fingerprint' : ''}`,
  code_sent: () => 'asked for a sign-in code',
  installed: (d, p) => `added the app to their home screen${p ? ` (${PLATFORM[p] || p})` : ''}`,
  setup_details: () => 'saved their details',
  setup_season_seen: () => 'checked their season',
  setup_done: () => 'finished setup',
  signout: () => 'logged out',
  photo_failed: (d) => `couldn't upload a photo${d ? ` (${d})` : ''}`,
  img_failed: (d) => `couldn't load a picture${d ? ` (${d})` : ''}`,
  push_on: () => 'turned on notifications',
  push_off: () => 'turned off notifications',
  passkey_added: (d) => `turned on Face ID / fingerprint sign-in${d ? ` (${d})` : ''}`,
  passkey_removed: () => 'removed a Face ID / fingerprint sign-in',
};
const EVENT_TONE = { signin: 'blue', installed: 'green', setup_done: 'green', setup_details: 'gray', code_sent: 'gray', signout: 'gray', photo_failed: 'red', img_failed: 'amber', push_on: 'green', push_off: 'gray', passkey_added: 'green', passkey_removed: 'gray' };

// rows: [{ regId, playerId, name, team, color, email, hasAccess, s (summary row | null),
//          setup: { photo, details } }]
export function adminAppBody({ rows, events, query = {}, isOpen, pushOn = 0, settingsHtml = '', now = Date.now() }) {
  const stage = r => (r.s?.installed_at ? 'installed' : r.s?.first_signin_at ? 'signed_in' : 'not_yet');
  const total = rows.length;
  const signedIn = rows.filter(r => r.s?.first_signin_at).length;
  const installed = rows.filter(r => r.s?.installed_at).length;
  const setupDone = rows.filter(r => r.s?.first_signin_at && r.setup.photo && r.setup.details).length;
  const active7 = rows.filter(r => (r.s?.open_days_7 || 0) > 0).length;

  const grid = dataGrid({
    id: 'app-players', baseUrl: '/admin/app', query,
    rows, rowKey: r => r.regId, noun: ['player', 'players'], perPage: 50,
    views: [
      { key: 'all', label: 'All', test: () => true },
      { key: 'installed', label: 'Installed', test: r => stage(r) === 'installed' },
      { key: 'browser', label: 'Signed in, not installed', test: r => stage(r) === 'signed_in' },
      { key: 'setup', label: 'Setup not finished', test: r => r.s?.first_signin_at && !(r.setup.photo && r.setup.details) },
      { key: 'not_yet', label: 'Not signed in yet', test: r => stage(r) === 'not_yet' },
    ],
    search: { placeholder: 'Search player, team or email', text: r => `${r.name} ${r.team} ${r.email}` },
    defaultSort: '-last',
    columns: [
      { key: 'name', label: 'Player', primary: true, sort: r => r.name.toLowerCase(), cell: r => `<a class="aui-who" href="/admin/users/${escHtml(r.regId)}">${avatar(r.name, r.color, { size: 26, playerId: r.playerId })}<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(r.name)}</span><span class="aui-cell__sub">${escHtml(r.team || 'No team')}</span></span></a>` },
      { key: 'stage', label: 'App', bare: true, sort: r => ({ installed: 0, signed_in: 1, not_yet: 2 })[stage(r)], cell: r => {
        const st = stage(r);
        const main = st === 'installed' ? badge(`Installed · ${platformLabel(r.s.installed_on)}`, 'green')
          : st === 'signed_in' ? badge('Browser only', 'blue') : badge('Not yet', 'gray');
        return main + (!isOpen && !r.hasAccess ? ` ${badge('No access yet', 'amber')}` : '');
      } },
      { key: 'setup', label: 'Setup', nowrap: true, sort: r => (r.setup.photo ? 1 : 0) + (r.setup.details ? 1 : 0), cell: r => (r.s?.first_signin_at
        ? `${r.setup.photo ? '✓' : '·'} Photo &nbsp; ${r.setup.details ? '✓' : '·'} Details`
        : '<span class="aui-muted">—</span>') },
      { key: 'first', label: 'First sign-in', num: true, sort: r => r.s?.first_signin_at || 0, cell: r => (r.s?.first_signin_at ? escHtml(fmtDay(r.s.first_signin_at)) : '<span class="aui-muted">—</span>') },
      { key: 'last', label: 'Last opened', num: true, sort: r => r.s?.last_open_at || r.s?.last_signin_at || 0, cell: r => {
        const t = r.s?.last_open_at || r.s?.last_signin_at;
        return t ? `<span title="${escHtml(fmtTime(t))}">${escHtml(ago(t, now))} ago</span>` : '<span class="aui-muted">—</span>';
      } },
      { key: 'days', label: 'Days used', num: true, phone: false, sort: r => r.s?.open_days || 0, cell: r => String(r.s?.open_days || 0) },
      { key: 'method', label: 'Signs in with', phone: false, sort: r => r.s?.last_method || '', cell: r => (r.s?.last_method ? escHtml(({ email_code: 'Email code', passkey: 'Face ID' })[r.s.last_method] || 'Password') : '<span class="aui-muted">—</span>') },
    ],
    empty: { title: 'No players here', sub: 'Approved player accounts show up here.' },
  });

  const log = events.length ? `<div class="aui-panel aui-panel--flush">${events.map(e => `
    <div class="aui-action" style="cursor:default">
      <span class="aui-cell__stack">
        <span class="aui-action__label"><b>${escHtml(e.name)}</b> ${escHtml((EVENT[e.type] || (() => e.type))(e.detail, e.platform))}</span>
        <span class="aui-cell__sub">${escHtml(fmtTime(e.created_at))}${e.platform && e.type !== 'installed' ? ` · ${escHtml(PLATFORM[e.platform] || e.platform)}` : ''}</span>
      </span>
      ${badge(e.type.replace('_', ' '), EVENT_TONE[e.type] || 'gray')}
    </div>`).join('')}</div>` : emptyState({ title: 'Nothing yet', sub: 'Sign-ins, installs and setup show up here.' });

  return `<div class="aui-page">
    ${pageHeader({ title: 'Players app', sub: `Who has signed in to the app at /app, added it to their home screen and set up their account. ${isOpen ? 'Open to every player.' : 'Hidden: only player-admins and the testers below can get in.'}`, actionsHtml: button('Announcements', { href: '/admin/app/announcements', kind: 'primary' }) })}
    ${settingsHtml}
    <div class="aui-kpis">
      ${kpi({ label: 'Signed in', value: String(signedIn), of: ` of ${total}`, href: '/admin/app?view=all' })}
      ${kpi({ label: 'Installed', value: String(installed), of: ` of ${total}`, href: '/admin/app?view=installed' })}
      ${kpi({ label: 'Setup finished', value: String(setupDone), of: signedIn ? ` of ${signedIn} signed in` : '' })}
      ${kpi({ label: 'Opened in the last 7 days', value: String(active7) })}
      ${kpi({ label: 'Notifications on', value: String(pushOn), of: signedIn ? ` of ${signedIn} signed in` : '' })}
    </div>
    <div class="aui-cols">
      <div class="aui-cols__main">${grid}</div>
      <aside class="aui-cols__side">
        ${section({ title: 'Activity', note: `· latest ${events.length}`, bodyHtml: log })}
      </aside>
    </div>
  </div>`;
}
