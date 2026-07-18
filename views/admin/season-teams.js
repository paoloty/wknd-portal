import { escHtml } from '../layout.js';

const TEAM_COLORS = [
  '#f59332', '#3b82f6', '#ef4444', '#22c55e',
  '#a855f7', '#ec4899', '#14b8a6', '#f97316',
];

const POS_ORDER = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };
const POSITIONS  = ['PG', 'SG', 'SF', 'PF', 'C'];

// Single 6-column row structure used in both pool and team tables.
// CSS hides rating cols (4-6) inside .team-col so only the pool shows them.
function playerRow(p, teamColor = '') {
  let positions = [];
  try { positions = JSON.parse(p.positions || '[]'); } catch(e) {}
  const primaryPos  = positions[0] || '';
  const posDisplay  = positions.slice(0, 2).join('/');
  const posOrder    = POS_ORDER[primaryPos] ?? 99;
  const accent      = teamColor || '#1e293b';
  const displayName = p.full_name || '—';
  const initials    = escHtml(displayName.charAt(0).toUpperCase());
  const pic         = p.picture_url || '';
  const isNew       = (p.career_games ?? 0) === 0;

  const rTd = (val, cls) => val != null && val !== ''
    ? `<td class="rating-td text-center text-[11px] font-bold px-2 py-1.5 ${cls}">${val}</td>`
    : `<td class="rating-td text-center text-[11px] px-2 py-1.5 text-slate-700">—</td>`;

  const subtext = (!p._sandbox && p.jersey_top)
    ? `<div class="text-[9px] text-slate-700 mt-px">Top: ${escHtml(p.jersey_top)}${p.jersey_shorts ? ` · Shorts: ${escHtml(p.jersey_shorts)}` : ''}</div>`
    : (p.height ? `<div class="text-[9px] text-slate-600 mt-px">${escHtml(p.height)}</div>` : '');

  const avatarHtml = pic
    ? `<img class="player-avatar-img" src="${escHtml(pic)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;object-position:top center;flex-shrink:0">`
    : `<div class="player-avatar-init" style="width:28px;height:28px;border-radius:50%;background:#1e293b;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#64748b">${initials}</div>`;

  return `<tr class="player-row" draggable="true"
    data-signup-id="${escHtml(p.id)}"
    data-rating="${p.rating ?? ''}"
    data-off-rating="${p.off_rating ?? ''}"
    data-def-rating="${p.def_rating ?? ''}"
    data-name="${escHtml((p.full_name || '').toLowerCase())}"
    data-display-name="${escHtml(displayName)}"
    data-primary-pos="${escHtml(primaryPos)}"
    data-pos-order="${posOrder}">
    <td style="width:0;padding:0;border-left:3px solid ${escHtml(accent)}"></td>
    <td class="px-2 py-1.5 text-[12px] font-semibold text-slate-200 max-w-[190px]">
      <div style="display:flex;align-items:center;gap:7px;min-width:0">
        ${avatarHtml}
        <div style="min-width:0;flex:1">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="truncate">${escHtml(displayName)}</span>
            ${isNew ? `<span style="font-size:8px;font-weight:800;letter-spacing:.08em;padding:1px 4px;border-radius:3px;background:#22c55e18;color:#22c55e;border:1px solid #22c55e33;flex-shrink:0;line-height:1.4">NEW</span>` : ''}
          </div>
          ${subtext}
        </div>
      </div>
    </td>
    <td class="px-1.5 py-1.5 text-[10px] text-slate-500 whitespace-nowrap min-w-[36px]">${escHtml(posDisplay || '—')}</td>
    ${rTd(p.rating,     'text-amber-400')}
    ${rTd(p.off_rating, 'text-blue-400')}
    ${rTd(p.def_rating, 'text-green-400')}
  </tr>`;
}

function teamColumn(team, players) {
  const rows = players.map(p => playerRow(p, team.color)).join('');
  const hint = players.length === 0
    ? `<tr class="drop-hint"><td colspan="6" class="text-center py-6 text-[11px] text-slate-700">Drop players here</td></tr>`
    : '';

  // Compute initial averages server-side for first render
  const numOf = (arr, key) => arr.map(p => p[key]).filter(v => v != null && v !== '');
  const avg = (vals) => vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  const initOvr = avg(numOf(players, 'rating'));
  const initOff = avg(numOf(players, 'off_rating'));
  const initDef = avg(numOf(players, 'def_rating'));

  const statPill = (val, color, cls) => `
    <div class="stat-${escHtml(cls)}-pill" style="display:flex;align-items:center;gap:6px">
      <span style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#475569;width:22px;flex-shrink:0">${escHtml(cls.toUpperCase())}</span>
      <div style="flex:1;height:5px;background:#0a1120;border-radius:3px;overflow:hidden;min-width:0">
        <div class="stat-fill" style="height:100%;border-radius:3px;background:${escHtml(color)};width:${val ?? 0}%;transition:width .45s cubic-bezier(.4,0,.2,1)"></div>
      </div>
      <span class="stat-val font-saira" style="font-size:12px;font-weight:700;width:22px;text-align:right;color:${val != null ? escHtml(color) : '#334155'}">${val ?? '—'}</span>
    </div>`;

  return `<div class="team-col" data-team-id="${escHtml(team.id)}">
    <!-- Team name + controls -->
    <div class="flex items-center gap-1.5 mb-1.5">
      <span class="team-dot w-2 h-2 rounded-full shrink-0" style="background:${escHtml(team.color)}"></span>
      <input class="team-name-input admin-input flex-1 text-[13px] font-bold min-w-0 px-2 py-1" data-team-id="${escHtml(team.id)}" value="${escHtml(team.name)}">
      <input type="color" class="team-color-input" data-team-id="${escHtml(team.id)}" value="${escHtml(team.color)}"
        style="width:24px;height:24px;border:1px solid #1e293b;border-radius:4px;background:none;cursor:pointer;padding:1px;flex-shrink:0">
      <button class="team-delete-btn text-slate-700 hover:text-error text-lg leading-none p-0 bg-transparent border-0 cursor-pointer shrink-0" data-team-id="${escHtml(team.id)}" title="Remove team">×</button>
    </div>

    <!-- Running team averages -->
    <div class="team-stats-bar px-2.5 py-2 bg-admin-bg rounded-md mb-2" style="display:flex;flex-direction:column;gap:4px" data-team-id="${escHtml(team.id)}">
      ${statPill(initOvr, '#f59332', 'ovr')}
      ${statPill(initOff, '#3b82f6', 'off')}
      ${statPill(initDef, '#22c55e', 'def')}
      <div style="text-align:right;margin-top:1px">
        <span class="stat-count" style="font-size:10px;color:#334155">${players.length}p</span>
      </div>
    </div>

    <!-- Drop zone -->
    <div class="drop-zone border-2 border-dashed border-admin-border rounded-lg overflow-hidden transition-colors" data-team-id="${escHtml(team.id)}">
      <table class="player-table w-full" style="border-collapse:collapse">
        <tbody class="player-tbody" data-team-id="${escHtml(team.id)}">${rows}${hint}</tbody>
      </table>
    </div>
  </div>`;
}

export function adminSeasonTeamsBody({ sigSeason = '', players = [], teams = [], rosterMap = {}, draftStatus = '', isSandbox = false, sandboxSource = null } = {}) {
  const confirmedPlayers = players.filter(p => p.status === 'confirmed');

  const assignedIds = new Set(
    Object.values(rosterMap).flatMap(arr => arr.map(p => p.id))
  );
  const unassigned = confirmedPlayers.filter(p => !assignedIds.has(p.id));

  const teamCols     = teams.map(t => teamColumn(t, rosterMap[t.id] || [])).join('');
  const colorPickers = TEAM_COLORS.map(c =>
    `<button class="color-swatch w-5 h-5 rounded shrink-0" data-color="${c}" style="background:${c};border:2px solid transparent;cursor:pointer"></button>`
  ).join('');

  const isStarted = !isSandbox && draftStatus === 'started';

  const poolHint = unassigned.length === 0
    ? `<tr class="drop-hint"><td colspan="6" class="text-center py-4 text-[11px] text-slate-700">All players assigned to teams</td></tr>`
    : '';

  const posFilterBtns = POSITIONS.map(pos =>
    `<button class="pos-filter-btn text-[10px] font-bold px-2.5 py-0.5 border border-admin-border rounded text-slate-500 bg-transparent cursor-pointer transition-all hover:border-slate-600" data-pos="${pos}">${pos}</button>`
  ).join('');

  const TH_CLS = 'px-2 py-1.5 text-[9.5px] font-bold tracking-widest uppercase text-slate-500 bg-admin-bg whitespace-nowrap';

  return `
<style>
  #teams-board { display:grid; grid-template-columns:repeat(${teams.length || 1}, minmax(0, 1fr)); gap:14px; align-items:start; }

  .player-row { cursor:grab; user-select:none; }
  .player-row:hover td { background:rgba(255,255,255,.025); }
  .player-table tbody tr { border-bottom:1px solid #0f1827; }
  .player-table tbody tr:last-child { border-bottom:none; }

  /* Hide OVR/OFF/DEF inside team drop zones — visible only in the pool */
  .team-col .player-table .rating-td { display:none; }

  .drop-zone.drag-over { border-color:#f59332 !important; background:#f5933208; }
  [data-sort-col] { cursor:pointer; }
  [data-sort-col]:hover { color:#94a3b8; }
  .pos-filter-btn.is-active { border-color:#f59332; color:#f59332; background:#f5933215; }
</style>

<div>
  <!-- Page header -->
  <div class="flex items-start justify-between gap-4 flex-wrap mb-5">
    <div>
      <a href="${isSandbox ? '/admin/season/teams' : '/admin/season'}" class="text-[11px] text-slate-500 hover:text-slate-300 no-underline inline-flex items-center gap-1 mb-1">← ${isSandbox ? 'Team Builder' : 'Season Management'}</a>
      <h1 class="m-0 text-xl font-extrabold text-slate-100">
        Team Builder
        ${isSandbox
          ? `<span class="ml-2 align-middle text-[12px] font-bold px-2.5 py-0.5 rounded-md" style="background:#a855f71a;color:#a855f7;border:1px solid #a855f733">Sandbox</span>`
          : `<span class="text-brand"> Season ${escHtml(String(sigSeason))}</span>`}
      </h1>
      ${isSandbox && sandboxSource ? (() => {
        const { source, season, gameSeasons = [], signupSeasons = [] } = sandboxSource;
        const srcLabel = source === 'waitlist' ? `Waitlist — Season ${season}` : `Players — Season ${season}`;
        const playerOpts = gameSeasons.map(s =>
          `<option value="players:${escHtml(s)}" ${source === 'players' && season === String(s) ? 'selected' : ''}>Players — Season ${escHtml(s)}</option>`
        ).join('');
        const waitlistOpts = signupSeasons.map(s =>
          `<option value="waitlist:${escHtml(s)}" ${source === 'waitlist' && season === String(s) ? 'selected' : ''}>Waitlist — Season ${escHtml(s)}</option>`
        ).join('');
        const hasOptions = gameSeasons.length || signupSeasons.length;
        return hasOptions ? `
          <div class="flex items-center gap-2 mt-1.5">
            <span class="text-[10px] text-slate-600 uppercase tracking-widest font-bold">Source:</span>
            <select id="sandbox-source-select" class="admin-input text-[11px] py-1 px-2 h-7">
              ${playerOpts}
              ${waitlistOpts}
            </select>
            <button id="sandbox-source-load" class="agm-new-btn text-[11px] py-1 px-3">Load</button>
          </div>` : `<p class="text-[11px] text-slate-500 mt-0.5 mb-0">Source: ${escHtml(srcLabel)}</p>`;
      })() : ''}
    </div>
    <div class="flex items-center gap-2 flex-wrap">
      ${isStarted ? `<span class="text-[11px] font-bold px-3 py-1 rounded-full" style="background:#22c55e1a;color:#22c55e;border:1px solid #22c55e33">SEASON STARTED</span>` : ''}
      <button id="auto-balance-btn" class="agm-new-btn" ${isStarted ? 'disabled' : ''}>⚡ Auto-Balance</button>
      <button id="save-draft-btn" class="agm-new-btn" ${isStarted ? 'disabled' : ''}>${isSandbox ? 'Save' : 'Save Draft'}</button>
      ${!isStarted && !isSandbox ? `<button id="start-season-btn" class="text-[12px] font-bold px-4 py-1.5 rounded-md border-0 cursor-pointer bg-green-500 text-admin-bg">Start Season →</button>` : ''}
      ${isSandbox ? `<button id="clear-sandbox-btn" class="text-[12px] font-semibold px-3.5 py-1.5 rounded-md cursor-pointer bg-transparent border border-admin-border text-slate-500 hover:text-slate-300">Clear</button>` : ''}
      <span id="builder-msg" class="text-[11px]"></span>
    </div>
  </div>

  ${!isStarted ? `
  <!-- Add team toolbar -->
  <div class="flex items-center gap-2 flex-wrap mb-4 px-3.5 py-2.5 bg-admin-surface border border-admin-border rounded-lg">
    <input id="new-team-name" class="admin-input text-[12px] w-40" placeholder="Team name">
    <div class="flex gap-1 items-center" id="color-swatches">${colorPickers}</div>
    <button id="add-team-btn" class="agm-new-btn">+ Add Team</button>
  </div>` : ''}

  <!-- Teams grid -->
  ${teams.length > 0
    ? `<div id="teams-board">${teamCols}</div>`
    : `<div id="teams-board" class="border-2 border-dashed border-admin-border rounded-xl p-10 text-center text-slate-700 text-[13px] mb-4">Add a team above to get started.</div>`}

  <!-- Unassigned pool -->
  <div class="mt-6 pt-5 border-t border-admin-border">
    <div class="flex items-center justify-between gap-2 flex-wrap mb-2.5">
      <div class="text-[10px] font-bold text-slate-500 tracking-widest uppercase">
        Unassigned <span id="unassigned-count" class="text-slate-600">(${unassigned.length})</span>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <input id="pool-search" type="text" placeholder="Search…"
          class="h-7 px-2.5 text-[12px] bg-admin-surface border border-admin-border rounded text-slate-200 w-36 outline-none font-sans">
        <div class="flex gap-1">${posFilterBtns}</div>
        <span id="filter-status" class="text-[10px] text-slate-600 min-w-[50px]"></span>
      </div>
    </div>

    <div class="drop-zone border-2 border-dashed border-admin-border rounded-lg overflow-hidden transition-colors" id="unassigned-pool">
      <table class="player-table w-full" style="border-collapse:collapse">
        <thead>
          <tr class="border-b border-admin-border">
            <th style="width:0;padding:0"></th>
            <th data-sort-col="name" class="${TH_CLS} text-left pl-3">Name<span class="sort-ind"> ↕</span></th>
            <th data-sort-col="pos"  class="${TH_CLS} text-left">Pos<span class="sort-ind"> ↕</span></th>
            <th data-sort-col="ovr"  class="${TH_CLS} text-center text-amber-500/70">OVR<span class="sort-ind"> ↕</span></th>
            <th data-sort-col="off"  class="${TH_CLS} text-center text-blue-400/70">OFF<span class="sort-ind"> ↕</span></th>
            <th data-sort-col="def"  class="${TH_CLS} text-center text-green-400/70">DEF<span class="sort-ind"> ↕</span></th>
          </tr>
        </thead>
        <tbody id="unassigned-pool-tbody">
          ${unassigned.map(p => playerRow(p)).join('')}
          ${poolHint}
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- Start Season Modal -->
<div id="start-modal" class="hidden fixed inset-0 z-50 items-center justify-center" style="background:rgba(0,0,0,.75)">
  <div class="bg-admin-surface border border-admin-border rounded-xl p-8 max-w-lg w-[90%] shadow-2xl">
    <h2 class="m-0 mb-3 text-lg font-extrabold text-slate-100">Start Season ${escHtml(String(sigSeason))}?</h2>
    <p class="text-[13px] text-slate-400 m-0 mb-3 leading-relaxed">This will:</p>
    <ul class="text-[13px] text-slate-400 m-0 mb-5 pl-5 leading-loose">
      <li>Email confirmed players that they made it</li>
      <li>Email unselected players that they didn't</li>
      <li>Charge season fee + jersey costs to each confirmed player</li>
      <li>Lock the team draft — rosters can't be changed</li>
    </ul>
    <div id="modal-charge-preview" class="bg-admin-surface2 border border-admin-border rounded-lg px-4 py-3 mb-5 text-[12px] text-slate-500">Loading charge preview…</div>
    <div class="flex gap-2.5 justify-end">
      <button id="modal-cancel" class="bg-transparent border border-admin-border text-slate-400 text-[13px] font-semibold rounded-md px-4 py-2 cursor-pointer">Cancel</button>
      <button id="modal-confirm" class="bg-green-500 text-admin-bg text-[13px] font-bold border-0 rounded-md px-4 py-2 cursor-pointer">Confirm &amp; Start</button>
    </div>
    <p id="modal-error" class="text-error text-[12px] mt-2 text-right min-h-[16px] m-0"></p>
  </div>
</div>

<script>
(function() {
  var SEASON = ${JSON.stringify(sigSeason)};
  var dragging = null;

  // ── Team stats ───────────────────────────────────────────────────────────
  function avgStat(rows, attr) {
    var vals = rows.map(function(r) { return parseFloat(r.dataset[attr]); }).filter(function(v) { return !isNaN(v); });
    return vals.length ? Math.round(vals.reduce(function(a,b){return a+b;}, 0) / vals.length) : null;
  }

  function updateTeamStats(col) {
    var tbody = col.querySelector('.player-tbody');
    var bar   = col.querySelector('.team-stats-bar');
    if (!tbody || !bar) return;
    var rows  = Array.from(tbody.querySelectorAll('tr.player-row'));
    var ovr   = avgStat(rows, 'rating');
    var off   = avgStat(rows, 'offRating');
    var def   = avgStat(rows, 'defRating');

    function setPill(cls, val, color) {
      var pill = bar.querySelector('.stat-' + cls + '-pill');
      if (!pill) return;
      var fill  = pill.querySelector('.stat-fill');
      var valEl = pill.querySelector('.stat-val');
      if (fill)  fill.style.width = (val != null ? val : 0) + '%';
      if (valEl) { valEl.textContent = val != null ? val : '—'; valEl.style.color = val != null ? color : '#334155'; }
    }
    setPill('ovr', ovr, '#f59332');
    setPill('off', off, '#3b82f6');
    setPill('def', def, '#22c55e');
    var cnt = bar.querySelector('.stat-count');
    if (cnt) cnt.textContent = rows.length + 'p';
  }

  function updateAllTeamStats() {
    document.querySelectorAll('.team-col').forEach(updateTeamStats);
  }

  // ── Hint row helper ──────────────────────────────────────────────────────
  function createHintRow(text) {
    var tr = document.createElement('tr');
    tr.className = 'drop-hint';
    var td = document.createElement('td');
    td.colSpan = 6;
    td.className = 'text-center py-4 text-[11px] text-slate-700';
    td.textContent = text;
    tr.appendChild(td);
    return tr;
  }

  // ── Drag and drop ────────────────────────────────────────────────────────
  function bindRow(row) {
    row.addEventListener('dragstart', function(e) {
      dragging = row;
      e.dataTransfer.effectAllowed = 'move';

      // Ghost: avatar circle + name only
      var ghost = document.createElement('div');
      ghost.style.cssText = 'position:fixed;top:-9999px;left:0;background:#0d1424;border:1px solid #1e293b;border-radius:8px;padding:6px 10px;display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:#e2e8f0;white-space:nowrap;font-family:inherit;';
      var name = this.dataset.displayName || '';
      var srcImg = this.querySelector('.player-avatar-img');
      if (srcImg) {
        var av = srcImg.cloneNode(false);
        av.style.cssText = 'width:28px;height:28px;border-radius:50%;object-fit:cover;object-position:top center;flex-shrink:0;';
        ghost.appendChild(av);
      } else {
        var av = document.createElement('div');
        av.style.cssText = 'width:28px;height:28px;border-radius:50%;background:#1e293b;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#64748b;';
        av.textContent = name.charAt(0).toUpperCase();
        ghost.appendChild(av);
      }
      var nameEl = document.createElement('span');
      nameEl.textContent = name;
      ghost.appendChild(nameEl);
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 24, 20);
      setTimeout(function() { ghost.remove(); }, 0);

      setTimeout(function() { row.style.opacity = '.35'; }, 0);
    });
    row.addEventListener('dragend', function() {
      row.style.opacity = '';
      dragging = null;
      document.querySelectorAll('.drop-zone').forEach(function(z) { z.classList.remove('drag-over'); });
    });
  }

  function getTbody(zone) {
    return zone.id === 'unassigned-pool'
      ? document.getElementById('unassigned-pool-tbody')
      : zone.querySelector('.player-tbody');
  }

  function bindZone(zone) {
    zone.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', function(e) {
      if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
    });
    zone.addEventListener('drop', function(e) {
      e.preventDefault();
      zone.classList.remove('drag-over');
      if (!dragging) return;

      var isPool = zone.id === 'unassigned-pool';
      var tbody  = getTbody(zone);
      if (!tbody) return;

      var hint = tbody.querySelector('tr.drop-hint');
      if (hint) hint.remove();

      var accentTd = dragging.querySelector('td:first-child');
      if (accentTd) {
        if (isPool) {
          accentTd.style.borderLeftColor = '#1e293b';
        } else {
          var col = document.querySelector('.team-col[data-team-id="' + zone.dataset.teamId + '"]');
          var color = col ? col.querySelector('.team-color-input').value : '#1e293b';
          accentTd.style.borderLeftColor = color;
        }
      }

      if (isPool) dragging.style.display = '';
      dragging.style.opacity = '';
      tbody.appendChild(dragging);

      restoreHints();
      updateAllTeamStats();
      updateUnassignedCount();
      if (isPool) applyFilters();
    });
  }

  function restoreHints() {
    document.querySelectorAll('.player-tbody').forEach(function(tbody) {
      if (!tbody.querySelector('tr.player-row') && !tbody.querySelector('tr.drop-hint'))
        tbody.appendChild(createHintRow('Drop players here'));
    });
    var pool = document.getElementById('unassigned-pool-tbody');
    if (pool && !pool.querySelector('tr.player-row') && !pool.querySelector('tr.drop-hint'))
      pool.appendChild(createHintRow('All players assigned to teams'));
  }

  function updateUnassignedCount() {
    var pool = document.getElementById('unassigned-pool-tbody');
    var el   = document.getElementById('unassigned-count');
    if (el && pool) el.textContent = '(' + pool.querySelectorAll('tr.player-row').length + ')';
  }

  document.querySelectorAll('tr.player-row').forEach(bindRow);
  document.querySelectorAll('.drop-zone').forEach(bindZone);

  // ── Position filter + search ─────────────────────────────────────────────
  var activePosFilters = new Set();
  var searchQuery = '';

  function applyFilters() {
    var pool = document.getElementById('unassigned-pool-tbody');
    if (!pool) return;
    var rows = Array.from(pool.querySelectorAll('tr.player-row'));
    var visible = 0;
    rows.forEach(function(row) {
      var show = (activePosFilters.size === 0 || activePosFilters.has(row.dataset.primaryPos))
              && (!searchQuery || row.dataset.name.includes(searchQuery));
      row.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    var st = document.getElementById('filter-status');
    if (st) st.textContent = (activePosFilters.size || searchQuery) ? visible + ' / ' + rows.length : '';
  }

  document.querySelectorAll('.pos-filter-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var pos = this.dataset.pos;
      if (activePosFilters.has(pos)) { activePosFilters.delete(pos); this.classList.remove('is-active'); }
      else                           { activePosFilters.add(pos);    this.classList.add('is-active'); }
      applyFilters();
    });
  });

  var si = document.getElementById('pool-search');
  if (si) si.addEventListener('input', function() { searchQuery = this.value.trim().toLowerCase(); applyFilters(); });

  // ── Sort pool ────────────────────────────────────────────────────────────
  var sortCol = null, sortDir = 1;
  document.querySelectorAll('[data-sort-col]').forEach(function(th) {
    th.addEventListener('click', function() {
      var col = this.dataset.sortCol;
      sortDir = (sortCol === col) ? sortDir * -1 : 1;
      sortCol = col;
      document.querySelectorAll('[data-sort-col] .sort-ind').forEach(function(ind) {
        ind.textContent = ind.parentElement.dataset.sortCol === sortCol ? (sortDir === 1 ? ' ↑' : ' ↓') : ' ↕';
      });
      var tbody = document.getElementById('unassigned-pool-tbody');
      Array.from(tbody.querySelectorAll('tr.player-row'))
        .sort(function(a, b) {
          var v;
          if      (col === 'pos') v = Number(a.dataset.posOrder)           - Number(b.dataset.posOrder);
          else if (col === 'ovr') v = parseFloat(a.dataset.rating    || 0) - parseFloat(b.dataset.rating    || 0);
          else if (col === 'off') v = parseFloat(a.dataset.offRating || 0) - parseFloat(b.dataset.offRating || 0);
          else if (col === 'def') v = parseFloat(a.dataset.defRating || 0) - parseFloat(b.dataset.defRating || 0);
          else                    v = (a.dataset.name || '').localeCompare(b.dataset.name || '');
          return v * sortDir;
        })
        .forEach(function(r) { tbody.appendChild(r); });
    });
  });

  // ── Team color live update ───────────────────────────────────────────────
  document.querySelectorAll('.team-color-input').forEach(function(input) {
    input.addEventListener('input', function() {
      var col = document.querySelector('.team-col[data-team-id="' + this.dataset.teamId + '"]');
      if (!col) return;
      col.querySelector('.team-dot').style.background = this.value;
      col.querySelectorAll('.player-tbody td:first-child').forEach(function(td) {
        td.style.borderLeftColor = input.value;
      });
    });
  });

  // ── Color swatches ───────────────────────────────────────────────────────
  var pickedColor = '${escHtml(TEAM_COLORS[0])}';
  document.querySelectorAll('.color-swatch').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.color-swatch').forEach(function(b) { b.style.borderColor = 'transparent'; });
      this.style.borderColor = '#fff';
      pickedColor = this.dataset.color;
    });
  });
  var firstSwatch = document.querySelector('.color-swatch');
  if (firstSwatch) firstSwatch.style.borderColor = '#fff';

  // ── Add team ─────────────────────────────────────────────────────────────
  var addTeamBtn = document.getElementById('add-team-btn');
  if (addTeamBtn) addTeamBtn.addEventListener('click', async function() {
    var inp = document.getElementById('new-team-name');
    var name = inp.value.trim();
    if (!name) { inp.focus(); return; }
    addTeamBtn.disabled = true; addTeamBtn.textContent = 'Adding…';
    try {
      var r = await fetch('/admin/season/teams/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season: SEASON, name, color: pickedColor }),
      });
      if (!r.ok) throw new Error();
      location.reload();
    } catch(e) { addTeamBtn.disabled = false; addTeamBtn.textContent = '+ Add Team'; alert('Error creating team.'); }
  });

  // ── Delete team ───────────────────────────────────────────────────────────
  document.querySelectorAll('.team-delete-btn').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      if (!confirm('Remove this team? Players will return to unassigned.')) return;
      try {
        var r = await fetch('/admin/season/teams/' + this.dataset.teamId + '/delete', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
        });
        if (!r.ok) throw new Error();
        location.reload();
      } catch(e) { alert('Error deleting team.'); }
    });
  });

  // ── Build data for save ───────────────────────────────────────────────────
  function buildAssignments() {
    var out = [];
    document.querySelectorAll('.team-col').forEach(function(col) {
      col.querySelectorAll('.player-tbody tr.player-row').forEach(function(row) {
        out.push({ signup_id: row.dataset.signupId, team_id: col.dataset.teamId });
      });
    });
    var pool = document.getElementById('unassigned-pool-tbody');
    if (pool) pool.querySelectorAll('tr.player-row').forEach(function(row) {
      out.push({ signup_id: row.dataset.signupId, team_id: '' });
    });
    return out;
  }

  function buildTeamUpdates() {
    return Array.from(document.querySelectorAll('.team-col')).map(function(col, i) {
      return {
        id:         col.dataset.teamId,
        name:       col.querySelector('.team-name-input').value.trim(),
        color:      col.querySelector('.team-color-input').value,
        sort_order: i,
      };
    });
  }

  // ── Save draft ────────────────────────────────────────────────────────────
  var saveDraftBtn = document.getElementById('save-draft-btn');
  if (saveDraftBtn) saveDraftBtn.addEventListener('click', async function() {
    var msg = document.getElementById('builder-msg');
    saveDraftBtn.disabled = true; msg.textContent = 'Saving…'; msg.className = 'text-[11px] text-slate-400';
    try {
      var r = await fetch('/admin/season/teams/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season: SEASON, teams: buildTeamUpdates(), assignments: buildAssignments() }),
      });
      if (!r.ok) throw new Error();
      msg.className = 'text-[11px] text-green-400'; msg.textContent = 'Saved.';
    } catch(e) { msg.className = 'text-[11px] text-error'; msg.textContent = 'Error saving.'; }
    saveDraftBtn.disabled = false;
    setTimeout(function() { msg.textContent = ''; }, 2500);
  });

  // ── Auto-balance ──────────────────────────────────────────────────────────
  // Round 1: continuous snake across all position groups (C→PF→SF→SG→PG) so
  //          the direction carries over — T1 never gets first pick every time.
  // Round 2: greedy — each overflow/unlabeled player goes to the team with the
  //          lowest current OVR sum, tightening the spread as much as possible.
  var autoBtn = document.getElementById('auto-balance-btn');
  if (autoBtn) autoBtn.addEventListener('click', function() {
    var cols = Array.from(document.querySelectorAll('.team-col'));
    if (!cols.length) { alert('Add at least one team first.'); return; }
    if (!confirm('Auto-balance will reassign all players by position and rating. Continue?')) return;

    var POS_DRAFT = ['C', 'PF', 'SF', 'SG', 'PG'];
    var n       = cols.length;
    var tbodies = cols.map(function(c) { return c.querySelector('.player-tbody'); });

    // Detach all rows
    var allRows = Array.from(document.querySelectorAll('tr.player-row'));
    allRows.forEach(function(r) { r.remove(); });
    tbodies.forEach(function(tb) { if (tb) tb.querySelectorAll('tr.drop-hint').forEach(function(h) { h.remove(); }); });

    // Group by primary position, sort each by OVR desc
    var groups = {};
    POS_DRAFT.forEach(function(p) { groups[p] = []; });
    groups[''] = [];
    allRows.forEach(function(row) {
      var pos = row.dataset.primaryPos || '';
      (groups[pos] !== undefined ? groups[pos] : groups['']).push(row);
    });

    function sortOvr(arr) {
      return arr.slice().sort(function(a, b) { return parseFloat(b.dataset.rating || 0) - parseFloat(a.dataset.rating || 0); });
    }
    Object.keys(groups).forEach(function(k) { groups[k] = sortOvr(groups[k]); });

    var assignments = cols.map(function() { return []; });

    // Round 1: continuous snake — idx/dir carry over between position groups
    var snakeIdx = 0, snakeDir = 1;
    function snake(players) {
      players.forEach(function(row) {
        assignments[snakeIdx].push(row);
        snakeIdx += snakeDir;
        if (snakeIdx >= n) { snakeDir = -1; snakeIdx = n - 1; }
        if (snakeIdx < 0)  { snakeDir =  1; snakeIdx = 0; }
      });
    }

    var overflow = [];
    POS_DRAFT.forEach(function(pos) {
      snake(groups[pos].slice(0, n));
      overflow = overflow.concat(groups[pos].slice(n));
    });

    // Round 2: greedy — weakest team (by OVR sum) gets each remaining player
    function teamOvrSum(i) {
      return assignments[i].reduce(function(acc, r) { return acc + parseFloat(r.dataset.rating || 0); }, 0);
    }
    sortOvr(overflow.concat(groups[''])).forEach(function(row) {
      var best = 0;
      for (var i = 1; i < n; i++) { if (teamOvrSum(i) < teamOvrSum(best)) best = i; }
      assignments[best].push(row);
    });

    // Apply
    cols.forEach(function(col, i) {
      var tbody = tbodies[i];
      if (!tbody) return;
      var color = col.querySelector('.team-color-input').value;
      assignments[i].forEach(function(row) {
        var td = row.querySelector('td:first-child');
        if (td) td.style.borderLeftColor = color;
        row.style.opacity = ''; row.style.display = '';
        tbody.appendChild(row);
      });
      if (!tbody.querySelector('tr.player-row')) tbody.appendChild(createHintRow('Drop players here'));
    });

    var pool = document.getElementById('unassigned-pool-tbody');
    if (pool) { pool.querySelectorAll('tr.drop-hint').forEach(function(h) { h.remove(); }); pool.appendChild(createHintRow('All players assigned to teams')); }

    // Reset filters
    activePosFilters.clear(); searchQuery = '';
    var poolSearch = document.getElementById('pool-search');
    if (poolSearch) poolSearch.value = '';
    document.querySelectorAll('.pos-filter-btn').forEach(function(b) { b.classList.remove('is-active'); });
    var fs = document.getElementById('filter-status');
    if (fs) fs.textContent = '';

    updateAllTeamStats();
    updateUnassignedCount();
  });

  // ── Clear sandbox ─────────────────────────────────────────────────────────
  var clearBtn = document.getElementById('clear-sandbox-btn');
  if (clearBtn) clearBtn.addEventListener('click', async function() {
    if (!confirm('Clear all sandbox teams and assignments?')) return;
    clearBtn.disabled = true; clearBtn.textContent = 'Clearing…';
    try {
      await fetch('/admin/season/teams/sandbox/clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      location.reload();
    } catch(e) { clearBtn.disabled = false; clearBtn.textContent = 'Clear'; alert('Error.'); }
  });

  // ── Start Season modal ────────────────────────────────────────────────────
  var startBtn  = document.getElementById('start-season-btn');
  var modal     = document.getElementById('start-modal');
  var cancelBtn = document.getElementById('modal-cancel');
  var confBtn   = document.getElementById('modal-confirm');

  if (startBtn) startBtn.addEventListener('click', async function() {
    modal.classList.remove('hidden'); modal.classList.add('flex');
    var preview = document.getElementById('modal-charge-preview');
    preview.textContent = 'Loading…';
    try {
      var r = await fetch('/admin/season/teams/charge-preview?season=' + encodeURIComponent(SEASON));
      var d = await r.json();
      if (d.lines && d.lines.length) {
        preview.innerHTML = d.lines.map(function(l) {
          return '<div class="flex justify-between py-0.5"><span class="text-slate-400">' + l.name + '</span><span class="text-slate-200 font-semibold">' + l.total + '</span></div>';
        }).join('') + '<div class="flex justify-between pt-2 mt-2 border-t border-admin-border font-bold text-slate-100"><span>Total</span><span>' + d.grand_total + '</span></div>';
      } else {
        preview.textContent = 'No confirmed players with charges.';
      }
    } catch(e) { preview.textContent = 'Could not load preview.'; }
  });

  if (cancelBtn) cancelBtn.addEventListener('click', function() { modal.classList.add('hidden'); modal.classList.remove('flex'); });
  modal.addEventListener('click', function(e) { if (e.target === modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); } });

  if (confBtn) confBtn.addEventListener('click', async function() {
    var errEl = document.getElementById('modal-error');
    errEl.textContent = '';
    confBtn.disabled = true; confBtn.textContent = 'Starting…';
    await fetch('/admin/season/teams/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season: SEASON, teams: buildTeamUpdates(), assignments: buildAssignments() }),
    });
    try {
      var r = await fetch('/admin/season/teams/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season: SEASON }),
      });
      var d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      location.reload();
    } catch(e) {
      errEl.textContent = e.message;
      confBtn.disabled = false; confBtn.textContent = 'Confirm & Start';
    }
  });

  // ── Sandbox source switcher ───────────────────────────────────────────────
  var sandboxLoadBtn = document.getElementById('sandbox-source-load');
  if (sandboxLoadBtn) sandboxLoadBtn.addEventListener('click', function() {
    var sel = document.getElementById('sandbox-source-select');
    if (!sel) return;
    var parts = sel.value.split(':');
    var src = parts[0], season = parts[1];
    window.location.href = '/admin/season/teams/sandbox?source=' + encodeURIComponent(src) + '&season=' + encodeURIComponent(season);
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  updateAllTeamStats();
})();
</script>`;
}
