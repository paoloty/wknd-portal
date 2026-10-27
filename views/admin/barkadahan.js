// /admin/barkadahan (super admins only, 2026-10-27): the app chat's whole archive, read-only
// (Paolo: super admins view it here but can't reply). Players see the last 30 days in the app;
// this keeps everything, deleted messages included and marked. Open reports on top, with
// Delete or Keep. The on/off switch sits here, the feature's own page.
import { escHtml } from '../layout.js';
import { settingsScript } from './settings.js';
import { pageHeader, section, avatar, badge, button, emptyState } from './ui.js';

const attr = s => escHtml(String(s ?? ''));
const when = ts => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
const OLD = 30 * 864e5;

// rows: barkadahan_messages, newest first · reports: open reports with the message ·
// people: { pid: bkPerson } · online: bkPerson[]
export function adminBarkadahanBody({ panel, rows = [], reports = [], people = {}, q = '', who = '', total = 0, online = [] }) {
  const p = id => people[id] || { name: 'Someone', full: 'Someone', ring: '' };
  const face = id => `<span class="aui-who">${avatar(p(id).full, p(id).ring, { size: 26, playerId: id })}<a class="aui-cell__title" href="/admin/barkadahan?who=${attr(id)}">${escHtml(p(id).full)}</a></span>`;
  const now = Date.now();
  const reportList = reports.length ? `<div class="aui-panel aui-panel--flush">${reports.map(r => `<div class="bkadm-row">
      ${face(r.author_id)}
      <p class="bkadm-body">${r.deleted_at ? '<i class="aui-muted">Deleted</i>' : escHtml(r.body)}</p>
      <span class="aui-muted">Reported by ${escHtml(p(r.player_id).full)} · ${escHtml(when(r.created_at))}${r.reason ? ` · “${escHtml(r.reason)}”` : ''}</span>
      <span class="aui-row">${r.deleted_at ? '' : button('Delete', { kind: 'danger', size: 'sm', attrs: `data-post-json="/admin/barkadahan/${attr(r.message_id)}/delete" data-then="/admin/barkadahan" data-done="Message deleted."` })}${button('Keep', { kind: 'secondary', size: 'sm', attrs: `data-post-json="/admin/barkadahan/${attr(r.message_id)}/keep" data-then="/admin/barkadahan" data-done="Report closed."` })}</span>
    </div>`).join('')}</div>` : emptyState({ title: 'No open reports', done: true });
  const archive = rows.length ? `<div class="aui-panel aui-panel--flush">${rows.map(m => `<div class="bkadm-row${m.deleted_at ? ' is-del' : ''}">
      ${face(m.player_id)}
      <p class="bkadm-body">${escHtml(m.body)}</p>
      <span class="aui-muted">${escHtml(when(m.created_at))}${m.reply_to ? ' · reply' : ''}${now - m.created_at > OLD ? ' · archived (players no longer see it)' : ''}</span>
      <span class="aui-row">${m.deleted_at ? badge(`Deleted${m.deleted_by === 'admin' ? ' by admin' : m.deleted_by === m.player_id ? ' by them' : m.deleted_by ? ` by ${p(m.deleted_by).full}` : ''}`, 'red') : button('Delete', { kind: 'ghost', size: 'sm', attrs: `data-post-json="/admin/barkadahan/${attr(m.id)}/delete" data-then="/admin/barkadahan${q || who ? `?${new URLSearchParams({ ...(q ? { q } : {}), ...(who ? { who } : {}) })}` : ''}" data-done="Message deleted." data-confirm data-confirm-title="Delete this message?" data-confirm-body="It goes from the app for everyone. It stays here, marked deleted." data-confirm-send="Delete"` })}</span>
    </div>`).join('')}</div>` : emptyState({ title: q || who ? 'Nothing matches' : 'No messages yet', sub: q || who ? 'Try other words.' : 'Messages show up here once players start chatting.' });
  const filters = `<form class="aui-grid__filters" method="get" action="/admin/barkadahan" role="search">
      ${who ? `<input type="hidden" name="who" value="${attr(who)}">` : ''}
      <label class="aui-search"><input type="search" name="q" value="${attr(q)}" placeholder="Search messages" aria-label="Search messages"></label>
      ${who ? `<a class="aui-chip" href="/admin/barkadahan${q ? `?q=${encodeURIComponent(q)}` : ''}">${escHtml(p(who).full)}<span aria-hidden="true">×</span></a>` : ''}
    </form>`;
  return `<div class="aui-page">
    ${pageHeader({ eyebrow: 'Super Admin', title: 'Barkadahan', sub: `The app’s chat room. Read-only here: super admins can read and delete, not post. ${total} message${total === 1 ? '' : 's'} in the archive; players see the last 30 days.` })}
    ${panel}
    ${section({ title: 'Reports', note: `· ${reports.length} open`, bodyHtml: reportList })}
    ${section({ title: 'Online now', note: `· ${online.length}`, bodyHtml: online.length ? `<div class="aui-row bkadm-online">${online.map(o => `<span class="aui-who">${avatar(o.full, o.ring, { size: 24, playerId: o.pid })}${escHtml(o.full)}</span>`).join('')}</div>` : '<p class="aui-muted">Nobody has the app open.</p>' })}
    ${section({ title: 'Archive', note: `· ${rows.length}${rows.length === 300 ? ' newest' : ''}`, bodyHtml: filters + archive })}
  </div>${settingsScript()}`;
}
