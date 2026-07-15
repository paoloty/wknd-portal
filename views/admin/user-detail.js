import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';

const ICON_CHECK    = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7.5l3 3 6-7"/></svg>`;
const ICON_PLUS     = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="6.5" y1="2" x2="6.5" y2="11"/><line x1="2" y1="6.5" x2="11" y2="6.5"/></svg>`;
const ICON_X        = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="1.5" y1="1.5" x2="9.5" y2="9.5"/><line x1="9.5" y1="1.5" x2="1.5" y2="9.5"/></svg>`;
const ICON_REFRESH  = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 6.5A4.5 4.5 0 1 1 8 2.5"/><path d="M8 1v3h3"/></svg>`;
const ICON_UNDO     = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4.5h7a3 3 0 1 1 0 6H6"/><path d="M5 1.5L2 4.5 5 7.5"/></svg>`;
const ICON_EXTERNAL = `<svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2H2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V8"/><polyline points="9.5 1 13 1 13 4.5"/><line x1="7" y1="7" x2="13" y2="1"/></svg>`;

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_BADGE = {
  pending:  { label: 'Pending',  cls: 'bg-amber-500/15 text-amber-400' },
  approved: { label: 'Approved', cls: 'bg-green-500/15 text-green-400' },
  rejected: { label: 'Rejected', cls: 'bg-red-500/15  text-red-400'   },
};

function badge(status) {
  const b = STATUS_BADGE[status] || STATUS_BADGE.pending;
  return `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${b.cls}">${b.label}</span>`;
}

function field(label, value, opts = {}) {
  if (!value) return '';
  return `<div>
    <dt class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">${label}</dt>
    <dd class="text-sm text-slate-200 ${opts.capitalize ? 'capitalize' : ''}">${escHtml(value)}</dd>
  </div>`;
}

export function adminUserDetailBody({ reg, players = [], linkedPlayer = null, isSuperAdmin = false }) {
  if (!reg) return `<div class="text-slate-500 text-sm">Registration not found.</div>`;

  let positions = [];
  try { positions = JSON.parse(reg.positions || '[]'); } catch {}

  const playersData = JSON.stringify(
    players.map(p => ({
      id: p.id,
      first_name: p.first_name || '',
      last_name: p.last_name || '',
      team_name: p.team_name || '',
    }))
  ).replace(/</g, '\\u003c');

  // Linked player info
  const linkedName = linkedPlayer
    ? displayPlayerName(`${(linkedPlayer.last_name || '').toUpperCase()}, ${linkedPlayer.first_name || ''}`)
    : null;

  // Actions panel
  let actionsHtml = '';
  if (reg.status === 'pending') {
    actionsHtml = `
<div class="space-y-4">
  <div>
    <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2" id="picker-label">Suggested matches</div>
    <div id="match-chips" class="flex flex-col gap-1.5 mb-3"></div>
    <div style="position:relative">
      <input id="player-search" type="text" placeholder="Search all players…" autocomplete="off"
        class="w-full bg-admin-border/50 border border-admin-border rounded-md px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-brand">
      <div id="player-dropdown" style="display:none;position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:20;background:#0f1623;border:1px solid #1c2840;border-radius:6px;max-height:220px;overflow-y:auto"></div>
    </div>
    <div id="selected-player-label" class="text-[11px] text-slate-500 mt-2">No player selected — will approve without linking.</div>
  </div>

  <div style="display:flex;flex-direction:column;gap:10px;padding-top:12px;border-top:1px solid var(--border-2)">
    <button data-action="approve" onclick="doAction(this.dataset.action)" class="admin-btn admin-btn--success admin-btn--block">
      ${ICON_CHECK} Approve &amp; Link
    </button>
    <button data-action="create" onclick="doAction(this.dataset.action)" class="admin-btn admin-btn--block">
      ${ICON_PLUS} Create Player
    </button>
    <button onclick="openReject()" class="admin-btn admin-btn--danger admin-btn--block">
      ${ICON_X} Reject
    </button>
  </div>
</div>`;
  } else if (reg.status === 'approved') {
    const adminToggle = isSuperAdmin ? `
  <hr style="border:none;border-top:1px solid var(--border-2);margin:4px 0">
  <button onclick="toggleAdmin()" id="admin-toggle-btn" class="admin-btn admin-btn--block ${reg.is_admin ? 'admin-btn--danger' : 'admin-btn--success'}" style="font-size:12px">
    ${reg.is_admin ? '🔒 Revoke Admin Access' : '🛡 Grant Admin Access'}
  </button>` : '';
    actionsHtml = `
<div style="display:flex;flex-direction:column;gap:6px">
  ${linkedName ? `<a href="/players/${escHtml(reg.player_id)}" target="_blank" class="admin-btn admin-btn--block no-underline">
    ${ICON_EXTERNAL} View Player
  </a>` : ''}
  <button data-action="sync" onclick="doAction(this.dataset.action)" class="admin-btn admin-btn--block">
    ${ICON_REFRESH} Re-sync to Player
  </button>
  <hr style="border:none;border-top:1px solid var(--border-2);margin:4px 0">
  <button onclick="confirmReset()" class="admin-btn admin-btn--muted admin-btn--block">
    ${ICON_UNDO} Reset to Pending
  </button>${adminToggle}
</div>`;
  } else if (reg.status === 'rejected') {
    actionsHtml = `
<div style="display:flex;flex-direction:column;gap:6px">
  <button onclick="confirmReset()" class="admin-btn admin-btn--muted admin-btn--block">
    ${ICON_UNDO} Reset to Pending
  </button>
</div>`;
  }

  return `
<div class="mb-6 flex items-center gap-3">
  <a href="/admin/users" class="text-slate-500 hover:text-slate-300 text-sm no-underline transition-colors">← Users</a>
  <span class="text-slate-700">/</span>
  <span class="text-sm text-slate-400">${escHtml(reg.full_name)}</span>
  ${badge(reg.status)}
</div>

<div class="grid gap-5" style="grid-template-columns:1fr 380px;align-items:start">

  <!-- Left: registration details -->
  <div class="space-y-5">

    <div class="bg-admin-surface border border-admin-border rounded-xl overflow-hidden">
      <div class="px-5 py-3.5 border-b border-admin-border">
        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Personal Info</div>
      </div>
      <div class="px-5 py-4">
        <dl class="grid grid-cols-2 gap-x-6 gap-y-4">
          ${field('Full Name', reg.full_name)}
          ${field('Email', reg.email)}
          ${field('Phone', reg.phone)}
          ${field('Birthday', reg.birthday)}
        </dl>
      </div>
    </div>

    <div class="bg-admin-surface border border-admin-border rounded-xl overflow-hidden">
      <div class="px-5 py-3.5 border-b border-admin-border">
        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Your Game</div>
      </div>
      <div class="px-5 py-4 space-y-4">
        ${positions.length ? `<div>
          <dt class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Positions</dt>
          <div class="flex gap-2 flex-wrap">
            ${positions.map(p => `<span class="px-3 py-1 text-xs font-bold bg-admin-border/60 text-slate-300 rounded-md">${escHtml(p)}</span>`).join('')}
          </div>
        </div>` : ''}
        <dl class="grid grid-cols-3 gap-x-6 gap-y-4">
          ${field('Height', reg.height ? reg.height + ' cm' : '')}
          ${field('Weight', reg.weight ? reg.weight + ' kg' : '')}
          ${field('Dominant Hand', reg.dominant_hand, { capitalize: true })}
        </dl>
      </div>
    </div>

    <div class="bg-admin-surface border border-admin-border rounded-xl overflow-hidden">
      <div class="px-5 py-3.5 border-b border-admin-border">
        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500">A Few More Things</div>
      </div>
      <div class="px-5 py-4 space-y-4">
        <dl class="grid grid-cols-2 gap-x-6 gap-y-4">
          ${field('Experience', reg.experience, { capitalize: true })}
          ${field('Referred By', reg.referred_by)}
          ${field('Emergency Contact', reg.emergency_name)}
          ${field('Emergency Phone', reg.emergency_phone)}
        </dl>
        ${reg.motto ? `<div>
          <dt class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Quick Bio</dt>
          <blockquote class="text-sm text-slate-300 italic leading-relaxed bg-admin-border/20 rounded-lg px-4 py-3 border-l-2 border-brand/40">"${escHtml(reg.motto)}"</blockquote>
        </div>` : ''}
      </div>
    </div>

    <div class="bg-admin-surface border border-admin-border rounded-xl overflow-hidden">
      <div class="px-5 py-3.5 border-b border-admin-border">
        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Timeline</div>
      </div>
      <div class="px-5 py-4">
        <dl class="grid grid-cols-2 gap-x-6 gap-y-4">
          ${field('Submitted', fmtDate(reg.created_at))}
          ${field('Approved', reg.approved_at ? fmtDate(reg.approved_at) : '')}
          ${linkedName ? field('Linked Player', linkedName) : ''}
          ${reg.notes ? field('Notes', reg.notes) : ''}
        </dl>
      </div>
    </div>

  </div>

  <!-- Right: actions -->
  <div class="bg-admin-surface border border-admin-border rounded-xl overflow-hidden" style="position:sticky;top:24px">
    <div class="px-5 py-3.5 border-b border-admin-border">
      <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Admin Actions</div>
    </div>
    <div class="px-5 py-4">
      ${actionsHtml}
    </div>
  </div>

</div>

<!-- Reject modal -->
<div id="reject-backdrop" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:50;align-items:center;justify-content:center">
  <div class="bg-admin-surface border border-admin-border rounded-xl p-6" style="width:100%;max-width:420px">
    <div class="text-sm font-bold text-slate-200 mb-3">Reject Registration</div>
    <textarea id="reject-notes" rows="3" placeholder="Reason (optional)…"
      class="w-full bg-admin-border/50 border border-admin-border rounded-md px-3 py-2 text-sm text-slate-300 resize-none focus:outline-none focus:border-brand mb-3"></textarea>
    <div class="flex justify-end gap-2">
      <button onclick="document.getElementById('reject-backdrop').style.display='none'" class="admin-btn">${ICON_X} Cancel</button>
      <button id="reject-confirm" class="admin-btn admin-btn--danger">${ICON_X} Confirm Reject</button>
    </div>
  </div>
</div>

<style>
.match-chip { display:block; width:100%; text-align:left; padding:9px 14px; font-size:13px; background:rgba(28,40,64,.4); border:1px solid #1c2840; border-radius:8px; color:#94a3b8; cursor:pointer; transition:border-color .15s,color .15s,background .15s; }
.match-chip:hover { border-color:#f59332; color:#e2e8f0; }
.match-chip.selected { border-color:#f59332; background:rgba(245,147,50,.1); color:#f59332; }
.search-result { display:block; width:100%; text-align:left; padding:10px 14px; font-size:13px; color:#94a3b8; background:transparent; border:none; border-bottom:1px solid rgba(28,40,64,.5); cursor:pointer; transition:background .1s; }
.search-result:last-child { border-bottom:none; }
.search-result:hover { background:rgba(255,255,255,.04); color:#e2e8f0; }
</style>

<script>
(function() {
  var PLAYERS   = ${playersData};
  var REG_NAME  = ${JSON.stringify(reg.full_name)};
  var REG_ID    = ${JSON.stringify(reg.id)};
  var _selectedPlayerId = '';

  // ── Player matching ──────────────────────────────────────────────────────
  function playerDisplay(p) {
    return p.first_name + ' ' + p.last_name + (p.team_name ? ' (' + p.team_name + ')' : '');
  }

  function findMatches() {
    var parts   = (REG_NAME || '').split(',');
    var regLast = parts[0].trim().toLowerCase();
    if (!regLast) return [];
    return PLAYERS.filter(function(p) {
      var pLast = (p.last_name || '').toLowerCase();
      return pLast && (pLast.includes(regLast) || regLast.includes(pLast));
    });
  }

  function setSelected(id, label) {
    _selectedPlayerId = id || '';
    var el = document.getElementById('selected-player-label');
    if (el) el.textContent = id ? ('Selected: ' + label) : 'No player selected — will approve without linking.';
    document.querySelectorAll('.match-chip').forEach(function(c) {
      c.classList.toggle('selected', c.dataset.pid === id);
    });
  }

  // ── Build picker (only for pending) ──────────────────────────────────────
  var chipsEl = document.getElementById('match-chips');
  if (chipsEl) {
    var matches = findMatches();
    var labelEl = document.getElementById('picker-label');

    if (matches.length) {
      matches.forEach(function(p) {
        var btn = document.createElement('button');
        btn.className = 'match-chip';
        btn.dataset.pid = p.id;
        btn.textContent = playerDisplay(p);
        chipsEl.appendChild(btn);
      });
      chipsEl.addEventListener('click', function(e) {
        var btn = e.target.closest('.match-chip');
        if (!btn) return;
        var wasSelected = btn.classList.contains('selected');
        setSelected(wasSelected ? '' : btn.dataset.pid, wasSelected ? '' : btn.textContent.trim());
        if (!wasSelected) { var inp = document.getElementById('player-search'); if (inp) inp.value = ''; }
      });
      // Auto-select if exactly one match
      if (matches.length === 1) setSelected(matches[0].id, playerDisplay(matches[0]));
    } else {
      chipsEl.remove();
      if (labelEl) labelEl.textContent = 'Link to existing player';
    }

    // Search
    var input    = document.getElementById('player-search');
    var dropdown = document.getElementById('player-dropdown');
    if (input && dropdown) {
      input.addEventListener('input', function() {
        var q = this.value.trim().toLowerCase();
        if (!q) { dropdown.style.display = 'none'; return; }
        var results = PLAYERS.filter(function(p) {
          return playerDisplay(p).toLowerCase().includes(q);
        }).slice(0, 10);
        dropdown.innerHTML = results.length
          ? results.map(function(p) {
              return '<button class="search-result" data-pid="' + p.id + '">' + playerDisplay(p) + '</button>';
            }).join('')
          : '<div style="padding:10px 14px;font-size:12px;color:#475569">No results</div>';
        dropdown.style.display = 'block';
      });
      dropdown.addEventListener('click', function(e) {
        var btn = e.target.closest('.search-result');
        if (!btn) return;
        setSelected(btn.dataset.pid, btn.textContent.trim());
        input.value = btn.textContent.trim();
        dropdown.style.display = 'none';
      });
      document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.style.display = 'none';
      });
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  window.doAction = async function(action) {
    var playerId = _selectedPlayerId || '';
    if (action === 'approve' && !playerId) {
      if (!confirm('No player selected — approve without linking?')) return;
    }
    try {
      var resp = await fetch('/admin/users/' + REG_ID + '/' + action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId }),
      });
      var j = await resp.json();
      if (!resp.ok) throw new Error(j.error || 'Failed');
      location.href = '/admin/users/' + REG_ID;
    } catch(e) { alert(e.message); }
  };

  window.confirmReset = async function() {
    if (!confirm('Reset this registration back to pending? The player record will not be affected.')) return;
    try {
      var resp = await fetch('/admin/users/' + REG_ID + '/reset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      var j = await resp.json();
      if (!resp.ok) throw new Error(j.error || 'Failed');
      location.href = '/admin/users/' + REG_ID;
    } catch(e) { alert(e.message); }
  };

  window.toggleAdmin = async function() {
    var btn = document.getElementById('admin-toggle-btn');
    var isAdmin = btn && btn.textContent.trim().startsWith('🔒');
    var msg = isAdmin ? 'Revoke admin access for this user?' : 'Grant admin access to this user? They will be able to access the admin panel.';
    if (!confirm(msg)) return;
    try {
      var resp = await fetch('/admin/users/' + REG_ID + '/toggle-admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      var j = await resp.json();
      if (!resp.ok) throw new Error(j.error || 'Failed');
      location.reload();
    } catch(e) { alert(e.message); }
  };

  window.openReject = function() {
    document.getElementById('reject-notes').value = '';
    document.getElementById('reject-backdrop').style.display = 'flex';
  };

  var confirmBtn = document.getElementById('reject-confirm');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async function() {
      var notes = document.getElementById('reject-notes').value.trim();
      document.getElementById('reject-backdrop').style.display = 'none';
      try {
        var resp = await fetch('/admin/users/' + REG_ID + '/reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes }),
        });
        var j = await resp.json();
        if (!resp.ok) throw new Error(j.error || 'Failed');
        location.href = '/admin/users/' + REG_ID;
      } catch(e) { alert(e.message); }
    });
  }
})();
</script>`;
}
