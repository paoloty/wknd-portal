// /admin/users: every registration, on the shared data grid (admin redesign, 2026-10-15).
// Rebuilt from scratch on views/admin/ui.js; the route in server.js passes the data.
import { escHtml } from '../layout.js';
import { maskEmail, maskPhone } from '../../lib/sensitive-mask.js';
import { emailStatus } from './email-status.js';
import { pageHeader, dataGrid, badge, avatar, facts, button } from './ui.js';

// Where an account's sign-in stands. Shared with the user page (views/admin/user-detail.js)
// so both say the same thing: a Facebook login counts as set, like a password.
//   'set' | 'waiting' (link sent, not used yet) | 'expired' | 'none' (no link sent)
export function accountPasswordState(r) {
  if (r.password_hash || r.facebook_id) return 'set';
  if (r.pw_token && r.pw_token_exp) return r.pw_token_exp > Date.now() ? 'waiting' : 'expired';
  return 'none';
}
const passwordState = r => (r.status === 'approved' ? accountPasswordState(r) : null);

const fmtDate = ts => (ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
function ago(ts) {
  if (!ts) return '';
  const d = Math.floor((Date.now() - ts) / 86400000);
  return d <= 0 ? 'today' : d === 1 ? '1d' : d < 60 ? `${d}d` : `${Math.round(d / 30)}mo`;
}
function positions(p) {
  try { return (typeof p === 'string' ? JSON.parse(p) : p || []).join(' / '); } catch { return ''; }
}
// "LAST, First" → "First LAST"
function displayName(full) {
  const [last, first] = String(full || '').split(',').map(s => s.trim());
  return first ? `${first} ${last}` : (last || '');
}

const EMAIL_TONE = { complained: 'red', bounced: 'red', failed: 'red', clicked: 'green', opened: 'green', delivered: 'gray', delayed: 'amber', sent: 'gray' };
const EMAIL_BAD = new Set(['complained', 'bounced', 'failed']);

// Phone: tapping a name opens the user (desktop keeps the quick-facts expand). Bulk resend
// skips anyone not approved (or without an email) before it posts, and says so.
const usersScript = `<script>
(function () {
  if (window.__ausersInit) return; window.__ausersInit = true;
  document.addEventListener('click', function (e) {
    var t = e.target;
    var ex = t.closest && t.closest('#users [data-grid-expand]');
    if (ex && window.matchMedia('(max-width: 640px)').matches) {
      var tr = ex.closest('tr[data-key]');
      if (tr) { e.preventDefault(); e.stopImmediatePropagation(); location.href = '/admin/users/' + encodeURIComponent(tr.getAttribute('data-key')); }
      return;
    }
    var be = t.closest && t.closest('#users [data-bulk-each]');
    if (!be) return;
    var grid = be.closest('[data-grid]'), skipped = 0;
    grid.querySelectorAll('[data-bulk-row]:checked').forEach(function (c) {
      var st = c.closest('tr').querySelector('[data-can-email]');
      if (!st || st.getAttribute('data-can-email') !== '1') { c.checked = false; skipped++; }
    });
    var left = grid.querySelectorAll('[data-bulk-row]:checked').length;
    var first = grid.querySelector('[data-bulk-row]');
    if (first) first.dispatchEvent(new Event('change', { bubbles: true }));
    if (!left) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (window.adminUi) window.adminUi.toast('None of those can get a link: they aren’t approved yet or have no email.', { tone: 'error' });
      return;
    }
    be.setAttribute('data-bulk-body', 'Each gets a fresh link to set or reset their password.' + (skipped ? ' ' + skipped + ' not approved yet (or without an email) ' + (skipped === 1 ? 'was' : 'were') + ' left out.' : ''));
  }, true);
})();
</script>`;

export function adminUsersBody({ registrations = [], canViewSensitive = true, accountEmails = {}, teamColorByPlayer = {}, isSuperAdmin = false, query = {} } = {}) {
  const rows = registrations.map(r => {
    const pw = passwordState(r);
    const em = accountEmails[r.id];
    const st = em && pw && pw !== 'set' ? emailStatus(em) : null;
    return {
      ...r,
      name: displayName(r.full_name) || r.email,
      pw,
      mailSt: st,
      mailBad: !!(st && EMAIL_BAD.has(st.key)),
      flags: r.bogusFlags || [],
      seen: Math.max(r.last_login_at || 0, r.last_seen_at || 0),
      color: teamColorByPlayer[r.player_id] || '',
      email_shown: canViewSensitive ? r.email : maskEmail(r.email),
      phone_shown: r.phone ? (canViewSensitive ? r.phone : maskPhone(r.phone)) : '',
    };
  });
  const pending = rows.filter(r => r.status === 'pending').length;

  // Only the exceptions get a badge; an approved, signed-in member's cell stays empty.
  const statusCell = r => {
    const parts = [];
    if (r.status === 'pending') parts.push(badge('Pending', 'blue'));
    if (r.status === 'rejected') parts.push(badge('Rejected', 'gray'));
    if (r.pw === 'expired') parts.push(badge('Link expired', 'red'));
    if (r.pw === 'none') parts.push(badge('No link sent', 'gray'));
    if (r.mailBad) parts.push(badge(`Email ${r.mailSt.label.toLowerCase()}`, 'red'));
    if (r.flags.length) parts.push(badge('Flagged', 'red'));
    return `<span class="aui-cell__badges" data-can-email="${r.status === 'approved' && r.email ? 1 : 0}">${parts.join('')}</span>`;
  };

  // Saved views with nothing in them are left out (the one being looked at always stays).
  const allViews = [
    { key: 'all', label: 'All', test: () => true },
    { key: 'pending', label: 'Pending', test: r => r.status === 'pending' },
    { key: 'approved', label: 'Approved', test: r => r.status === 'approved' },
    { key: 'waiting', label: 'Awaiting password', test: r => r.pw === 'waiting' },
    { key: 'expired', label: 'Needs a link', test: r => r.pw === 'expired' || r.pw === 'none' || r.mailBad },
    { key: 'flagged', label: 'Flagged', test: r => r.flags.length > 0 },
    { key: 'rejected', label: 'Rejected', test: r => r.status === 'rejected' },
  ];
  const views = allViews.filter(v => v.key === 'all' || v.key === query.view || rows.some(v.test));

  const grid = dataGrid({
    id: 'users', baseUrl: '/admin/users', query,
    rows, rowKey: r => r.id, noun: ['user', 'users'],
    views,
    search: { placeholder: 'Search name, email, phone', text: r => [r.full_name, r.name, r.email, r.phone].join(' ') },
    filters: [
      { key: 'login', label: 'Login', options: [['password', 'Password'], ['facebook', 'Facebook'], ['never', 'Never logged in']],
        test: (r, v) => (v === 'password' ? !!r.password_hash : v === 'facebook' ? !!r.facebook_id : !r.last_login_at) },
      { key: 'role', label: 'Role', options: [['admin', 'Admins'], ['player', 'Players']], test: (r, v) => (v === 'admin' ? !!r.is_admin : !r.is_admin) },
    ],
    defaultSort: '-joined',
    columns: [
      { key: 'name', label: 'Name', primary: true, sort: r => r.name.toLowerCase(),
        cell: r => `${avatar(r.name, r.color, { playerId: r.player_id })}<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(r.name)}</span><span class="aui-cell__sub">${escHtml(r.email_shown || '')}</span></span>` },
      { key: 'status', label: 'Status', bare: true, sort: r => `${r.status}${r.pw || ''}`, cell: statusCell },
      { key: 'positions', label: 'Positions', phone: false, cell: r => escHtml(positions(r.positions)) || '<span class="aui-muted">—</span>' },
      { key: 'phone', label: 'Phone', phone: false, nowrap: true, cell: r => escHtml(r.phone_shown) || '<span class="aui-muted">—</span>' },
      { key: 'joined', label: 'Joined', num: true, sort: r => r.created_at || 0, cell: r => escHtml(fmtDate(r.created_at)) },
      { key: 'seen', label: 'Last seen', num: true, sort: r => r.seen || 0, cell: r => (r.seen ? escHtml(ago(r.seen)) : '<span class="aui-muted">never</span>') },
    ],
    expand: r => facts([
      ['Email', escHtml(r.email_shown || '—')],
      ['Phone', escHtml(r.phone_shown || '—')],
      ['Logs in with', escHtml(r.facebook_id ? 'Facebook' : r.password_hash ? 'Password' : 'Not set up yet')],
      ['Approved', escHtml(fmtDate(r.approved_at) || '—')],
      r.mailSt ? ['Account email', badge(r.mailSt.label, EMAIL_TONE[r.mailSt.key] || 'gray')] : null,
      r.referred_by ? ['Referred by', escHtml(r.referred_by)] : null,
      r.flags.length ? ['Why flagged', escHtml(r.flags.join('; '))] : null,
      r.notes ? ['Notes', escHtml(r.notes)] : null,
    ]) + `<div class="ausers-open">${button('Open user', { kind: 'secondary', size: 'sm', href: `/admin/users/${r.id}` })}</div>`,
    rowMenu: r => [
      { label: r.status === 'pending' ? 'Review and approve' : 'Open user', href: `/admin/users/${r.id}` },
      r.player_id ? { label: 'Player profile', href: `/admin/players/${r.player_id}` } : null,
      r.status === 'approved' && r.email ? { label: r.pw === 'set' ? 'Send password reset' : 'Resend set-password link', post: `/admin/users/${r.id}/send-reset`, done: `Email sent to ${r.name}.`,
        confirm: { title: `Email ${r.name}?`, body: `A new link to ${r.pw === 'set' ? 'reset their password' : 'set their password'} goes to ${r.email_shown}.`, send: 'Send email' } } : null,
      isSuperAdmin && r.status === 'approved' && r.player_id ? { label: 'View as this player', post: `/admin/impersonate/${r.player_id}`, then: '/me', done: `Viewing as ${r.name}`,
        confirm: { title: `View the site as ${r.name}?`, body: 'Read-only. Stop from the bar at the top of the site.', send: 'View as' } } : null,
      r.status === 'pending' ? 'sep' : null,
      r.status === 'pending' ? { label: 'Reject…', danger: true, post: `/admin/users/${r.id}/reject`, done: `${r.name} rejected.`,
        confirm: { title: `Reject ${r.name}?`, body: 'They get an email saying the registration wasn’t approved.', send: 'Reject' } } : null,
    ],
    bulk: [
      { label: 'Resend set-password link', eachUrl: '/admin/users/{id}/send-reset', done: 'Sent {n} email{s}.',
        confirm: { title: 'Email {n} user{s} a new link?', body: 'Each gets a fresh link to set or reset their password.' } },
    ],
    actionsHtml: button('Registration form ↗', { kind: 'ghost', href: '/register', attrs: 'target="_blank" rel="noopener"' }),
    empty: { title: 'No users yet', sub: 'Share the registration link: /register' },
  });

  return `<div class="aui-page ausers">
    ${pageHeader({ title: 'Users', sub: `${rows.length} accounts${pending ? ` · ${pending} waiting for approval` : ''}` })}
    ${grid}
    ${usersScript}
  </div>`;
}
