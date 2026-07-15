import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';

function fmtDate(ts) {
  if (!ts) return '—';
  const ms = ts > 1e10 ? ts : ts * 1000;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function adminComparePage({ rows = [], players = [] } = {}) {
  const playerOpts = players.map(p =>
    `<option value="${escHtml(p.id)}">${escHtml(displayPlayerName(p.name))}${p.team_name ? ' — ' + escHtml(p.team_name) : ''}</option>`
  ).join('');

  const tableRows = rows.map((r, i) => {
    const nameA  = r.player_a_name ? displayPlayerName(r.player_a_name) : r.player_a_id;
    const nameB  = r.player_b_name ? displayPlayerName(r.player_b_name) : r.player_b_id;
    const preview = (r.writeup || '').slice(0, 110).replace(/\n/g, ' ');
    return `<tr class="cmp-row border-b border-admin-border/50 last:border-b-0 hover:bg-white/[.015] cursor-pointer transition-colors" data-idx="${i}">
      <td class="px-4 py-3 text-sm font-medium text-slate-200">${escHtml(nameA)}</td>
      <td class="px-4 py-3 text-sm font-medium text-slate-200">${escHtml(nameB)}</td>
      <td class="px-4 py-3 text-center"><span class="font-saira text-base font-bold text-brand">${r.view_count ?? 0}</span></td>
      <td class="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">${escHtml(fmtDate(r.last_viewed_at))}</td>
      <td class="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">${escHtml(fmtDate(r.created_at))}</td>
      <td class="px-4 py-3 text-xs text-slate-400 max-w-[260px] whitespace-normal leading-relaxed hidden md:table-cell">${escHtml(preview)}${r.writeup && r.writeup.length > 110 ? '…' : ''}</td>
    </tr>`;
  }).join('');

  const rowData = rows.map(r => ({
    nameA: r.player_a_name ? displayPlayerName(r.player_a_name) : (r.player_a_id || ''),
    nameB: r.player_b_name ? displayPlayerName(r.player_b_name) : (r.player_b_id || ''),
    writeup: r.writeup || '',
    views: r.view_count ?? 0,
    lastViewed: fmtDate(r.last_viewed_at),
    created: fmtDate(r.created_at),
    model: r.model || '—',
  }));

  return `
<div class="mb-6 flex items-center justify-between">
  <h2 class="text-xl font-bold tracking-tight text-slate-100">Compare Players</h2>
</div>

<!-- History table -->
<div class="mb-3 flex items-center gap-2">
  <h3 class="text-[13px] font-bold text-slate-400 uppercase tracking-widest">History</h3>
  <span class="text-xs text-slate-600">${rows.length} generated</span>
</div>
${rows.length === 0
  ? `<div class="bg-admin-surface border border-admin-border rounded-lg p-8 text-center text-sm text-slate-500">No comparisons yet.</div>`
  : `<div class="bg-admin-surface border border-admin-border rounded-lg overflow-auto">
  <table class="w-full border-collapse has-col-dividers has-freeze-col">
    <thead>
      <tr>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Player A</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Player B</th>
        <th class="px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Views</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Last Viewed</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">Created</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border hidden md:table-cell">Preview</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</div>`}

<!-- Detail modal -->
<div class="agm-modal-backdrop" id="cmp-backdrop" hidden>
  <div class="agm-modal" style="max-width:580px;width:100%">
    <div class="agm-modal-header">
      <span class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Comparison</span>
      <button class="agm-modal-close" id="cmp-modal-close" aria-label="Close">✕</button>
    </div>
    <div class="agm-modal-body" style="gap:0;padding:0">
      <div class="grid grid-cols-2 gap-px bg-admin-border">
        <div class="bg-admin-surface px-5 py-4">
          <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Player A</div>
          <div id="cmp-modal-name-a" class="text-base font-semibold text-slate-100">—</div>
        </div>
        <div class="bg-admin-surface px-5 py-4">
          <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Player B</div>
          <div id="cmp-modal-name-b" class="text-base font-semibold text-slate-100">—</div>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-px bg-admin-border border-t border-admin-border">
        <div class="bg-admin-surface px-5 py-4">
          <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Views</div>
          <div id="cmp-modal-views" class="font-saira text-2xl font-extrabold text-brand">—</div>
        </div>
        <div class="bg-admin-surface px-5 py-4">
          <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Last Viewed</div>
          <div id="cmp-modal-last" class="text-sm text-slate-300 mt-0.5">—</div>
        </div>
        <div class="bg-admin-surface px-5 py-4">
          <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Created</div>
          <div id="cmp-modal-created" class="text-sm text-slate-300 mt-0.5">—</div>
        </div>
      </div>
      <div class="px-5 py-4 border-t border-admin-border">
        <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Writeup</div>
        <p id="cmp-modal-writeup" class="text-sm leading-relaxed text-slate-300 m-0 whitespace-pre-wrap"></p>
      </div>
    </div>
    <div class="agm-modal-footer">
      <button class="admin-btn" id="cmp-modal-ok">Close</button>
    </div>
  </div>
</div>

<style>
.cmp-stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.cmp-stat { text-align: center; }
.cmp-stat__val { font-size: 20px; font-weight: 800; color: var(--text); font-family: 'Saira Condensed', sans-serif; line-height: 1; }
.cmp-stat__val--win { color: #f59332; }
.cmp-stat__lbl { font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--text-muted); margin-top: 2px; }
</style>

<script>
(function() {
  var DATA = ${JSON.stringify(rowData)};

  // ── History modal ─────────────────────────────────────────────────────────
  var backdrop = document.getElementById('cmp-backdrop');

  function openModal(idx) {
    var d = DATA[idx];
    document.getElementById('cmp-modal-name-a').textContent  = d.nameA;
    document.getElementById('cmp-modal-name-b').textContent  = d.nameB;
    document.getElementById('cmp-modal-views').textContent   = d.views;
    document.getElementById('cmp-modal-last').textContent    = d.lastViewed;
    document.getElementById('cmp-modal-created').textContent = d.created;
    document.getElementById('cmp-modal-writeup').textContent = d.writeup;
    backdrop.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() { backdrop.setAttribute('hidden', ''); document.body.style.overflow = ''; }

  document.querySelectorAll('.cmp-row').forEach(function(row) {
    row.addEventListener('click', function() { openModal(Number(this.dataset.idx)); });
  });
  document.getElementById('cmp-modal-close').addEventListener('click', closeModal);
  document.getElementById('cmp-modal-ok').addEventListener('click', closeModal);
  backdrop.addEventListener('click', function(e) { if (e.target === backdrop) closeModal(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && !backdrop.hasAttribute('hidden')) closeModal(); });
})();
</script>`;
}
