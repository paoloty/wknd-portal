import { escHtml } from '../layout.js';

function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts > 1e10 ? ts : ts * 1000).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export function adminCoachNotesBody({ analyses = [], focusLabels = {} }) {
  const rows = analyses.map(a => {
    const entry = {
      player: a.player_name, team: a.team_name, generated_at: a.generated_at,
      model: a.model, provider: a.provider, focus_tag: a.focus_tag,
      analysis: a.analysis, stat_snapshot: a.stat_snapshot,
    };
    const entryJson = escHtml(JSON.stringify(entry));
    return `<tr class="border-b border-admin-border/40 last:border-0 hover:bg-white/[.015] transition-colors">
      <td class="px-4 py-2.5 text-sm text-slate-300 whitespace-nowrap">${escHtml(a.player_name)}</td>
      <td class="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">${escHtml(a.team_name || '—')}</td>
      <td class="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">${escHtml(fmtTime(a.generated_at))}</td>
      <td class="px-4 py-2.5 text-xs font-mono text-slate-400 whitespace-nowrap">${escHtml(a.model || '—')} <span class="text-slate-600">(${escHtml(a.provider || '—')})</span></td>
      <td class="px-4 py-2.5 whitespace-nowrap"><span class="text-[10px] font-bold uppercase tracking-wide text-brand bg-brand/10 border border-brand/30 px-2 py-0.5 rounded-full">${escHtml(focusLabels[a.focus_tag] || a.focus_tag)}</span></td>
      <td class="px-4 py-2.5 whitespace-nowrap"><button class="text-xs font-semibold text-brand hover:underline" data-entry="${entryJson}" onclick="openCoachModal(this)">View</button></td>
    </tr>`;
  }).join('');

  return `
<div class="mb-6 flex items-center justify-between">
  <div>
    <h2 class="text-xl font-bold tracking-tight text-slate-100">Coach Notes</h2>
    <p class="text-xs text-slate-500 mt-0.5">AI-generated performance analysis shown to players on their own "My Profile" page — one row per player, overwritten when their career averages change</p>
  </div>
  <span class="text-xs text-slate-600">${analyses.length} generated</span>
</div>

${analyses.length === 0
  ? `<div class="bg-admin-surface border border-admin-border rounded-lg p-12 text-center text-sm text-slate-500">No analyses generated yet.</div>`
  : `<div class="bg-admin-surface border border-admin-border rounded-lg overflow-auto">
  <table class="w-full border-collapse">
    <thead>
      <tr class="border-b border-admin-border">
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">Player</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">Team</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">Generated</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">Model</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">Focus</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap"></th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</div>`}

<!-- Detail modal -->
<div id="coach-modal-backdrop" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:50;align-items:center;justify-content:center" onclick="if(event.target===this) closeCoachModal()">
  <div class="bg-admin-surface border border-admin-border rounded-xl p-6" style="width:100%;max-width:560px;max-height:80vh;overflow:auto">
    <div class="flex items-center justify-between mb-4">
      <div>
        <div id="coach-modal-player" class="text-sm font-bold text-slate-200"></div>
        <div id="coach-modal-meta" class="text-xs text-slate-500 mt-0.5"></div>
      </div>
      <button onclick="closeCoachModal()" class="text-slate-500 hover:text-slate-300 text-lg leading-none">&times;</button>
    </div>
    <div id="coach-modal-tag" class="inline-block text-[10px] font-bold uppercase tracking-wide text-brand bg-brand/10 border border-brand/30 px-2 py-0.5 rounded-full mb-3"></div>
    <p id="coach-modal-analysis" class="text-sm text-slate-300 leading-relaxed mb-4"></p>
    <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Career averages at generation time</div>
    <pre id="coach-modal-snapshot" class="text-xs text-slate-400 bg-admin-bg border border-admin-border rounded-lg p-3 overflow-auto"></pre>
  </div>
</div>

<script>
var COACH_FOCUS_LABELS = ${JSON.stringify(focusLabels)};
function openCoachModal(btn) {
  var entry = JSON.parse(btn.dataset.entry);
  document.getElementById('coach-modal-player').textContent = entry.player + (entry.team ? ' — ' + entry.team : '');
  document.getElementById('coach-modal-meta').textContent = new Date(entry.generated_at).toLocaleString() + ' · ' + (entry.model || '—') + ' (' + (entry.provider || '—') + ')';
  document.getElementById('coach-modal-tag').textContent = 'Focus: ' + (COACH_FOCUS_LABELS[entry.focus_tag] || entry.focus_tag);
  document.getElementById('coach-modal-analysis').textContent = entry.analysis;
  try {
    document.getElementById('coach-modal-snapshot').textContent = JSON.stringify(JSON.parse(entry.stat_snapshot), null, 2);
  } catch (e) {
    document.getElementById('coach-modal-snapshot').textContent = entry.stat_snapshot;
  }
  document.getElementById('coach-modal-backdrop').style.display = 'flex';
}
function closeCoachModal() {
  document.getElementById('coach-modal-backdrop').style.display = 'none';
}
</script>`;
}
