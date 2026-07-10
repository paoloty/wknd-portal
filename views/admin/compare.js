import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';

function fmtDate(ts) {
  if (!ts) return '—';
  const ms = ts > 1e10 ? ts : ts * 1000;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function adminComparePage({ rows = [] } = {}) {
  const tableRows = rows.map((r, i) => {
    const nameA = r.player_a_name ? displayPlayerName(r.player_a_name) : r.player_a_id;
    const nameB = r.player_b_name ? displayPlayerName(r.player_b_name) : r.player_b_id;
    const preview = (r.writeup || '').slice(0, 110).replace(/\n/g, ' ');
    const model = r.model || '—';
    return `<tr class="admin-table-row cmp-row" data-idx="${i}" style="cursor:pointer">
      <td class="admin-td" style="font-weight:500">${escHtml(nameA)}</td>
      <td class="admin-td" style="font-weight:500">${escHtml(nameB)}</td>
      <td class="admin-td" style="text-align:center">
        <span style="font-size:15px;font-weight:700;color:var(--accent)">${r.view_count ?? 0}</span>
      </td>
      <td class="admin-td" style="color:var(--text-muted);font-size:13px">${escHtml(fmtDate(r.last_viewed_at))}</td>
      <td class="admin-td" style="color:var(--text-muted);font-size:13px">${escHtml(fmtDate(r.created_at))}</td>
      <td class="admin-td" style="color:var(--text-muted);font-size:12px;font-family:'Saira Condensed',sans-serif;letter-spacing:.03em">${escHtml(model)}</td>
      <td class="admin-td" style="color:var(--text-muted);font-size:12px;max-width:280px;white-space:normal;line-height:1.4">${escHtml(preview)}${r.writeup && r.writeup.length > 110 ? '…' : ''}</td>
    </tr>`;
  }).join('');

  // Serialize row data for JS
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
<div class="agm-toolbar">
  <h2 class="agm-page-title">Player Compares</h2>
  <span style="color:var(--text-muted);font-size:13px">${rows.length} generated</span>
</div>

${rows.length === 0
  ? `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">No comparisons generated yet.</div>`
  : `<div class="card admin-table-scroll" style="padding:0">
  <table class="admin-table">
    <thead>
      <tr>
        <th class="admin-th">Player A</th>
        <th class="admin-th">Player B</th>
        <th class="admin-th" style="text-align:center">Views</th>
        <th class="admin-th">Last Viewed</th>
        <th class="admin-th">Created</th>
        <th class="admin-th">Model</th>
        <th class="admin-th">Preview</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</div>`}

<!-- Compare detail modal -->
<div class="agm-modal-backdrop" id="cmp-backdrop" hidden>
  <div class="agm-modal" style="max-width:540px;width:100%">
    <div class="agm-modal-header">
      <h3 class="agm-modal-title" id="cmp-modal-title">Comparison</h3>
      <button class="agm-modal-close" id="cmp-modal-close" aria-label="Close">✕</button>
    </div>
    <div class="agm-modal-body" style="gap:16px">
      <div style="display:flex;gap:24px">
        <div>
          <div class="agm-modal-label">Views</div>
          <div id="cmp-modal-views" style="font-size:22px;font-weight:800;color:var(--accent);font-family:'Saira Condensed',sans-serif">—</div>
        </div>
        <div>
          <div class="agm-modal-label">Last Viewed</div>
          <div id="cmp-modal-last" style="font-size:13px;color:var(--text-muted);margin-top:4px">—</div>
        </div>
        <div>
          <div class="agm-modal-label">Created</div>
          <div id="cmp-modal-created" style="font-size:13px;color:var(--text-muted);margin-top:4px">—</div>
        </div>
        <div>
          <div class="agm-modal-label">Model</div>
          <div id="cmp-modal-model" style="font-size:12px;color:var(--text-muted);margin-top:4px;font-family:'Saira Condensed',sans-serif">—</div>
        </div>
      </div>
      <div style="border-top:1px solid var(--border);padding-top:16px">
        <div class="agm-modal-label" style="margin-bottom:8px">Writeup</div>
        <p id="cmp-modal-writeup" style="font-size:14px;line-height:1.7;color:var(--text);margin:0;white-space:pre-wrap"></p>
      </div>
    </div>
    <div class="agm-modal-footer">
      <button class="agm-modal-cancel" id="cmp-modal-ok">Close</button>
    </div>
  </div>
</div>

<script>
(function() {
  var DATA = ${JSON.stringify(rowData)};

  var backdrop = document.getElementById('cmp-backdrop');

  function openModal(idx) {
    var d = DATA[idx];
    document.getElementById('cmp-modal-title').textContent = d.nameA + ' vs ' + d.nameB;
    document.getElementById('cmp-modal-views').textContent = d.views;
    document.getElementById('cmp-modal-last').textContent = d.lastViewed;
    document.getElementById('cmp-modal-created').textContent = d.created;
    document.getElementById('cmp-modal-model').textContent = d.model;
    document.getElementById('cmp-modal-writeup').textContent = d.writeup;
    backdrop.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    backdrop.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.cmp-row').forEach(function(row) {
    row.addEventListener('click', function() { openModal(Number(this.dataset.idx)); });
  });

  document.getElementById('cmp-modal-close').addEventListener('click', closeModal);
  document.getElementById('cmp-modal-ok').addEventListener('click', closeModal);
  backdrop.addEventListener('click', function(e) { if (e.target === backdrop) closeModal(); });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !backdrop.hasAttribute('hidden')) closeModal();
  });
})();
</script>`;
}
