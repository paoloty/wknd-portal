import { escHtml } from '../layout.js';
import { displayPlayerName, teamColor } from '../utils.js';
import { buildBoxScoreData, teamBoxScoreTab, gameLeadersTab, teamComparisonTab, lineScoreTab } from '../game.js';

const ICON_IMPORT = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 1v7.5M4.5 6L7 8.5 9.5 6"/><path d="M2 10v1.5A1.5 1.5 0 0 0 3.5 13h7A1.5 1.5 0 0 0 12 11.5V10"/></svg>`;
const ICON_CHEVRON_R = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4.5 2.5l3 3-3 3"/></svg>`;

const fmtDate = d => d
  ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—';
const fmtDateLong = d => d
  ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  : '';

function isUpcoming(game) {
  return game.scheduled === 1 || (Number(game.team_a_score) + Number(game.team_b_score)) === 0;
}

function statusBadge(game) {
  if (isUpcoming(game) || game.status === 'scheduled') return `<span class="agm-badge agm-badge--amber">Upcoming</span>`;
  if (game.status === 'final')    return `<span class="agm-badge agm-badge--blue">Final</span>`;
  if (game.under_review)          return `<span class="agm-badge agm-badge--gray">Draft</span>`;
  return `<span class="agm-badge agm-badge--green">Live</span>`;
}

function otLabel(ot) {
  const n = Number(ot) || 0;
  return n === 0 ? '' : n === 1 ? 'OT' : `OT${n}`;
}

// ── Games list ────────────────────────────────────────────────────────────────
export function adminGamesListBody({ games = [], seasons = [], teams = [], currentSeason = 1 } = {}) {
  const rows = games.map(g => {
    const scoreA = Number(g.team_a_score), scoreB = Number(g.team_b_score);
    const winner = !g.scheduled && (scoreA !== scoreB) ? (scoreA > scoreB ? 'a' : 'b') : '';
    const contentDots = [
      `<span class="agm-dot${g.game_writeup ? ' agm-dot--on' : ''}" title="Recap"></span>`,
      `<span class="agm-dot${g.youtube_url  ? ' agm-dot--on' : ''}" title="YouTube"></span>`,
      `<span class="agm-dot${g.has_cover    ? ' agm-dot--on' : ''}" title="Cover"></span>`,
    ].join('');
    const isUpcom  = isUpcoming(g);
    const isFinal  = g.status === 'final';
    const statusKey = isUpcom ? 'upcoming' : isFinal ? 'final' : g.under_review ? 'draft' : 'live';
    const typeKey   = g.game_type === 'playoff' ? 'playoff' : 'regular';
    const ot        = Number(g.overtime) || 0;
    const otLbl     = otLabel(ot);

    const scoreCell = isUpcom
      ? `<span class="agm-vs">vs</span>`
      : `<span class="agm-score">${scoreA} – ${scoreB}${otLbl ? `<span style="font-size:10px;font-weight:700;color:var(--amber);margin-left:4px">${otLbl}</span>` : ''}</span>`;

    const otEdit = !isUpcom
      ? `<select class="agm-ot-sel" data-gid="${escHtml(g.id)}" title="Overtime periods" style="font-size:11px;background:var(--bg);border:1px solid var(--border);color:var(--text-muted);border-radius:4px;padding:1px 4px">
          <option value="0"${ot===0?' selected':''}>REG</option>
          <option value="1"${ot===1?' selected':''}>OT</option>
          <option value="2"${ot===2?' selected':''}>OT2</option>
          <option value="3"${ot===3?' selected':''}>OT3</option>
        </select>`
      : '';

    const markFinalBtn = isUpcom
      ? `<button class="agm-final-btn" data-gid="${escHtml(g.id)}" data-name="${escHtml(g.team_a_name + ' vs ' + g.team_b_name)}" style="font-size:11px;font-weight:600;color:var(--amber);background:none;border:1px solid var(--amber);border-radius:4px;padding:2px 8px;cursor:pointer;white-space:nowrap">Final Score</button>`
      : '';

    return `<tr class="agm-row admin-table-row"
      data-type="${typeKey}"
      data-status="${statusKey}"
      data-season="${escHtml(g.season || '')}"
      data-q="${escHtml((g.team_a_name + ' ' + g.team_b_name).toLowerCase())}">
      <td class="admin-td agm-td--date">${fmtDate(g.date)}</td>
      <td class="admin-td agm-td--matchup">
        <span class="${winner === 'a' ? 'agm-team--win' : ''}">${escHtml(g.team_a_name)}</span>
        ${scoreCell}
        <span class="${winner === 'b' ? 'agm-team--win' : ''}">${escHtml(g.team_b_name)}</span>
      </td>
      <td class="admin-td">
        <span class="agm-type${typeKey === 'playoff' ? ' agm-type--po' : ''}">${typeKey === 'playoff' ? 'PO' : 'RS'}</span>
      </td>
      <td class="admin-td agm-td--season">${escHtml(g.season || '—')}</td>
      <td class="admin-td">${statusBadge(g)}</td>
      <td class="admin-td"><span class="agm-dots">${contentDots}</span>${otEdit}</td>
      <td class="admin-td agm-td--action" style="display:flex;gap:6px;align-items:center;justify-content:flex-end">
        ${markFinalBtn}
        <a href="/admin/games/${escHtml(g.id)}" class="agm-edit-link">Edit ${ICON_CHEVRON_R}</a>
      </td>
    </tr>`;
  }).join('');

  const seasonPills = seasons.map(s =>
    `<button class="agm-pill" data-fs="${escHtml(s)}">${escHtml(s)}</button>`
  ).join('');

  const teamOpts = teams.map(t =>
    `<option value="${escHtml(t.id)}">${escHtml(t.name)}</option>`
  ).join('');

  const today = new Date().toISOString().slice(0, 10);

  return `
<div class="agm-toolbar">
  <h2 class="agm-page-title">Games</h2>
  <div class="agm-toolbar__right">
    <input type="search" id="agm-search" class="agm-search" placeholder="Search teams…">
    <button class="agm-new-btn" id="agm-new-btn">+ New Game</button>
  </div>
</div>

<div class="agm-modal-backdrop" id="agm-modal-backdrop" hidden>
  <div class="agm-modal">
    <div class="agm-modal-header">
      <h3 class="agm-modal-title">New Game</h3>
      <button class="agm-modal-close" id="agm-modal-close" aria-label="Close">✕</button>
    </div>
    <div class="agm-modal-body">
      <div class="agm-modal-field">
        <label class="agm-modal-label">Date</label>
        <input type="date" id="ng-date" class="agm-modal-input" value="${today}">
      </div>
      <div class="agm-modal-field">
        <label class="agm-modal-label">Team A</label>
        <select id="ng-team-a" class="agm-modal-select">
          <option value="">Select team…</option>
          ${teamOpts}
        </select>
      </div>
      <div class="agm-modal-field">
        <label class="agm-modal-label">Team B</label>
        <select id="ng-team-b" class="agm-modal-select">
          <option value="">Select team…</option>
          ${teamOpts}
        </select>
      </div>
      <div class="agm-modal-row">
        <div class="agm-modal-field">
          <label class="agm-modal-label">Season</label>
          <input type="number" id="ng-season" class="agm-modal-input" value="${escHtml(String(currentSeason))}" min="1" step="1">
        </div>
        <div class="agm-modal-field">
          <label class="agm-modal-label">Type</label>
          <select id="ng-type" class="agm-modal-select">
            <option value="regular">Regular Season</option>
            <option value="playoff">Playoff</option>
          </select>
        </div>
      </div>
      <p class="agm-modal-err" id="ng-err" hidden></p>
    </div>
    <div class="agm-modal-footer">
      <button class="agm-modal-cancel" id="agm-modal-cancel">Cancel</button>
      <button class="agm-modal-submit" id="ng-submit">Create Game</button>
    </div>
  </div>
</div>

<div class="agm-modal-backdrop" id="agm-final-backdrop" hidden>
  <div class="agm-modal">
    <div class="agm-modal-header">
      <h3 class="agm-modal-title">Mark as Final</h3>
      <button class="agm-modal-close" id="agm-final-close" aria-label="Close">✕</button>
    </div>
    <div class="agm-modal-body">
      <p id="agm-final-name" style="font-size:13px;color:var(--text-muted);margin:0 0 12px"></p>
      <div class="agm-modal-row">
        <div class="agm-modal-field">
          <label class="agm-modal-label">Team A Score</label>
          <input type="number" id="agm-final-score-a" class="agm-modal-input" min="0" step="1" placeholder="0">
        </div>
        <div class="agm-modal-field">
          <label class="agm-modal-label">Team B Score</label>
          <input type="number" id="agm-final-score-b" class="agm-modal-input" min="0" step="1" placeholder="0">
        </div>
      </div>
      <div class="agm-modal-field">
        <label class="agm-modal-label">Overtime</label>
        <select id="agm-final-ot" class="agm-modal-select">
          <option value="0">Regulation</option>
          <option value="1">OT (1 overtime)</option>
          <option value="2">OT2 (2 overtimes)</option>
          <option value="3">OT3 (3 overtimes)</option>
        </select>
      </div>
      <p class="agm-modal-err" id="agm-final-err" hidden></p>
    </div>
    <div class="agm-modal-footer">
      <button class="agm-modal-cancel" id="agm-final-cancel">Cancel</button>
      <button class="agm-modal-submit" id="agm-final-submit">Confirm Final Score</button>
    </div>
  </div>
</div>

<div class="agm-filters">
  <div class="agm-filter-group">
    <button class="agm-pill is-active" data-ft="">All</button>
    <button class="agm-pill" data-ft="regular">Regular</button>
    <button class="agm-pill" data-ft="playoff">Playoff</button>
  </div>
  <div class="agm-filter-group">
    <button class="agm-pill is-active" data-fst="">All Status</button>
    <button class="agm-pill" data-fst="live">Live</button>
    <button class="agm-pill" data-fst="draft">Draft</button>
    <button class="agm-pill" data-fst="final">Final</button>
    <button class="agm-pill" data-fst="upcoming">Upcoming</button>
  </div>
  ${seasons.length > 1 ? `<div class="agm-filter-group">${seasonPills}</div>` : ''}
</div>

<div class="card admin-table-scroll" style="padding:0">
  <table class="admin-table">
    <thead>
      <tr>
        <th class="admin-th">Date</th>
        <th class="admin-th">Matchup</th>
        <th class="admin-th">Type</th>
        <th class="admin-th">Season</th>
        <th class="admin-th">Status</th>
        <th class="admin-th" title="Recap · YouTube · Cover">R · Y · C</th>
        <th class="admin-th"></th>
      </tr>
    </thead>
    <tbody id="agm-tbody">
      ${rows || '<tr><td colspan="7" style="padding:40px;text-align:center;color:var(--text-muted)">No games found.</td></tr>'}
    </tbody>
  </table>
</div>

<script>
(function(){
  var ft = '', fst = '', fs = '';

  function apply() {
    var q = document.getElementById('agm-search').value.toLowerCase().trim();
    document.querySelectorAll('#agm-tbody .agm-row').forEach(function(r) {
      var show = (!ft  || r.dataset.type   === ft)
              && (!fst || r.dataset.status === fst)
              && (!fs  || r.dataset.season === fs)
              && (!q   || r.dataset.q.includes(q));
      r.style.display = show ? '' : 'none';
    });
  }

  document.querySelectorAll('[data-ft]').forEach(function(b) {
    b.addEventListener('click', function() {
      ft = this.dataset.ft;
      document.querySelectorAll('[data-ft]').forEach(function(x){ x.classList.toggle('is-active', x.dataset.ft === ft); });
      apply();
    });
  });
  document.querySelectorAll('[data-fst]').forEach(function(b) {
    b.addEventListener('click', function() {
      fst = this.dataset.fst;
      document.querySelectorAll('[data-fst]').forEach(function(x){ x.classList.toggle('is-active', x.dataset.fst === fst); });
      apply();
    });
  });
  document.querySelectorAll('[data-fs]').forEach(function(b) {
    b.addEventListener('click', function() {
      var val = this.dataset.fs;
      fs = (fs === val) ? '' : val;
      document.querySelectorAll('[data-fs]').forEach(function(x){ x.classList.toggle('is-active', x.dataset.fs === fs); });
      apply();
    });
  });
  document.getElementById('agm-search').addEventListener('input', apply);

  // Inline OT selects
  document.querySelectorAll('.agm-ot-sel').forEach(function(sel) {
    sel.addEventListener('change', function() {
      var gid = this.dataset.gid;
      var ot  = Number(this.value);
      fetch('/admin/games/' + encodeURIComponent(gid) + '/overtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overtime: ot })
      }).catch(function() {});
    });
  });

  // Mark as Final modal
  var finalBackdrop = document.getElementById('agm-final-backdrop');
  var finalGid = null;
  function openFinalModal(gid, name) {
    finalGid = gid;
    document.getElementById('agm-final-name').textContent = name;
    document.getElementById('agm-final-score-a').value = '';
    document.getElementById('agm-final-score-b').value = '';
    document.getElementById('agm-final-ot').value = '0';
    document.getElementById('agm-final-err').hidden = true;
    finalBackdrop.hidden = false;
    document.getElementById('agm-final-score-a').focus();
  }
  function closeFinalModal() { finalBackdrop.hidden = true; finalGid = null; }
  document.getElementById('agm-final-close').addEventListener('click', closeFinalModal);
  document.getElementById('agm-final-cancel').addEventListener('click', closeFinalModal);
  finalBackdrop.addEventListener('click', function(e) { if (e.target === finalBackdrop) closeFinalModal(); });

  document.querySelectorAll('.agm-final-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      openFinalModal(this.dataset.gid, this.dataset.name);
    });
  });

  document.getElementById('agm-final-submit').addEventListener('click', function() {
    var scoreA = document.getElementById('agm-final-score-a').value.trim();
    var scoreB = document.getElementById('agm-final-score-b').value.trim();
    var ot     = document.getElementById('agm-final-ot').value;
    var errEl  = document.getElementById('agm-final-err');
    var btn    = this;
    if (scoreA === '' || scoreB === '') {
      errEl.textContent = 'Both scores are required.'; errEl.hidden = false; return;
    }
    errEl.hidden = true;
    btn.disabled = true; btn.textContent = 'Saving…';
    fetch('/admin/games/' + encodeURIComponent(finalGid) + '/final', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_a_score: Number(scoreA), team_b_score: Number(scoreB), overtime: Number(ot) })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.ok) { location.reload(); return; }
      errEl.textContent = data.error || 'Failed to save.'; errEl.hidden = false;
      btn.disabled = false; btn.textContent = 'Confirm Final Score';
    })
    .catch(function() {
      errEl.textContent = 'Network error.'; errEl.hidden = false;
      btn.disabled = false; btn.textContent = 'Confirm Final Score';
    });
  });

  // New Game modal
  var backdrop = document.getElementById('agm-modal-backdrop');
  function openModal() { backdrop.hidden = false; document.getElementById('ng-date').focus(); }
  function closeModal() { backdrop.hidden = true; document.getElementById('ng-err').hidden = true; }
  document.getElementById('agm-new-btn').addEventListener('click', openModal);
  document.getElementById('agm-modal-close').addEventListener('click', closeModal);
  document.getElementById('agm-modal-cancel').addEventListener('click', closeModal);
  backdrop.addEventListener('click', function(e) { if (e.target === backdrop) closeModal(); });

  document.getElementById('ng-submit').addEventListener('click', function() {
    var date    = document.getElementById('ng-date').value.trim();
    var teamA   = document.getElementById('ng-team-a').value;
    var teamB   = document.getElementById('ng-team-b').value;
    var season  = document.getElementById('ng-season').value.trim();
    var type    = document.getElementById('ng-type').value;
    var errEl   = document.getElementById('ng-err');
    var btn     = this;

    if (!date || !teamA || !teamB || !season) {
      errEl.textContent = 'All fields are required.'; errEl.hidden = false; return;
    }
    if (teamA === teamB) {
      errEl.textContent = 'Team A and Team B must be different.'; errEl.hidden = false; return;
    }
    errEl.hidden = true;
    btn.disabled = true; btn.textContent = 'Creating…';

    fetch('/admin/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: date, team_a_id: teamA, team_b_id: teamB, season: Number(season), game_type: type })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.ok) {
        window.location.href = '/admin/games/' + data.id;
      } else {
        errEl.textContent = data.error || 'Failed to create game.'; errEl.hidden = false;
        btn.disabled = false; btn.textContent = 'Create Game';
      }
    })
    .catch(function() {
      errEl.textContent = 'Network error.'; errEl.hidden = false;
      btn.disabled = false; btn.textContent = 'Create Game';
    });
  });
})();
</script>`;
}

const ICON_CHEVRON_L = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.5L5 7l4 4.5"/></svg>`;
const ICON_TRASH = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3.5h10M5.5 3.5V2.5h3v1M12 3.5l-.9 8a1 1 0 0 1-1 .9H3.9a1 1 0 0 1-1-.9L2 3.5"/></svg>`;
const ICON_CAMERA = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4.5A1.5 1.5 0 0 1 2.5 3h.68L4.1 1.5h5.8L10.82 3H11.5A1.5 1.5 0 0 1 13 4.5v6A1.5 1.5 0 0 1 11.5 12h-9A1.5 1.5 0 0 1 1 10.5v-6z"/><circle cx="7" cy="7.5" r="2"/></svg>`;

function fmtFrac(made, miss) {
  const att = made + miss;
  return att === 0 ? '—' : `${made}/${att}`;
}

// ── Game detail / edit ────────────────────────────────────────────────────────
export function adminGameDetailBody({ game, players = [], stats = [], dnpPlayers = [], quarterScores = [] } = {}) {
  const perOf = (p) => {
    const fgm = Number(p.fg2m) + Number(p.fg3m);
    const fga = fgm + Number(p.fg2m_miss) + Number(p.fg3m_miss);
    const ftm = Number(p.ftm), fta = ftm + Number(p.ft_miss);
    return Number(p.pts) + 0.4 * fgm - 0.7 * fga - 0.4 * (fta - ftm) +
      0.7 * Number(p.reb) + Number(p.stl) + 0.7 * Number(p.ast) +
      0.7 * Number(p.blk) - Number(p.turnover);
  };

  const winnerName = Number(game.team_a_score) >= Number(game.team_b_score)
    ? game.team_a_name : game.team_b_name;

  const top5 = [...stats]
    .filter(s => String(s.team_name || '').toUpperCase() === winnerName.toUpperCase())
    .sort((a, b) => perOf(b) - perOf(a))
    .slice(0, 5);

  const autoPotgId = top5[0]?.player_id ?? null;
  const selectedPotgId = game.manual_potg_player_id || autoPotgId;

  if (game.manual_potg_player_id && !top5.find(p => p.player_id === game.manual_potg_player_id)) {
    const manual = stats.find(s => s.player_id === game.manual_potg_player_id);
    if (manual) top5.push(manual);
  }

  const playerOpts = top5.length
    ? top5.map(p => {
        const sel = p.player_id === selectedPotgId ? ' selected' : '';
        return `<option value="${escHtml(p.player_id)}"${sel}>${escHtml(displayPlayerName(p.name || ''))} — PER ${perOf(p).toFixed(1)}</option>`;
      }).join('')
    : `<option value="" disabled selected>No stats available</option>`;

  const scoreA = Number(game.team_a_score), scoreB = Number(game.team_b_score);
  const winA = !isUpcoming(game) && scoreA > scoreB;
  const winB = !isUpcoming(game) && scoreB > scoreA;
  const isScheduled = isUpcoming(game);
  const isFinal = game.status === 'final';
  const needsImport = isScheduled || isFinal;
  const isLive = !isScheduled && !isFinal && !game.under_review;
  const id = escHtml(game.id);

  const colorA = teamColor(game.team_a_name);
  const colorB = teamColor(game.team_b_name);

  const writeupRaw = game.game_writeup || '';
  const recapInitHtml = writeupRaw.trim().startsWith('<')
    ? writeupRaw
    : writeupRaw
      ? '<p>' + escHtml(writeupRaw).replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>') + '</p>'
      : '';

  // Shared portal tab data
  const { byTeam, dnpByTeam, winner } = buildBoxScoreData(game, stats, dnpPlayers);
  const nameA = game.team_a_name.toUpperCase();
  const nameB = game.team_b_name.toUpperCase();

  return `
${!isScheduled && !isFinal ? `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css">` : ''}

<div class="agm-edit-bar">
  <a href="/admin/games" class="agm-edit-bar__back">${ICON_CHEVRON_L} All Games</a>
  <div class="agm-edit-bar__right">
    <span id="save-msg" class="agm-save-msg"></span>
    <button id="agm-save-all" class="agm-edit-bar__save">${isScheduled || isFinal ? 'Save Date' : 'Save Changes'}</button>
  </div>
</div>

<div class="card agm-game-header">
  <div class="agm-game-header__teams">
    <div class="agm-game-header__team">
      <span class="team-dot" style="background:${colorA}"></span>
      <span class="${winA ? 'agm-team--win' : ''}">${escHtml(game.team_a_name)}</span>
      ${!isScheduled ? `<span class="agm-game-header__score${winA ? ' agm-game-header__score--win' : ''}">${scoreA}</span>` : ''}
    </div>
    <span class="agm-vs">${isScheduled ? 'vs' : '–'}</span>
    <div class="agm-game-header__team">
      ${!isScheduled ? `<span class="agm-game-header__score${winB ? ' agm-game-header__score--win' : ''}">${scoreB}</span>` : ''}
      <span class="${winB ? 'agm-team--win' : ''}">${escHtml(game.team_b_name)}</span>
      <span class="team-dot" style="background:${colorB}"></span>
    </div>
  </div>
  <div class="agm-game-header__meta">
    <span>${fmtDateLong(game.date)}</span>
    <span class="agm-sep">·</span>
    <span>${game.game_type === 'playoff' ? 'Playoff' : 'Regular Season'}${game.season ? ` · ${escHtml(game.season)}` : ''}</span>
    <span class="agm-sep">·</span>
    ${statusBadge(game)}
    <a href="/games/${id}" target="_blank" class="agm-view-link">View on site ↗</a>
  </div>
</div>

<div class="agm-wp-layout">

  <div class="agm-wp-main">
    ${needsImport ? `
    <div class="card agm-section agm-import-section">
      <div class="agm-import-icon">${ICON_IMPORT}</div>
      <div class="agm-import-body">
        <h3 class="agm-section__title">Import Game Results</h3>
        <p class="agm-import-desc">${isFinal ? 'Score has been confirmed. Import the full game file to add box scores and player stats.' : 'Export the game file from the wknd-stats admin app, then upload it here to import the final score, box score, and player stats into this game.'}</p>
        <label class="agm-file-label" id="agm-file-label">
          <input type="file" id="agm-file-input" accept=".json" style="display:none">
          <span class="agm-file-placeholder" id="agm-file-placeholder">Choose exported file (.json)…</span>
          <span class="agm-file-browse">Browse</span>
        </label>
        <div class="agm-import-actions">
          <button class="agm-import-trigger" id="agm-import-trigger" disabled>
            ${ICON_IMPORT} Import Results
          </button>
        </div>
      </div>
    </div>
    ` : ''}
    ${!isScheduled && !isFinal ? `
    <div class="card agm-editor-card">
      <div class="agm-editor-card__title">YouTube</div>
      <input id="val-yt" type="url" class="admin-input" placeholder="https://youtube.com/watch?v=…" value="${escHtml(game.youtube_url || '')}">
    </div>

    <div class="card game-tabs">
      <div class="game-tabs__nav">
        <button class="game-tabs__tab game-tabs__tab--active" data-gtab="recap">Recap</button>
        ${!isFinal ? `
        <button class="game-tabs__tab" data-gtab="bst-a"><span class="team-dot" style="background:${colorA}"></span>${escHtml(game.team_a_name)}</button>
        <button class="game-tabs__tab" data-gtab="bst-b"><span class="team-dot" style="background:${colorB}"></span>${escHtml(game.team_b_name)}</button>
        <button class="game-tabs__tab" data-gtab="leaders">Leaders</button>
        <button class="game-tabs__tab" data-gtab="comparison">Team Comparison</button>
        <button class="game-tabs__tab" data-gtab="linescore">Line Score</button>
        ` : ''}
      </div>
      <div id="adm-tab-recap" class="game-tabs__body adm-recap-body">
        <div class="agm-gen-bar">
          <button class="agm-gen-btn" id="btn-gen-recap">✦ Generate with AI</button>
          <span class="agm-gen-status" id="gen-recap-status"></span>
        </div>
        <div id="recap-quill"></div>
      </div>
      ${!isFinal ? `
      <div id="adm-tab-bst-a" class="game-tabs__body game-tabs__body--hidden">
        ${teamBoxScoreTab(nameA, byTeam, dnpByTeam, winner)}
      </div>
      <div id="adm-tab-bst-b" class="game-tabs__body game-tabs__body--hidden">
        ${teamBoxScoreTab(nameB, byTeam, dnpByTeam, winner)}
      </div>
      <div id="adm-tab-leaders" class="game-tabs__body game-tabs__body--hidden">
        ${gameLeadersTab(game, stats)}
      </div>
      <div id="adm-tab-comparison" class="game-tabs__body game-tabs__body--hidden">
        ${teamComparisonTab(game, stats)}
      </div>
      <div id="adm-tab-linescore" class="game-tabs__body game-tabs__body--hidden">
        ${lineScoreTab(game, quarterScores)}
      </div>
      ` : ''}
    </div>
    ` : ''}
  </div>

  <div class="agm-wp-sidebar">

    <div class="card agm-sidebar-card">
      <div class="agm-sidebar-card__title">${isScheduled || isFinal ? 'Schedule' : 'Publish'}</div>
      ${!isScheduled && !isFinal ? `
      <div class="agm-sidebar-field">
        <label class="admin-field-label">Status</label>
        <select id="pub-status" class="admin-input">
          <option value="live"${isLive ? ' selected' : ''}>Live</option>
          <option value="draft"${game.under_review ? ' selected' : ''}>Draft</option>
        </select>
      </div>
      ` : ''}
      <div class="agm-sidebar-field">
        <label class="admin-field-label">Date</label>
        <input type="date" id="pub-date" class="admin-input" value="${escHtml(game.date || '')}">
      </div>
    </div>

    ${!isScheduled && !isFinal ? `
    <div class="card agm-sidebar-card">
      <div class="agm-sidebar-card__title">Player of the Game</div>
      <select id="val-potg-player" class="admin-input">${playerOpts}</select>
      <label class="admin-field-label">Write-up</label>
      <textarea id="val-potg" class="admin-input agm-textarea" rows="4" placeholder="Write about the player of the game…">${escHtml(game.potg_writeup || '')}</textarea>
      <div class="agm-gen-bar agm-gen-bar--sm">
        <button class="agm-gen-btn agm-gen-btn--sm" id="btn-gen-potg">✦ Generate</button>
        <span class="agm-gen-status" id="gen-potg-status"></span>
      </div>
    </div>
    ` : ''}

    ${!isScheduled && !isFinal ? `
    <div class="card agm-sidebar-card">
      <div class="agm-sidebar-card__title">Cover Image</div>
      ${game.has_cover
        ? `<div class="agm-cover-slot">
             <img src="/admin/games/${id}/cover-img" class="agm-cover-img" id="cover-img" alt="">
             <div class="agm-cover-btns">
               <label class="agm-cover-btn" for="cover-file" title="Change image">${ICON_CAMERA}</label>
               <button class="agm-cover-btn agm-cover-btn--del" id="btn-cover-del" title="Remove image">${ICON_TRASH}</button>
             </div>
           </div>`
        : `<label class="agm-cover-canvas" for="cover-file">
             <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
             <span class="agm-cover-canvas__label">Upload cover image</span>
           </label>`
      }
      <input type="file" id="cover-file" accept="image/jpeg,image/png,image/webp" style="display:none">
      <span class="agm-cover-status" id="cover-status"></span>
    </div>
    ` : ''}

    <div class="agm-sidebar-danger">
      <button id="agm-delete-btn" class="agm-delete-btn">${ICON_TRASH} Delete game</button>
    </div>

  </div>

</div>

${!isScheduled && !isFinal ? `<script src="https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js"></script>` : ''}
<script>
(function(){
  ${!isScheduled && !isFinal ? `
  var quill = new Quill('#recap-quill', {
    theme: 'snow',
    placeholder: 'Write the game recap here…',
    modules: { toolbar: [['bold','italic','underline'],[{list:'ordered'},{list:'bullet'}],['link','clean']] }
  });
  quill.clipboard.dangerouslyPasteHTML(${JSON.stringify(recapInitHtml)});
  ` : ''}

  async function doSave() {
    var btn = document.getElementById('agm-save-all');
    var msg = document.getElementById('save-msg');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    var body = { date: document.getElementById('pub-date').value };
    ${!isScheduled && !isFinal ? `
    body.game_writeup = quill.root.innerHTML;
    body.youtube_url  = document.getElementById('val-yt').value;
    ` : ''}
    ${!isScheduled && !isFinal ? `
    body.potg_writeup   = document.getElementById('val-potg').value;
    body.potg_player_id = document.getElementById('val-potg-player').value;
    body.status         = document.getElementById('pub-status').value;
    ` : ''}
    try {
      var r = await fetch('/admin/games/${id}/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      msg.className = 'agm-save-msg agm-save-msg--ok';
      msg.textContent = 'Saved';
      setTimeout(function(){ msg.textContent = ''; msg.className = 'agm-save-msg'; }, 2500);
    } catch(e) {
      msg.className = 'agm-save-msg agm-save-msg--err';
      msg.textContent = e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = '${isScheduled || isFinal ? 'Save Date' : 'Save Changes'}';
    }
  }

  document.getElementById('agm-save-all').addEventListener('click', doSave);

  // AI Generate — Recap
  var btnGenRecap = document.getElementById('btn-gen-recap');
  if (btnGenRecap) {
    btnGenRecap.addEventListener('click', async function() {
      var status = document.getElementById('gen-recap-status');
      btnGenRecap.disabled = true; btnGenRecap.textContent = 'Generating…';
      status.textContent = ''; status.className = 'agm-gen-status';
      try {
        var r = await fetch('/admin/games/${id}/generate-recap', { method: 'POST' });
        var j = await r.json();
        if (!r.ok) throw new Error(j.error || 'AI error');
        quill.clipboard.dangerouslyPasteHTML(
          '<p>' + j.writeup.replace(/\\n\\n+/g, '</p><p>').replace(/\\n/g, '<br>') + '</p>'
        );
        status.textContent = 'Generated'; status.className = 'agm-gen-status agm-gen-status--ok';
      } catch(e) {
        status.textContent = e.message; status.className = 'agm-gen-status agm-gen-status--err';
      } finally {
        btnGenRecap.disabled = false; btnGenRecap.textContent = '✦ Generate with AI';
      }
    });
  }

  // AI Generate — POTG
  var btnGenPotg = document.getElementById('btn-gen-potg');
  if (btnGenPotg) {
    btnGenPotg.addEventListener('click', async function() {
      var status = document.getElementById('gen-potg-status');
      btnGenPotg.disabled = true; btnGenPotg.textContent = 'Generating…';
      status.textContent = ''; status.className = 'agm-gen-status';
      try {
        var r = await fetch('/admin/games/${id}/generate-potg', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ player_id: document.getElementById('val-potg-player').value }) });
        var j = await r.json();
        if (!r.ok) throw new Error(j.error || 'AI error');
        document.getElementById('val-potg').value = j.writeup;
        status.textContent = 'Generated'; status.className = 'agm-gen-status agm-gen-status--ok';
      } catch(e) {
        status.textContent = e.message; status.className = 'agm-gen-status agm-gen-status--err';
      } finally {
        btnGenPotg.disabled = false; btnGenPotg.textContent = '✦ Generate';
      }
    });
  }

  var gtNav = document.querySelector('.game-tabs__nav');
  if (gtNav) {
    gtNav.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-gtab]');
      if (!btn) return;
      document.querySelectorAll('.game-tabs__tab').forEach(function(b) { b.classList.remove('game-tabs__tab--active'); });
      document.querySelectorAll('[id^="adm-tab-"]').forEach(function(b) { b.classList.add('game-tabs__body--hidden'); });
      btn.classList.add('game-tabs__tab--active');
      document.getElementById('adm-tab-' + btn.dataset.gtab).classList.remove('game-tabs__body--hidden');
    });
  }

  document.getElementById('agm-delete-btn').addEventListener('click', async function() {
    if (!confirm('Delete this game? This will also remove all player stats and cannot be undone.')) return;
    var btn = this;
    btn.disabled = true;
    try {
      var r = await fetch('/admin/games/${id}', { method: 'DELETE' });
      if (r.ok) { window.location.href = '/admin/games'; return; }
      var j = await r.json();
      throw new Error(j.error || 'Error');
    } catch(e) {
      alert(e.message);
      btn.disabled = false;
    }
  });

  ${needsImport ? `
  var fileInput = document.getElementById('agm-file-input');
  var fileLabel = document.getElementById('agm-file-label');
  var filePlaceholder = document.getElementById('agm-file-placeholder');
  var importTrigger = document.getElementById('agm-import-trigger');
  if (fileInput) {
    fileInput.addEventListener('change', function() {
      var f = fileInput.files[0];
      if (f) {
        filePlaceholder.textContent = f.name;
        fileLabel.classList.add('agm-file-label--has-file');
        importTrigger.disabled = false;
      }
    });
    importTrigger.addEventListener('click', async function() {
      var file = fileInput.files[0];
      if (!file) return;
      importTrigger.disabled = true;
      importTrigger.textContent = 'Importing…';
      try {
        var text = await file.text();
        var payload = JSON.parse(text);
        var r = await fetch('/admin/games/${id}/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        var data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Import failed');
        location.reload();
      } catch (e) {
        filePlaceholder.textContent = 'Error: ' + e.message;
        filePlaceholder.style.color = '#f87171';
        importTrigger.disabled = false;
        importTrigger.innerHTML = '${ICON_IMPORT} Import Results';
      }
    });
  }
  ` : ''}
  ${!isScheduled && !isFinal ? `
  var coverFile = document.getElementById('cover-file');
  if (coverFile) {
    coverFile.addEventListener('change', async function() {
      var file = this.files[0];
      if (!file) return;
      var status = document.getElementById('cover-status');
      status.textContent = 'Uploading…';
      try {
        var dataUrl = await new Promise(function(resolve, reject) {
          var reader = new FileReader();
          reader.onload = function(e) { resolve(e.target.result); };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        var r = await fetch('/admin/games/${id}/cover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl: dataUrl })
        });
        if (r.ok) { location.reload(); } else { status.textContent = 'Upload failed'; }
      } catch { status.textContent = 'Upload failed'; }
    });
  }
  var delCover = document.getElementById('btn-cover-del');
  if (delCover) {
    delCover.addEventListener('click', async function() {
      if (!confirm('Remove the cover image?')) return;
      var r = await fetch('/admin/games/${id}/cover', { method: 'DELETE' });
      if (r.ok) location.reload();
    });
  }
  ` : ''}
})();
</script>`;
}
