import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';

function fmtDate(ts) {
  if (!ts) return '—';
  const ms = ts > 1e10 ? ts : ts * 1000;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtViews(n) {
  return n == null ? '0' : String(n);
}

export function adminComparePage({ rows = [] } = {}) {
  const tableRows = rows.map(r => {
    const nameA = r.player_a_name ? displayPlayerName(r.player_a_name) : r.player_a_id;
    const nameB = r.player_b_name ? displayPlayerName(r.player_b_name) : r.player_b_id;
    const preview = (r.writeup || '').slice(0, 120).replace(/\n/g, ' ');
    return `<tr class="admin-table-row">
      <td class="admin-td" style="font-weight:500">${escHtml(nameA)}</td>
      <td class="admin-td" style="font-weight:500">${escHtml(nameB)}</td>
      <td class="admin-td" style="text-align:center">
        <span style="font-size:16px;font-weight:700;color:var(--accent)">${escHtml(fmtViews(r.view_count))}</span>
      </td>
      <td class="admin-td" style="color:var(--text-muted);font-size:13px">${escHtml(fmtDate(r.last_viewed_at))}</td>
      <td class="admin-td" style="color:var(--text-muted);font-size:13px">${escHtml(fmtDate(r.created_at))}</td>
      <td class="admin-td" style="color:var(--text-muted);font-size:12px;max-width:320px;white-space:normal;line-height:1.4">${escHtml(preview)}${r.writeup && r.writeup.length > 120 ? '…' : ''}</td>
    </tr>`;
  }).join('');

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
        <th class="admin-th">Preview</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</div>`}`;
}
