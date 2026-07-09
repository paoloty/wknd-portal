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
    ${isAdmin ? `<button class="pt-edit-btn" aria-label="Edit player"
      data-pid="${escHtml(p.id)}"
      data-fn="${escHtml(p.first_name || '')}"
      data-ln="${escHtml(p.last_name || '')}"
      data-num="${escHtml(String(p.number || ''))}"
      data-pos="${escHtml(p.positions || '[]')}"
      data-status="${escHtml(p.status || 'active')}"
    >${ICON_PENCIL}</button>` : ''}
  </td>
  <td class=”pt-num”>${p.number ? escHtml(String(p.number)) : '—'}</td>
  <td class=”pt-pos”>${positions.length ? escHtml(positions.slice(0, 2).join(' · ')) : '—'}</td>
  <td class=”pt-stat”>${gp || '—'}</td>
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

  ${isAdmin ? `// â”€â”€ Edit player modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
