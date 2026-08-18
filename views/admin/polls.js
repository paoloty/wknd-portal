import { escHtml } from '../layout.js';

const TIER_LABEL = { admins: 'Admins', heads: 'Team Heads', players: 'All Players' };
const BAR_COLORS = ['#f59332', '#38bdf8', '#a78bfa', '#34d399', '#f87171', '#fbbf24'];

function fmtDate(ts) {
  return ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

function tally(poll) {
  const counts = poll.options.map(() => 0);
  for (const v of poll.votes) if (counts[v.option_index] !== undefined) counts[v.option_index]++;
  const total = counts.reduce((a, b) => a + b, 0);
  return { counts, total };
}

function pollCard(poll, { canManage = true } = {}) {
  const { counts, total } = tally(poll);
  const isOpen = poll.status === 'open';
  const rows = poll.options.map((opt, i) => {
    const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
    const color = BAR_COLORS[i % BAR_COLORS.length];
    return `
    <div class="py-1.5">
      <div class="flex items-center justify-between text-xs mb-1">
        <span class="text-slate-300 font-medium">${escHtml(opt)}</span>
        <span class="text-slate-500" style="font-variant-numeric:tabular-nums">${counts[i]} &middot; ${pct}%</span>
      </div>
      <div class="h-1.5 rounded-full bg-admin-border/60 overflow-hidden"><div style="width:${pct}%;background:${color};height:100%;border-radius:99px"></div></div>
    </div>`;
  }).join('');

  const voters = poll.votes.length
    ? `<div class="text-[11px] text-slate-600 mt-2 truncate">Voted: ${poll.votes.map(v => escHtml(v.voter_name || 'Someone')).join(', ')}</div>`
    : '';

  return `
<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden mb-4" data-poll-id="${escHtml(poll.id)}">
  <div class="px-4 py-3 border-b border-admin-border flex items-start justify-between gap-3 flex-wrap">
    <div class="min-w-0">
      <div class="text-sm font-semibold text-slate-200">${escHtml(poll.question)}</div>
      ${poll.description ? `<div class="text-xs text-slate-500 mt-1 leading-relaxed">${escHtml(poll.description)}</div>` : ''}
      <div class="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1.5 flex-wrap">
        <span class="agm-badge ${isOpen ? 'agm-badge--amber' : 'agm-badge--gray'}">${isOpen ? 'Open' : 'Closed'}</span>
        <span>Sees it: <b class="text-slate-400 font-semibold">${TIER_LABEL[poll.visibility]}</b></span>
        <span>&middot;</span>
        <span>Votes: <b class="text-slate-400 font-semibold">${TIER_LABEL[poll.voter_eligibility]}</b></span>
        <span>&middot;</span>
        <span>${fmtDate(poll.created_at)}</span>
      </div>
    </div>
    ${canManage ? `<button class="admin-btn admin-btn--sm ${isOpen ? 'admin-btn--danger' : 'admin-btn--success'}" onclick="setPollStatus('${escHtml(poll.id)}', '${isOpen ? 'closed' : 'open'}')">${isOpen ? 'Close' : 'Reopen'}</button>` : ''}
  </div>
  <div class="p-4">
    ${rows}
    <div class="text-[10px] text-slate-600 mt-2">n=${total}</div>
    ${voters}
  </div>
</div>`;
}

export function adminPollsBody({ polls = [] } = {}) {
  const cards = polls.length === 0
    ? `<div class="p-12 text-center text-sm text-slate-500 bg-admin-surface border border-admin-border rounded-lg">No polls yet.</div>`
    : polls.map(p => pollCard(p)).join('');

  return `
<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
  <div>
    <h2 class="text-xl font-bold tracking-tight text-slate-100">League Polls</h2>
    <p class="text-sm text-slate-500 mt-0.5">Visibility controls who sees results; voter eligibility controls who can vote — the two can differ.</p>
  </div>
  <button class="agm-new-btn" onclick="openPollModal()">New Poll</button>
</div>

<div style="max-width:640px">${cards}</div>

<div class="agm-modal-backdrop" id="poll-modal-backdrop" hidden>
  <div class="agm-modal">
    <div class="agm-modal-header">
      <h3 class="agm-modal-title">New Poll</h3>
      <button class="agm-modal-close" id="poll-modal-close">&times;</button>
    </div>
    <div class="agm-modal-body" style="display:flex;flex-direction:column;gap:12px">
      <div>
        <label class="admin-field-label">Question</label>
        <input id="poll-question" type="text" class="admin-input" placeholder="e.g. Should we shuffle teams next season?">
      </div>
      <div>
        <label class="admin-field-label">Description <span class="text-slate-500 font-normal">(optional)</span></label>
        <textarea id="poll-description" class="admin-input" rows="2" placeholder="A sentence or two of context, shown under the question…"></textarea>
      </div>
      <div>
        <label class="admin-field-label">Options</label>
        <div id="poll-options-list" class="flex flex-col gap-2"></div>
        <button type="button" class="admin-btn admin-btn--sm mt-2" id="poll-add-option-btn">+ Add option</button>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="admin-field-label">Visible to</label>
          <select id="poll-visibility" class="admin-input">
            <option value="players">All Players</option>
            <option value="heads">Team Heads</option>
            <option value="admins">Admins</option>
          </select>
        </div>
        <div>
          <label class="admin-field-label">Votable by</label>
          <select id="poll-voter-eligibility" class="admin-input">
            <option value="players">All Players</option>
            <option value="heads">Team Heads</option>
            <option value="admins">Admins</option>
          </select>
        </div>
      </div>
      <div id="poll-modal-msg" class="text-xs text-error" style="display:none"></div>
      <button class="agm-new-btn" id="poll-submit-btn">Create Poll</button>
    </div>
  </div>
</div>

<script>
(function() {
  var optionsList = document.getElementById('poll-options-list');

  function addOptionRow(value) {
    var row = document.createElement('div');
    row.className = 'flex items-center gap-2';
    row.innerHTML = '<input type="text" class="admin-input poll-option-input" placeholder="Option" value="' + (value ? value.replace(/"/g, '&quot;') : '') + '">'
      + '<button type="button" class="admin-btn admin-btn--sm admin-btn--danger poll-remove-option-btn">&times;</button>';
    row.querySelector('.poll-remove-option-btn').addEventListener('click', function() {
      if (optionsList.children.length > 2) row.remove();
    });
    optionsList.appendChild(row);
  }

  document.getElementById('poll-add-option-btn').addEventListener('click', function() { addOptionRow(''); });

  window.openPollModal = function() {
    document.getElementById('poll-question').value = '';
    document.getElementById('poll-description').value = '';
    optionsList.innerHTML = '';
    addOptionRow(''); addOptionRow('');
    document.getElementById('poll-visibility').value = 'players';
    document.getElementById('poll-voter-eligibility').value = 'players';
    document.getElementById('poll-modal-msg').style.display = 'none';
    document.getElementById('poll-modal-backdrop').hidden = false;
  };
  document.getElementById('poll-modal-close').addEventListener('click', function() { document.getElementById('poll-modal-backdrop').hidden = true; });

  document.getElementById('poll-submit-btn').addEventListener('click', async function() {
    var msg = document.getElementById('poll-modal-msg');
    msg.style.display = 'none';
    var question = document.getElementById('poll-question').value.trim();
    var options = Array.prototype.slice.call(document.querySelectorAll('.poll-option-input'))
      .map(function(el) { return el.value.trim(); }).filter(Boolean);
    if (!question) { msg.textContent = 'Question is required.'; msg.style.display = 'block'; return; }
    if (options.length < 2) { msg.textContent = 'At least 2 options are required.'; msg.style.display = 'block'; return; }
    var btn = this; btn.disabled = true;
    try {
      var r = await fetch('/admin/polls', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question, options: options,
          description: document.getElementById('poll-description').value.trim(),
          visibility: document.getElementById('poll-visibility').value,
          voter_eligibility: document.getElementById('poll-voter-eligibility').value,
        }),
      });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      location.reload();
    } catch (e) { msg.textContent = e.message; msg.style.display = 'block'; btn.disabled = false; }
  });

  window.setPollStatus = async function(id, status) {
    try {
      var r = await fetch('/admin/polls/' + id + '/status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: status }),
      });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      location.reload();
    } catch (e) { alert(e.message); }
  };
})();
</script>`;
}
