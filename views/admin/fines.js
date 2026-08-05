import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';

function fmtDate(ms) {
  return ms ? new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
}
function peso(n) { return '₱' + Number(n || 0).toLocaleString(); }

function statusBadge(status) {
  if (status === 'approved') return `<span class="agm-badge agm-badge--blue">Fined</span>`;
  if (status === 'rejected') return `<span class="agm-badge agm-badge--gray">Rejected</span>`;
  if (status === 'pending_admin') return `<span class="agm-badge agm-badge--amber">Pending Escalation</span>`;
  if (status === 'dismissed') return `<span class="agm-badge agm-badge--gray">Dismissed</span>`;
  return `<span class="agm-badge agm-badge--amber">Open</span>`;
}

function reportModal(players, categories) {
  const playersData = JSON.stringify(players.map(p => ({ id: p.id, name: displayPlayerName(p.name) }))).replace(/</g, '\\u003c');
  const categoryOptions = categories.map(c => `<option value="${escHtml(c.id)}" data-amount="${c.amount}">${escHtml(c.label)} (${peso(c.amount)})</option>`).join('');
  return `
<div class="agm-modal-backdrop" id="fine-modal-backdrop" hidden>
  <div class="agm-modal">
    <div class="agm-modal-header">
      <h3 class="agm-modal-title">Report Incident</h3>
      <button class="agm-modal-close" id="fine-modal-close">&times;</button>
    </div>
    <div class="agm-modal-body" style="display:flex;flex-direction:column;gap:12px">
      <div>
        <label class="admin-field-label">Player</label>
        <div style="position:relative">
          <input id="fine-player-search" type="text" class="admin-input" placeholder="Search players…" autocomplete="off">
          <input type="hidden" id="fine-player-id">
          <div id="fine-player-dropdown" style="display:none;position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:20;background:#0f1623;border:1px solid #1c2840;border-radius:6px;max-height:220px;overflow-y:auto"></div>
        </div>
      </div>
      <div>
        <label class="admin-field-label">Category</label>
        <select id="fine-category" class="admin-input">${categoryOptions}</select>
      </div>
      <div>
        <label class="admin-field-label">What happened</label>
        <textarea id="fine-description" class="admin-input" rows="4" placeholder="Describe the incident — game, context, who saw it…"></textarea>
      </div>
      <div id="fine-modal-msg" class="text-xs text-error" style="display:none"></div>
      <button class="agm-new-btn" id="fine-submit-btn">File Report</button>
    </div>
  </div>
</div>
<style>.priv-search-result{display:block;width:100%;text-align:left;padding:10px 14px;font-size:13px;color:#94a3b8;background:transparent;border:none;border-bottom:1px solid rgba(28,40,64,.5);cursor:pointer}.priv-search-result:hover{background:rgba(255,255,255,.04);color:#e2e8f0}</style>
<script>
(function() {
  var PLAYERS = ${playersData};
  var input = document.getElementById('fine-player-search');
  var hidden = document.getElementById('fine-player-id');
  var dropdown = document.getElementById('fine-player-dropdown');
  input.addEventListener('input', function() {
    hidden.value = '';
    var q = this.value.trim().toLowerCase();
    if (!q) { dropdown.style.display = 'none'; return; }
    var results = PLAYERS.filter(function(p) { return p.name.toLowerCase().includes(q); }).slice(0, 10);
    dropdown.innerHTML = results.length
      ? results.map(function(p) { return '<button type="button" class="priv-search-result" data-id="' + p.id + '" data-name="' + p.name.replace(/"/g, '&quot;') + '">' + p.name + '</button>'; }).join('')
      : '<div style="padding:10px 14px;font-size:12px;color:#475569">No matching players</div>';
    dropdown.style.display = 'block';
  });
  dropdown.addEventListener('click', function(e) {
    var btn = e.target.closest('.priv-search-result');
    if (!btn || !btn.dataset.id) return;
    hidden.value = btn.dataset.id;
    input.value = btn.dataset.name;
    dropdown.style.display = 'none';
  });
  document.addEventListener('click', function(e) {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.style.display = 'none';
  });

  document.getElementById('fine-modal-close').addEventListener('click', function() {
    document.getElementById('fine-modal-backdrop').hidden = true;
  });
  window.openFineModal = function() {
    input.value = ''; hidden.value = '';
    document.getElementById('fine-description').value = '';
    document.getElementById('fine-modal-msg').style.display = 'none';
    document.getElementById('fine-modal-backdrop').hidden = false;
  };

  document.getElementById('fine-submit-btn').addEventListener('click', async function() {
    var msg = document.getElementById('fine-modal-msg');
    msg.style.display = 'none';
    if (!hidden.value) { msg.textContent = 'Pick a player from the list.'; msg.style.display = 'block'; return; }
    var btn = this; btn.disabled = true;
    try {
      var r = await fetch('${'REPORT_ENDPOINT'}', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: hidden.value,
          categoryId: document.getElementById('fine-category').value,
          description: document.getElementById('fine-description').value,
        }),
      });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      location.reload();
    } catch (e) {
      msg.textContent = e.message; msg.style.display = 'block'; btn.disabled = false;
    }
  });
})();
</script>`;
}

function caseRow(c, base) {
  return `<tr class="border-b border-admin-border/40 last:border-0 hover:bg-white/[.015] transition-colors">
    <td class="px-4 py-3 text-sm font-medium text-slate-200">${escHtml(displayPlayerName(c.player_name))}</td>
    <td class="px-4 py-3 text-xs text-slate-400">${escHtml(c.category_label)}</td>
    <td class="px-4 py-3 text-sm font-saira text-brand">${peso(c.amount)}</td>
    <td class="px-4 py-3 text-xs text-slate-500">${escHtml(c.reported_by_name)} (${c.reported_by_type})</td>
    <td class="px-4 py-3">${statusBadge(c.status)}</td>
    <td class="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">${fmtDate(c.created_at)}</td>
    <td class="px-4 py-3 text-right"><a href="${base}/${escHtml(c.id)}" class="agm-edit-link">Review</a></td>
  </tr>`;
}

export function adminFinesListBody({ pendingAdmin = [], open = [], resolved = [], players = [], categories = [] } = {}) {
  return `
<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
  <div>
    <h2 class="text-xl font-bold tracking-tight text-slate-100">Fines &amp; Conduct</h2>
    <p class="text-sm text-slate-500 mt-0.5">${open.length} open case${open.length === 1 ? '' : 's'}${pendingAdmin.length ? ` · ${pendingAdmin.length} awaiting escalation` : ''}</p>
  </div>
  <div class="flex items-center gap-2">
    <a href="/admin/fines/heads" class="admin-btn">Team Heads</a>
    <a href="/admin/fines/categories" class="admin-btn">Categories</a>
    <button class="agm-new-btn" onclick="openFineModal()">Report Incident</button>
  </div>
</div>

${pendingAdmin.length ? `
<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden mb-6">
  <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Pending Escalation — player-submitted, needs an admin vote</div>
  <table class="w-full border-collapse"><tbody>${pendingAdmin.map(c => caseRow(c, '/admin/fines')).join('')}</tbody></table>
</div>` : ''}

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden mb-6">
  <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Open cases</div>
  ${open.length === 0
    ? `<div class="p-8 text-center text-sm text-slate-500">No open cases.</div>`
    : `<table class="w-full border-collapse"><tbody>${open.map(c => caseRow(c, '/admin/fines')).join('')}</tbody></table>`}
</div>

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
  <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Resolved</div>
  ${resolved.length === 0
    ? `<div class="p-8 text-center text-sm text-slate-500">No resolved cases yet.</div>`
    : `<table class="w-full border-collapse"><tbody>${resolved.map(c => caseRow(c, '/admin/fines')).join('')}</tbody></table>`}
</div>

${reportModal(players, categories).replace('REPORT_ENDPOINT', '/admin/fines')}`;
}

function voteRow(v) {
  const color = v.vote === 'approve' ? 'text-emerald-400' : 'text-red-400';
  return `<tr class="border-b border-admin-border/40 last:border-0">
    <td class="px-4 py-2.5 text-sm text-slate-200">${escHtml(v.voter_name)} <span class="text-xs text-slate-500">(${v.voter_type})</span></td>
    <td class="px-4 py-2.5 text-sm font-semibold ${color}">${v.vote === 'approve' ? 'Approve' : 'Reject'}</td>
    <td class="px-4 py-2.5 text-xs text-slate-500">${escHtml(v.comment || '—')}</td>
    <td class="px-4 py-2.5 text-xs text-slate-500 text-right whitespace-nowrap">${fmtDate(v.created_at)}</td>
  </tr>`;
}

function escalationVoteRow(v) {
  const color = v.vote === 'escalate' ? 'text-emerald-400' : 'text-red-400';
  return `<tr class="border-b border-admin-border/40 last:border-0">
    <td class="px-4 py-2.5 text-sm text-slate-200">${escHtml(v.admin_name)}</td>
    <td class="px-4 py-2.5 text-sm font-semibold ${color}">${v.vote === 'escalate' ? 'Escalate' : 'Dismiss'}</td>
    <td class="px-4 py-2.5 text-xs text-slate-500">${escHtml(v.comment || '—')}</td>
    <td class="px-4 py-2.5 text-xs text-slate-500 text-right whitespace-nowrap">${fmtDate(v.created_at)}</td>
  </tr>`;
}

const descriptionCard = c => `<div class="bg-admin-surface border border-admin-border rounded-lg p-5">
  <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Description</div>
  <p class="text-sm text-slate-300 leading-relaxed">${escHtml(c.description) || '<span class="text-slate-600">No description provided.</span>'}</p>
  <p class="text-xs text-slate-600 mt-3">Reported by ${escHtml(c.reported_by_name)} (${c.reported_by_type}) · ${fmtDate(c.created_at)}</p>
</div>`;

export function adminFineCaseBody({ case: c, votes = [], player, escalationVotes = [], totalAdmins = 0, viewerAdminId = '', isSuperAdmin = false } = {}) {
  const header = `
<div class="mb-5">
  <a href="/admin/fines" class="text-xs text-slate-500 hover:text-slate-300 no-underline">&larr; Back to Fines</a>
  <div class="flex items-center gap-3 mt-2">
    <h2 class="text-xl font-bold tracking-tight text-slate-100">${escHtml(displayPlayerName(c.player_name))}</h2>
    ${statusBadge(c.status)}
  </div>
  <p class="text-sm text-slate-500 mt-1">${escHtml(c.category_label)} · <span class="text-brand font-saira">${peso(c.amount)}</span>${player?.team_name ? ` · ${escHtml(player.team_name)}` : ''}</p>
</div>`;

  // ── Player-submitted, awaiting an admin escalation vote ────────────────────────
  if (c.status === 'pending_admin') {
    const escalateCount = escalationVotes.filter(v => v.vote === 'escalate').length;
    const dismissCount  = escalationVotes.filter(v => v.vote === 'dismiss').length;
    const escalateNeeded = Math.floor(totalAdmins / 2) + 1;
    const dismissNeeded  = totalAdmins - escalateNeeded + 1;
    const myVote = escalationVotes.find(v => v.admin_id === viewerAdminId);
    return `${header}
<div class="grid gap-5" style="grid-template-columns:1fr 340px;align-items:start">
  <div class="flex flex-col gap-5">
    ${descriptionCard(c)}

    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Escalation votes (${escalateCount} escalate · ${dismissCount} dismiss — needs ${escalateNeeded} of ${totalAdmins} to escalate, ${dismissNeeded} to dismiss)</div>
      ${escalationVotes.length === 0
        ? `<div class="p-6 text-center text-sm text-slate-500">No votes yet.</div>`
        : `<table class="w-full border-collapse"><tbody>${escalationVotes.map(escalationVoteRow).join('')}</tbody></table>`}
    </div>

    <div class="bg-admin-surface border border-admin-border rounded-lg p-5">
      <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Cast your vote${myVote ? ` — you voted ${myVote.vote === 'escalate' ? 'Escalate' : 'Dismiss'}` : ''}</div>
      <textarea id="esc-comment" class="admin-input mb-3" rows="2" placeholder="Optional comment…">${myVote ? escHtml(myVote.comment) : ''}</textarea>
      <div class="flex gap-2">
        <button class="admin-btn admin-btn--success" onclick="castEscalationVote('escalate')">Escalate to heads</button>
        <button class="admin-btn admin-btn--danger" onclick="castEscalationVote('dismiss')">Dismiss</button>
      </div>
    </div>
  </div>

  <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden" style="position:sticky;top:24px">
    <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Escalation</div>
    <div class="p-4">
      <p class="text-xs text-slate-500 leading-relaxed">A player filed this report directly. Once a majority of admins vote to escalate, it moves to team heads for a recommendation — you still have final say after that, same as any other case.</p>
      ${isSuperAdmin ? `
      <div class="mt-4 pt-4" style="border-top:1px solid var(--border-2)">
        <p class="text-[11px] text-slate-600 mb-2">Super admin override — use if the vote has stalled.</p>
        <div class="flex flex-col gap-2">
          <button class="admin-btn admin-btn--block" onclick="forceEscalation(true)">Force Escalate</button>
          <button class="admin-btn admin-btn--danger admin-btn--block" onclick="forceEscalation(false)">Force Dismiss</button>
        </div>
      </div>` : ''}
    </div>
  </div>
</div>

<script>
window.castEscalationVote = async function(vote) {
  var btn = event.target; btn.disabled = true;
  try {
    var r = await fetch('/admin/fines/${escHtml(c.id)}/escalate-vote', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote: vote, comment: document.getElementById('esc-comment').value }),
    });
    var j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Failed');
    location.reload();
  } catch (e) { alert(e.message); btn.disabled = false; }
};
window.forceEscalation = async function(escalate) {
  if (!confirm(escalate ? 'Force-escalate this case to team heads?' : 'Force-dismiss this case?')) return;
  try {
    var r = await fetch('/admin/fines/${escHtml(c.id)}/force-escalation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ escalate: escalate }),
    });
    var j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Failed');
    location.reload();
  } catch (e) { alert(e.message); }
};
</script>`;
  }

  // ── Dismissed by admin vote (or forced) before ever reaching a head ────────────
  if (c.status === 'dismissed') {
    const escalateCount = escalationVotes.filter(v => v.vote === 'escalate').length;
    const dismissCount  = escalationVotes.filter(v => v.vote === 'dismiss').length;
    return `${header}
<div class="grid gap-5" style="grid-template-columns:1fr 340px;align-items:start">
  <div class="flex flex-col gap-5">
    ${descriptionCard(c)}
    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Escalation votes (${escalateCount} escalate · ${dismissCount} dismiss)</div>
      ${escalationVotes.length === 0
        ? `<div class="p-6 text-center text-sm text-slate-500">No votes recorded.</div>`
        : `<table class="w-full border-collapse"><tbody>${escalationVotes.map(escalationVoteRow).join('')}</tbody></table>`}
    </div>
  </div>

  <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden" style="position:sticky;top:24px">
    <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Resolution</div>
    <div class="p-4">
      <p class="text-sm text-slate-300">${c.resolution_note ? escHtml(c.resolution_note) : `Dismissed by admin vote — ${dismissCount} dismiss vs ${escalateCount} escalate.`}</p>
      <p class="text-xs text-slate-600 mt-2">Never reached team heads. The reporting player was notified.</p>
    </div>
  </div>
</div>`;
  }

  // ── Open (head-voting) / approved / rejected — unchanged from before escalation existed ──
  const approveCount = votes.filter(v => v.vote === 'approve').length;
  const rejectCount  = votes.filter(v => v.vote === 'reject').length;
  const isOpen = c.status === 'open';
  return `${header}
<div class="grid gap-5" style="grid-template-columns:1fr 340px;align-items:start">
  <div class="flex flex-col gap-5">
    ${descriptionCard(c)}

    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Votes (${approveCount} approve · ${rejectCount} reject)</div>
      ${votes.length === 0
        ? `<div class="p-6 text-center text-sm text-slate-500">No votes yet.</div>`
        : `<table class="w-full border-collapse"><tbody>${votes.map(voteRow).join('')}</tbody></table>`}
    </div>

    ${isOpen ? `
    <div class="bg-admin-surface border border-admin-border rounded-lg p-5">
      <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Cast your vote</div>
      <textarea id="vote-comment" class="admin-input mb-3" rows="2" placeholder="Optional comment…"></textarea>
      <div class="flex gap-2">
        <button class="admin-btn admin-btn--success" onclick="castVote('approve')">Approve</button>
        <button class="admin-btn admin-btn--danger" onclick="castVote('reject')">Reject</button>
      </div>
    </div>` : ''}
  </div>

  <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden" style="position:sticky;top:24px">
    <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">${isOpen ? 'Resolve' : 'Resolution'}</div>
    <div class="p-4">
      ${isOpen ? `
      <p class="text-xs text-slate-500 mb-3 leading-relaxed">The vote tally above is guidance — the final call is yours. Approving charges ${peso(c.amount)} to the player's ledger (category: Penalty) and notifies them.</p>
      <textarea id="resolve-note" class="admin-input mb-3" rows="2" placeholder="Optional resolution note…"></textarea>
      <div class="flex flex-col gap-2">
        <button class="agm-new-btn" onclick="resolveCase(true)">Approve &amp; Charge ${peso(c.amount)}</button>
        <button class="admin-btn admin-btn--danger" onclick="resolveCase(false)">Reject — No Fine</button>
      </div>
      ` : `
      <p class="text-sm text-slate-300">Resolved by <strong>${escHtml(c.resolved_by_name)}</strong> on ${fmtDate(c.resolved_at)}.</p>
      ${c.resolution_note ? `<p class="text-xs text-slate-500 mt-2">${escHtml(c.resolution_note)}</p>` : ''}
      ${c.status === 'approved' ? `<p class="text-xs text-emerald-400 mt-3">Charged ${peso(c.amount)} to the player's ledger.</p>` : ''}
      `}
    </div>
  </div>
</div>

<script>
window.castVote = async function(vote) {
  var btn = event.target; btn.disabled = true;
  try {
    var r = await fetch('/admin/fines/${escHtml(c.id)}/vote', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote: vote, comment: document.getElementById('vote-comment').value }),
    });
    var j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Failed');
    location.reload();
  } catch (e) { alert(e.message); btn.disabled = false; }
};
window.resolveCase = async function(approved) {
  if (!confirm(approved ? 'Approve this fine and charge the player?' : 'Reject this case — no fine will be charged?')) return;
  try {
    var r = await fetch('/admin/fines/${escHtml(c.id)}/resolve', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: approved, note: document.getElementById('resolve-note').value }),
    });
    var j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Failed');
    location.reload();
  } catch (e) { alert(e.message); }
};
</script>`;
}

function examplePillsDisplay(examples) {
  if (!examples.length) return '';
  return `<div class="flex flex-wrap gap-1">
    ${examples.map(ex => `<span class="inline-block text-[11px] bg-admin-border/50 text-slate-300 px-2 py-0.5 rounded-full">${escHtml(ex)}</span>`).join('')}
  </div>`;
}

function categoryRow(c) {
  return `<tr class="border-b border-admin-border/40 last:border-0" data-id="${escHtml(c.id)}">
    <td class="px-4 py-3 text-sm font-medium text-slate-200 align-top">${escHtml(c.label)}</td>
    <td class="px-4 py-3 text-sm font-saira text-brand align-top">${peso(c.amount)}</td>
    <td class="px-4 py-3 text-xs text-slate-400 max-w-xs align-top">${c.description ? escHtml(c.description) : `<span class="text-slate-600">—</span>`}</td>
    <td class="px-4 py-3 max-w-sm align-top">${examplePillsDisplay(c.examples) || `<span class="text-xs text-slate-600">—</span>`}</td>
    <td class="px-4 py-3 align-top">${c.active ? `<span class="agm-badge agm-badge--amber">Active</span>` : `<span class="agm-badge agm-badge--gray">Inactive</span>`}</td>
    <td class="px-4 py-3 text-right whitespace-nowrap align-top">
      <button class="admin-btn admin-btn--sm" onclick='openCategoryModal(${JSON.stringify({ id: c.id, label: c.label, amount: c.amount, description: c.description, examples: c.examples }).replace(/'/g, '&#39;')})'>Edit</button>
      <button class="admin-btn admin-btn--sm ${c.active ? 'admin-btn--danger' : 'admin-btn--success'}" onclick="toggleCategory('${escHtml(c.id)}')">${c.active ? 'Deactivate' : 'Activate'}</button>
    </td>
  </tr>`;
}

export function adminFineCategoriesBody({ categories = [] } = {}) {
  return `
<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
  <div>
    <h2 class="text-xl font-bold tracking-tight text-slate-100">Fine Categories</h2>
    <p class="text-sm text-slate-500 mt-0.5">Editable conduct policy — changes apply to new reports immediately.</p>
  </div>
  <div class="flex items-center gap-2">
    <a href="/admin/fines" class="admin-btn">&larr; Back to Fines</a>
    <button class="agm-new-btn" onclick="openCategoryModal(null)">Add Category</button>
  </div>
</div>

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden overflow-x-auto">
  ${categories.length === 0
    ? `<div class="p-8 text-center text-sm text-slate-500">No categories yet.</div>`
    : `<table class="w-full border-collapse">
        <thead><tr class="border-b border-admin-border">
          <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Category</th>
          <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Amount</th>
          <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Description</th>
          <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Examples</th>
          <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</th>
          <th class="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">Actions</th>
        </tr></thead>
        <tbody>${categories.map(categoryRow).join('')}</tbody>
      </table>`}
</div>

<div class="agm-modal-backdrop" id="cat-modal-backdrop" hidden>
  <div class="agm-modal">
    <div class="agm-modal-header">
      <h3 class="agm-modal-title" id="cat-modal-title">Add Category</h3>
      <button class="agm-modal-close" id="cat-modal-close">&times;</button>
    </div>
    <div class="agm-modal-body" style="display:flex;flex-direction:column;gap:12px">
      <input type="hidden" id="cat-id">
      <div>
        <label class="admin-field-label">Label</label>
        <input id="cat-label" type="text" class="admin-input" placeholder="e.g. Standard Unsportsmanlike Conduct">
      </div>
      <div>
        <label class="admin-field-label">Amount (₱)</label>
        <input id="cat-amount" type="number" min="0" step="1" class="admin-input" placeholder="0 for a reference-only, non-fineable category">
      </div>
      <div>
        <label class="admin-field-label">Description</label>
        <textarea id="cat-description" class="admin-input" rows="2" placeholder="One sentence describing this category…"></textarea>
      </div>
      <div>
        <label class="admin-field-label">Examples</label>
        <div id="cat-examples-pills" class="flex flex-wrap gap-1 mb-2"></div>
        <input id="cat-examples-input" type="text" class="admin-input" placeholder="Type an example, press Enter or comma to add…">
      </div>
      <div id="cat-modal-msg" class="text-xs text-error" style="display:none"></div>
      <button class="agm-new-btn" id="cat-submit-btn">Save</button>
    </div>
  </div>
</div>

<script>
var catExamples = [];
function renderCatExamplePills() {
  var container = document.getElementById('cat-examples-pills');
  container.innerHTML = catExamples.map(function(ex, i) {
    var span = document.createElement('span');
    span.textContent = ex;
    return '<span class="inline-flex items-center gap-1.5 text-[11px] bg-admin-border/50 text-slate-300 px-2 py-0.5 rounded-full">' + span.innerHTML +
      '<button type="button" class="text-slate-500 hover:text-red-400" data-i="' + i + '">&times;</button></span>';
  }).join('');
}
document.getElementById('cat-examples-input').addEventListener('keydown', function(e) {
  // Enter-only — commas are a valid character inside a single example (e.g. "getting in
  // faces, chest bumping"), so treating comma as a second add-pill trigger would split
  // that mid-word the moment it's typed. Paste-to-split-many still uses commas, just not
  // this key handler.
  if (e.key === 'Enter') {
    e.preventDefault();
    var val = this.value.trim();
    if (val) { catExamples.push(val); renderCatExamplePills(); this.value = ''; }
  } else if (e.key === 'Backspace' && !this.value && catExamples.length) {
    catExamples.pop(); renderCatExamplePills();
  }
});
// Pasting a comma-separated list (e.g. copied straight from the original policy doc)
// splits into multiple pills at once instead of landing as one giant pill.
document.getElementById('cat-examples-input').addEventListener('paste', function(e) {
  var text = (e.clipboardData || window.clipboardData).getData('text');
  if (!text || text.indexOf(',') === -1) return;
  e.preventDefault();
  text.split(',').map(function(s) { return s.trim(); }).filter(Boolean).forEach(function(s) { catExamples.push(s); });
  renderCatExamplePills();
});
document.getElementById('cat-examples-pills').addEventListener('click', function(e) {
  var btn = e.target.closest('button[data-i]');
  if (!btn) return;
  catExamples.splice(Number(btn.dataset.i), 1);
  renderCatExamplePills();
});

document.getElementById('cat-modal-close').addEventListener('click', function() { document.getElementById('cat-modal-backdrop').hidden = true; });
window.openCategoryModal = function(cat) {
  document.getElementById('cat-modal-title').textContent = cat ? 'Edit Category' : 'Add Category';
  document.getElementById('cat-id').value = cat ? cat.id : '';
  document.getElementById('cat-label').value = cat ? cat.label : '';
  document.getElementById('cat-amount').value = cat ? cat.amount : '';
  document.getElementById('cat-description').value = cat ? (cat.description || '') : '';
  catExamples = cat && Array.isArray(cat.examples) ? cat.examples.slice() : [];
  renderCatExamplePills();
  document.getElementById('cat-examples-input').value = '';
  document.getElementById('cat-modal-msg').style.display = 'none';
  document.getElementById('cat-modal-backdrop').hidden = false;
};
document.getElementById('cat-submit-btn').addEventListener('click', async function() {
  var msg = document.getElementById('cat-modal-msg');
  msg.style.display = 'none';
  var id = document.getElementById('cat-id').value;
  // A pending, not-yet-committed example still sitting in the input counts too — easy to
  // type one and hit Save without remembering to press Enter first.
  var pending = document.getElementById('cat-examples-input').value.trim();
  var examples = pending ? catExamples.concat([pending]) : catExamples.slice();
  var body = {
    label: document.getElementById('cat-label').value.trim(),
    amount: Number(document.getElementById('cat-amount').value),
    description: document.getElementById('cat-description').value.trim(),
    examples: examples,
  };
  if (!body.label || Number.isNaN(body.amount) || body.amount < 0) { msg.textContent = 'Label and an amount of 0 or more are required.'; msg.style.display = 'block'; return; }
  var btn = this; btn.disabled = true;
  try {
    var r = await fetch(id ? '/admin/fines/categories/' + id : '/admin/fines/categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    var j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Failed');
    location.reload();
  } catch (e) { msg.textContent = e.message; msg.style.display = 'block'; btn.disabled = false; }
});
window.toggleCategory = async function(id) {
  try {
    var r = await fetch('/admin/fines/categories/' + id + '/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    var j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Failed');
    location.reload();
  } catch (e) { alert(e.message); }
};
</script>`;
}

function headRow(h) {
  return `<tr class="border-b border-admin-border/40 last:border-0">
    <td class="px-4 py-3 text-sm font-medium text-slate-200">${escHtml(displayPlayerName(h.player_name))}</td>
    <td class="px-4 py-3 text-xs text-slate-500">${escHtml(h.team_name)}</td>
    <td class="px-4 py-3 text-right"><button class="admin-btn admin-btn--sm admin-btn--danger" onclick="revokeHead('${escHtml(h.id)}', ${JSON.stringify(displayPlayerName(h.player_name))})">Revoke</button></td>
  </tr>`;
}

export function adminFineHeadsBody({ heads = [], teams = [], players = [] } = {}) {
  const teamOptions = teams.map(t => `<option value="${escHtml(t.id)}">${escHtml(t.name)}</option>`).join('');
  const playersData = JSON.stringify(players.map(p => ({ id: p.id, name: displayPlayerName(p.name) }))).replace(/</g, '\\u003c');
  return `
<div class="mb-6">
  <a href="/admin/fines" class="text-xs text-slate-500 hover:text-slate-300 no-underline">&larr; Back to Fines</a>
  <h2 class="text-xl font-bold tracking-tight text-slate-100 mt-2">Team Heads / Coaches</h2>
  <p class="text-sm text-slate-500 mt-0.5">${heads.length} head${heads.length === 1 ? '' : 's'} — can vote on and file fine cases at <code class="text-[11px] bg-admin-border/50 px-1 rounded">/fines</code>, logged in as themselves.</p>
</div>

<div class="grid gap-5" style="grid-template-columns:1fr 360px;align-items:start">
  <div class="bg-admin-surface border border-admin-border rounded-xl overflow-hidden">
    <div class="px-5 py-3.5 border-b border-admin-border">
      <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Current Heads</div>
    </div>
    ${heads.length === 0
      ? `<div class="p-8 text-center text-sm text-slate-500">No team heads yet — grant access from the panel on the right.</div>`
      : `<table class="w-full border-collapse"><tbody>${heads.map(headRow).join('')}</tbody></table>`}
  </div>

  <div class="bg-admin-surface border border-admin-border rounded-xl overflow-hidden" style="position:sticky;top:24px">
    <div class="px-5 py-3.5 border-b border-admin-border">
      <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Grant Access</div>
    </div>
    <div class="px-5 py-4 flex flex-col gap-3">
      <div>
        <label class="admin-field-label">Team</label>
        <select id="head-team" class="admin-input">${teamOptions}</select>
      </div>
      <div style="position:relative">
        <label class="admin-field-label">Player</label>
        <input id="head-player-search" type="text" class="admin-input" placeholder="Search players…" autocomplete="off">
        <input type="hidden" id="head-player-id">
        <div id="head-player-dropdown" style="display:none;position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:20;background:#0f1623;border:1px solid #1c2840;border-radius:6px;max-height:220px;overflow-y:auto"></div>
      </div>
      <div id="head-msg" class="text-xs text-error" style="display:none"></div>
      <button class="agm-new-btn" id="head-grant-btn">Grant Access</button>
      <p class="text-[11px] text-slate-600 mt-1">Heads log in through the normal player login — no separate password.</p>
    </div>
  </div>
</div>

<style>.priv-search-result{display:block;width:100%;text-align:left;padding:10px 14px;font-size:13px;color:#94a3b8;background:transparent;border:none;border-bottom:1px solid rgba(28,40,64,.5);cursor:pointer}.priv-search-result:hover{background:rgba(255,255,255,.04);color:#e2e8f0}</style>
<script>
(function() {
  var PLAYERS = ${playersData};
  var input = document.getElementById('head-player-search');
  var hidden = document.getElementById('head-player-id');
  var dropdown = document.getElementById('head-player-dropdown');
  input.addEventListener('input', function() {
    hidden.value = '';
    var q = this.value.trim().toLowerCase();
    if (!q) { dropdown.style.display = 'none'; return; }
    var results = PLAYERS.filter(function(p) { return p.name.toLowerCase().includes(q); }).slice(0, 10);
    dropdown.innerHTML = results.length
      ? results.map(function(p) { return '<button type="button" class="priv-search-result" data-id="' + p.id + '" data-name="' + p.name.replace(/"/g, '&quot;') + '">' + p.name + '</button>'; }).join('')
      : '<div style="padding:10px 14px;font-size:12px;color:#475569">No matching players</div>';
    dropdown.style.display = 'block';
  });
  dropdown.addEventListener('click', function(e) {
    var btn = e.target.closest('.priv-search-result');
    if (!btn || !btn.dataset.id) return;
    hidden.value = btn.dataset.id;
    input.value = btn.dataset.name;
    dropdown.style.display = 'none';
  });
  document.addEventListener('click', function(e) {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.style.display = 'none';
  });

  document.getElementById('head-grant-btn').addEventListener('click', async function() {
    var msg = document.getElementById('head-msg');
    msg.style.display = 'none';
    if (!hidden.value) { msg.textContent = 'Pick a player from the list.'; msg.style.display = 'block'; return; }
    var btn = this; btn.disabled = true;
    try {
      var r = await fetch('/admin/fines/heads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: document.getElementById('head-team').value, playerId: hidden.value }),
      });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      location.reload();
    } catch (e) { msg.textContent = e.message; msg.style.display = 'block'; btn.disabled = false; }
  });
})();

window.revokeHead = async function(id, name) {
  if (!confirm('Revoke head/coach access for ' + name + '?')) return;
  try {
    var r = await fetch('/admin/fines/heads/' + id + '/revoke', { method: 'POST' });
    if (!r.ok) throw new Error('Failed');
    location.reload();
  } catch (e) { alert(e.message); }
};
</script>`;
}
