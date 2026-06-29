import { escHtml } from '../layout.js';
import { displayPlayerName, teamColor } from '../utils.js';

const METHOD_LABELS = { cash: 'Cash', gcash: 'GCash', bank: 'Bank Transfer', other: 'Other' };
const fmt = (n) => `PHP ${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const ICON_PLUS = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="7" y1="1.5" x2="7" y2="12.5"/><line x1="1.5" y1="7" x2="12.5" y2="7"/></svg>`;
const ICON_EYE  = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 7c0 0 2.2-4 6-4s6 4 6 4-2.2 4-6 4-6-4-6-4z"/><circle cx="7" cy="7" r="1.6"/></svg>`;

function statusBadge(status) {
  const cfg = {
    confirmed: { bg: '#22c55e22', color: '#22c55e' },
    pending:   { bg: '#f5933222', color: '#f59332' },
    voided:    { bg: '#64748b22', color: '#64748b' },
  };
  const { bg, color } = cfg[status] || cfg.pending;
  return `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.05em;background:${bg};color:${color};text-transform:uppercase">${escHtml(status)}</span>`;
}

function typeBadge(type) {
  const isCharge = type === 'charge';
  return `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.05em;background:${isCharge ? '#ef444422' : '#22c55e22'};color:${isCharge ? '#ef4444' : '#22c55e'};text-transform:uppercase">${isCharge ? 'Charge' : 'Payment'}</span>`;
}

function balanceColor(bal) {
  if (bal > 0) return '#ef4444';
  if (bal < 0) return '#22c55e';
  return 'var(--text-muted)';
}

function modalHtml(playerOptions, today, sfx = '') {
  const id = sfx ? `-${sfx}` : '';
  return `<div id="ledger-modal${id}" data-lgr-modal="${id}" style="display:none;position:fixed;inset:0;z-index:1000;background:rgba(2,8,23,.82);backdrop-filter:blur(4px);align-items:center;justify-content:center">
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;width:100%;max-width:400px;padding:28px;margin:16px;position:relative">
    <button onclick="lgrClose('${id}')" style="position:absolute;top:14px;right:16px;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:20px;line-height:1">&times;</button>
    <div style="font-size:14px;font-weight:700;margin-bottom:20px">Record Transaction</div>
    <div id="modal-msg${id}" style="display:none;border-radius:8px;font-size:13px;padding:10px 14px;margin-bottom:12px"></div>
    <form id="ledger-form${id}" onsubmit="lgrSubmit(event,'${id}')">
      <label class="admin-field-label">Player</label>
      <select name="player_id" id="modal-player${id}" class="admin-input" required>
        <option value="">Select player...</option>${playerOptions}
      </select>
      <label class="admin-field-label">Type</label>
      <select name="type" class="admin-input">
        <option value="payment">Payment (credit)</option>
        <option value="charge">Charge (debit)</option>
      </select>
      <label class="admin-field-label">What is this for?</label>
      <input name="notes" type="text" class="admin-input" placeholder="e.g. Season fee, Game payment..." required>
      <label class="admin-field-label">Amount (PHP)</label>
      <input name="amount" type="number" min="0.01" step="0.01" class="admin-input" placeholder="0.00" required>
      <label class="admin-field-label">Payment Method</label>
      <select name="payment_method" class="admin-input">
        <option value="cash">Cash</option>
        <option value="gcash">GCash</option>
        <option value="bank">Bank Transfer</option>
        <option value="other">Other</option>
      </select>
      <label class="admin-field-label">Date</label>
      <input name="date" type="date" class="admin-input" value="${today}" required>
      <label class="admin-field-label">Status</label>
      <select name="status" class="admin-input">
        <option value="confirmed">Confirmed</option>
        <option value="pending">Pending</option>
      </select>
      <button type="submit" class="admin-btn" id="modal-submit${id}">RECORD TRANSACTION</button>
    </form>
  </div>
</div>`;
}

const sharedScript = `<script>
(function(){
  window.lgrOpen = function(pid, id) {
    var sel = document.getElementById('modal-player' + id);
    if (sel && pid) sel.value = pid;
    document.getElementById('ledger-modal' + id).style.display = 'flex';
    var msg = document.getElementById('modal-msg' + id);
    if (msg) msg.style.display = 'none';
  };
  window.lgrClose = function(id) {
    document.getElementById('ledger-modal' + id).style.display = 'none';
    var f = document.getElementById('ledger-form' + id);
    if (f) f.reset();
    var msg = document.getElementById('modal-msg' + id);
    if (msg) msg.style.display = 'none';
  };
  window.lgrFilter = function(q) {
    var term = q.toLowerCase().trim();
    document.querySelectorAll('.ledger-player-row').forEach(function(row) {
      var show = !term || row.dataset.name.includes(term);
      row.style.display = show ? '' : 'none';
    });
  };
  window.lgrSubmit = async function(e, id) {
    e.preventDefault();
    var btn = document.getElementById('modal-submit' + id);
    var msg = document.getElementById('modal-msg' + id);
    btn.disabled = true; btn.textContent = 'SAVING...';
    try {
      var res = await fetch('/admin/ledger/transaction', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(e.target)))
      });
      var json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      msg.style.cssText = 'display:block;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);color:#22c55e';
      msg.textContent = 'Saved. Reloading...';
      setTimeout(function(){ location.reload(); }, 800);
    } catch(err) {
      msg.style.cssText = 'display:block;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#f87171';
      msg.textContent = err.message;
      btn.disabled = false; btn.textContent = 'RECORD TRANSACTION';
    }
  };
  document.querySelectorAll('[data-lgr-modal]').forEach(function(el) {
    el.addEventListener('click', function(e){ if (e.target === el) lgrClose(el.dataset.lgrModal); });
  });
})();
</script>`;

// ── Player profile financial card ─────────────────────────────────────────────
export function playerFinancialSection(fin, transactions, playerName, playerId, allPlayerOptions) {
  const bal  = Number(fin?.current_balance ?? 0);
  const today = new Date().toISOString().split('T')[0];
  const id   = '-profile';

  const txRows = transactions.length
    ? transactions.map(tx => `<div class="standings-row ledger-tx-row-inner">
    <div class="standings-cell ledger-cell--date" style="color:var(--text-muted);font-size:12px">${fmtDate(tx.date)}</div>
    <div class="standings-cell ledger-cell--type">${typeBadge(tx.type)}</div>
    <div class="standings-cell ledger-cell--amount" style="font-size:13px;font-weight:600;color:${tx.type === 'charge' ? '#ef4444' : '#22c55e'}">${fmt(tx.amount)}</div>
    <div class="standings-cell ledger-cell--for" style="font-size:13px">${escHtml(tx.notes || '—')}</div>
    <div class="standings-cell ledger-cell--status">${statusBadge(tx.status)}</div>
    <div class="standings-cell ledger-cell--method" style="color:var(--text-muted);font-size:12px">${escHtml(METHOD_LABELS[tx.payment_method] || tx.payment_method || '—')}</div>
  </div>`).join('')
    : `<div class="standings-row" style="border-bottom:none"><div class="standings-cell" style="grid-column:1/-1;color:var(--text-muted);font-size:12px;padding:14px 16px">No transactions yet.</div></div>`;

  return `<div class="card standings-table" style="margin-top:20px">
  <div class="card-label" style="padding:12px 16px;border-bottom:1px solid var(--border)">
    ACCOUNT BALANCE
    <button class="ledger-icon-btn" title="Record transaction" onclick="lgrOpen('${escHtml(playerId)}','${id}')" style="color:var(--amber)">${ICON_PLUS}</button>
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
      <div class="standings-cell ledger-cell--method">METHOD</div>
    </div>
    ${txRows}
  </div>
</div>
${modalHtml(allPlayerOptions, today, 'profile')}
${sharedScript}`;
}

// ── Admin ledger page ─────────────────────────────────────────────────────────
export function adminLedgerBody({ players = [], financials = {}, txByPlayer = {} } = {}) {
  const sorted = [...players].sort((a, b) => {
    const bA = Number(financials[a.id]?.current_balance ?? 0);
    const bB = Number(financials[b.id]?.current_balance ?? 0);
    return bB - bA;
  });

  const lgrDataB64 = Buffer.from(JSON.stringify({
    playerNames: Object.fromEntries(sorted.map(p => [p.id, displayPlayerName(p.name)])),
    playerTeams: Object.fromEntries(sorted.map(p => [p.id, p.team_name || ''])),
    financials:  Object.fromEntries(sorted.map(p => [p.id, financials[p.id] ?? { current_balance: 0, total_paid: 0, total_outstanding: 0 }])),
    txByPlayer:  Object.fromEntries(sorted.map(p => [p.id, (txByPlayer[p.id] ?? []).map(tx => ({
      id: tx.id, date: tx.date, type: tx.type, amount: tx.amount,
      notes: tx.notes, status: tx.status, payment_method: tx.payment_method,
      reference_no: tx.reference_no || '',
    }))])),
  })).toString('base64');

  const rows = sorted.map(p => {
    const name  = displayPlayerName(p.name);
    const color = teamColor(p.team_name);
    const fin   = financials[p.id] ?? { current_balance: 0, total_paid: 0, total_outstanding: 0 };
    const bal   = Number(fin.current_balance);

    return `<div class="ledger-player-row" data-name="${escHtml(name.toLowerCase())}" data-pid="${escHtml(p.id)}" style="--tc-color:${color}">
  <div class="ledger-cell--player">
    <span class="team-dot" style="background:${color};flex-shrink:0"></span>
    <span class="ledger-player-name">${escHtml(name)}</span>
    <span class="ledger-player-team">&nbsp;&middot;&nbsp;${escHtml(p.team_name || '')}</span>
  </div>
  <div class="ledger-cell--balance">${fmt(bal)}</div>
  <div class="ledger-cell--actions">
    <button class="ledger-icon-btn" title="View transactions" onclick="lgrView('${escHtml(p.id)}')">${ICON_EYE}</button>
    <button class="ledger-icon-btn" title="Record transaction" onclick="lgrAdd('${escHtml(p.id)}')" style="color:var(--amber)">${ICON_PLUS}</button>
  </div>
</div>`;
  }).join('\n');

  const today = new Date().toISOString().split('T')[0];

  return `<div class="container"><div class="page-content">
  <div class="section-header"><h2>Player Ledger</h2></div>
  <div class="card standings-table">
    <div class="card-label" style="padding:12px 16px;border-bottom:1px solid var(--border)">
      PLAYERS
      <input type="search" placeholder="Search..." oninput="lgrFilter(this.value)"
        style="background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font:13px/1 inherit;padding:6px 12px;outline:none;width:200px">
    </div>
    <div class="ledger-head">
      <div class="ledger-cell--player">PLAYER</div>
      <div class="ledger-cell--balance">BALANCE</div>
      <div class="ledger-cell--actions"></div>
    </div>
    ${rows || '<div style="padding:40px;color:var(--text-muted);text-align:center;font-size:13px">No players found.</div>'}
  </div>
</div></div>

<div id="lgr-view-modal" style="display:none;position:fixed;inset:0;z-index:1000;background:rgba(2,8,23,.82);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:16px">
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;width:100%;max-width:540px;max-height:88vh;display:flex;flex-direction:column;overflow:hidden">
    <div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
      <div>
        <div id="vm-pname" style="font-size:14px;font-weight:700;color:var(--text-primary)"></div>
        <div id="vm-pteam" style="font-size:12px;color:var(--text-muted);margin-top:1px"></div>
      </div>
      <button onclick="lgrViewClose()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:20px;line-height:1;padding:4px 8px">&times;</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid var(--border);flex-shrink:0">
      <div style="padding:10px 16px">
        <div style="font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--text-muted);text-transform:uppercase;margin-bottom:3px">Balance</div>
        <div id="vm-bal" style="font-size:13px;font-weight:500;color:var(--text-primary)"></div>
      </div>
      <div style="padding:10px 16px;border-left:1px solid var(--border)">
        <div style="font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--text-muted);text-transform:uppercase;margin-bottom:3px">Paid</div>
        <div id="vm-paid" style="font-size:13px;font-weight:500;color:var(--text-primary)"></div>
      </div>
      <div style="padding:10px 16px;border-left:1px solid var(--border)">
        <div style="font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--text-muted);text-transform:uppercase;margin-bottom:3px">Charged</div>
        <div id="vm-charged" style="font-size:13px;font-weight:500;color:var(--text-primary)"></div>
      </div>
    </div>
    <div id="vm-tx-list" style="overflow-y:auto;flex:1;min-height:80px"></div>
  </div>
</div>

<div id="lgr-add-modal" style="display:none;position:fixed;inset:0;z-index:1000;background:rgba(2,8,23,.82);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:16px">
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;width:100%;max-width:420px;overflow:hidden">
    <div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:10px;font-weight:700;letter-spacing:.07em;color:var(--text-muted);text-transform:uppercase">Record Transaction</div>
        <div id="am-pname" style="font-size:13px;font-weight:600;color:var(--text-primary);margin-top:2px"></div>
      </div>
      <button onclick="lgrAddClose()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:20px;line-height:1;padding:4px 8px">&times;</button>
    </div>
    <div style="padding:20px">
      <div id="am-msg" style="display:none;border-radius:8px;font-size:13px;padding:10px 14px;margin-bottom:12px"></div>
      <form id="lgr-add-form" onsubmit="lgrAddSubmit(event)">
        <input type="hidden" name="player_id" id="am-pid">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label class="admin-field-label">Type</label>
            <select name="type" class="admin-input" required>
              <option value="charge">Charge</option>
              <option value="payment">Payment</option>
            </select>
          </div>
          <div>
            <label class="admin-field-label">Amount (PHP)</label>
            <input type="number" name="amount" min="0.01" step="0.01" class="admin-input" required placeholder="0.00">
          </div>
          <div>
            <label class="admin-field-label">Status</label>
            <select name="status" class="admin-input" required>
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
        </div>
        <div style="margin-top:10px">
          <label class="admin-field-label">Date</label>
          <input type="date" name="date" class="admin-input" value="${today}" required>
        </div>
        <div style="margin-top:10px">
          <label class="admin-field-label">For / Notes</label>
          <input type="text" name="notes" class="admin-input" placeholder="e.g. Season 3 Quota">
        </div>
        <div style="margin-top:10px">
          <label class="admin-field-label">Reference / Tracking No. <span style="color:var(--text-muted);font-weight:400">(optional)</span></label>
          <input type="text" name="reference_no" class="admin-input" placeholder="GCash ref, bank ref, etc.">
        </div>
        <div style="margin-top:14px">
          <button type="submit" id="am-submit" class="admin-btn" style="width:100%">RECORD TRANSACTION</button>
        </div>
      </form>
    </div>
  </div>
</div>

<script>
(function(){
  var _d=JSON.parse(atob('${lgrDataB64}'));
  var FMT=function(n){return 'PHP '+Number(n).toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g,',');};
  var FDATE=function(d){return d?new Date(d+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'n/a';};
  var BCOLOR=function(b){return b>0?'#ef4444':b<0?'#22c55e':'var(--text-muted)';};
  function sbadge(s){
    var c={confirmed:['#22c55e22','#22c55e'],pending:['#f5933222','#f59332'],voided:['#64748b22','#64748b']}[s]||['#f5933222','#f59332'];
    return '<span style="display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;background:'+c[0]+';color:'+c[1]+';text-transform:uppercase">'+s+'</span>';
  }
  function tbadge(t){
    return '<span style="font-size:12px;color:var(--text-muted)">'+(t==='charge'?'Charge':'Payment')+'</span>';
  }
  function scell(tx){
    var b=sbadge(tx.status);
    if(tx.status==='pending'){
      b+='<button onclick="lgrConfirm(&#39;'+tx.id+'&#39;)" title="Mark as confirmed" style="margin-left:6px;background:none;border:1px solid #f59332;border-radius:4px;color:#f59332;cursor:pointer;font-size:10px;font-weight:700;padding:1px 6px;line-height:1.4;vertical-align:middle">Confirm</button>';
    }
    return b;
  }
  window.lgrView=function(pid){
    var fin=_d.financials[pid]||{current_balance:0,total_paid:0,total_outstanding:0},txs=_d.txByPlayer[pid]||[],bal=Number(fin.current_balance);
    document.getElementById('vm-pname').textContent=_d.playerNames[pid]||pid;
    document.getElementById('vm-pteam').textContent=_d.playerTeams[pid]||'';
    document.getElementById('vm-bal').textContent=FMT(bal);
    document.getElementById('vm-paid').textContent=FMT(fin.total_paid);
    document.getElementById('vm-charged').textContent=FMT(fin.total_outstanding);
    var h='';
    if(!txs.length){
      h='<div style="padding:28px 20px;color:var(--text-muted);font-size:13px;text-align:center">No transactions yet.</div>';
    }else{
      h='<div class="ledger-tx-head-modal"><div class="ledger-cell--date">DATE</div><div class="ledger-cell--type">TYPE</div><div class="ledger-cell--amount">AMOUNT</div><div class="ledger-cell--for">FOR</div><div class="ledger-cell--status">STATUS</div></div>';
      txs.forEach(function(tx){
        var forCell='<div style="font-size:13px">'+(tx.notes||'')+'</div>'
          +(tx.reference_no?'<div style="font-size:11px;color:var(--text-muted);margin-top:2px">Ref: '+tx.reference_no+'</div>':'');
        h+='<div class="ledger-tx-row-modal">'
          +'<div class="ledger-cell--date" style="color:var(--text-muted);font-size:12px">'+FDATE(tx.date)+'</div>'
          +'<div class="ledger-cell--type">'+tbadge(tx.type)+'</div>'
          +'<div class="ledger-cell--amount" style="font-size:13px;font-weight:500;white-space:nowrap;color:var(--text-primary)">'+FMT(tx.amount)+'</div>'
          +'<div class="ledger-cell--for">'+forCell+'</div>'
          +'<div class="ledger-cell--status" style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;padding:8px 12px;border-left:1px solid var(--border)">'+scell(tx)+'</div>'
          +'</div>';
      });
    }
    document.getElementById('vm-tx-list').innerHTML=h;
    document.getElementById('lgr-view-modal').style.display='flex';
  };
  window.lgrViewClose=function(){document.getElementById('lgr-view-modal').style.display='none';};
  window.lgrAdd=function(pid){
    document.getElementById('am-pname').textContent=_d.playerNames[pid]||pid;
    document.getElementById('am-pid').value=pid;
    var f=document.getElementById('lgr-add-form');
    if(f)f.reset();
    document.getElementById('am-pid').value=pid;
    document.getElementById('am-msg').style.display='none';
    var s=document.getElementById('am-submit');
    s.disabled=false;s.textContent='RECORD TRANSACTION';
    document.getElementById('lgr-add-modal').style.display='flex';
  };
  window.lgrAddClose=function(){document.getElementById('lgr-add-modal').style.display='none';};
  window.lgrConfirm=async function(txId){
    if(!confirm('Mark this transaction as confirmed?'))return;
    try{
      var r=await fetch('/admin/ledger/transaction/'+txId+'/confirm',{method:'POST'});
      var j=await r.json();
      if(!r.ok)throw new Error(j.error||'Failed');
      location.reload();
    }catch(e){alert(e.message);}
  };
  window.lgrFilter=function(q){
    var t=q.toLowerCase().trim();
    document.querySelectorAll('.ledger-player-row').forEach(function(r){
      r.style.display=(!t||r.dataset.name.includes(t))?'':'none';
    });
  };
  window.lgrAddSubmit=async function(e){
    e.preventDefault();
    var btn=document.getElementById('am-submit'),msg=document.getElementById('am-msg');
    btn.disabled=true;btn.textContent='SAVING...';
    try{
      var res=await fetch('/admin/ledger/transaction',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});
      var json=await res.json();
      if(!res.ok)throw new Error(json.error||'Failed');
      msg.style.cssText='display:block;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);color:#22c55e;border-radius:8px;font-size:13px;padding:10px 14px;margin-bottom:12px';
      msg.textContent='Saved. Reloading...';
      setTimeout(function(){location.reload();},800);
    }catch(err){
      msg.style.cssText='display:block;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#f87171;border-radius:8px;font-size:13px;padding:10px 14px;margin-bottom:12px';
      msg.textContent=err.message;
      btn.disabled=false;btn.textContent='RECORD TRANSACTION';
    }
  };
  document.getElementById('lgr-view-modal').addEventListener('click',function(e){if(e.target===this)lgrViewClose();});
  document.getElementById('lgr-add-modal').addEventListener('click',function(e){if(e.target===this)lgrAddClose();});
})();
</script>`;
}
