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

function playerRow(p) {
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

  return `<tr data-name="${escHtml(name.toLowerCase())}" data-team="${escHtml(teamName)}" data-pos="${escHtml(posKey)}" data-num="${p.number ? parseInt(p.number, 10) || 0 : 0}" data-gp="${gp}" data-ppg="${d(ppg)}" data-rpg="${d(rpg)}" data-apg="${d(apg)}" data-spg="${d(spg)}" data-bpg="${d(bpg)}" data-tpg="${d(tpg)}" data-fgp="${d(fgp)}" data-tpp="${d(tpp)}" data-ftp="${d(ftp)}">
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
  </td>
  <td class="pt-num">${p.number ? '#' + escHtml(String(p.number)) : '—'}</td>
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

export function playersPage({ players }) {
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

  const teamPills = teamNames.map(t =>
    `<button class="pt-pill" data-group="team" data-val="${escHtml(t)}">${escHtml(t)}</button>`
  ).join('');

  const posPills = allPositions.map(pos =>
    `<button class="pt-pill" data-group="pos" data-val="${escHtml(pos)}">${escHtml(pos)}</button>`
  ).join('');

  return `<div class="pt-bar">
  <div class="pt-field">
    <span class="pt-label">SEARCH</span>
    <div class="pt-search-wrap">
      <svg class="pt-search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
        <circle cx="6.5" cy="6.5" r="4.5"/><path d="M10.5 10.5 14 14"/>
      </svg>
      <input class="pt-search" id="pt-search" type="search" placeholder="Search players…" autocomplete="off">
    </div>
  </div>
  ${teamNames.length > 1 ? `<div class="pt-field">
    <span class="pt-label">TEAM</span>
    <div class="pt-pills">${teamPills}</div>
  </div>` : ''}
  ${allPositions.length > 1 ? `<div class="pt-field">
    <span class="pt-label">POSITION</span>
    <div class="pt-pills">${posPills}</div>
  </div>` : ''}
</div>
<div class="card pt-card">
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
        ${sorted.map(playerRow).join('\n        ')}
      </tbody>
    </table>
    <div class="pt-empty" id="pt-empty" style="display:none">No players match your search.</div>
  </div>
</div>
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

  document.querySelectorAll('.pt-pill').forEach(function(btn) {
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
})();
</script>`;
}
