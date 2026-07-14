import { escHtml } from '../layout.js';
import { displayPlayerName, teamColor } from '../utils.js';

const STATUS_BADGE = {
  pending:  { label: 'Pending',  cls: 'bg-amber-500/15 text-amber-400' },
  approved: { label: 'Approved', cls: 'bg-green-500/15 text-green-400' },
  rejected: { label: 'Rejected', cls: 'bg-red-500/15  text-red-400'   },
};

function badge(status) {
  const b = STATUS_BADGE[status] || STATUS_BADGE.pending;
  return `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${b.cls}">${b.label}</span>`;
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function posChips(positions) {
  try {
    const arr = typeof positions === 'string' ? JSON.parse(positions) : (positions || []);
    return arr.map(p => `<span class="text-[10px] bg-admin-border/60 text-slate-400 px-1.5 py-0.5 rounded">${escHtml(p)}</span>`).join(' ');
  } catch { return '—'; }
}

export function adminRegistrationsBody({ registrations = [], players = [] } = {}) {
  const pending  = registrations.filter(r => r.status === 'pending');
  const resolved = registrations.filter(r => r.status !== 'pending');

  // Build player options for the link dropdown
  const playerOpts = players.map(p => {
    const name = `${p.last_name?.toUpperCase() || ''}, ${p.first_name || ''}`.trim();
    const display = displayPlayerName(name) || name;
    return `<option value="${escHtml(p.id)}">${escHtml(display)} (${escHtml(p.team_name || '—')})</option>`;
  }).join('');

  function regCard(r) {
    const positions = posChips(r.positions);
    const match = r.player_id
      ? players.find(p => p.id === r.player_id)
      : null;
    const matchName = match
      ? displayPlayerName(`${match.last_name?.toUpperCase()}, ${match.first_name}`)
      : null;
    const isPending  = r.status === 'pending';
    const isApproved = r.status === 'approved' && r.player_id;

    return `<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden mb-3" id="reg-${escHtml(r.id)}">
  <div class="flex items-start justify-between gap-4 px-5 py-4">
    <div class="min-w-0">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-base font-bold text-slate-100">${escHtml(r.full_name)}</span>
        ${badge(r.status)}
      </div>
      <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-2">
        <span>${escHtml(r.email)}</span>
        ${r.phone ? `<span>${escHtml(r.phone)}</span>` : ''}
        ${r.birthday ? `<span>Born ${escHtml(r.birthday)}</span>` : ''}
        ${r.height ? `<span>${escHtml(r.height)} cm</span>` : ''}
        ${r.weight ? `<span>${escHtml(r.weight)} kg</span>` : ''}
        ${r.experience ? `<span class="capitalize">${escHtml(r.experience)}</span>` : ''}
        ${r.referred_by ? `<span>Referred by: <strong class="text-slate-400">${escHtml(r.referred_by)}</strong></span>` : ''}
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        ${positions}
      </div>
      ${r.emergency_name ? `<div class="text-[11px] text-slate-600 mt-1.5">Emergency: ${escHtml(r.emergency_name)} ${r.emergency_phone ? escHtml(r.emergency_phone) : ''}</div>` : ''}
      ${matchName ? `<div class="mt-2 text-xs text-green-400">✓ Linked to: <strong>${escHtml(matchName)}</strong></div>` : ''}
      ${r.motto ? `<div class="mt-2 text-xs text-slate-400 italic">"${escHtml(r.motto)}"</div>` : ''}
      ${r.notes ? `<div class="mt-2 text-xs text-slate-500 italic">${escHtml(r.notes)}</div>` : ''}
    </div>
    <div class="text-xs text-slate-600 shrink-0">${fmtDate(r.created_at)}</div>
  </div>

  ${isApproved ? `<div class="border-t border-admin-border px-5 py-3 bg-black/10 flex items-center justify-between gap-3">
    <span class="text-[11px] text-slate-500">Registration data not yet synced to player profile.</span>
    <button onclick="regAction('${escHtml(r.id)}','sync')"
      class="px-3 py-2 text-xs font-bold bg-slate-500/15 text-slate-300 border border-slate-500/30 rounded-md hover:bg-slate-500/25 transition-colors shrink-0">
      ↻ Re-sync to Player
    </button>
  </div>` : ''}

  ${isPending ? `<div class="border-t border-admin-border px-5 py-3 bg-black/10">
    <div class="flex flex-wrap items-end gap-3">
      <div class="flex-1 min-w-[200px]">
        <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Link to existing player</label>
        <select id="sel-${escHtml(r.id)}" class="w-full bg-admin-border/50 border border-admin-border rounded-md px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-brand">
          <option value="">— No match / select player —</option>
          ${playerOpts}
        </select>
      </div>
      <div class="flex gap-2 pb-px">
        <button onclick="regAction('${escHtml(r.id)}','approve')"
          class="px-3 py-2 text-xs font-bold bg-green-500/15 text-green-400 border border-green-500/30 rounded-md hover:bg-green-500/25 transition-colors">
          ✓ Approve &amp; Link
        </button>
        <button onclick="regAction('${escHtml(r.id)}','create')"
          class="px-3 py-2 text-xs font-bold bg-brand/15 text-brand border border-brand/30 rounded-md hover:bg-brand/25 transition-colors">
          + Create Player
        </button>
        <button onclick="regReject('${escHtml(r.id)}')"
          class="px-3 py-2 text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-md hover:bg-red-500/20 transition-colors">
          ✗ Reject
        </button>
      </div>
    </div>
  </div>` : ''}
</div>`;
  }

  return `
<div class="mb-6 flex items-center justify-between gap-3">
  <div>
    <h2 class="text-xl font-bold tracking-tight text-slate-100">Registrations</h2>
    <p class="text-sm text-slate-500 mt-0.5">${pending.length} pending · ${resolved.length} resolved</p>
  </div>
</div>

${pending.length === 0 && resolved.length === 0
  ? `<div class="bg-admin-surface border border-admin-border rounded-lg p-12 text-center text-sm text-slate-500">No registrations yet. Share the link: <a href="/register" class="text-brand hover:underline">/register</a></div>`
  : ''}

${pending.length > 0 ? `
<div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
  Pending Review (${pending.length})
</div>
${pending.map(regCard).join('')}` : ''}

${resolved.length > 0 ? `
<div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 mt-6">
  Resolved (${resolved.length})
</div>
${resolved.map(regCard).join('')}` : ''}

<!-- Reject modal -->
<div id="reject-backdrop" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:50;align-items:center;justify-content:center">
  <div class="bg-admin-surface border border-admin-border rounded-xl p-6" style="width:100%;max-width:420px">
    <div class="text-sm font-bold text-slate-200 mb-3">Reject Registration</div>
    <textarea id="reject-notes" rows="3" placeholder="Reason (optional)..."
      class="w-full bg-admin-border/50 border border-admin-border rounded-md px-3 py-2 text-sm text-slate-300 resize-none focus:outline-none focus:border-brand mb-3"></textarea>
    <div class="flex justify-end gap-2">
      <button onclick="document.getElementById('reject-backdrop').style.display='none'"
        class="px-4 py-2 text-xs font-bold text-slate-400 bg-admin-border/30 rounded-md hover:bg-admin-border/60">Cancel</button>
      <button id="reject-confirm"
        class="px-4 py-2 text-xs font-bold text-red-400 bg-red-500/15 border border-red-500/30 rounded-md hover:bg-red-500/25">Confirm Reject</button>
    </div>
  </div>
</div>

<script>
(function() {
  var _rejectId = null;

  window.regAction = async function(id, action) {
    var sel = document.getElementById('sel-' + id);
    var playerId = sel ? sel.value : '';

    if (action === 'approve' && !playerId) {
      if (!confirm('No player selected — approve without linking to a player?')) return;
    }

    try {
      var r = await fetch('/admin/registrations/' + id + '/' + action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId }),
      });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      location.reload();
    } catch(e) { alert(e.message); }
  };

  window.regReject = function(id) {
    _rejectId = id;
    document.getElementById('reject-notes').value = '';
    document.getElementById('reject-backdrop').style.display = 'flex';
  };

  document.getElementById('reject-confirm').addEventListener('click', async function() {
    var notes = document.getElementById('reject-notes').value.trim();
    document.getElementById('reject-backdrop').style.display = 'none';
    try {
      var r = await fetch('/admin/registrations/' + _rejectId + '/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      location.reload();
    } catch(e) { alert(e.message); }
  });
})();
</script>`;
}
