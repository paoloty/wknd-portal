export function adminDashboardBody({ registrations = [] } = {}) {
  const pending   = registrations.filter(r => r.status === 'pending').length;
  const freeAgent = registrations.filter(r => r.status === 'free_agent').length;
  const matched   = registrations.filter(r => r.status === 'matched').length;

  return `<div class="container"><div class="page-content">
  <div class="section-header">
    <h2>Admin Dashboard</h2>
  </div>

  <div class="admin-stat-grid">
    <div class="card admin-stat-card">
      <div class="admin-stat-label">Total Registrations</div>
      <div class="admin-stat-value font-condensed">${registrations.length}</div>
    </div>
    <div class="card admin-stat-card">
      <div class="admin-stat-label">Pending Review</div>
      <div class="admin-stat-value font-condensed">${pending}</div>
    </div>
    <div class="card admin-stat-card">
      <div class="admin-stat-label">Free Agents</div>
      <div class="admin-stat-value font-condensed">${freeAgent}</div>
    </div>
    <div class="card admin-stat-card">
      <div class="admin-stat-label">Matched</div>
      <div class="admin-stat-value font-condensed">${matched}</div>
    </div>
  </div>

  <div class="section-header" style="margin-top:32px">
    <h2>Registrations</h2>
    <a href="/admin/registrations">See all</a>
  </div>

  ${registrations.length === 0
    ? `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">No registrations yet.</div>`
    : adminRegistrationTable(registrations.slice(0, 10))
  }
</div></div>`;
}

export function adminRegistrationsBody({ registrations = [] } = {}) {
  return `<div class="container"><div class="page-content">
  <div class="section-header">
    <h2>Registrations</h2>
  </div>
  ${registrations.length === 0
    ? `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">No registrations yet.</div>`
    : adminRegistrationTable(registrations)
  }
</div></div>`;
}

function adminRegistrationTable(rows) {
  const statusBadge = s => {
    const map = { pending: '#f59332', free_agent: '#64748b', matched: '#22c55e' };
    return `<span style="display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:.06em;background:${map[s] || '#64748b'}22;color:${map[s] || '#64748b'};text-transform:uppercase">${s.replace('_', ' ')}</span>`;
  };
  const fmt = ts => new Date(Number(ts)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const rowsHtml = rows.map(r => `<tr class="admin-table-row">
    <td class="admin-td">${escHtml(r.full_name)}</td>
    <td class="admin-td">${escHtml(r.email)}</td>
    <td class="admin-td">${escHtml(r.phone || '—')}</td>
    <td class="admin-td">${statusBadge(r.status)}</td>
    <td class="admin-td" style="color:var(--text-muted);font-size:12px">${fmt(r.created_at)}</td>
  </tr>`).join('');

  return `<div class="card" style="padding:0;overflow:hidden">
  <table class="admin-table">
    <thead>
      <tr>
        <th class="admin-th">Name</th>
        <th class="admin-th">Email</th>
        <th class="admin-th">Phone</th>
        <th class="admin-th">Status</th>
        <th class="admin-th">Date</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</div>`;
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
