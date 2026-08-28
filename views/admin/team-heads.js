import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';

function headRow(h) {
  return `<tr class="border-b border-admin-border/40 last:border-0">
    <td class="px-4 py-3 text-sm font-medium text-slate-200">${escHtml(displayPlayerName(h.player_name))}</td>
    <td class="px-4 py-3 text-xs text-slate-500">${escHtml(h.team_name)}</td>
    <td class="px-4 py-3 text-right"><button class="admin-btn admin-btn--sm admin-btn--danger" onclick="revokeHead('${escHtml(h.id)}', ${escHtml(JSON.stringify(displayPlayerName(h.player_name)))})">Revoke</button></td>
  </tr>`;
}

// A team head is a normal registered player granted one extra privilege, scoped to their
// team — not folded into is_admin/isElevatedPlayer (docs/agents/features/admin-core.md).
// Started out gating only Fines (/fines), now also gates the payments-status page (/team),
// hence living under Members rather than nested under Fines.
export function adminTeamHeadsBody({ heads = [], teams = [], players = [] } = {}) {
  const teamOptions = teams.map(t => `<option value="${escHtml(t.id)}">${escHtml(t.name)}</option>`).join('');
  const playersData = JSON.stringify(players.map(p => ({ id: p.id, name: displayPlayerName(p.name) }))).replace(/</g, '\\u003c');
  return `
<div class="mb-6">
  <h2 class="text-xl font-bold tracking-tight text-slate-100">Team Heads / Coaches</h2>
  <p class="text-sm text-slate-500 mt-0.5">${heads.length} head${heads.length === 1 ? '' : 's'} — can vote on and file fine cases at <code class="text-[11px] bg-admin-border/50 px-1 rounded">/fines</code> and view their team's payment status at <code class="text-[11px] bg-admin-border/50 px-1 rounded">/team</code>, logged in as themselves.</p>
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
      var r = await fetch('/admin/team-heads', {
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
    var r = await fetch('/admin/team-heads/' + id + '/revoke', { method: 'POST' });
    if (!r.ok) throw new Error('Failed');
    location.reload();
  } catch (e) { alert(e.message); }
};
</script>`;
}
