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

// The editor's own names (views/game.js SSC_TEMPLATES). Before 2026-10-19 the log only kept the
// first five keys, so Premium/Hero/Card/Scoreboard rows from then are blank: "Not recorded".
const TEMPLATE_LABELS = {
  left: 'Marquee L', center: 'Marquee', right: 'Marquee R', bottom: 'Lower third', stacked: 'Box score',
  premium: 'Premium', 'premium-r': 'Premium R', hero: 'Hero', card: 'Card', scoreboard: 'Scoreboard',
  usual: 'Vs your usual', poster: 'Poster', cover: 'Cover', jersey: 'Jersey', bug: 'Corner bug', receipt: 'Receipt',
};
const templateLabel = t => TEMPLATE_LABELS[t] || t || 'Not recorded';
const FOCUS_LABELS = { all: 'All-Around', offense: 'Offense', defense: 'Defense' };

export function adminShareCardLogPage({ logs = [] }) {
  const counts = logs.reduce((acc, l) => { acc[l.action] = (acc[l.action] || 0) + 1; return acc; }, {});
  // Most used first: uses and distinct players per template.
  const byTpl = {};
  for (const l of logs) {
    const t = byTpl[l.template] || (byTpl[l.template] = { uses: 0, players: new Set() });
    t.uses++; t.players.add(l.player_id);
  }
  const tplRows = Object.entries(byTpl).sort((a, b) => b[1].uses - a[1].uses).map(([key, t]) =>
    `<tr class="border-b border-admin-border/40 last:border-0">
      <td class="px-4 py-2 text-sm ${key ? 'text-slate-300' : 'text-slate-500 italic'}">${escHtml(templateLabel(key))}</td>
      <td class="px-4 py-2 text-sm text-slate-300 text-right">${t.uses}</td>
      <td class="px-4 py-2 text-sm text-slate-400 text-right">${t.players.size}</td>
    </tr>`).join('');

  const rows = logs.map(l => {
    const matchup = l.team_a_name && l.team_b_name
      ? `${escHtml(l.team_a_name)} vs ${escHtml(l.team_b_name)}${l.game_date ? ` · ${fmtGameDate(l.game_date)}` : ''}`
      : escHtml(l.game_id);
    return `<tr class="border-b border-admin-border/40 last:border-0 hover:bg-white/[.015] transition-colors">
      <td class="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">${escHtml(fmtTime(l.created_at))}</td>
      <td class="px-4 py-2.5 text-sm text-slate-300 whitespace-nowrap">${escHtml(l.player_name || l.player_id)}</td>
      <td class="px-4 py-2.5 whitespace-nowrap">${actionBadge(l.action)}</td>
      <td class="px-4 py-2.5 text-sm text-slate-400 whitespace-nowrap">${matchup}</td>
      <td class="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">${escHtml(templateLabel(l.template))}</td>
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

${logs.length ? `<div class="bg-admin-surface border border-admin-border rounded-lg overflow-auto mb-5 max-w-md">
  <table class="w-full border-collapse">
    <thead>
      <tr class="border-b border-admin-border">
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Template</th>
        <th class="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">Uses</th>
        <th class="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500">Players</th>
      </tr>
    </thead>
    <tbody>${tplRows}</tbody>
  </table>
</div>` : ''}

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
