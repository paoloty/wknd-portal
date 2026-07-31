import { escHtml } from '../layout.js';

const ICON_SHIELD_OFF = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 1.5l4 1.5v3c0 3-1.7 5-4 6-2.3-1-4-3-4-6v-3l4-1.5z"/><line x1="4.5" y1="6.5" x2="8.5" y2="6.5"/></svg>`;
const ICON_EXTERNAL   = `<svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2H2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V8"/><polyline points="9.5 1 13 1 13 4.5"/><line x1="7" y1="7" x2="13" y2="1"/></svg>`;

export function adminPrivilegesBody({ admins = [], candidates = [] }) {
  const adminRows = admins.map(a => `
<tr class="border-b border-admin-border/40 last:border-0">
  <td class="px-4 py-3">
    <div class="text-xs font-semibold text-slate-200 whitespace-nowrap">${escHtml(a.full_name)}</div>
    <div class="text-xs text-slate-500 mt-0.5">${escHtml(a.email)}</div>
  </td>
  <td class="px-4 py-3 whitespace-nowrap">
    <button onclick="toggleSensitive('${escHtml(a.id)}', ${JSON.stringify(a.full_name)})" class="admin-btn admin-btn--sm ${a.can_view_sensitive ? 'admin-btn--success' : 'admin-btn--muted'}">
      ${a.can_view_sensitive ? '👁 Sensitive Data: On' : '🚫 Sensitive Data: Off'}
    </button>
  </td>
  <td class="px-4 py-3 text-right whitespace-nowrap">
    <a href="/admin/users/${escHtml(a.id)}" class="admin-btn admin-btn--sm no-underline mr-2">${ICON_EXTERNAL} Review</a>
    <button onclick="revokeAdmin('${escHtml(a.id)}', ${JSON.stringify(a.full_name)})" class="admin-btn admin-btn--sm admin-btn--danger">${ICON_SHIELD_OFF} Revoke</button>
  </td>
</tr>`).join('');

  const candidatesData = JSON.stringify(
    candidates.map(c => ({ id: c.id, name: c.full_name, email: c.email }))
  ).replace(/</g, '\\u003c');

  return `
<div class="mb-6">
  <h2 class="text-xl font-bold tracking-tight text-slate-100">Admin Privileges</h2>
  <p class="text-sm text-slate-500 mt-0.5">${admins.length} user${admins.length === 1 ? '' : 's'} with admin access</p>
</div>

<div class="grid gap-5" style="grid-template-columns:1fr 360px;align-items:start">

  <div class="bg-admin-surface border border-admin-border rounded-xl overflow-hidden">
    <div class="px-5 py-3.5 border-b border-admin-border">
      <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Current Admins</div>
    </div>
    ${admins.length === 0
      ? `<div class="p-8 text-center text-sm text-slate-500">No admins yet — grant access from the panel on the right.</div>`
      : `<table class="w-full border-collapse"><tbody>${adminRows}</tbody></table>`}
  </div>

  <div class="bg-admin-surface border border-admin-border rounded-xl overflow-hidden" style="position:sticky;top:24px">
    <div class="px-5 py-3.5 border-b border-admin-border">
      <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Grant Access</div>
    </div>
    <div class="px-5 py-4">
      <div style="position:relative">
        <input id="candidate-search" type="text" placeholder="Search approved users…" autocomplete="off"
          class="w-full bg-admin-border/50 border border-admin-border rounded-md px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-brand">
        <div id="candidate-dropdown" style="display:none;position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:20;background:#0f1623;border:1px solid #1c2840;border-radius:6px;max-height:260px;overflow-y:auto"></div>
      </div>
      <p class="text-[11px] text-slate-600 mt-3">Only approved users can be granted admin access. Search by name or email.</p>
      <p class="text-[11px] text-slate-600 mt-4 pt-3" style="border-top:1px solid var(--border-2)">The primary super admin login is configured via environment variables and isn't managed here.</p>
    </div>
  </div>

</div>

<style>
.priv-search-result { display:block; width:100%; text-align:left; padding:10px 14px; font-size:13px; color:#94a3b8; background:transparent; border:none; border-bottom:1px solid rgba(28,40,64,.5); cursor:pointer; transition:background .1s; }
.priv-search-result:last-child { border-bottom:none; }
.priv-search-result:hover { background:rgba(255,255,255,.04); color:#e2e8f0; }
</style>

<script>
(function() {
  var CANDIDATES = ${candidatesData};

  function candidateDisplay(c) { return c.name + ' (' + c.email + ')'; }

  var input    = document.getElementById('candidate-search');
  var dropdown = document.getElementById('candidate-dropdown');
  input.addEventListener('input', function() {
    var q = this.value.trim().toLowerCase();
    if (!q) { dropdown.style.display = 'none'; return; }
    var results = CANDIDATES.filter(function(c) {
      return candidateDisplay(c).toLowerCase().includes(q);
    }).slice(0, 10);
    dropdown.innerHTML = results.length
      ? results.map(function(c) {
          return '<button class="priv-search-result" data-id="' + c.id + '" data-name="' + c.name.replace(/"/g, '&quot;') + '">' + candidateDisplay(c) + '</button>';
        }).join('')
      : '<div style="padding:10px 14px;font-size:12px;color:#475569">No matching approved users</div>';
    dropdown.style.display = 'block';
  });
  dropdown.addEventListener('click', function(e) {
    var btn = e.target.closest('.priv-search-result');
    if (!btn || !btn.dataset.id) return;
    grantAdmin(btn.dataset.id, btn.dataset.name);
  });
  document.addEventListener('click', function(e) {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.style.display = 'none';
  });

  async function toggleAdmin(id) {
    var resp = await fetch('/admin/users/' + id + '/toggle-admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    var j = await resp.json();
    if (!resp.ok) throw new Error(j.error || 'Failed');
  }

  window.grantAdmin = async function(id, name) {
    if (!confirm('Grant admin access to ' + name + '? They will be able to access the admin panel.')) return;
    try { await toggleAdmin(id); location.reload(); } catch(e) { alert(e.message); }
  };

  window.revokeAdmin = async function(id, name) {
    if (!confirm('Revoke admin access for ' + name + '?')) return;
    try { await toggleAdmin(id); location.reload(); } catch(e) { alert(e.message); }
  };

  window.toggleSensitive = async function(id, name) {
    if (!confirm("Toggle sensitive-data access (email, phone, emergency contact, birthday) for " + name + "?")) return;
    try {
      var resp = await fetch('/admin/users/' + id + '/toggle-sensitive', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      var j = await resp.json();
      if (!resp.ok) throw new Error(j.error || 'Failed');
      location.reload();
    } catch(e) { alert(e.message); }
  };
})();
</script>`;
}
