import { escHtml } from '../layout.js';

function parsePositions(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

function sizeText(top, shorts) {
  if (!top && !shorts) return '—';
  return [top ? `Top ${top}` : '', shorts ? `Shorts ${shorts}` : ''].filter(Boolean).join(' · ');
}

function rosterRow(p) {
  const positions = parsePositions(p.positions);
  const initial    = escHtml((p.name || '?').charAt(0).toUpperCase());
  const avatar     = p.pictureUrl
    ? `<img src="${escHtml(p.pictureUrl)}" style="width:100%;height:100%;object-fit:cover;object-position:top center">`
    : initial;

  const numberBadge = p.number
    ? `<span class="text-[11px] font-bold px-2 py-0.5 rounded" style="background:#1e293b;color:#e2e8f0;font-family:'Saira Condensed',sans-serif">#${escHtml(String(p.number))}</span>`
    : `<span class="text-[10px] font-semibold px-2 py-0.5 rounded" style="background:#f871711a;color:#f87171;border:1px solid #f8717133">Pending</span>`;

  return `<tr class="border-b border-admin-border/40 last:border-0">
    <td class="px-4 py-2.5">
      <div class="flex items-center gap-2.5">
        <div style="width:28px;height:28px;border-radius:50%;background:#1e293b;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#64748b;overflow:hidden">${avatar}</div>
        <div>
          <div class="flex items-center gap-1.5">
            <span class="text-[12.5px] font-semibold text-slate-200">${escHtml(p.name)}</span>
            ${p.isNew  ? `<span class="text-[8px] font-extrabold tracking-wide px-1.5 py-0.5 rounded" style="background:#22c55e18;color:#22c55e;border:1px solid #22c55e33">NEW</span>` : ''}
            ${p.isHead ? `<span class="text-[8px] font-extrabold tracking-wide px-1.5 py-0.5 rounded" style="background:#f5933218;color:#f59332;border:1px solid #f5933233">HEAD</span>` : ''}
          </div>
          ${positions.length ? `<div class="text-[10px] text-slate-600">${positions.map(escHtml).join(' · ')}</div>` : ''}
        </div>
      </div>
    </td>
    <td class="px-4 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">${escHtml(sizeText(p.jerseyTop, p.jerseyShorts))}</td>
    <td class="px-4 py-2.5 text-right">${numberBadge}</td>
  </tr>`;
}

function teamCard(team, roster) {
  const newCount     = roster.filter(p => p.isNew).length;
  const pendingCount = roster.filter(p => !p.number).length;

  return `<div class="bg-admin-surface border border-admin-border rounded-xl overflow-hidden">
    <div class="px-5 py-3.5 border-b border-admin-border flex items-center justify-between gap-2 flex-wrap">
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full" style="background:${escHtml(team.color)}"></span>
        <span class="text-[13px] font-bold text-slate-200">${escHtml(team.name)}</span>
        <span class="text-[11px] text-slate-600">${roster.length} player${roster.length === 1 ? '' : 's'}${newCount ? ` · ${newCount} new` : ''}</span>
      </div>
      ${pendingCount
        ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:#f871711a;color:#f87171;border:1px solid #f8717133">${pendingCount} number${pendingCount === 1 ? '' : 's'} pending</span>`
        : `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:#22c55e1a;color:#22c55e;border:1px solid #22c55e33">All numbers set</span>`}
    </div>
    ${roster.length === 0
      ? `<div class="p-6 text-center text-[12px] text-slate-600">No players assigned yet.</div>`
      : `<table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-admin-border">
              <th class="px-4 py-2 text-left text-[9.5px] font-bold tracking-widest uppercase text-slate-600">Player</th>
              <th class="px-4 py-2 text-left text-[9.5px] font-bold tracking-widest uppercase text-slate-600">Size</th>
              <th class="px-4 py-2 text-right text-[9.5px] font-bold tracking-widest uppercase text-slate-600">Number</th>
            </tr>
          </thead>
          <tbody>${roster.map(rosterRow).join('')}</tbody>
        </table>`}
  </div>`;
}

// Mirrors exactly what a team head sees on the public /my-team page (see
// buildTeamRosterView in server.js) — read-only here since number entry is the head's job,
// not admin's; this is purely for checking progress across all teams at a glance.
export function adminSeasonTeamsPreviewBody({ sigSeason = '', teamsWithRosters = [], rosterPublished = false } = {}) {
  const cards = teamsWithRosters.map(({ team, roster }) => teamCard(team, roster)).join('');

  return `
<div class="flex items-start justify-between gap-4 flex-wrap mb-5">
  <div>
    <a href="/admin/season/teams" class="text-[11px] text-slate-500 hover:text-slate-300 no-underline inline-flex items-center gap-1 mb-1">← Team Builder</a>
    <h1 class="m-0 text-xl font-extrabold text-slate-100">Team Preview <span class="text-brand">— Head View</span></h1>
    <p class="text-[11px] text-slate-500 mt-1 mb-0">What each team head sees at <code class="text-[10.5px] bg-admin-border/50 px-1 rounded">/my-team</code> for Season ${escHtml(String(sigSeason))}.</p>
  </div>
  ${rosterPublished
    ? `<span class="text-[11px] font-bold px-3 py-1 rounded-full" style="background:#22c55e1a;color:#22c55e;border:1px solid #22c55e33">● Published to Players</span>`
    : `<span class="text-[11px] font-bold px-3 py-1 rounded-full" style="background:transparent;color:#64748b;border:1px solid #334155">○ Not Published — heads can't see this yet</span>`}
</div>

${teamsWithRosters.length === 0
  ? `<div class="border-2 border-dashed border-admin-border rounded-xl p-10 text-center text-slate-700 text-[13px]">No teams built yet — set them up in Team Builder first.</div>`
  : `<div class="grid gap-4" style="grid-template-columns:repeat(auto-fit, minmax(340px, 1fr))">${cards}</div>`}`;
}
