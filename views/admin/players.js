import { escHtml } from '../layout.js';
import { displayPlayerName, teamColor } from '../utils.js';
import { ovrColor } from '../../lib/ratings.js';

const ICON_CHEVRON_R = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4.5 2.5l3 3-3 3"/></svg>`;
const ICON_RECOMPUTE = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 6.5A4.5 4.5 0 1 1 8 2.5"/><path d="M8 1v3h3"/></svg>`;

function ovrBadge(ovr) {
  if (ovr == null) return `<span class="text-xs text-slate-500">—</span>`;
  const color = ovrColor(ovr);
  return `<span class="font-saira text-lg font-extrabold leading-none" style="color:${color}">${ovr}</span>`;
}

function miniBar(val, color) {
  if (val == null) return `<span class="text-xs text-slate-500">—</span>`;
  const pct = Math.round((val / 99) * 100);
  return `<div class="flex items-center gap-1.5">
    <div class="w-10 h-1 bg-admin-border rounded-full overflow-hidden shrink-0">
      <div style="width:${pct}%;height:100%;background:${color};border-radius:99px"></div>
    </div>
    <span class="text-xs font-semibold" style="color:${color}">${val}</span>
  </div>`;
}

function posChips(positions) {
  try {
    const arr = typeof positions === 'string' ? JSON.parse(positions) : (positions || []);
    if (!arr.length) return '';
    return arr.map(p => `<span class="text-[10px] bg-admin-border/50 text-slate-500 px-1.5 py-0.5 rounded ml-1">${escHtml(p)}</span>`).join('');
  } catch { return ''; }
}

export function adminPlayersBody({ players = [], seasons = [], season = '', teams = [] } = {}) {
  const seasonPills = seasons.map(s =>
    `<button class="agm-pill${String(s) === String(season) ? ' is-active' : ''}" data-season="${escHtml(String(s))}">${escHtml('Season ' + s)}</button>`
  ).join('');

  const teamPills = teams.map(t =>
    `<button class="agm-pill" data-fteam="${escHtml(t.name.toLowerCase())}">${escHtml(t.name)}</button>`
  ).join('');

  const rows = players.map(p => {
    const name     = displayPlayerName(p.name);
    const color    = teamColor(p.team_name);
    const off      = (p.eff_scoring != null && p.eff_shooting != null)
      ? Math.round((p.eff_scoring + p.eff_shooting) / 2) : null;
    const isRated  = p.eff_overall != null;
    const inactive = p.status === 'inactive';

    return `<tr class="agm-row border-b border-admin-border/50 last:border-b-0 hover:bg-white/[.015] transition-colors"
      data-id="${escHtml(p.id)}"
      data-q="${escHtml(name.toLowerCase())}"
      data-team="${escHtml((p.team_name || '').toLowerCase())}"
      data-status="${inactive ? 'inactive' : 'active'}"
      ${inactive ? 'style="opacity:0.4"' : ''}>
      <td class="px-4 py-3">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full shrink-0" style="background:${color}"></span>
          <div class="min-w-0">
            <span class="text-sm font-medium text-slate-200">${escHtml(name)}</span>
            ${inactive ? `<span class="text-[10px] bg-slate-700/40 text-slate-500 px-1.5 py-0.5 rounded ml-1.5">Inactive</span>` : ''}
            ${posChips(p.positions)}
          </div>
        </div>
      </td>
      <td class="px-4 py-3 text-center">${ovrBadge(p.eff_overall)}</td>
      <td class="px-4 py-3">${miniBar(off, '#f59332')}</td>
      <td class="px-4 py-3">${miniBar(p.eff_defense, '#06b6d4')}</td>
      <td class="px-4 py-3">${miniBar(p.eff_usage, '#22c55e')}</td>
      <td class="px-4 py-3">${miniBar(p.eff_iq, '#94a3b8')}</td>
      <td class="px-4 py-3 text-right">
        <a href="/admin/players/${escHtml(p.id)}${season ? '?season='+encodeURIComponent(season) : ''}" class="agm-edit-link">Edit ${ICON_CHEVRON_R}</a>
      </td>
    </tr>`;
  }).join('');

  return `
<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
  <h2 class="text-xl font-bold tracking-tight text-slate-100">Players</h2>
  <div class="flex flex-wrap items-center gap-2">
    <button id="plr-recompute-all" class="agm-pill inline-flex items-center gap-1.5">${ICON_RECOMPUTE} Recompute All</button>
    <input type="search" id="plr-search" class="agm-search" placeholder="Search players…">
  </div>
</div>

<div class="mb-4 flex flex-wrap gap-3">
  ${seasons.length ? `<div class="flex flex-wrap items-center gap-1.5" id="plr-season-pills">
    <button class="agm-pill${!season ? ' is-active' : ''}" data-season="">All Time</button>
    ${seasonPills}
  </div>` : ''}
  <div class="flex flex-wrap items-center gap-1.5">
    <button class="agm-pill is-active" data-fteam="">All Teams</button>
    ${teamPills}
  </div>
  <div class="flex flex-wrap items-center gap-1.5">
    <button class="agm-pill is-active" id="plr-show-active">Active</button>
    <button class="agm-pill" id="plr-show-inactive">Inactive</button>
    <button class="agm-pill" id="plr-show-all">All</button>
  </div>
</div>

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-auto">
  <table class="w-full border-collapse has-col-dividers has-freeze-col">
    <thead>
      <tr>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border whitespace-nowrap">Player</th>
        <th class="px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">OVR</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">OFF</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">DEF</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">USG</th>
        <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-admin-border">IQ</th>
        <th class="px-4 py-2.5 border-b border-admin-border"></th>
      </tr>
    </thead>
    <tbody id="plr-tbody">
      ${rows || '<tr><td colspan="7" class="px-4 py-10 text-center text-sm text-slate-500">No players found.</td></tr>'}
    </tbody>
  </table>
</div>

<div id="plr-recompute-msg" hidden class="mt-3 rounded-lg text-[13px] px-3.5 py-2.5"></div>

<script>
  // ── Season filter (reload) ────────────────────────────────────────────────
  document.querySelectorAll('[data-season]').forEach(function(b) {
    b.addEventListener('click', function() {
      var s = this.dataset.season;
      window.location.href = '/admin/players' + (s ? '?season=' + encodeURIComponent(s) : '');
    });
  });

  // ── Team filter ───────────────────────────────────────────────────────────
  var fteam = '';
  document.querySelectorAll('[data-fteam]').forEach(function(b) {
    b.addEventListener('click', function() {
      fteam = this.dataset.fteam;
      document.querySelectorAll('[data-fteam]').forEach(function(x){ x.classList.toggle('is-active', x.dataset.fteam === fteam); });
      applyFilters();
    });
  });

  // ── Active/inactive filter ────────────────────────────────────────────────
  var fstatus = 'active';
  ['plr-show-active','plr-show-inactive','plr-show-all'].forEach(function(id) {
    document.getElementById(id).addEventListener('click', function() {
      fstatus = id === 'plr-show-active' ? 'active' : id === 'plr-show-inactive' ? 'inactive' : 'all';
      ['plr-show-active','plr-show-inactive','plr-show-all'].forEach(function(x) {
        document.getElementById(x).classList.toggle('is-active', x === id);
      });
      applyFilters();
    });
  });

  // ── Search ────────────────────────────────────────────────────────────────
  document.getElementById('plr-search').addEventListener('input', applyFilters);

  function applyFilters() {
    var q = document.getElementById('plr-search').value.toLowerCase().trim();
    document.querySelectorAll('#plr-tbody .agm-row').forEach(function(r) {
      var teamOk   = !fteam || r.dataset.team === fteam;
      var statusOk = fstatus === 'all' || r.dataset.status === fstatus;
      var searchOk = !q || r.dataset.q.includes(q);
      r.style.display = (teamOk && statusOk && searchOk) ? '' : 'none';
    });
  }

  // ── Recompute All ─────────────────────────────────────────────────────────
  document.getElementById('plr-recompute-all').addEventListener('click', async function() {
    var btn = this;
    btn.disabled = true; btn.style.opacity = '0.6';
    var msg = document.getElementById('plr-recompute-msg');
    try {
      var season = new URLSearchParams(window.location.search).get('season') || '';
      var r = await fetch('/admin/players/recompute-all', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season: season })
      });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      msg.removeAttribute('hidden');
      msg.style.cssText = 'background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);color:#22c55e;border-radius:8px;font-size:13px;padding:10px 14px;margin-top:12px';
      msg.textContent = 'Recomputed ' + j.count + ' players. Reloading…';
      setTimeout(function(){ location.reload(); }, 900);
    } catch(err) {
      msg.removeAttribute('hidden');
      msg.style.cssText = 'background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#f87171;border-radius:8px;font-size:13px;padding:10px 14px;margin-top:12px';
      msg.textContent = err.message;
      btn.disabled = false; btn.style.opacity = '';
    }
  });

  // Apply default filter on load
  applyFilters();
</script>`;
}
