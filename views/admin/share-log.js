import { escHtml } from '../layout.js';

function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts > 1e10 ? ts : ts * 1000).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function fmtGameDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Same visual convention as views/admin/logs.js's methodBadge/actorBadge —
// small uppercase pill, one color per category — just keyed on action instead.
function actionBadge(action) {
  const colors = { save: '#60a5fa', copy: '#a78bfa', share: '#f59332' };
  const c = colors[action] || '#64748b';
  return `<span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${c};background:${c}1f;padding:1px 6px;border-radius:4px">${escHtml(action || '—')}</span>`;
}

const TEMPLATE_LABELS = { left: 'Left', center: 'Center', right: 'Right', bottom: 'Bottom', stacked: 'Stacked' };
const FOCUS_LABELS = { all: 'All-Around', offense: 'Offense', defense: 'Defense' };

export function adminShareCardLogPage({ logs = [] }) {
  const counts = logs.reduce((acc, l) => { acc[l.action] = (acc[l.action] || 0) + 1; return acc; }, {});

  const rows = logs.map(l => {
    const matchup = l.team_a_name && l.team_b_name
      ? `${escHtml(l.team_a_name)} vs ${escHtml(l.team_b_name)}${l.game_date ? ` · ${fmtGameDate(l.game_date)}` : ''}`
      : escHtml(l.game_id);
    return `<tr class="border-b border-admin-border/40 last:border-0 hover:bg-white/[.015] transition-colors">
      <td class="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">${escHtml(fmtTime(l.created_at))}</td>
      <td class="px-4 py-2.5 text-sm text-slate-300 whitespace-nowrap">${escHtml(l.player_name || l.player_id)}</td>
      <td class="px-4 py-2.5 whitespace-nowrap">${actionBadge(l.action)}</td>
      <td class="px-4 py-2.5 text-sm text-slate-400 whitespace-nowrap">${matchup}</td>
      <td class="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">${escHtml(TEMPLATE_LABELS[l.template] || l.template || '—')}</td>
      <td class="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">${escHtml(FOCUS_LABELS[l.focus] || l.focus || '—')}</td>
      <td class="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap capitalize">${escHtml(l.accent || '—')}</td>
    </tr>`;
  }).join('');

  return `
<div class="mb-6 flex items-center justify-between">
  <div>
    <h2 class="text-xl font-bold tracking-tight text-slate-100">Share Card Log</h2>
    <p class="text-xs text-slate-500 mt-0.5">Save/Copy/Share activity on the "Share My Stats" card — the only signal a player actually used it beyond opening the editor.</p>
  </div>
  <div class="flex items-center gap-3 text-xs text-slate-500">
    <span>${counts.save || 0} saves</span>
    <span>${counts.copy || 0} copies</span>
    <span>${counts.share || 0} shares</span>
  </div>
</div>

${logs.length === 0
  ? `<div class="bg-admin-surface border border-admin-border rounded-lg p-12 text-center text-sm text-slate-500">No card actions logged yet.</div>`
  : `<div class="bg-admin-surface border border-admin-border rounded-lg overflow-auto">
  <table class="w-full border-collapse">
    <thead>
      <tr class="border-b border-admin-border">
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">Time</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Player</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Action</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Game</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Template</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Focus</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Accent</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</div>`}`;
}
