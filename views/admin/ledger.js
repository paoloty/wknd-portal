import { escHtml } from '../layout.js';
import { displayPlayerName, teamColor } from '../utils.js';

const METHOD_LABELS = { cash: 'Cash', gcash: 'GCash', bank: 'Bank Transfer', other: 'Other' };
const CATEGORIES    = ['Season Fee', 'Game Fee', 'Papawis', 'Penalty', 'Equipment', 'Other'];

const fmt     = n => `PHP ${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const ICON_CHEVRON_R = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4.5 2.5l3 3-3 3"/></svg>`;
const ICON_EYE       = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 7c0 0 2.2-4 6-4s6 4 6 4-2.2 4-6 4-6-4-6-4z"/><circle cx="7" cy="7" r="1.6"/></svg>`;
const ICON_COPY      = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="4" y="4" width="8" height="8" rx="1.5"/><path d="M1 9V2.5A1.5 1.5 0 0 1 2.5 1H9"/></svg>`;
const ICON_CHECK     = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7l3.5 3.5L11 3"/></svg>`;
const ICON_VOID      = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="6.5" cy="6.5" r="5"/><path d="M3.5 9.5l6-6"/></svg>`;
const ICON_TRASH     = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3.5h9M5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M10 3.5l-.7 7a.5.5 0 0 1-.5.5H4.2a.5.5 0 0 1-.5-.5L3 3.5"/></svg>`;

function statusBadge(status) {
  const cfg = {
    confirmed: { bg: '#22c55e22', color: '#22c55e' },
    pending:   { bg: '#f5933222', color: '#f59332' },
    voided:    { bg: '#64748b22', color: '#64748b' },
  };
  const { bg, color } = cfg[status] || cfg.pending;
  return `<span class="agm-badge" style="background:${bg};color:${color}">${escHtml(status)}</span>`;
}

function balanceColor(bal) {
  if (bal > 0) return '#ef4444';
  if (bal < 0) return '#22c55e';
  return 'var(--text-muted)';
}

function statTile(label, value, color = 'var(--text-primary)') {
  return `<div class="card" style="padding:16px 20px">
    <div style="font-size:10px;font-weight:700;letter-spacing:.08em;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">${escHtml(label)}</div>
    <div style="font-size:20px;font-weight:700;color:${color}">${value}</div>
  </div>`;
}

function quotaBar(paid, quota) {
  if (!quota) return '';
  const pct = Math.min(100, Math.round((paid / quota) * 100));
  const color = pct >= 100 ? '#22c55e' : pct >= 50 ? '#f59332' : '#ef4444';
  return `<div style="margin-top:4px;display:flex;align-items:center;gap:6px">
    <div style="flex:1;height:4px;background:var(--border);border-radius:99px;overflow:hidden">
      <div style="width:${pct}%;height:100%;background:${color};border-radius:99px"></div>
    </div>
    <span style="font-size:10px;font-weight:700;color:${color};white-space:nowrap">${pct}%</span>
  </div>`;
}

function categoryOpts(selected = '') {
  return CATEGORIES.map(c => `<option value="${escHtml(c)}"${selected === c ? ' selected' : ''}>${escHtml(c)}</option>`).join('');
}

function addTransactionForm(playerId, today, season) {
  return `<div id="lgr-msg" hidden style="border-radius:8px;font-size:13px;padding:10px 14px;margin-bottom:14px"></div>
  <form id="lgr-form">
    <input type="hidden" name="player_id" value="${escHtml(playerId)}">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div>
        <label class="admin-field-label">Type</label>
        <select name="type" class="admin-input">
          <option value="charge">Charge</option>
          <option value="payment">Payment</option>
        </select>
      </div>
      <div>
        <label class="admin-field-label">Amount (PHP)</label>
        <input type="number" name="amount" class="admin-input" min="0.01" step="0.01" placeholder="0.00" required>
      </div>
      <div>
        <label class="admin-field-label">Category</label>
        <select name="category" class="admin-input"><option value="">— None —</option>${categoryOpts()}</select>
      </div>
      <div>
        <label class="admin-field-label">Status</label>
        <select name="status" class="admin-input">
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
        </select>
      </div>
      <div>
        <label class="admin-field-label">Method</label>
        <select name="payment_method" class="admin-input">
          <option value="cash">Cash</option>
          <option value="gcash">GCash</option>
          <option value="bank">Bank Transfer</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label class="admin-field-label">Date</label>
        <input type="date" name="date" class="admin-input" value="${today}" required>
      </div>
      <div>
        <label class="admin-field-label">Season</label>
        <input type="text" name="season" class="admin-input" value="${escHtml(season)}" placeholder="e.g. Season 3">
      </div>
      <div>
        <label class="admin-field-label">Notes</label>
        <input type="text" name="notes" class="admin-input" placeholder="e.g. Season 3 Quota">
      </div>
      <div style="grid-column:1/-1">
        <label class="admin-field-label">Reference No. <span style="font-weight:400;color:var(--text-muted)">(optional)</span></label>
        <input type="text" name="reference_no" class="admin-input" placeholder="GCash ref, bank ref…">
      </div>
      <div style="grid-column:1/-1">
        <button type="submit" id="lgr-submit" class="admin-btn">ADD TRANSACTION</button>
      </div>
    </div>
  </form>`;
}

// ── Player profile financial card (used on player admin page) ─────────────────
export function playerFinancialSection(fin, transactions, playerName, playerId) {
  const bal = Number(fin?.current_balance ?? 0);

  const txRows = transactions.length
    ? transactions.slice(0, 5).map(tx => `<div class="standings-row ledger-tx-row-inner">
    <div class="standings-cell ledger-cell--date" style="color:var(--text-muted);font-size:12px">${fmtDate(tx.date)}</div>
    <div class="standings-cell ledger-cell--type"><span style="font-size:12px;color:${tx.type==='charge'?'#ef4444':'#22c55e'}">${tx.type === 'charge' ? 'Charge' : 'Payment'}</span></div>
    <div class="standings-cell ledger-cell--amount" style="font-size:13px;font-weight:600;color:${tx.type === 'charge' ? '#ef4444' : '#22c55e'}">${fmt(tx.amount)}</div>
    <div class="standings-cell ledger-cell--for" style="font-size:13px">${escHtml(tx.notes || '—')}</div>
    <div class="standings-cell ledger-cell--status">${statusBadge(tx.status)}</div>
  </div>`).join('')
    : `<div class="standings-row" style="border-bottom:none"><div class="standings-cell" style="grid-column:1/-1;color:var(--text-muted);font-size:12px;padding:14px 16px">No transactions yet.</div></div>`;

  return `<div class="card standings-table" style="margin-top:20px">
  <div class="card-label" style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
    <span>ACCOUNT BALANCE</span>
    <a href="/admin/ledger/${escHtml(playerId)}" class="agm-edit-link">${ICON_EYE} Full ledger</a>
  </div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr)">
    <div style="padding:14px 16px;border-right:1px solid var(--border)">
      <div style="font-size:10px;font-weight:700;letter-spacing:.08em;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">Balance</div>
      <div style="font-size:16px;font-weight:700;color:${balanceColor(bal)}">${fmt(bal)}</div>
    </div>
    <div style="padding:14px 16px;border-right:1px solid var(--border)">
      <div style="font-size:10px;font-weight:700;letter-spacing:.08em;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">Paid</div>
      <div style="font-size:16px;font-weight:600;color:#22c55e">${fmt(fin?.total_paid ?? 0)}</div>
    </div>
    <div style="padding:14px 16px">
      <div style="font-size:10px;font-weight:700;letter-spacing:.08em;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">Charged</div>
      <div style="font-size:16px;font-weight:600;color:#ef4444">${fmt(fin?.total_outstanding ?? 0)}</div>
    </div>
  </div>
  <div style="border-top:1px solid var(--border)">
    <div class="standings-row ledger-tx-head">
      <div class="standings-cell ledger-cell--date">DATE</div>
      <div class="standings-cell ledger-cell--type">TYPE</div>
      <div class="standings-cell ledger-cell--amount">AMOUNT</div>
      <div class="standings-cell ledger-cell--for">FOR</div>
      <div class="standings-cell ledger-cell--status">STATUS</div>
    </div>
    ${txRows}
  </div>
</div>`;
}

// ── Ledger list page ──────────────────────────────────────────────────────────
export function adminLedgerBody({ players = [], txByPlayer = {}, seasons = [], season = '', quota = 0, summary = {}, balMap = {} } = {}) {
  const teams = [...new Set(players.map(p => p.team_name).filter(Boolean))];

  const sorted = [...players].sort((a, b) => {
    const bA = season ? Number(balMap[a.id]?.balance ?? 0) : 0;
    const bB = season ? Number(balMap[b.id]?.balance ?? 0) : 0;
    return bB - bA;
  });

  const seasonPills = seasons.map(s =>
    `<button class="agm-pill${s === season ? ' is-active' : ''}" data-season="${escHtml(s)}">${escHtml(s)}</button>`
  ).join('');

  const teamPills = teams.map(t =>
    `<button class="agm-pill" data-fteam="${escHtml(t.toLowerCase())}">${escHtml(t)}</button>`
  ).join('');

  const rows = sorted.map(p => {
    const name    = displayPlayerName(p.name);
    const color   = teamColor(p.team_name);
    const sbal    = balMap[p.id];
    const bal     = Number(sbal?.balance ?? 0);
    const paid    = Number(sbal?.paid ?? 0);
    const pending = Number(sbal?.pending_count ?? txByPlayer[p.id]?.filter(t => t.status === 'pending').length ?? 0);
    const balKey  = bal > 0 ? 'owed' : 'settled';
    const balLabel = bal === 0 ? 'Settled' : fmt(Math.abs(bal));

    return `<tr class="agm-row admin-table-row"
      data-q="${escHtml(name.toLowerCase() + ' ' + (p.team_name || '').toLowerCase())}"
      data-team="${escHtml((p.team_name || '').toLowerCase())}"
      data-bal="${balKey}"
      data-pid="${escHtml(p.id)}">
      <td class="admin-td">
        <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" class="lgr-check" value="${escHtml(p.id)}" style="accent-color:var(--amber)">
          <span class="team-dot" style="background:${color};flex-shrink:0"></span>
          <span>${escHtml(name)}</span>
        </label>
      </td>
      <td class="admin-td" style="color:${balanceColor(bal)};font-weight:600">
        ${escHtml(balLabel)}
        ${quota ? quotaBar(paid, quota) : ''}
      </td>
      <td class="admin-td">
        ${pending > 0 ? `<span class="agm-badge agm-badge--amber">${pending} pending</span>` : '<span style="color:var(--text-muted)">–</span>'}
      </td>
      <td class="admin-td agm-td--action">
        <a href="/admin/ledger/${escHtml(p.id)}${season ? `?season=${encodeURIComponent(season)}` : ''}" class="agm-edit-link">View ${ICON_CHEVRON_R}</a>
      </td>
    </tr>`;
  }).join('');

  const today = new Date().toISOString().split('T')[0];

  const summaryStrip = season ? `
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
  ${statTile('Total Outstanding', fmt(summary.total_outstanding ?? 0), '#ef4444')}
  ${statTile('Total Collected', fmt(summary.total_paid ?? 0), '#22c55e')}
  ${statTile('Pending Transactions', String(summary.pending_count ?? 0), '#f59332')}
  ${statTile('Quota', quota ? fmt(quota) : 'Not set', 'var(--text-primary)')}
</div>` : '';

  return `
<div class="agm-toolbar">
  <h2 class="agm-page-title">Ledger</h2>
  <div class="agm-toolbar__right">
    <button id="lgr-export-btn" class="agm-pill" style="display:inline-flex;align-items:center;gap:6px">${ICON_COPY} Copy Summary</button>
    <button id="lgr-bulk-btn" class="agm-new-btn">+ Bulk Charge</button>
    <input type="search" id="lgr-search" class="agm-search" placeholder="Search players…">
  </div>
</div>

${season ? `
<div id="lgr-quota-bar" style="display:flex;align-items:center;gap:10px;padding:10px 0;margin-bottom:4px">
  <span style="font-size:12px;color:var(--text-muted)">Season quota:</span>
  <span id="lgr-quota-val" style="font-size:13px;font-weight:600;color:var(--text-primary)">${quota ? fmt(quota) : 'Not set'}</span>
  <button id="lgr-quota-edit-btn" style="background:none;border:1px solid var(--border);border-radius:4px;color:var(--text-muted);cursor:pointer;font-size:11px;padding:2px 8px">Edit</button>
  <span id="lgr-quota-form" hidden style="display:inline-flex;align-items:center;gap:6px">
    <input type="number" id="lgr-quota-input" min="0" step="0.01" value="${quota || ''}" placeholder="0.00" style="background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font:13px/1 inherit;padding:5px 10px;width:120px;outline:none">
    <button id="lgr-quota-save" class="admin-btn" style="padding:5px 14px;font-size:11px">Save</button>
    <button id="lgr-quota-cancel" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:12px">Cancel</button>
  </span>
</div>` : ''}

<div class="agm-filters">
  ${seasons.length ? `<div class="agm-filter-group" id="lgr-season-pills">
    <button class="agm-pill${!season ? ' is-active' : ''}" data-season="">All Time</button>
    ${seasonPills}
  </div>` : ''}
  <div class="agm-filter-group">
    <button class="agm-pill is-active" data-fteam="">All Teams</button>
    ${teamPills}
  </div>
  <div class="agm-filter-group">
    <button class="agm-pill is-active" data-fbal="">All</button>
    <button class="agm-pill" data-fbal="owed">Owed</button>
    <button class="agm-pill" data-fbal="settled">Settled</button>
  </div>
</div>

${summaryStrip}

<div id="lgr-bulk-panel" hidden style="margin-bottom:16px">
  <div class="card" style="padding:20px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--text-muted);text-transform:uppercase">Bulk Charge / Payment</div>
      <button id="lgr-bulk-close" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;line-height:1;padding:0 2px">&times;</button>
    </div>
    <div id="lgr-bulk-msg" hidden style="border-radius:8px;font-size:13px;padding:10px 14px;margin-bottom:14px"></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr) auto;gap:12px;align-items:end">
      <div>
        <label class="admin-field-label">Type</label>
        <select id="blk-type" class="admin-input">
          <option value="charge">Charge</option>
          <option value="payment">Payment</option>
        </select>
      </div>
      <div>
        <label class="admin-field-label">Amount (PHP)</label>
        <input type="number" id="blk-amount" class="admin-input" min="0.01" step="0.01" placeholder="0.00">
      </div>
      <div>
        <label class="admin-field-label">Category</label>
        <select id="blk-category" class="admin-input"><option value="">— None —</option>${categoryOpts()}</select>
      </div>
      <div>
        <label class="admin-field-label">Status</label>
        <select id="blk-status" class="admin-input">
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
        </select>
      </div>
      <div>
        <label class="admin-field-label">Date</label>
        <input type="date" id="blk-date" class="admin-input" value="${today}">
      </div>
      <div>
        <label class="admin-field-label">Season</label>
        <input type="text" id="blk-season" class="admin-input" value="${escHtml(season)}" placeholder="e.g. Season 3">
      </div>
      <div style="grid-column:1/-1">
        <label class="admin-field-label">Notes</label>
        <input type="text" id="blk-notes" class="admin-input" placeholder="e.g. Season 3 Quota">
      </div>
    </div>
    <div style="margin-top:14px;display:flex;align-items:center;gap:12px">
      <button id="blk-select-all" class="agm-pill">Select All</button>
      <span id="blk-count" style="font-size:12px;color:var(--text-muted)">0 players selected</span>
      <button id="blk-submit" class="admin-btn" style="margin-left:auto">APPLY TO SELECTED</button>
    </div>
  </div>
</div>

<div class="card admin-table-scroll" style="padding:0">
  <table class="admin-table">
    <thead>
      <tr>
        <th class="admin-th">Player</th>
        <th class="admin-th">${season ? 'Season Balance' : 'Balance'}</th>
        <th class="admin-th">Pending</th>
        <th class="admin-th"></th>
      </tr>
    </thead>
    <tbody id="lgr-tbody">
      ${rows || '<tr><td colspan="4" style="padding:40px;text-align:center;color:var(--text-muted)">No players found.</td></tr>'}
    </tbody>
  </table>
</div>

<script>
(function(){
  var fteam = '', fbal = '', currentSeason = '${escHtml(season)}';

  // ── Filters ───────────────────────────────────────────────────────────────
  function apply() {
    var q = document.getElementById('lgr-search').value.toLowerCase().trim();
    document.querySelectorAll('#lgr-tbody .agm-row').forEach(function(r) {
      var show = (!fteam || r.dataset.team === fteam)
              && (!fbal  || r.dataset.bal  === fbal)
              && (!q     || r.dataset.q.includes(q));
      r.style.display = show ? '' : 'none';
    });
  }
  document.querySelectorAll('[data-fteam]').forEach(function(b) {
    b.addEventListener('click', function() {
      fteam = this.dataset.fteam;
      document.querySelectorAll('[data-fteam]').forEach(function(x){ x.classList.toggle('is-active', x.dataset.fteam === fteam); });
      apply();
    });
  });
  document.querySelectorAll('[data-fbal]').forEach(function(b) {
    b.addEventListener('click', function() {
      fbal = this.dataset.fbal;
      document.querySelectorAll('[data-fbal]').forEach(function(x){ x.classList.toggle('is-active', x.dataset.fbal === fbal); });
      apply();
    });
  });
  document.getElementById('lgr-search').addEventListener('input', apply);

  // ── Season pills (reload page) ────────────────────────────────────────────
  document.querySelectorAll('[data-season]').forEach(function(b) {
    b.addEventListener('click', function() {
      var s = this.dataset.season;
      window.location.href = '/admin/ledger' + (s ? '?season=' + encodeURIComponent(s) : '');
    });
  });

  // ── Quota edit ────────────────────────────────────────────────────────────
  var qEditBtn = document.getElementById('lgr-quota-edit-btn');
  var qForm    = document.getElementById('lgr-quota-form');
  var qVal     = document.getElementById('lgr-quota-val');
  if (qEditBtn) {
    qEditBtn.addEventListener('click', function() { qForm.hidden = false; qEditBtn.hidden = true; });
    document.getElementById('lgr-quota-cancel').addEventListener('click', function() { qForm.hidden = true; qEditBtn.hidden = false; });
    document.getElementById('lgr-quota-save').addEventListener('click', async function() {
      var amount = parseFloat(document.getElementById('lgr-quota-input').value);
      if (isNaN(amount)) return;
      var btn = this; btn.textContent = 'Saving…'; btn.disabled = true;
      try {
        var r = await fetch('/admin/ledger/quota/' + encodeURIComponent(currentSeason), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount })
        });
        if (!r.ok) throw new Error('Failed');
        location.reload();
      } catch(e) { btn.textContent = 'Save'; btn.disabled = false; }
    });
  }

  // ── Bulk charge ───────────────────────────────────────────────────────────
  var bulkPanel = document.getElementById('lgr-bulk-panel');
  var bulkCount = document.getElementById('blk-count');
  document.getElementById('lgr-bulk-btn').addEventListener('click', function() { bulkPanel.hidden = false; });
  document.getElementById('lgr-bulk-close').addEventListener('click', function() { bulkPanel.hidden = true; });
  function updateCount() {
    var n = document.querySelectorAll('.lgr-check:checked').length;
    bulkCount.textContent = n + ' player' + (n === 1 ? '' : 's') + ' selected';
  }
  document.querySelectorAll('.lgr-check').forEach(function(c) { c.addEventListener('change', updateCount); });
  document.getElementById('blk-select-all').addEventListener('click', function() {
    var checks = document.querySelectorAll('#lgr-tbody .agm-row:not([style*="none"]) .lgr-check');
    var allChecked = [...checks].every(function(c){ return c.checked; });
    checks.forEach(function(c){ c.checked = !allChecked; });
    updateCount();
  });
  document.getElementById('blk-submit').addEventListener('click', async function() {
    var pids = [...document.querySelectorAll('.lgr-check:checked')].map(function(c){ return c.value; });
    if (!pids.length) return;
    var amount = parseFloat(document.getElementById('blk-amount').value);
    var date   = document.getElementById('blk-date').value;
    if (!amount || !date) { alert('Amount and date are required.'); return; }
    var msg = document.getElementById('lgr-bulk-msg');
    var btn = this; btn.disabled = true; btn.textContent = 'APPLYING…';
    try {
      var r = await fetch('/admin/ledger/bulk-charge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_ids: pids, amount,
          type:     document.getElementById('blk-type').value,
          status:   document.getElementById('blk-status').value,
          date,
          notes:    document.getElementById('blk-notes').value,
          season:   document.getElementById('blk-season').value,
          category: document.getElementById('blk-category').value,
        })
      });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      msg.removeAttribute('hidden');
      msg.style.cssText = 'background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);color:#22c55e;border-radius:8px;font-size:13px;padding:10px 14px;margin-bottom:14px';
      msg.textContent = 'Applied to ' + j.count + ' players. Reloading…';
      setTimeout(function(){ location.reload(); }, 900);
    } catch(err) {
      msg.removeAttribute('hidden');
      msg.style.cssText = 'background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#f87171;border-radius:8px;font-size:13px;padding:10px 14px;margin-bottom:14px';
      msg.textContent = err.message;
      btn.disabled = false; btn.textContent = 'APPLY TO SELECTED';
    }
  });

  // ── Clipboard export ──────────────────────────────────────────────────────
  document.getElementById('lgr-export-btn').addEventListener('click', function() {
    var lines = ['WKND League — ' + (currentSeason || 'All Time') + ' Balance Summary', ''];
    document.querySelectorAll('#lgr-tbody .agm-row').forEach(function(r) {
      if (r.style.display === 'none') return;
      var name = r.querySelector('span:nth-child(3)')?.textContent?.trim() || '';
      var bal  = r.querySelector('td:nth-child(2)')?.firstChild?.textContent?.trim() || '';
      if (name) lines.push(name + ' — ' + bal);
    });
    navigator.clipboard.writeText(lines.join('\\n')).then(function() {
      var btn = document.getElementById('lgr-export-btn');
      btn.textContent = '✓ Copied';
      setTimeout(function(){ btn.innerHTML = '${ICON_COPY} Copy Summary'; }, 2000);
    });
  });
})();
</script>`;
}

// ── Ledger player detail page ─────────────────────────────────────────────────
export function adminLedgerPlayerBody({ player, fin = {}, transactions = [], seasons = [], season = '', quota = 0 } = {}) {
  const name  = displayPlayerName(player.name);
  const color = teamColor(player.team_name);
  const bal   = Number(fin.current_balance ?? 0);
  const today = new Date().toISOString().split('T')[0];

  const seasonBal  = transactions.filter(t => t.status === 'confirmed' && t.type === 'charge').reduce((s, t) => s + t.amount, 0)
                   - transactions.filter(t => t.status === 'confirmed' && t.type === 'payment').reduce((s, t) => s + t.amount, 0);
  const seasonPaid = transactions.filter(t => t.status === 'confirmed' && t.type === 'payment').reduce((s, t) => s + t.amount, 0);

  const seasonPills = seasons.map(s =>
    `<a href="/admin/ledger/${escHtml(player.id)}?season=${encodeURIComponent(s)}" class="agm-pill${s === season ? ' is-active' : ''}">${escHtml(s)}</a>`
  ).join('');

  const txRows = transactions.length
    ? transactions.map(tx => {
        const isCharge   = tx.type === 'charge';
        const canConfirm = tx.status === 'pending';
        const canVoid    = tx.status === 'confirmed';

        const notesCell = `
          ${escHtml(tx.notes || '—')}
          ${tx.category ? `<span style="margin-left:6px;font-size:10px;color:var(--text-muted);background:var(--border);padding:1px 6px;border-radius:99px">${escHtml(tx.category)}</span>` : ''}`;

        const statusCell = canConfirm
          ? `<button onclick="lgrConfirm('${escHtml(tx.id)}')" id="status-${escHtml(tx.id)}" class="agm-badge" style="background:#f5933222;color:#f59332;border:none;cursor:pointer" title="Click to confirm">pending</button>`
          : statusBadge(tx.status);

        const actionBtns = `
          <button id="btn-void-${escHtml(tx.id)}"   onclick="lgrVoid('${escHtml(tx.id)}')"   class="ledger-icon-btn" title="Void"   style="${canVoid ? '' : 'display:none'}">${ICON_VOID}</button>
          <button id="btn-delete-${escHtml(tx.id)}" onclick="lgrDelete('${escHtml(tx.id)}')" class="ledger-icon-btn" title="Delete" style="color:#ef4444;border-color:#ef444444">${ICON_TRASH}</button>`;

        return `<tr class="admin-table-row" id="txrow-${escHtml(tx.id)}">
          <td class="admin-td" style="color:var(--text-muted);font-size:13px">${fmtDate(tx.date)}</td>
          <td class="admin-td"><span style="font-size:12px;color:${isCharge ? '#ef4444' : '#22c55e'}">${isCharge ? 'Charge' : 'Payment'}</span></td>
          <td class="admin-td" style="font-weight:600;color:${isCharge ? '#ef4444' : '#22c55e'}">${fmt(tx.amount)}</td>
          <td class="admin-td" style="font-size:13px">${notesCell}</td>
          <td class="admin-td" style="color:var(--text-muted);font-size:12px">${escHtml(tx.season || '—')}</td>
          <td class="admin-td" id="status-${escHtml(tx.id)}">${statusCell}</td>
          <td class="admin-td" style="color:var(--text-muted);font-size:12px">${escHtml(METHOD_LABELS[tx.payment_method] || tx.payment_method || '—')}</td>
          <td class="admin-td agm-td--action" style="display:flex;gap:4px;align-items:center">${actionBtns}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="8" style="padding:40px;text-align:center;color:var(--text-muted);font-size:13px">No transactions yet.</td></tr>`;

  return `
<div class="agm-toolbar">
  <div style="display:flex;align-items:center;gap:10px">
    <a href="/admin/ledger${season ? '?season='+encodeURIComponent(season) : ''}" style="color:var(--text-muted);font-size:13px;text-decoration:none">← Ledger</a>
    <span style="color:var(--border)">/</span>
    <h2 class="agm-page-title" style="margin:0">${escHtml(name)}</h2>
    <span class="team-dot" style="background:${color}"></span>
    <span style="color:var(--text-muted);font-size:13px">${escHtml(player.team_name || '')}</span>
  </div>
</div>

${seasons.length ? `<div class="agm-filters" style="margin-bottom:16px">
  <div class="agm-filter-group">
    <a href="/admin/ledger/${escHtml(player.id)}" class="agm-pill${!season ? ' is-active' : ''}">All Time</a>
    ${seasonPills}
  </div>
</div>` : ''}

<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
  ${season
    ? statTile('Season Balance', fmt(seasonBal), balanceColor(seasonBal))
    : statTile('Overall Balance', fmt(bal), balanceColor(bal))}
  ${statTile(season ? 'Season Paid' : 'Total Paid', fmt(season ? seasonPaid : (fin.total_paid ?? 0)), '#22c55e')}
  ${quota && season
    ? `<div class="card" style="padding:16px 20px">
        <div style="font-size:10px;font-weight:700;letter-spacing:.08em;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">Quota Progress</div>
        <div style="font-size:20px;font-weight:700;color:var(--text-primary)">${fmt(seasonPaid)} <span style="font-size:13px;color:var(--text-muted)">/ ${fmt(quota)}</span></div>
        ${quotaBar(seasonPaid, quota)}
      </div>`
    : statTile(season ? 'Season Charged' : 'Total Charged', fmt(season ? (seasonBal + seasonPaid) : (fin.total_outstanding ?? 0)), '#ef4444')}
</div>

<div class="card" style="padding:0;overflow:hidden;margin-bottom:20px">
  <table class="admin-table">
    <thead>
      <tr>
        <th class="admin-th">Date</th>
        <th class="admin-th">Type</th>
        <th class="admin-th">Amount</th>
        <th class="admin-th">Notes</th>
        <th class="admin-th">Season</th>
        <th class="admin-th">Status</th>
        <th class="admin-th">Method</th>
        <th class="admin-th"></th>
      </tr>
    </thead>
    <tbody id="lgr-tx-tbody">${txRows}</tbody>
  </table>
</div>

<div class="card" style="padding:20px">
  <div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--text-muted);text-transform:uppercase;margin-bottom:16px">Add Transaction</div>
  ${addTransactionForm(player.id, today, season)}
</div>

<script>
  // ── Confirm (in-place via status badge click) ─────────────────────────────
  window.lgrConfirm = async function(id) {
    if (!confirm('Mark this transaction as confirmed?')) return;
    try {
      var r = await fetch('/admin/ledger/transaction/' + id + '/confirm', { method: 'POST' });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      var statusEl = document.getElementById('status-' + id);
      if (statusEl) statusEl.outerHTML = '<td class="admin-td" id="status-' + id + '"><span class="agm-badge" style="background:#22c55e22;color:#22c55e">confirmed</span></td>';
      var voidBtn = document.getElementById('btn-void-' + id);
      if (voidBtn) voidBtn.style.display = '';
      var row = document.getElementById('txrow-' + id);
      if (row) { row.style.transition = 'background .15s'; row.style.background = 'rgba(34,197,94,.07)'; setTimeout(function(){ row.style.background = ''; }, 900); }
    } catch(err) { alert(err.message); }
  };

  // ── Void (in-place) ───────────────────────────────────────────────────────
  window.lgrVoid = async function(id) {
    if (!confirm('Void this transaction? It will be kept in history but reversed.')) return;
    try {
      var r = await fetch('/admin/ledger/transaction/' + id + '/void', { method: 'POST' });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      document.getElementById('status-' + id).innerHTML = '<span class="agm-badge" style="background:#64748b22;color:#64748b">voided</span>';
      var voidBtn = document.getElementById('btn-void-' + id);
      if (voidBtn) voidBtn.style.display = 'none';
      var row = document.getElementById('txrow-' + id);
      if (row) row.style.opacity = '0.5';
    } catch(err) { alert(err.message); }
  };

  // ── Delete (fade out) ─────────────────────────────────────────────────────
  window.lgrDelete = async function(id) {
    if (!confirm('Delete this transaction? This cannot be undone.')) return;
    try {
      var r = await fetch('/admin/ledger/transaction/' + id, { method: 'DELETE' });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      var row = document.getElementById('txrow-' + id);
      if (row) {
        row.style.transition = 'opacity .25s, transform .25s';
        row.style.opacity = '0';
        row.style.transform = 'translateX(6px)';
        setTimeout(function(){ row.remove(); }, 260);
      }
    } catch(err) { alert(err.message); }
  };

  // ── Add transaction ───────────────────────────────────────────────────────
  var lgrForm = document.getElementById('lgr-form');
  if (lgrForm) lgrForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    var btn = document.getElementById('lgr-submit');
    var msg = document.getElementById('lgr-msg');
    btn.disabled = true; btn.textContent = 'SAVING...';
    try {
      var res = await fetch('/admin/ledger/transaction', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(e.target)))
      });
      var json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      msg.removeAttribute('hidden');
      msg.style.cssText = 'background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);color:#22c55e;border-radius:8px;font-size:13px;padding:10px 14px;margin-bottom:14px';
      msg.textContent = 'Saved. Reloading...';
      setTimeout(function(){ location.reload(); }, 800);
    } catch(err) {
      msg.removeAttribute('hidden');
      msg.style.cssText = 'background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#f87171;border-radius:8px;font-size:13px;padding:10px 14px;margin-bottom:14px';
      msg.textContent = err.message;
      btn.disabled = false; btn.textContent = 'ADD TRANSACTION';
    }
  });
</script>`;
}
