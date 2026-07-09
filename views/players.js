import { escHtml } from './layout.js';
import { teamColor, displayPlayerName, initials } from './utils.js';

const POS_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'];

function pct(made, miss) {
  const att = (made || 0) + (miss || 0);
  return att > 0 ? (made || 0) / att : null;
}

function fmtPct(val) {
  return val === null ? '—' : Math.round(val * 100) + '%';
}

function pergame(total, gp) {
  return gp > 0 ? total / gp : null;
}

function fmtPg(val) {
  return val === null ? '—' : val.toFixed(1);
}

function parsePositions(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

const ICON_PENCIL = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

function playerRow(p, isAdmin = false) {
  const name      = displayPlayerName(p.name);
  const teamName  = String(p.team_name || '').toUpperCase();
  const color     = teamColor(teamName);
  const positions = parsePositions(p.positions);
  const gp        = p.games_played || 0;

  const parts     = name.trim().split(' ');
  const firstName = escHtml(parts[0] || '');
  const lastName  = escHtml(parts.slice(1).join(' ') || '');

  const ppg = pergame(p.pts,      gp);
  const rpg = pergame(p.reb,      gp);
  const apg = pergame(p.ast,      gp);
  const spg = pergame(p.stl,      gp);
  const bpg = pergame(p.blk,      gp);
  const tpg = pergame(p.turnover, gp);
  const fgp = pct(p.fg2m + p.fg3m, p.fg2m_miss + p.fg3m_miss);
  const tpp = pct(p.fg3m, p.fg3m_miss);
  const ftp = pct(p.ftm,  p.ft_miss);

  const d      = (v) => v !== null ? v.toFixed(4) : '0';
  const posKey = positions.map(pos => `|${pos}|`).join('');

  return `<tr data-name="${escHtml(name.toLowerCase())}" data-team="${escHtml(teamName)}" data-pos="${escHtml(posKey)}" data-num="${p.number ? parseInt(p.number, 10) || 0 : 0}" data-gp="${gp}" data-ppg="${d(ppg)}" data-rpg="${d(rpg)}" data-apg="${d(apg)}" data-spg="${d(spg)}" data-bpg="${d(bpg)}" data-tpg="${d(tpg)}" data-fgp="${d(fgp)}" data-tpp="${d(tpp)}" data-ftp="${d(ftp)}" data-id="${escHtml(p.id)}" data-color="${escHtml(color)}" data-display-name="${escHtml(name)}">
  <td class="pt-player">
    <a href="/players/${encodeURIComponent(p.id)}" class="pt-player-link">
      <div class="pt-avatar" style="border-color:${color}">
        <span>${escHtml(initials(p.name))}</span>
        <img src="/api/player/${encodeURIComponent(p.id)}/photo" alt="" loading="lazy" onerror="this.style.display='none'">
      </div>
      <div class="pt-player-info">
        <span class="pt-first">${firstName}</span>
        <span class="pt-last">${lastName}</span>
      </div>
    </a>
    ${isAdmin ? `<button class="pt-edit-btn" aria-label="Edit player"
      data-pid="${escHtml(p.id)}"
      data-fn="${escHtml(p.first_name || '')}"
      data-ln="${escHtml(p.last_name || '')}"
      data-num="${escHtml(String(p.number || ''))}"
      data-pos="${escHtml(p.positions || '[]')}"
      data-status="${escHtml(p.status || 'active')}"
    >${ICON_PENCIL}</button>` : ''}
  </td>
  <td class="pt-num">${p.number ? escHtml(String(p.number)) : '—'}</td>
  <td class="pt-pos">${positions.length ? escHtml(positions.slice(0, 2).join(' · ')) : '—'}</td>
  <td class="pt-stat">${gp || '—'}</td>
  <td class="pt-stat">${fmtPg(ppg)}</td>
  <td class="pt-stat">${fmtPg(rpg)}</td>
  <td class="pt-stat">${fmtPg(apg)}</td>
  <td class="pt-stat">${fmtPg(spg)}</td>
  <td class="pt-stat">${fmtPg(bpg)}</td>
  <td class="pt-stat">${fmtPg(tpg)}</td>
  <td class="pt-stat pt-pct">${fmtPct(fgp)}</td>
  <td class="pt-stat pt-pct">${fmtPct(tpp)}</td>
  <td class="pt-stat pt-pct">${fmtPct(ftp)}</td>
</tr>`;
}

export function playersPage({ players, isAdmin = false }) {
  const teamNames = [...new Set(
    players.map(p => String(p.team_name || '').toUpperCase()).filter(Boolean)
  )];

  const allPositions = [...new Set(
    players.flatMap(p => parsePositions(p.positions))
  )].sort((a, b) => {
    const ai = POS_ORDER.indexOf(a), bi = POS_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const sorted = [...players].sort((a, b) => {
    const agp = a.games_played || 0, bgp = b.games_played || 0;
    if (!agp && bgp) return 1;
    if (agp && !bgp) return -1;
    return ((bgp ? (b.pts || 0) / bgp : 0) - (agp ? (a.pts || 0) / agp : 0));
  });

  const teamPills = teamNames.length > 1
    ? teamNames.map(t => {
        const color = teamColor(t);
        return `<button class="pt-pill pt-pill--dot" data-group="team" data-val="${escHtml(t)}" title="${escHtml(t)}"><span class="team-dot" style="background:${color}"></span></button>`;
      }).join('')
    : '';

  const posPills = allPositions.length > 1
    ? allPositions.map(pos => `<button class="pt-pill" data-group="pos" data-val="${escHtml(pos)}">${escHtml(pos)}</button>`).join('')
    : '';

  const teamGroup = teamPills ? `<div class="pt-toolbar__group"><span class="pt-toolbar__label">TEAM</span>${teamPills}</div>` : '';
  const posGroup  = posPills  ? `<div class="pt-toolbar__group"><span class="pt-toolbar__label">POSITION</span>${posPills}</div>` : '';

  return `<div class="card pt-card">
  <div class="pt-toolbar">
    ${teamGroup}
    ${posGroup}
    <div class="pt-toolbar__group">
      <button class="pt-pill" id="pt-cmp-btn" title="Select 2 players to compare" style="display:inline-flex;align-items:center;gap:5px">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 2h3.5v9H2zM7.5 2H11v9H7.5z"/></svg>
        Compare
      </button>
    </div>
    <div class="pt-search-wrap">
      <svg class="pt-search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
        <circle cx="6.5" cy="6.5" r="4.5"/><path d="M10.5 10.5 14 14"/>
      </svg>
      <input class="pt-search" id="pt-search" type="search" placeholder="Search players…" autocomplete="off">
    </div>
  </div>
  <div class="pt-table-wrap" id="pt-wrap">
    <table class="pt-table" id="pt-table">
      <thead>
        <tr>
          <th class="pt-th-player pt-sticky pt-sortable" data-col="name">PLAYER</th>
          <th class="pt-th-sm">#</th>
          <th class="pt-th-pos">POS</th>
          <th class="pt-stat pt-sortable" data-col="gp">GP</th>
          <th class="pt-stat pt-sortable pt-sort-active pt-sort-desc" data-col="ppg">PPG</th>
          <th class="pt-stat pt-sortable" data-col="rpg">RPG</th>
          <th class="pt-stat pt-sortable" data-col="apg">APG</th>
          <th class="pt-stat pt-sortable" data-col="spg">SPG</th>
          <th class="pt-stat pt-sortable" data-col="bpg">BPG</th>
          <th class="pt-stat pt-sortable" data-col="tpg">TO</th>
          <th class="pt-stat pt-pct pt-sortable" data-col="fgp">FG%</th>
          <th class="pt-stat pt-pct pt-sortable" data-col="tpp">3P%</th>
          <th class="pt-stat pt-pct pt-sortable" data-col="ftp">FT%</th>
        </tr>
      </thead>
      <tbody id="pt-body">
        ${sorted.map(p => playerRow(p, isAdmin)).join('\n        ')}
      </tbody>
    </table>
    <div class="pt-empty" id="pt-empty" style="display:none">No players match your search.</div>
  </div>
</div>

<div id="pt-cmp-bar" style="display:none;position:fixed;bottom:0;left:0;right:0;z-index:900;background:var(--surface);border-top:1px solid var(--border);padding:12px 20px;align-items:center;gap:12px;box-shadow:0 -8px 32px rgba(0,0,0,.4)">
  <span style="font-size:13px;font-weight:600;color:var(--text-primary)">Compare Players</span>
  <div id="pt-cmp-slots" style="display:flex;gap:8px;flex:1"></div>
  <span id="pt-cmp-hint" style="font-size:12px;color:var(--text-muted)">Select 2 players from the table</span>
  <button id="pt-cmp-go" disabled class="pt-pill pt-pill--active" style="padding:6px 16px;font-size:12px;font-weight:700;opacity:.45">Compare →</button>
  <button id="pt-cmp-cancel" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:20px;line-height:1;padding:0 4px">&times;</button>
</div>

<div id="pt-cmp-modal" style="display:none;position:fixed;inset:0;z-index:1100;background:rgba(2,8,23,.88);backdrop-filter:blur(6px);align-items:flex-start;justify-content:center;overflow-y:auto;padding:40px 16px">
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;width:100%;max-width:520px;position:relative;margin:auto">
    <button id="pt-cmp-close" style="position:absolute;top:12px;right:16px;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:22px;line-height:1;z-index:1">&times;</button>
    <div id="pt-cmp-content"></div>
  </div>
</div>

${isAdmin ? `<div id="pt-edit-modal" style="display:none;position:fixed;inset:0;z-index:1000;background:rgba(2,8,23,.82);backdrop-filter:blur(4px);align-items:center;justify-content:center">
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;width:100%;max-width:420px;padding:28px;margin:16px;position:relative">
    <button id="pt-edit-close" style="position:absolute;top:14px;right:16px;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:20px;line-height:1">&times;</button>
    <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:20px">Edit Player</div>
    <div id="pt-edit-msg" style="display:none;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;color:#f87171;font-size:13px;padding:10px 14px;margin-bottom:12px"></div>
    <input type="hidden" id="pt-edit-pid">
    <form id="pt-edit-form">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div>
          <label class="admin-field-label" style="margin-top:0">First Name</label>
          <input name="first_name" type="text" class="admin-input" required placeholder="First name">
        </div>
        <div>
          <label class="admin-field-label" style="margin-top:0">Last Name</label>
          <input name="last_name" type="text" class="admin-input" required placeholder="Last name">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div>
          <label class="admin-field-label" style="margin-top:0">Jersey #</label>
          <input name="number" type="text" class="admin-input" placeholder="e.g. 23">
        </div>
        <div>
          <label class="admin-field-label" style="margin-top:0">Status</label>
          <select name="status" class="admin-input">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
      <label class="admin-field-label" style="margin-top:0;margin-bottom:8px">Positions</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">
        ${['PG','SG','SF','PF','C'].map(pos => `<label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:13px;color:var(--text-muted)"><input type="checkbox" name="positions" value="${pos}" style="accent-color:var(--amber)"> ${pos}</label>`).join('')}
      </div>
      <button type="submit" class="admin-btn" id="pt-edit-submit" style="margin-top:0">SAVE CHANGES</button>
    </form>
  </div>
</div>` : ''}

<script>
(function() {
  var wrap   = document.getElementById('pt-wrap');
  var body   = document.getElementById('pt-body');
  var empty  = document.getElementById('pt-empty');
  var search = document.getElementById('pt-search');
  var rows   = Array.from(body.querySelectorAll('tr'));
  var sortCol = 'ppg', sortDir = -1;
  var selTeams = new Set(), selPos = new Set(), searchVal = '';

  var isNum = { num:1, gp:1, ppg:1, rpg:1, apg:1, spg:1, bpg:1, tpg:1, fgp:1, tpp:1, ftp:1 };
  var defDir = { name:1, gp:-1, ppg:-1, rpg:-1, apg:-1, spg:-1, bpg:-1, tpg:-1, fgp:-1, tpp:-1, ftp:-1 };

  function update() {
    var visible = rows.filter(function(r) {
      var teamOk = selTeams.size === 0 || selTeams.has(r.dataset.team);
      var posOk  = selPos.size  === 0 || Array.from(selPos).some(function(pos) {
        return r.dataset.pos.indexOf('|' + pos + '|') !== -1;
      });
      var nameOk = !searchVal || r.dataset.name.indexOf(searchVal) !== -1;
      return teamOk && posOk && nameOk;
    });
    visible.sort(function(a, b) {
      if (isNum[sortCol]) return (parseFloat(a.dataset[sortCol]) - parseFloat(b.dataset[sortCol])) * sortDir;
      var ak = a.dataset[sortCol] || '', bk = b.dataset[sortCol] || '';
      return ak < bk ? sortDir : ak > bk ? -sortDir : 0;
    });
    rows.forEach(function(r) { r.style.display = 'none'; });
    visible.forEach(function(r) { r.style.display = ''; body.appendChild(r); });
    empty.style.display = visible.length ? 'none' : '';
  }

  document.querySelectorAll('.pt-pill[data-group]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var group = btn.dataset.group, val = btn.dataset.val;
      var set = group === 'team' ? selTeams : selPos;
      if (set.has(val)) { set.delete(val); btn.classList.remove('pt-pill--active'); }
      else              { set.add(val);    btn.classList.add('pt-pill--active'); }
      update();
    });
  });

  document.querySelectorAll('.pt-sortable').forEach(function(th) {
    th.addEventListener('click', function() {
      var col = th.dataset.col;
      sortDir = col === sortCol ? -sortDir : (defDir[col] || -1);
      sortCol = col;
      document.querySelectorAll('.pt-sortable').forEach(function(t) {
        t.classList.remove('pt-sort-active','pt-sort-asc','pt-sort-desc');
      });
      th.classList.add('pt-sort-active', sortDir === -1 ? 'pt-sort-desc' : 'pt-sort-asc');
      update();
    });
  });

  search.addEventListener('input', function() {
    searchVal = search.value.trim().toLowerCase();
    update();
  });

  update();

  // ── Compare mode ──────────────────────────────────────────────────────────────
  var cmpMode    = false;
  var cmpPicked  = [];
  var cmpBtn     = document.getElementById('pt-cmp-btn');
  var cmpBar     = document.getElementById('pt-cmp-bar');
  var cmpGo      = document.getElementById('pt-cmp-go');
  var cmpCancel  = document.getElementById('pt-cmp-cancel');
  var cmpSlots   = document.getElementById('pt-cmp-slots');
  var cmpHint    = document.getElementById('pt-cmp-hint');
  var cmpModal   = document.getElementById('pt-cmp-modal');
  var cmpContent = document.getElementById('pt-cmp-content');
  var cmpClose   = document.getElementById('pt-cmp-close');

  function enterCompare() {
    cmpMode = true; cmpPicked = [];
    cmpBtn.classList.add('pt-pill--active');
    cmpBar.style.display = 'flex';
    body.classList.add('pt-body--compare');
    updateCmpBar();
  }
  function exitCompare() {
    cmpMode = false; cmpPicked = [];
    cmpBtn.classList.remove('pt-pill--active');
    cmpBar.style.display = 'none';
    body.classList.remove('pt-body--compare');
    rows.forEach(function(r) { r.classList.remove('pt-row--selected'); });
  }
  function updateCmpBar() {
    var n = cmpPicked.length;
    cmpSlots.innerHTML = cmpPicked.map(function(r) {
      var col = r.dataset.color;
      var nm  = r.dataset.displayName;
      return '<span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--text-primary);background:var(--bg);border:1px solid ' + col + '44;border-radius:6px;padding:3px 10px"><span class="team-dot" style="background:' + col + ';width:7px;height:7px"></span>' + nm + '</span>';
    }).join('');
    cmpHint.style.display = n === 2 ? 'none' : '';
    cmpGo.disabled = n !== 2;
    cmpGo.style.opacity = n === 2 ? '1' : '.45';
  }

  cmpBtn.addEventListener('click', function() {
    cmpMode ? exitCompare() : enterCompare();
  });
  cmpCancel.addEventListener('click', exitCompare);

  rows.forEach(function(r) {
    r.addEventListener('click', function(e) {
      if (!cmpMode) return;
      if (e.target.closest('button')) return;
      e.preventDefault();
      if (r.classList.contains('pt-row--selected')) {
        r.classList.remove('pt-row--selected');
        cmpPicked = cmpPicked.filter(function(x) { return x !== r; });
      } else if (cmpPicked.length < 2) {
        r.classList.add('pt-row--selected');
        cmpPicked.push(r);
        if (cmpPicked.length === 2) {
          // auto-open comparison after brief highlight
          setTimeout(openCmpModal, 220);
        }
      }
      updateCmpBar();
    });
  });

  cmpGo.addEventListener('click', openCmpModal);
  cmpClose.addEventListener('click', function() { cmpModal.style.display = 'none'; });
  cmpModal.addEventListener('click', function(e) { if (e.target === cmpModal) cmpModal.style.display = 'none'; });

  function fmtStat(val, col) {
    var v = parseFloat(val);
    if (!val || val === '0' || isNaN(v) || v === 0) return '—';
    if (col === 'fgp' || col === 'tpp' || col === 'ftp') return Math.round(v * 100) + '%';
    if (col === 'gp') return String(Math.round(v));
    return v.toFixed(1);
  }

  function generateWriteup(dA, dB, nameA, nameB) {
    var ppgA = parseFloat(dA.ppg) || 0, ppgB = parseFloat(dB.ppg) || 0;
    var rpgA = parseFloat(dA.rpg) || 0, rpgB = parseFloat(dB.rpg) || 0;
    var apgA = parseFloat(dA.apg) || 0, apgB = parseFloat(dB.apg) || 0;
    var spgA = parseFloat(dA.spg) || 0, spgB = parseFloat(dB.spg) || 0;
    var bpgA = parseFloat(dA.bpg) || 0, bpgB = parseFloat(dB.bpg) || 0;
    var fgpA = parseFloat(dA.fgp) || 0, fgpB = parseFloat(dB.fgp) || 0;
    var gpA  = parseInt(dA.gp)  || 0,   gpB  = parseInt(dB.gp)  || 0;
    if (gpA === 0 && gpB === 0) return '';
    var lines = [];

    // Scoring
    if (ppgA > 0 || ppgB > 0) {
      if (Math.abs(ppgA - ppgB) < 1.0) {
        lines.push(nameA + ' and ' + nameB + ' produce at a similar scoring clip, both hovering around ' + ((ppgA + ppgB) / 2).toFixed(1) + ' PPG.');
      } else {
        var scorer = ppgA > ppgB ? nameA : nameB;
        var other  = ppgA > ppgB ? nameB : nameA;
        lines.push(scorer + ' brings more firepower offensively, averaging ' + Math.max(ppgA, ppgB).toFixed(1) + ' PPG to ' + other + "'s " + Math.min(ppgA, ppgB).toFixed(1) + '.');
      }
    }

    // Boards vs. Assists
    var rebDiff = rpgA - rpgB, astDiff = apgA - apgB;
    var rebWin = Math.abs(rebDiff) >= 0.8 ? (rebDiff > 0 ? nameA : nameB) : null;
    var astWin = Math.abs(astDiff) >= 0.6 ? (astDiff > 0 ? nameA : nameB) : null;
    if (rebWin && astWin && rebWin !== astWin) {
      var rHi = rebWin === nameA ? rpgA : rpgB;
      var aHi = astWin === nameA ? apgA : apgB;
      lines.push(rebWin + ' owns the glass with ' + rHi.toFixed(1) + ' RPG, while ' + astWin + ' runs the offense better at ' + aHi.toFixed(1) + ' APG.');
    } else if (rebWin) {
      var rHi = rebWin === nameA ? rpgA : rpgB, rLo = rebWin === nameA ? rpgB : rpgA;
      var rOther = rebWin === nameA ? nameB : nameA;
      lines.push(rebWin + ' is the superior rebounder, pulling down ' + rHi.toFixed(1) + ' boards compared to ' + rOther + "'s " + rLo.toFixed(1) + '.');
    } else if (astWin) {
      var aHi = astWin === nameA ? apgA : apgB, aLo = astWin === nameA ? apgB : apgA;
      var aOther = astWin === nameA ? nameB : nameA;
      lines.push(astWin + ' is the better playmaker, dishing out ' + aHi.toFixed(1) + ' APG to ' + aOther + "'s " + aLo.toFixed(1) + '.');
    }

    // Defense (combined steals + blocks)
    var defA = spgA + bpgA, defB = spgB + bpgB;
    if (Math.abs(defA - defB) >= 0.5 && (defA > 0 || defB > 0)) {
      var defWin = defA > defB ? nameA : nameB;
      lines.push(defWin + ' is the more disruptive defender, averaging ' + Math.max(defA, defB).toFixed(1) + ' combined steals and blocks per game.');
    }

    // Shooting efficiency
    if ((fgpA > 0 || fgpB > 0) && Math.abs(fgpA - fgpB) >= 0.05) {
      var effWin = fgpA > fgpB ? nameA : nameB;
      var effHi = Math.round(Math.max(fgpA, fgpB) * 100);
      var effLo = Math.round(Math.min(fgpA, fgpB) * 100);
      lines.push(effWin + ' converts from the field at a higher rate (' + effHi + '% vs. ' + effLo + '%).');
    }

    return lines.join(' ');
  }

  function openCmpModal() {
    if (cmpPicked.length !== 2) return;
    var rA = cmpPicked[0], rB = cmpPicked[1];
    var dA = rA.dataset, dB = rB.dataset;
    var colA = dA.color, colB = dB.color;
    var nameA = dA.displayName, nameB = dB.displayName;
    var teamA = dA.team, teamB = dB.team;
    var idA = dA.id, idB = dB.id;

    var STATS = [
      { label: 'PPG', col: 'ppg' },
      { label: 'RPG', col: 'rpg' },
      { label: 'APG', col: 'apg' },
      { label: 'SPG', col: 'spg' },
      { label: 'BPG', col: 'bpg' },
      { label: 'TO',  col: 'tpg' },
      { label: 'FG%', col: 'fgp' },
      { label: '3P%', col: 'tpp' },
      { label: 'FT%', col: 'ftp' },
      { label: 'GP',  col: 'gp'  },
    ];

    var rowsHtml = STATS.map(function(s) {
      var vA = parseFloat(dA[s.col] || '0') || 0;
      var vB = parseFloat(dB[s.col] || '0') || 0;
      var total = vA + vB;
      var wA = total > 0 ? (vA / total * 100).toFixed(1) : 50;
      var wB = total > 0 ? (vB / total * 100).toFixed(1) : 50;
      return '<div class="comp-row">'
        + '<div class="comp-val">' + fmtStat(dA[s.col], s.col) + '</div>'
        + '<div class="comp-label">' + s.label + '</div>'
        + '<div class="comp-val comp-val--b">' + fmtStat(dB[s.col], s.col) + '</div>'
        + '<div class="comp-bars">'
        + '<div class="comp-bars__half comp-bars__half--a"><div class="comp-bar" style="width:' + wA + '%;background:' + colA + '"></div></div>'
        + '<div class="comp-bars__half comp-bars__half--b"><div class="comp-bar" style="width:' + wB + '%;background:' + colB + '"></div></div>'
        + '</div></div>';
    }).join('');

    var playerCard = function(name, team, color, id, align) {
      var right = align === 'right';
      return '<div style="display:flex;justify-content:' + (right ? 'flex-end' : 'flex-start') + '">'
        + '<div class="pt-avatar" style="border-color:' + color + '">'
        + '<img src="/api/player/' + encodeURIComponent(id) + '/photo" alt="" onerror="this.style.display=\\'none\\'">'
        + '</div>'
        + '</div>';
    };

    var writeup = generateWriteup(dA, dB, nameA, nameB);

    cmpContent.innerHTML =
      '<div style="padding:20px 20px 0;display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center">'
      + playerCard(nameA, teamA, colA, idA, 'right')
      + '<div style="font-family:\\'Saira Condensed\\',sans-serif;font-size:28px;font-weight:800;color:var(--amber);text-align:center;padding:0 4px">VS</div>'
      + playerCard(nameB, teamB, colB, idB, 'left')
      + '</div>'
      + '<p id="cmp-writeup" style="margin:12px 20px 0;font-size:13px;line-height:1.65;color:var(--text-muted);text-align:center"></p>'
      + '<div class="comp-tab" style="padding:12px 20px 0">'
      + '<div class="comp-teams" style="padding:8px 0;border-top:1px solid var(--border)">'
      + '<div class="comp-team-name" style="color:' + colA + '">' + nameA.toUpperCase() + '</div>'
      + '<div class="comp-team-label">STAT</div>'
      + '<div class="comp-team-name comp-team-name--b" style="color:' + colB + '">' + nameB.toUpperCase() + '</div>'
      + '</div>'
      + rowsHtml
      + '</div>';

    cmpModal.style.display = 'flex';

    var wupEl = cmpContent.querySelector('#cmp-writeup');
    if (wupEl) {
      fetch('/api/compare?a=' + encodeURIComponent(idA) + '&b=' + encodeURIComponent(idB))
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(data) {
          if (wupEl.parentNode) wupEl.textContent = (data && data.writeup) ? data.writeup : writeup;
        })
        .catch(function() { if (wupEl.parentNode) wupEl.textContent = writeup; });
    }
  }

  ${isAdmin ? `// ── Edit player modal â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  var modal     = document.getElementById('pt-edit-modal');
  var modalForm = document.getElementById('pt-edit-form');
  var modalMsg  = document.getElementById('pt-edit-msg');
  var modalPid  = document.getElementById('pt-edit-pid');
  var POS_ALL   = ['PG','SG','SF','PF','C'];

  function openEditModal(btn) {
    var fn   = btn.dataset.fn, ln = btn.dataset.ln;
    var num  = btn.dataset.num, status = btn.dataset.status;
    var pos  = [];
    try { pos = JSON.parse(btn.dataset.pos); } catch {}
    modalPid.value = btn.dataset.pid;
    modalForm.querySelector('[name=first_name]').value = fn;
    modalForm.querySelector('[name=last_name]').value  = ln;
    modalForm.querySelector('[name=number]').value     = num;
    modalForm.querySelector('[name=status]').value     = status;
    POS_ALL.forEach(function(p) {
      var cb = modalForm.querySelector('[name=positions][value=' + p + ']');
      if (cb) cb.checked = pos.indexOf(p) !== -1;
    });
    modalMsg.style.display = 'none';
    modal.style.display = 'flex';
  }

  function closeEditModal() { modal.style.display = 'none'; }

  document.querySelectorAll('.pt-edit-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) { e.preventDefault(); openEditModal(btn); });
  });

  modal.addEventListener('click', function(e) { if (e.target === modal) closeEditModal(); });
  document.getElementById('pt-edit-close').addEventListener('click', closeEditModal);

  modalForm.addEventListener('submit', function(e) {
    e.preventDefault();
    var pid = modalPid.value;
    var positions = POS_ALL.filter(function(p) {
      var cb = modalForm.querySelector('[name=positions][value=' + p + ']');
      return cb && cb.checked;
    });
    var payload = {
      first_name: modalForm.querySelector('[name=first_name]').value.trim(),
      last_name:  modalForm.querySelector('[name=last_name]').value.trim(),
      number:     modalForm.querySelector('[name=number]').value.trim(),
      status:     modalForm.querySelector('[name=status]').value,
      positions:  positions,
    };
    var submit = document.getElementById('pt-edit-submit');
    submit.disabled = true; submit.textContent = 'Saving…';
    fetch('/admin/player/' + encodeURIComponent(pid) + '/edit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }).then(function(r) { return r.json(); }).then(function(data) {
      if (data.ok) {
        submit.textContent = 'Saved!';
        setTimeout(function() { closeEditModal(); location.reload(); }, 800);
      } else {
        modalMsg.textContent = data.error || 'Something went wrong.';
        modalMsg.style.display = 'block';
        submit.disabled = false; submit.textContent = 'SAVE CHANGES';
      }
    }).catch(function() {
      modalMsg.textContent = 'Network error. Please try again.';
      modalMsg.style.display = 'block';
      submit.disabled = false; submit.textContent = 'SAVE CHANGES';
    });
  });` : ''}
})();
</script>
`;
}
