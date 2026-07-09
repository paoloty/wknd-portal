import { escHtml } from '../layout.js';
import { displayPlayerName, teamColor } from '../utils.js';
import { ovrColor } from '../../lib/ratings.js';

const ICON_CHEVRON_R = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4.5 2.5l3 3-3 3"/></svg>`;
const ICON_RECOMPUTE = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 6.5A4.5 4.5 0 1 1 8 2.5"/><path d="M8 1v3h3"/></svg>`;

function ovrBadge(ovr) {
  if (ovr == null) return `<span style="color:var(--text-muted);font-size:12px">—</span>`;
  const color = ovrColor(ovr);
  return `<span style="font-size:16px;font-weight:800;color:${color}">${ovr}</span>`;
}

function miniBar(val, color) {
  if (val == null) return `<span style="color:var(--text-muted);font-size:12px">—</span>`;
  const pct = Math.round((val / 99) * 100);
  return `<div style="display:flex;align-items:center;gap:6px">
    <div style="width:42px;height:4px;background:var(--border);border-radius:99px;overflow:hidden;flex-shrink:0">
      <div style="width:${pct}%;height:100%;background:${color};border-radius:99px"></div>
    </div>
    <span style="font-size:12px;font-weight:600;color:${color}">${val}</span>
  </div>`;
}

function posChips(positions) {
  try {
    const arr = typeof positions === 'string' ? JSON.parse(positions) : (positions || []);
    if (!arr.length) return '';
    return arr.map(p => `<span style="font-size:10px;background:var(--border);color:var(--text-muted);padding:1px 5px;border-radius:4px;margin-left:4px">${escHtml(p)}</span>`).join('');
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

    return `<tr class="agm-row admin-table-row"
      data-id="${escHtml(p.id)}"
      data-q="${escHtml(name.toLowerCase())}"
      data-team="${escHtml((p.team_name || '').toLowerCase())}"
      data-status="${inactive ? 'inactive' : 'active'}"
      style="${inactive ? 'opacity:0.45' : ''}">
      <td class="admin-td">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="team-dot" style="background:${color};flex-shrink:0"></span>
          <div>
            <span style="font-weight:500">${escHtml(name)}</span>
            ${inactive ? `<span style="font-size:10px;background:rgba(100,116,139,.15);color:var(--text-muted);padding:1px 6px;border-radius:4px;margin-left:6px">Inactive</span>` : ''}
            ${posChips(p.positions)}
          </div>
        </div>
      </td>
      <td class="admin-td" style="text-align:center">${ovrBadge(p.eff_overall)}</td>
      <td class="admin-td">${miniBar(off, '#f59332')}</td>
      <td class="admin-td">${miniBar(p.eff_defense, '#06b6d4')}</td>
      <td class="admin-td">${miniBar(p.eff_usage, '#22c55e')}</td>
      <td class="admin-td">${miniBar(p.eff_iq, '#94a3b8')}</td>
      <td class="admin-td agm-td--action">
        <a href="/admin/players/${escHtml(p.id)}${season ? '?season='+encodeURIComponent(season) : ''}" class="agm-edit-link">Edit ${ICON_CHEVRON_R}</a>
      </td>
    </tr>`;
  }).join('');

  return `
<div class="agm-toolbar">
  <h2 class="agm-page-title">Players</h2>
  <div class="agm-toolbar__right">
    <button id="plr-recompute-all" class="agm-pill" style="display:inline-flex;align-items:center;gap:6px">${ICON_RECOMPUTE} Recompute All</button>
    <input type="search" id="plr-search" class="agm-search" placeholder="Search players…">
  </div>
</div>

<div class="agm-filters">
  ${seasons.length ? `<div class="agm-filter-group" id="plr-season-pills">
    <button class="agm-pill${!season ? ' is-active' : ''}" data-season="">All Time</button>
    ${seasonPills}
  </div>` : ''}
  <div class="agm-filter-group">
    <button class="agm-pill is-active" data-fteam="">All Teams</button>
    ${teamPills}
  </div>
  <div class="agm-filter-group">
    <button class="agm-pill is-active" id="plr-show-active">Active</button>
    <button class="agm-pill" id="plr-show-inactive">Inactive</button>
    <button class="agm-pill" id="plr-show-all">All</button>
  </div>
</div>

<div class="card admin-table-scroll" style="padding:0">
  <table class="admin-table">
    <thead>
      <tr>
        <th class="admin-th">Player</th>
        <th class="admin-th" style="text-align:center">OVR</th>
        <th class="admin-th">OFF</th>
        <th class="admin-th">DEF</th>
        <th class="admin-th">USG</th>
        <th class="admin-th">IQ</th>
        <th class="admin-th"></th>
      </tr>
    </thead>
    <tbody id="plr-tbody">
      ${rows || '<tr><td colspan="7" style="padding:40px;text-align:center;color:var(--text-muted)">No players found.</td></tr>'}
    </tbody>
  </table>
</div>

<div id="plr-recompute-msg" hidden style="margin-top:12px;border-radius:8px;font-size:13px;padding:10px 14px"></div>

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
