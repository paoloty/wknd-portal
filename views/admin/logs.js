import { escHtml } from '../layout.js';

function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts > 1e10 ? ts : ts * 1000).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function methodBadge(method) {
  const colors = { POST: '#f59332', DELETE: '#f87171', PATCH: '#a78bfa', PUT: '#60a5fa' };
  const c = colors[method] || '#64748b';
  return `<span style="font-size:10px;font-weight:700;color:${c};font-family:'Saira Condensed',sans-serif;letter-spacing:.04em">${escHtml(method)}</span>`;
}

function actorBadge(type) {
  return type === 'super'
    ? `<span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#f59332;background:rgba(245,147,50,.12);padding:1px 6px;border-radius:4px">Super</span>`
    : `<span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#a78bfa;background:rgba(167,139,250,.12);padding:1px 6px;border-radius:4px">Admin</span>`;
}

export function adminLogsPage({ logs = [] }) {
  const rows = logs.map(l => {
    let details = '';
    try {
      const d = JSON.parse(l.details || '{}');
      const entries = Object.entries(d).filter(([k]) => k !== 'password' && k !== 'confirm');
      if (entries.length) details = entries.map(([k, v]) => `<span style="color:var(--text-muted)">${escHtml(k)}:</span> ${escHtml(String(v)).slice(0, 80)}`).join(' &nbsp;·&nbsp; ');
    } catch {}

    return `<tr class="border-b border-admin-border/40 last:border-0 hover:bg-white/[.015] transition-colors">
      <td class="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">${escHtml(fmtTime(l.created_at))}</td>
      <td class="px-4 py-2.5 whitespace-nowrap">${actorBadge(l.actor_type)} <span class="text-sm text-slate-300 ml-1.5">${escHtml(l.actor)}</span></td>
      <td class="px-4 py-2.5 whitespace-nowrap">${methodBadge(l.method)}</td>
      <td class="px-4 py-2.5 text-sm font-mono text-slate-400">${escHtml(l.path)}</td>
      <td class="px-4 py-2.5 text-xs text-slate-500 max-w-[320px] truncate">${details}</td>
    </tr>`;
  }).join('');

  return `
<div class="mb-6 flex items-center justify-between">
  <div>
    <h2 class="text-xl font-bold tracking-tight text-slate-100">Admin Logs</h2>
    <p class="text-xs text-slate-500 mt-0.5">All admin actions — visible to super admin only</p>
  </div>
  <span class="text-xs text-slate-600">${logs.length} entries</span>
</div>

${logs.length === 0
  ? `<div class="bg-admin-surface border border-admin-border rounded-lg p-12 text-center text-sm text-slate-500">No actions logged yet.</div>`
  : `<div class="bg-admin-surface border border-admin-border rounded-lg overflow-auto">
  <table class="w-full border-collapse">
    <thead>
      <tr class="border-b border-admin-border">
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">Time</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Actor</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Method</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Path</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Details</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</div>`}`;
}
