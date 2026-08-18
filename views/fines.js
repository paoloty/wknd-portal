import { escHtml, pageHeader } from './layout.js';
import { displayPlayerName } from './utils.js';

function fmtDate(ms) {
  return ms ? new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
}
function peso(n) { return '₱' + Number(n || 0).toLocaleString(); }

function statusPill(status) {
  if (status === 'approved') return `<span class="fn-pill fn-pill--fined">Fined</span>`;
  if (status === 'rejected') return `<span class="fn-pill fn-pill--rejected">Rejected</span>`;
  return `<span class="fn-pill fn-pill--open">Open</span>`;
}

function openCaseCard(c, votes, viewerId) {
  const myVote = votes.find(v => v.voter_id === viewerId);
  const approveCount = votes.filter(v => v.vote === 'approve').length;
  const rejectCount  = votes.filter(v => v.vote === 'reject').length;
  return `<article class="fn-card" data-case="${escHtml(c.id)}">
    <div class="fn-card__top">
      <div>
        <div class="fn-card__player">${escHtml(displayPlayerName(c.player_name))}</div>
        <div class="fn-card__meta">${escHtml(c.category_label)} · <span class="fn-amount">${peso(c.amount)}</span></div>
      </div>
      ${statusPill(c.status)}
    </div>
    ${c.description ? `<p class="fn-card__desc">${escHtml(c.description)}</p>` : ''}
    <div class="fn-card__reported">Reported by ${escHtml(c.reported_by_name)} · ${fmtDate(c.created_at)}</div>
    <div class="fn-card__tally">${approveCount} approve · ${rejectCount} reject</div>
    ${myVote ? `<div class="fn-card__myvote">You voted: <strong>${myVote.vote === 'approve' ? 'Approve' : 'Reject'}</strong> — you can change it below.</div>` : ''}
    <textarea class="fn-input fn-vote-comment" rows="2" placeholder="Optional comment…">${myVote ? escHtml(myVote.comment) : ''}</textarea>
    <div class="fn-card__actions">
      <button class="fn-btn fn-btn--approve" data-vote="approve">Approve</button>
      <button class="fn-btn fn-btn--reject" data-vote="reject">Reject</button>
    </div>
  </article>`;
}

function resolvedCaseRow(c) {
  return `<div class="fn-resolved-row">
    <div>
      <span class="fn-resolved-row__player">${escHtml(displayPlayerName(c.player_name))}</span>
      <span class="fn-resolved-row__cat">${escHtml(c.category_label)}</span>
    </div>
    <div class="fn-resolved-row__right">
      ${statusPill(c.status)}
      <span class="fn-resolved-row__date">${fmtDate(c.resolved_at)}</span>
    </div>
  </div>`;
}

function reportModal(players, categories) {
  const playersData = JSON.stringify(players.map(p => ({ id: p.id, name: displayPlayerName(p.name) }))).replace(/</g, '\\u003c');
  const categoryOptions = categories.map(c => `<option value="${escHtml(c.id)}">${escHtml(c.label)} (${peso(c.amount)})</option>`).join('');
  return `
<div class="fn-modal-backdrop" id="fn-modal-backdrop" hidden>
  <div class="fn-modal">
    <div class="fn-modal-header">
      <span>Report Incident</span>
      <button class="fn-modal-close" id="fn-modal-close" aria-label="Close">✕</button>
    </div>
    <div class="fn-modal-body">
      <label class="fn-label">Player</label>
      <div style="position:relative">
        <input id="fn-player-search" class="fn-input" type="text" placeholder="Search players…" autocomplete="off">
        <input type="hidden" id="fn-player-id">
        <div id="fn-player-dropdown" class="fn-dropdown" hidden></div>
      </div>
      <label class="fn-label">Category</label>
      <select id="fn-category" class="fn-input">${categoryOptions}</select>
      <label class="fn-label">What happened</label>
      <textarea id="fn-description" class="fn-input" rows="4" placeholder="Describe the incident — game, context, who saw it…"></textarea>
      <div id="fn-modal-msg" class="fn-error" hidden></div>
      <button class="fn-btn fn-btn--primary" id="fn-submit-btn">File Report</button>
    </div>
  </div>
</div>
<script>window.__FN_PLAYERS__ = ${playersData};</script>`;
}

export function finesPage({ open = [], resolved = [], votesByCase = {}, categories = [], players = [], viewerId = '' } = {}) {
  const openCards = open.map(c => openCaseCard(c, votesByCase[c.id] || [], viewerId)).join('');
  const resolvedRows = resolved.map(resolvedCaseRow).join('');

  return `<div class="page-content">
  ${pageHeader({
    title: 'Fines &amp; Conduct',
    description: 'Report incidents and vote on conduct cases. An admin makes the final call on every case, informed by the votes here.',
    actions: '<button class="fn-btn fn-btn--primary" id="fn-open-report-btn">Report Incident</button>',
  })}

  <div class="fn-tabs">
    <button type="button" class="fn-tab is-active" data-tab="open">Open (${open.length})</button>
    <button type="button" class="fn-tab" data-tab="resolved">Resolved (${resolved.length})</button>
  </div>

  <div class="fn-tab-panel" data-panel="open">
    ${open.length ? `<div class="fn-grid">${openCards}</div>` : `<p class="fn-empty">No open cases right now.</p>`}
  </div>
  <div class="fn-tab-panel" data-panel="resolved" hidden>
    ${resolved.length ? `<div class="fn-resolved-list">${resolvedRows}</div>` : `<p class="fn-empty">Nothing resolved yet.</p>`}
  </div>
</div>

${reportModal(players, categories)}

<style>
.fn-empty { font-size: 14px; color: var(--text-muted); padding: 20px 0; }

.fn-tabs { display: flex; gap: 22px; border-bottom: 1px solid var(--border); margin-bottom: 20px; }
.fn-tab { padding: 0 0 10px; font-size: 13px; font-weight: 700; color: var(--text-muted); border-bottom: 2px solid transparent; margin-bottom: -1px; }
.fn-tab:hover { color: var(--text); }
.fn-tab.is-active { color: var(--amber); border-bottom-color: var(--amber); }

.fn-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.fn-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; display: flex; flex-direction: column; gap: 10px; }
.fn-card__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.fn-card__player { font-weight: 700; font-size: 15px; color: var(--text); }
.fn-card__meta { font-size: 12.5px; color: var(--text-muted); margin-top: 2px; }
.fn-amount { font-family: 'Saira Condensed'; font-weight: 700; color: var(--amber); }
.fn-card__desc { font-size: 13px; color: var(--text-muted); line-height: 1.5; }
.fn-card__reported { font-size: 11.5px; color: var(--text-subtle); }
.fn-card__tally { font-size: 12px; color: var(--text-muted); font-weight: 600; }
.fn-card__myvote { font-size: 12px; color: var(--amber); }
.fn-card__actions { display: flex; gap: 8px; }

.fn-pill { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 4px 9px; border-radius: 999px; white-space: nowrap; }
.fn-pill--open { background: var(--amber-dim); color: var(--amber); }
.fn-pill--fined { background: rgba(96,165,250,.12); color: #60a5fa; }
.fn-pill--rejected { background: rgba(255,255,255,.06); color: var(--text-muted); }

.fn-input { width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 9px 11px; font-size: 13.5px; color: var(--text); font-family: inherit; }
.fn-input:focus { outline: none; border-color: var(--amber); }
.fn-label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--text-subtle); margin: 12px 0 6px; }
.fn-label:first-child { margin-top: 0; }
.fn-error { font-size: 12px; color: #f87171; }

.fn-btn { border-radius: var(--radius-sm); padding: 9px 14px; font-size: 13px; font-weight: 700; border: 1px solid var(--border); background: var(--bg); color: var(--text); transition: opacity .15s, border-color .15s; }
.fn-btn:hover { opacity: .85; }
.fn-btn--primary { background: var(--amber); color: #0a0e16; border-color: var(--amber); }
.fn-btn--approve { border-color: rgba(52,211,153,.35); color: #34d399; }
.fn-btn--reject { border-color: rgba(248,113,113,.35); color: #f87171; }
.fn-btn:disabled { opacity: .5; pointer-events: none; }

.fn-resolved-list { display: flex; flex-direction: column; gap: 1px; background: var(--border); border-radius: var(--radius); overflow: hidden; }
.fn-resolved-row { background: var(--surface); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.fn-resolved-row__player { font-weight: 600; font-size: 13.5px; color: var(--text); }
.fn-resolved-row__cat { font-size: 12px; color: var(--text-muted); margin-left: 8px; }
.fn-resolved-row__right { display: flex; align-items: center; gap: 10px; }
.fn-resolved-row__date { font-size: 11.5px; color: var(--text-subtle); }

.fn-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 100; align-items: center; justify-content: center; padding: 20px; }
.fn-modal-backdrop:not([hidden]) { display: flex; }
.fn-modal { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); width: 100%; max-width: 440px; max-height: 90vh; overflow-y: auto; }
.fn-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--border); font-weight: 700; font-size: 14px; }
.fn-modal-close { font-size: 16px; color: var(--text-muted); background: none; border: none; }
.fn-modal-body { padding: 18px; display: flex; flex-direction: column; }
.fn-dropdown { position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 20; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); max-height: 220px; overflow-y: auto; }
.fn-dropdown-item { display: block; width: 100%; text-align: left; padding: 9px 12px; font-size: 13px; color: var(--text-muted); background: none; border: none; border-bottom: 1px solid var(--border); }
.fn-dropdown-item:hover { background: rgba(255,255,255,.04); color: var(--text); }
.fn-dropdown-item:last-child { border-bottom: none; }
</style>

<script>
(function() {
  document.querySelectorAll('.fn-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.fn-tab').forEach(function(t) { t.classList.remove('is-active'); });
      tab.classList.add('is-active');
      var target = tab.dataset.tab;
      document.querySelectorAll('.fn-tab-panel').forEach(function(p) { p.hidden = p.dataset.panel !== target; });
    });
  });

  var backdrop = document.getElementById('fn-modal-backdrop');
  document.getElementById('fn-open-report-btn').addEventListener('click', function() { backdrop.hidden = false; });
  document.getElementById('fn-modal-close').addEventListener('click', function() { backdrop.hidden = true; });

  var input = document.getElementById('fn-player-search');
  var hiddenId = document.getElementById('fn-player-id');
  var dropdown = document.getElementById('fn-player-dropdown');
  input.addEventListener('input', function() {
    hiddenId.value = '';
    var q = this.value.trim().toLowerCase();
    if (!q) { dropdown.hidden = true; return; }
    var results = (window.__FN_PLAYERS__ || []).filter(function(p) { return p.name.toLowerCase().includes(q); }).slice(0, 10);
    dropdown.innerHTML = results.length
      ? results.map(function(p) { return '<button type="button" class="fn-dropdown-item" data-id="' + p.id + '" data-name="' + p.name.replace(/"/g, '&quot;') + '">' + p.name + '</button>'; }).join('')
      : '<div style="padding:9px 12px;font-size:12px;color:var(--text-subtle)">No matching players</div>';
    dropdown.hidden = false;
  });
  dropdown.addEventListener('click', function(e) {
    var btn = e.target.closest('.fn-dropdown-item');
    if (!btn || !btn.dataset.id) return;
    hiddenId.value = btn.dataset.id;
    input.value = btn.dataset.name;
    dropdown.hidden = true;
  });
  document.addEventListener('click', function(e) {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.hidden = true;
  });

  document.getElementById('fn-submit-btn').addEventListener('click', async function() {
    var msg = document.getElementById('fn-modal-msg');
    msg.hidden = true;
    if (!hiddenId.value) { msg.textContent = 'Pick a player from the list.'; msg.hidden = false; return; }
    var btn = this; btn.disabled = true;
    try {
      var r = await fetch('/fines', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: hiddenId.value,
          categoryId: document.getElementById('fn-category').value,
          description: document.getElementById('fn-description').value,
        }),
      });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      location.reload();
    } catch (e) { msg.textContent = e.message; msg.hidden = false; btn.disabled = false; }
  });

  document.querySelectorAll('.fn-card').forEach(function(card) {
    var caseId = card.dataset.case;
    card.querySelectorAll('[data-vote]').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var buttons = card.querySelectorAll('[data-vote]');
        buttons.forEach(function(b) { b.disabled = true; });
        try {
          var r = await fetch('/fines/' + caseId + '/vote', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vote: btn.dataset.vote, comment: card.querySelector('.fn-vote-comment').value }),
          });
          var j = await r.json();
          if (!r.ok) throw new Error(j.error || 'Failed');
          location.reload();
        } catch (e) { alert(e.message); buttons.forEach(function(b) { b.disabled = false; }); }
      });
    });
  });
})();
</script>`;
}
