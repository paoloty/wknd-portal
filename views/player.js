import { escHtml } from './layout.js';
import { teamColor, displayPlayerName, formatDate, truncate, initials } from './utils.js';
import { FOCUS_LABELS, FOCUS_VIDEOS } from '../lib/player-analysis.js';
import { RATING_CATEGORIES } from '../lib/peer-ratings.js';

function avg(val, gp) {
  if (!gp || val == null) return '—';
  return (val / gp).toFixed(1);
}

function pct(made, miss) {
  const att = (made || 0) + (miss || 0);
  if (!att) return '—';
  return Math.round((made || 0) / att * 100) + '%';
}

function parsePositions(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function heroSection(player, totals, isAdmin = false, isOwnProfile = false) {
  const teamName  = String(player.team_name || '').toUpperCase();
  const color     = teamColor(teamName);
  const isLight   = teamName === 'WHITE';
  const positions = parsePositions(player.positions);
  const bio       = String(player.writeup || '').trim();

  // ── Left column: identity ──────────────────────────────────────────────────
  const metaParts = [
    player.number ? `<span class="player-hero__number">#${escHtml(String(player.number))}</span>` : '',
    positions.length ? `<span class="player-hero__pos">${escHtml(positions.join(' · '))}</span>` : '',
    `<span class="team-chip" style="background:${color};color:${isLight ? '#10141d' : '#fff'}">${escHtml(teamName)}</span>`,
  ].filter(Boolean).join('');

  const avatarInits = initials(player.name);
  const uploadOverlay = isAdmin ? `
    <label class="player-avatar-replace" id="pcp-label" title="Replace photo">
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
      <input type="file" id="pcp-file" accept="image/*" style="display:none">
    </label>` : '';

  const leftCol = `<div class="player-hero__left">
    <div class="player-hero__avatar-wrap">
      <div class="player-hero__avatar" style="border-color:${color}">
        <span>${escHtml(avatarInits)}</span>
        <img id="player-avatar-img" src="/api/player/${encodeURIComponent(player.id)}/photo" alt="" loading="lazy" onerror="this.style.display='none'">
      </div>
      ${uploadOverlay}
    </div>
    <div class="player-hero__info">
      <h1 class="player-hero__name">${escHtml(displayPlayerName(player.name))}</h1>
      <div class="player-hero__meta">${metaParts}</div>
      ${isOwnProfile ? `
      <div class="player-hero__bio-block" id="bio-block">
        <textarea class="player-hero__bio-input" id="bio-input" maxlength="500" rows="1" readonly placeholder="Add a short intro so people know a bit about you.">${escHtml(bio)}</textarea>
        <button type="button" class="player-hero__bio-edit-btn" id="bio-edit-btn" aria-label="Edit intro" title="Edit intro">✎</button>
        <div class="player-hero__bio-actions" id="bio-actions" hidden>
          <button type="button" class="player-hero__bio-icon-btn" id="bio-cancel" aria-label="Cancel" title="Cancel">✕</button>
          <button type="button" class="player-hero__bio-icon-btn player-hero__bio-icon-btn--save" id="bio-save" aria-label="Save" title="Save">✓</button>
        </div>
      </div>` : (bio ? `<p class="player-hero__bio">${escHtml(bio)}</p>` : '')}
    </div>
  </div>`;

  // ── Right column: career averages ──────────────────────────────────────────
  const gp = totals?.games_played || 0;
  const fga  = (totals?.fg2m || 0) + (totals?.fg3m || 0) + (totals?.fg2m_miss || 0) + (totals?.fg3m_miss || 0);
  const tpa  = (totals?.fg3m || 0) + (totals?.fg3m_miss || 0);
  const fta  = (totals?.ftm || 0) + (totals?.ft_miss || 0);
  const caStats = gp ? [
    { lbl: 'PPG', val: avg(totals.pts, gp) },
    { lbl: 'RPG', val: avg(totals.reb, gp) },
    { lbl: 'APG', val: avg(totals.ast, gp) },
    { lbl: 'SPG', val: avg(totals.stl, gp) },
    { lbl: 'BPG', val: avg(totals.blk, gp) },
    ...(fga  >= 10 ? [{ lbl: 'FG%', val: pct((totals.fg2m || 0) + (totals.fg3m || 0), (totals.fg2m_miss || 0) + (totals.fg3m_miss || 0)) }] : []),
    ...(tpa  >= 5  ? [{ lbl: '3P%', val: pct(totals.fg3m, totals.fg3m_miss) }] : []),
    ...(fta  >= 5  ? [{ lbl: 'FT%', val: pct(totals.ftm, totals.ft_miss) }] : []),
  ].filter(s => s.val !== '0.0' && s.val !== '0%' && s.val !== '—').slice(0, 8) : [];

  const rightCol = `<div class="player-hero__right">
    ${player.number ? `<span class="player-hero__num-bg" aria-hidden="true">${escHtml(String(player.number))}</span>` : ''}
    <div class="ca-label">CAREER AVERAGES</div>
    ${caStats.length
      ? `<div class="ca-grid" style="--ca-count:${caStats.length}">
          ${caStats.map(s => `<div class="ca-item">
            <span class="ca-item__val">${escHtml(String(s.val))}</span>
            <span class="ca-item__lbl">${s.lbl}</span>
          </div>`).join('')}
        </div>`
      : `<p class="player-hero__no-stats">No games recorded yet.</p>`}
  </div>`;

  const uploadScript = isAdmin ? `
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.min.css">

<div class="pcp-backdrop" id="pcp-backdrop" hidden>
  <div class="pcp-modal">
    <div class="pcp-modal__header">
      <span class="pcp-modal__title">Crop Photo</span>
      <button class="pcp-modal__close" id="pcp-close">&#x2715;</button>
    </div>
    <div class="pcp-modal__body">
      <img id="pcp-img" src="" alt="" style="max-width:100%;display:block">
    </div>
    <div class="pcp-modal__hint">Line up the eyes with the dashed line and keep the head inside the oval — this keeps photos consistent across players.</div>
    <div class="pcp-modal__footer">
      <button class="pcp-modal__cancel" id="pcp-cancel">Cancel</button>
      <button class="pcp-modal__save" id="pcp-save">Crop &amp; Save</button>
    </div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.min.js"><\/script>
<script>
(function() {
  var playerId  = '${escHtml(player.id)}';
  var fileInput = document.getElementById('pcp-file');
  var label     = document.getElementById('pcp-label');
  var backdrop  = document.getElementById('pcp-backdrop');
  var cropImg   = document.getElementById('pcp-img');
  var saveBtn   = document.getElementById('pcp-save');
  var cropper   = null;
  var pendingOriginalDataUrl = null;

  function openCrop(src) {
    cropImg.src = src;
    backdrop.hidden = false;
    document.body.style.overflow = 'hidden';
    if (cropper) { cropper.destroy(); }
    cropper = new Cropper(cropImg, {
      aspectRatio: 1,
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 0.6,
      guides: true,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
      ready: function() {
        var cropBox = backdrop.querySelector('.cropper-crop-box');
        if (cropBox && !cropBox.querySelector('.pcp-head-guide')) {
          var guide = document.createElement('div');
          guide.className = 'pcp-head-guide';
          guide.innerHTML =
            '<div class="pcp-head-guide__oval"></div>' +
            '<div class="pcp-head-guide__eyeline"></div>';
          cropBox.appendChild(guide);
        }
        var body = backdrop.querySelector('.pcp-modal__body');
        if (body && !body.querySelector('.pcp-zoom-ctrl')) {
          var ctrl = document.createElement('div');
          ctrl.className = 'pcp-zoom-ctrl';
          ctrl.innerHTML =
            '<button type="button" class="pcp-zoom-btn" id="pcp-zoom-reset" aria-label="Reset crop" title="Reset crop">&#8635;</button>' +
            '<button type="button" class="pcp-zoom-btn" id="pcp-zoom-out" aria-label="Zoom out">−</button>' +
            '<button type="button" class="pcp-zoom-btn" id="pcp-zoom-in" aria-label="Zoom in">+</button>';
          body.appendChild(ctrl);
          ctrl.querySelector('#pcp-zoom-reset').addEventListener('click', function() { cropper.reset(); });
          ctrl.querySelector('#pcp-zoom-out').addEventListener('click', function() { cropper.zoom(-0.1); });
          ctrl.querySelector('#pcp-zoom-in').addEventListener('click', function() { cropper.zoom(0.1); });
        }
      },
    });
  }

  function closeCrop() {
    backdrop.hidden = true;
    document.body.style.overflow = '';
    if (cropper) { cropper.destroy(); cropper = null; }
    fileInput.value = '';
    pendingOriginalDataUrl = null;
    saveBtn.disabled = false;
    saveBtn.textContent = 'Crop & Save';
  }

  fileInput.addEventListener('change', function() {
    var file = this.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      pendingOriginalDataUrl = e.target.result;
      openCrop(e.target.result);
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('pcp-close').addEventListener('click', closeCrop);
  document.getElementById('pcp-cancel').addEventListener('click', closeCrop);
  backdrop.addEventListener('click', function(e) { if (e.target === backdrop) closeCrop(); });

  var avatarImg = document.getElementById('player-avatar-img');
  if (avatarImg) {
    var markHasPhoto = function() {
      avatarImg.classList.add('player-avatar-img--has-photo');
      avatarImg.title = 'Click to re-crop';
    };
    if (avatarImg.complete && avatarImg.naturalWidth > 0) {
      markHasPhoto();
    } else {
      avatarImg.addEventListener('load', markHasPhoto);
    }
    avatarImg.addEventListener('click', function() {
      if (!avatarImg.classList.contains('player-avatar-img--has-photo')) return;
      pendingOriginalDataUrl = null;
      openCrop('/api/player/' + playerId + '/photo-source?t=' + Date.now());
    });
  }

  saveBtn.addEventListener('click', function() {
    if (!cropper) return;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    label.classList.add('player-avatar-replace--loading');
    var canvas = cropper.getCroppedCanvas({ width: 400, height: 400, imageSmoothingQuality: 'high' });
    var dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    fetch('/admin/player/' + encodeURIComponent(playerId) + '/photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl: dataUrl, originalDataUrl: pendingOriginalDataUrl || '' })
    }).then(function(r) {
      label.classList.remove('player-avatar-replace--loading');
      if (!r.ok) throw new Error('failed');
      var ts = Date.now();
      var newSrc = '/api/player/' + encodeURIComponent(playerId) + '/photo?t=' + ts;
      var img = document.getElementById('player-avatar-img');
      img.style.display = '';
      img.src = newSrc;
      ['og:image', 'og:image:secure_url', 'twitter:image'].forEach(function(prop) {
        var meta = document.querySelector('meta[property="' + prop + '"], meta[name="' + prop + '"]');
        if (meta) meta.setAttribute('content', newSrc);
      });
      closeCrop();
    }).catch(function() {
      label.classList.remove('player-avatar-replace--loading');
      alert('Photo upload failed. Please try again.');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Crop & Save';
    });
  });
})();
<\/script>` : '';

  const bioEditScript = isOwnProfile ? `
<script>
(function() {
  var input     = document.getElementById('bio-input');
  var editBtn   = document.getElementById('bio-edit-btn');
  var actions   = document.getElementById('bio-actions');
  var saveBtn   = document.getElementById('bio-save');
  var cancelBtn = document.getElementById('bio-cancel');
  if (!input || !editBtn) return;

  var originalValue = input.value;

  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = input.scrollHeight + 'px';
  }

  function enterEdit() {
    originalValue = input.value;
    input.readOnly = false;
    input.classList.add('is-editing');
    editBtn.hidden = true;
    actions.hidden = false;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    autoGrow();
  }

  function exitEdit() {
    input.readOnly = true;
    input.classList.remove('is-editing');
    editBtn.hidden = false;
    actions.hidden = true;
    autoGrow();
  }

  editBtn.addEventListener('click', enterEdit);

  cancelBtn.addEventListener('click', function() {
    input.value = originalValue;
    exitEdit();
  });

  input.addEventListener('input', autoGrow);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveBtn.click(); }
    else if (e.key === 'Escape') { cancelBtn.click(); }
  });

  saveBtn.addEventListener('click', function() {
    saveBtn.disabled = true;
    fetch('/me/writeup', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ writeup: input.value })
    })
    .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
    .then(function(res) {
      saveBtn.disabled = false;
      if (!res.ok) { alert(res.d.error || 'Failed to save.'); return; }
      input.value = input.value.trim();
      exitEdit();
    })
    .catch(function() { saveBtn.disabled = false; alert('Network error.'); });
  });

  autoGrow();
})();
<\/script>` : '';

  return `<div class="card player-hero" style="--ph-color:${color}">
  <div class="player-hero__grid">
    ${leftCol}
    ${rightCol}
  </div>
  ${bioEditScript}
</div>${uploadScript}`;
}

// ── Game log ──────────────────────────────────────────────────────────────────
function gameLog(allRows, player, potgGameIds) {
  if (!allRows.length) {
    return `<div class="card game-log-card">
  <div class="card-label">GAME LOG</div>
  <p style="padding:16px 18px;color:var(--text-muted);font-size:13px">No games recorded yet.</p>
</div>`;
  }

  const bySeason = {};
  const seasonOrder = [];
  for (const g of allRows) {
    const s = String(g.season || 'Unknown');
    if (!bySeason[s]) { bySeason[s] = []; seasonOrder.push(s); }
    bySeason[s].push(g);
  }

  function gameRow(g) {
    const isA     = g.player_team_id === g.team_a_id;
    const myScore = Number(isA ? g.team_a_score : g.team_b_score);
    const opScore = Number(isA ? g.team_b_score : g.team_a_score);
    const oppName = (isA ? g.team_b_name : g.team_a_name) || '';
    const myName  = (isA ? g.team_a_name : g.team_b_name) || '';
    const won     = myScore > opScore;
    const isPotg  = potgGameIds.has(g.id);
    const isPO    = g.game_type === 'playoff';

    const oppCell = `<div class="gl-opp">
      <span class="team-dot" style="background:${teamColor(oppName)}"></span>
      <a href="/games/${encodeURIComponent(g.id)}" class="gl-opp__link">${escHtml(String(oppName).toUpperCase())}</a>
      ${isPO ? '<span class="gl-badge gl-badge--po">PO</span>' : ''}
    </div>`;

    if (g.status === 'dnp') {
      return `<tr class="gl-row gl-row--dnp">
      <td class="gl-date">${escHtml(formatDate(g.date))} <span class="dnp-pill">DNP</span></td>
      <td>${oppCell}</td>
      <td class="gl-result ${won ? 'gl-result--w' : 'gl-result--l'}">${won ? 'W' : 'L'} ${myScore}–${opScore}</td>
      <td colspan="17" class="gl-stat">–</td>
    </tr>`;
    }

    const fgm  = (g.fg2m || 0) + (g.fg3m || 0);
    const fgMs = (g.fg2m_miss || 0) + (g.fg3m_miss || 0);
    const fga  = fgm + fgMs;
    const tpm  = g.fg3m || 0;
    const tpMs = g.fg3m_miss || 0;
    const tpa  = tpm + tpMs;
    const ftm  = g.ftm || 0;
    const ftMs = g.ft_miss || 0;
    const fta  = ftm + ftMs;
    const per  = (
      Number(g.pts) + 0.4*fgm - 0.7*fga - 0.4*ftMs +
      0.7*Number(g.reb) + Number(g.stl) + 0.7*Number(g.ast) +
      0.7*Number(g.blk) - Number(g.turnover)
    ).toFixed(1);

    return `<tr class="gl-row">
      <td class="gl-date">${escHtml(formatDate(g.date))}${isPotg ? ' <span class="gl-star" title="Player of the Game">★</span>' : ''}</td>
      <td>${oppCell}</td>
      <td class="gl-result ${won ? 'gl-result--w' : 'gl-result--l'}">${won ? 'W' : 'L'} ${myScore}–${opScore}</td>
      <td class="gl-stat gl-group-start">${fgm}</td>
      <td class="gl-stat">${fga}</td>
      <td class="gl-stat gl-pct">${pct(fgm, fgMs)}</td>
      <td class="gl-stat gl-group-start">${tpm}</td>
      <td class="gl-stat">${tpa}</td>
      <td class="gl-stat gl-pct">${pct(tpm, tpMs)}</td>
      <td class="gl-stat gl-group-start">${ftm}</td>
      <td class="gl-stat">${fta}</td>
      <td class="gl-stat gl-pct">${pct(ftm, ftMs)}</td>
      <td class="gl-stat gl-group-start">${g.reb ?? '—'}</td>
      <td class="gl-stat">${g.ast ?? '—'}</td>
      <td class="gl-stat">${g.stl ?? '—'}</td>
      <td class="gl-stat">${g.blk ?? '—'}</td>
      <td class="gl-stat">${g.turnover ?? '—'}</td>
      <td class="gl-stat">${g.pf ?? '—'}</td>
      <td class="gl-stat gl-pts">${g.pts ?? '—'}</td>
      <td class="gl-stat gl-per">${per}</td>
    </tr>`;
  }

  function seasonAvgRow(games, season) {
    const played = games.filter(g => !g.isDnp);
    if (!played.length) return '';
    const sum  = k => played.reduce((t, g) => t + Number(g[k] || 0), 0);
    const gp   = played.length;
    const a    = k => (sum(k) / gp).toFixed(1);
    const fgm  = sum('fg2m') + sum('fg3m');
    const fgMs = sum('fg2m_miss') + sum('fg3m_miss');
    const fga  = fgm + fgMs;
    const tpm  = sum('fg3m');
    const tpMs = sum('fg3m_miss');
    const tpa  = tpm + tpMs;
    const ftm  = sum('ftm');
    const ftMs = sum('ft_miss');
    const fta  = ftm + ftMs;
    return `<tr class="gl-avg-row">
      <td class="gl-avg-label" colspan="3">${escHtml(String(season))} · ${gp} GP — AVERAGES</td>
      <td class="gl-stat gl-group-start">${(fgm/gp).toFixed(1)}</td>
      <td class="gl-stat">${(fga/gp).toFixed(1)}</td>
      <td class="gl-stat gl-pct">${pct(fgm, fgMs)}</td>
      <td class="gl-stat gl-group-start">${(tpm/gp).toFixed(1)}</td>
      <td class="gl-stat">${(tpa/gp).toFixed(1)}</td>
      <td class="gl-stat gl-pct">${pct(tpm, tpMs)}</td>
      <td class="gl-stat gl-group-start">${(ftm/gp).toFixed(1)}</td>
      <td class="gl-stat">${(fta/gp).toFixed(1)}</td>
      <td class="gl-stat gl-pct">${pct(ftm, ftMs)}</td>
      <td class="gl-stat gl-group-start">${a('reb')}</td>
      <td class="gl-stat">${a('ast')}</td>
      <td class="gl-stat">${a('stl')}</td>
      <td class="gl-stat">${a('blk')}</td>
      <td class="gl-stat">${a('turnover')}</td>
      <td class="gl-stat">${a('pf')}</td>
      <td class="gl-stat">${a('pts')}</td>
      <td class="gl-stat gl-per">${(played.reduce((t, g) => {
        const fgm = (g.fg2m||0)+(g.fg3m||0), fga = fgm+(g.fg2m_miss||0)+(g.fg3m_miss||0);
        const ftMs = g.ft_miss||0;
        return t + Number(g.pts)+0.4*fgm-0.7*fga-0.4*ftMs+0.7*Number(g.reb)+Number(g.stl)+0.7*Number(g.ast)+0.7*Number(g.blk)-Number(g.turnover);
      }, 0) / played.length).toFixed(1)}</td>
    </tr>`;
  }

  const rows = seasonOrder.map(season =>
    bySeason[season].map(gameRow).join('\n      ')
    + '\n      '
    + seasonAvgRow(bySeason[season], season)
  ).join('\n      ');

  return `<div class="card game-log-card">
  <div class="card-label">GAME LOG</div>
  <div class="gl-wrap">
    <table class="gl-table">
      <thead>
        <tr>
          <th rowspan="2" class="gl-date">DATE</th>
          <th rowspan="2" class="gl-opp-col">OPP</th>
          <th rowspan="2" class="gl-result">SCORE</th>
          <th colspan="3" class="gl-group">FIELD GOALS</th>
          <th colspan="3" class="gl-group">3-POINTERS</th>
          <th colspan="3" class="gl-group">FREE THROWS</th>
          <th rowspan="2" class="gl-stat">REB</th>
          <th rowspan="2" class="gl-stat">AST</th>
          <th rowspan="2" class="gl-stat">STL</th>
          <th rowspan="2" class="gl-stat">BLK</th>
          <th rowspan="2" class="gl-stat">TO</th>
          <th rowspan="2" class="gl-stat">PF</th>
          <th rowspan="2" class="gl-stat gl-pts">PTS</th>
          <th rowspan="2" class="gl-stat gl-per">PER</th>
        </tr>
        <tr class="gl-subhead">
          <th class="gl-stat">M</th>
          <th class="gl-stat">A</th>
          <th class="gl-stat gl-pct">%</th>
          <th class="gl-stat">M</th>
          <th class="gl-stat">A</th>
          <th class="gl-stat gl-pct">%</th>
          <th class="gl-stat">M</th>
          <th class="gl-stat">A</th>
          <th class="gl-stat gl-pct">%</th>
        </tr>
      </thead>
      <tbody>
      ${rows}
      </tbody>
    </table>
  </div>
</div>`;
}

// ── Player highlights (POTG games) ────────────────────────────────────────────
function potgWriteups(potgGames, player) {
  if (!potgGames.length) return '';

  const rows = potgGames.map(g => {
    const isA      = g.player_team_id === g.team_a_id;
    const oppName  = String(isA ? g.team_b_name : g.team_a_name).toUpperCase();
    const oppColor = teamColor(oppName);
    const isLight  = oppName === 'WHITE';
    const writeup  = String(g.potg_writeup || '').replace(/\*\*/g, '').trim();

    return `<a href="/games/${encodeURIComponent(g.id)}#potg-anchor" class="highlight-card">
  <div class="hc-top">
    <div class="hc-info">
      <span class="hc-name">${escHtml(formatDate(g.date))}</span>
      <div class="hc-stat-line">${g.pts} PTS · ${g.reb} REB · ${g.ast} AST</div>
    </div>
    <span class="team-chip" style="background:${oppColor};color:${isLight ? '#10141d' : '#fff'}">vs ${escHtml(oppName)}</span>
  </div>
  ${writeup ? `<p class="hc-body">${escHtml(truncate(writeup, 150))}</p>` : ''}
</a>`;
  });

  return `<div class="card sidebar">
  <div class="card-label">PLAYER HIGHLIGHTS</div>
  ${rows.join('\n  ')}
</div>`;
}

// ── Awards section ────────────────────────────────────────────────────────────
const AWARD_META = {
  mvp:             { label: 'Season MVP',                     icon: '🏆', bg: '#f59332', text: '#10141d' },
  dpoy:            { label: 'Defensive Player of the Season', icon: '🛡️', bg: '#3b82f6', text: '#fff'    },
  all_wknd_1:      { label: 'All WKND 1st Team',             icon: '⭐', bg: '#22c55e', text: '#000'    },
  all_wknd_2:      { label: 'All WKND 2nd Team',             icon: '🌟', bg: '#64748b', text: '#fff'    },
  all_wknd_def:    { label: 'All WKND Defensive Team',       icon: '🔒', bg: '#3b82f6', text: '#fff'    },
  scoring_champ:   { label: 'Scoring Champion',              icon: '🔥', bg: '#f59332', text: '#10141d' },
  assists_leader:  { label: 'Assists Leader',                icon: '🎯', bg: '#f59332', text: '#10141d' },
  rebounds_leader: { label: 'Rebounds Leader',               icon: '💪', bg: '#f59332', text: '#10141d' },
  steals_leader:   { label: 'Steals Leader',                 icon: '⚡', bg: '#f59332', text: '#10141d' },
  blocks_leader:   { label: 'Blocks Leader',                 icon: '🚫', bg: '#f59332', text: '#10141d' },
  three_pm_leader: { label: '3-Pointers Leader',             icon: '🏹', bg: '#f59332', text: '#10141d' },
  champion:        { label: 'League Champion',                icon: '👑', bg: '#facc15', text: '#10141d' },
  finals_mvp:      { label: 'Finals MVP',                     icon: '🥇', bg: '#ef4444', text: '#fff'    },
};

function awardsSection(awards) {
  if (!awards?.length) return '';

  const bySeason = {};
  for (const a of awards) {
    (bySeason[a.season] ??= []).push(a);
  }

  const rows = Object.keys(bySeason).sort((a, b) => b - a).map(s => {
    const badges = bySeason[s].map(a => {
      const meta = AWARD_META[a.award_type] || { label: a.award_type, icon: '', bg: '#f59332', text: '#10141d' };
      return `<span class="player-award-badge" style="background:${meta.bg}22;color:${meta.bg};border-color:${meta.bg}55">${meta.icon ? `<span style="font-style:normal">${meta.icon}</span>` : ''}${escHtml(meta.label)}</span>`;
    }).join('');
    return `<div class="player-award-season">
      <div class="player-award-season__label">Season ${escHtml(String(s))}</div>
      <div>${badges}</div>
    </div>`;
  }).join('');

  return `<div class="card player-awards-section">
  <div class="card-label">AWARDS &amp; HONORS</div>
  ${rows}
</div>`;
}

// ── Season/Career stats table ─────────────────────────────────────────────────
function statsTable(statsByType) {
  if (!statsByType || !statsByType.seasons?.length) return '';

  const { seasons, career } = statsByType;
  const hasPlayoffs = seasons.some(r => r.game_type === 'playoff');

  const fgPct  = r => pct((r.fg2m || 0) + (r.fg3m || 0), (r.fg2m_miss || 0) + (r.fg3m_miss || 0));
  const tpPct  = r => { const att = (r.fg3m || 0) + (r.fg3m_miss || 0); return att >= 3 ? pct(r.fg3m, r.fg3m_miss) : '—'; };
  const ftPct  = r => { const att = (r.ftm || 0) + (r.ft_miss || 0); return att >= 3 ? pct(r.ftm, r.ft_miss) : '—'; };

  const statRow = (r, label, isBold = false, dimmed = false) => {
    const gp = r.games_played || 0;
    if (!gp) return '';
    const style = isBold ? ' style="font-weight:700;color:var(--text)"' : dimmed ? ' style="color:var(--text-muted)"' : '';
    return `<tr${style}>
      <td style="text-align:left;padding:7px 10px 7px 0;white-space:nowrap;font-size:12px">${escHtml(label)}</td>
      <td>${gp}</td>
      <td>${avg(r.pts, gp)}</td>
      <td>${avg(r.reb, gp)}</td>
      <td>${avg(r.ast, gp)}</td>
      <td>${avg(r.stl, gp)}</td>
      <td>${avg(r.blk, gp)}</td>
      <td>${fgPct(r)}</td>
      <td>${tpPct(r)}</td>
      <td>${ftPct(r)}</td>
    </tr>`;
  };

  const TYPE_LABEL = { regular: 'Regular', playoff: 'Playoffs', finals: 'Finals' };

  // Group by season
  const bySeason = {};
  for (const r of seasons) {
    if (!bySeason[r.season]) bySeason[r.season] = {};
    bySeason[r.season][r.game_type] = r;
  }
  const seasonNums = Object.keys(bySeason).map(Number).sort((a, b) => b - a);

  const rows = seasonNums.flatMap(s => {
    const types = ['regular', 'playoff', 'finals'];
    return types.map(type => {
      const r = bySeason[s][type];
      return r ? statRow(r, `Season ${s} — ${TYPE_LABEL[type]}`) : '';
    });
  }).join('');

  const careerRow = career?.games_played ? statRow(career, 'Career', true) : '';

  const th = (label) => `<th style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;padding:6px 8px;white-space:nowrap">${label}</th>`;

  return `<div class="card" style="margin-bottom:20px;overflow-x:auto">
  <div class="section-header"><h2>Stats</h2></div>
  <table style="width:100%;border-collapse:collapse;font-size:13px;font-family:'Archivo',sans-serif;text-align:center">
    <thead>
      <tr style="border-bottom:1px solid var(--border)">
        ${th('')}${th('GP')}${th('PPG')}${th('RPG')}${th('APG')}${th('SPG')}${th('BPG')}${th('FG%')}${th('3P%')}${th('FT%')}
      </tr>
    </thead>
    <tbody style="color:var(--text)">
      ${rows}
      ${careerRow ? `<tr><td colspan="10" style="border-top:1px solid var(--border);padding:0"></td></tr>${careerRow}` : ''}
    </tbody>
  </table>
</div>`;
}

// ── Facebook connect card ─────────────────────────────────────────────────────
function fbConnectCard(fbLinked) {
  const btnHtml = fbLinked
    ? `<button class="fb-disconnect-btn" onclick="fbDisconnect()">Disconnect Facebook</button>`
    : `<a href="/auth/facebook" class="fb-connect-btn">Connect with Facebook</a>`;
  const statusHtml = fbLinked
    ? `<span class="fb-status fb-status--on">Connected</span>`
    : `<span class="fb-status fb-status--off">Not connected</span>`;
  const desc = fbLinked
    ? `Your account is linked to Facebook. You can sign in with Facebook and your profile photo syncs automatically.`
    : `Link your Facebook account to sign in faster and sync your profile photo.`;
  return `<div class="card" style="padding:18px 20px">
  <div class="card-label" style="margin-bottom:12px">FACEBOOK</div>
  <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#1877F2" style="flex-shrink:0">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.022 1.792-4.692 4.533-4.692 1.313 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.93-1.956 1.886v2.256h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
    </svg>
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span style="font-weight:600;font-size:14px;color:var(--text)">Facebook</span>
        ${statusHtml}
      </div>
      <p style="font-size:13px;color:var(--text-muted);margin:0">${escHtml(desc)}</p>
    </div>
    ${btnHtml}
  </div>
  ${fbLinked ? `<script>
function fbDisconnect() {
  if (!confirm("Disconnect your Facebook account?")) return;
  fetch("/auth/facebook/disconnect", { method: "POST", headers: { "Content-Type": "application/json" } })
    .then(r => r.json())
    .then(d => { if (d.ok) location.reload(); })
    .catch(() => alert("Something went wrong."));
}
<\/script>` : ''}
</div>`;
}

// "2026-08-02" -> "Sun, Aug 2"
function fmtShortDate(d) {
  return d
    ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : '—';
}

// Owner-only — full-width, sits between the hero and the two-column layout below.
// Fixed until the player's career averages actually change (see getOrGenerateCoachNote
// in server.js), so the footer date is important context, not decoration.
function coachNoteCard(coachNote) {
  if (!coachNote?.analysis) return '';
  const label = FOCUS_LABELS[coachNote.focus_tag] || coachNote.focus_tag;
  const video = FOCUS_VIDEOS[coachNote.focus_tag];
  const dateStr = coachNote.generated_at
    ? new Date(coachNote.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return `<div class="card coach-card">
    <div class="section-header"><h2>Coach's Note</h2></div>
    <span class="coach-card__tag">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      Focus: ${escHtml(label)}
    </span>
    <p class="coach-card__body">${escHtml(coachNote.analysis)}</p>
    ${video ? `<a class="coach-card__video" href="${escHtml(video.url)}" target="_blank" rel="noopener">
      <span class="coach-card__play">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </span>
      <span class="coach-card__video-meta">
        <span class="coach-card__video-eyebrow">Watch &middot; ${escHtml(label)}</span>
        <span class="coach-card__video-title">${escHtml(video.title)}</span>
      </span>
    </a>` : ''}
    ${dateStr ? `<div class="coach-card__foot">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
      Based on stats through ${escHtml(dateStr)} &middot; updates the next time your season averages change
    </div>` : ''}
  </div>`;
}

// Owner-only — top of the right sidebar on your own profile. Balance notice is
// deliberately not dismissable (unlike the site-wide balance-bar): this is the one place
// on the site meant to be a persistent record, not a transient reminder.
function myProfileSidebar({ balanceAmount = 0, papawisGames = [] }) {
  const balanceHtml = balanceAmount > 0 ? `
  <div class="mp-balance-card">
    <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7" cy="7" r="6"/><path d="M7 4v3.3"/><circle cx="7" cy="9.8" r=".2" fill="currentColor"/></svg>
    <div>
      <div class="mp-balance-card__title">Outstanding balance</div>
      <div class="mp-balance-card__amount">₱${Number(balanceAmount).toLocaleString()}</div>
      <a href="/settle-balance" class="mp-balance-card__cta">Settle balance →</a>
    </div>
  </div>` : '';

  const papawisHtml = papawisGames.length ? `
  <div class="card">
    <div class="card-label">YOUR PAPAWIS</div>
    <div class="mp-papawis-list">
      ${papawisGames.map(g => {
        const label = g.status === 'cancelled' ? 'Cancelled'
          : g.status === 'completed' ? (g.any_confirmed ? (g.all_paid ? 'Played' : 'Unpaid') : 'Waitlisted')
          : g.any_confirmed ? 'Confirmed' : 'Waitlist';
        const cls = g.status === 'cancelled' ? 'mp-papawis-badge--cancelled'
          : g.status === 'completed' ? (g.any_confirmed ? (g.all_paid ? 'mp-papawis-badge--muted' : 'mp-papawis-badge--unpaid') : 'mp-papawis-badge--waitlist')
          : g.any_confirmed ? 'mp-papawis-badge--confirmed' : 'mp-papawis-badge--waitlist';
        return `<a href="/papawis" class="mp-papawis-item">
          <span class="mp-papawis-item__main">
            <span class="mp-papawis-item__title">${escHtml(g.title || 'Papawis')}</span>
            <span class="mp-papawis-item__date">${escHtml(fmtShortDate(g.date))}</span>
          </span>
          <span class="mp-papawis-badge ${cls}">${label}</span>
        </a>`;
      }).join('')}
    </div>
  </div>` : '';

  if (!balanceHtml && !papawisHtml) return '';
  return `<div class="mp-sidebar">${balanceHtml}${papawisHtml}</div>`;
}

// ── Peer ratings (roast-style player-to-player ratings) ────────────────────────
function timeAgo(ts) {
  const diffMs = Date.now() - Number(ts);
  const days = Math.floor(diffMs / 86400000);
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'} ago`;
  const hours = Math.floor(diffMs / 3600000);
  if (hours >= 1) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  return `${mins} minute${mins === 1 ? '' : 's'} ago`;
}

function starsInput(catKey, kind, currentValue) {
  // Radios rendered highest-value-first + row-reverse in CSS so the sibling selector
  // (~) can fill leftward from whichever star is hovered/checked — a pure-CSS star
  // widget, no JS needed for the visual fill.
  const inputs = [5, 4, 3, 2, 1].map(n => {
    const id = `pr-${catKey}-${n}`;
    const checked = Number(currentValue) === n ? ' checked' : (n === 3 && !currentValue ? ' checked' : '');
    return `<input type="radio" name="pr-${catKey}" id="${id}" value="${n}"${checked}><label for="${id}">★</label>`;
  }).join('');
  return `<div class="stars stars--${kind}" role="radiogroup" aria-label="${escHtml(catKey)} rating">${inputs}</div>`;
}

function rateThisPlayerCard(rateeId, viewerExistingRating, cooldownActive, cooldownUntil) {
  // Once rating is disabled (cooldown), don't show the categories at all — just the
  // card-label and the "come back later" note. There's nothing to submit, so no
  // anon toggle, no star rows, no submit button, no client script.
  if (cooldownActive) {
    return `<div class="card" id="pr-rate-card">
  <div class="card-label">${viewerExistingRating ? 'UPDATE YOUR RATING' : 'RATE THIS PLAYER'}</div>
  <div class="panel-body">
    <div class="panel__sub" id="pr-cooldown-note" style="margin-bottom:0">You can update your rating for this player again on ${escHtml(new Date(cooldownUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}.</div>
  </div>
</div>`;
  }

  const positiveRows = RATING_CATEGORIES.filter(c => c.kind === 'positive').map(cat => `
    <div class="rate-row">
      <div class="rate-row__info">
        <span class="rate-row__emoji">${cat.emoji}</span>
        <div class="rate-row__text"><div class="rate-row__name">${escHtml(cat.label)}</div><div class="rate-row__desc">${escHtml(cat.desc)}</div></div>
      </div>
      ${starsInput(cat.key, 'positive', viewerExistingRating?.[cat.key])}
    </div>`).join('');
  const roastRows = RATING_CATEGORIES.filter(c => c.kind === 'roast').map(cat => `
    <div class="rate-row">
      <div class="rate-row__info">
        <span class="rate-row__emoji">${cat.emoji}</span>
        <div class="rate-row__text"><div class="rate-row__name">${escHtml(cat.label)}</div><div class="rate-row__desc">${escHtml(cat.desc)}</div></div>
      </div>
      ${starsInput(cat.key, 'roast', viewerExistingRating?.[cat.key])}
    </div>`).join('');

  return `<div class="card" id="pr-rate-card">
  <div class="card-label" style="display:flex;align-items:center;justify-content:space-between">
    <span>${viewerExistingRating ? 'UPDATE YOUR RATING' : 'RATE THIS PLAYER'}</span>
    <span class="anon-toggle">
      <span class="anon-toggle__label">Anonymous</span>
      <label class="switch">
        <input type="checkbox" id="pr-anon-toggle"${viewerExistingRating?.is_anonymous ? ' checked' : ''}>
        <span class="switch__track"></span>
        <span class="switch__knob"></span>
      </label>
    </span>
  </div>
  <div class="panel-body">
    <div class="panel__sub">Pick your tags. Be honest — or don't, that's the fun part.</div>
    <div class="rate-group">
      <div class="rate-group__label">Give props</div>
      ${positiveRows}
    </div>
    <div class="rate-group">
      <div class="rate-group__label">Roast 'em</div>
      ${roastRows}
    </div>
    <button class="submit-btn" type="button" id="pr-submit-btn">Submit Ratings</button>
    <div class="panel__sub" id="pr-error" style="color:#f87171;display:none;margin:10px 0 0"></div>
  </div>
</div>
<script>
(function() {
  var card = document.getElementById('pr-rate-card');
  if (!card) return;
  var btn = document.getElementById('pr-submit-btn');
  var err = document.getElementById('pr-error');
  btn.addEventListener('click', function() {
    var scores = {};
    ${RATING_CATEGORIES.map(c => `scores['${c.key}'] = Number((card.querySelector('input[name="pr-${c.key}"]:checked') || {}).value || 0);`).join('\n    ')}
    for (var k in scores) { if (!scores[k]) { err.textContent = 'Pick a star for every category.'; err.style.display = 'block'; return; } }
    btn.disabled = true;
    btn.textContent = 'Saving…';
    err.style.display = 'none';
    fetch('/players/${escHtml(rateeId)}/rate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scores: scores, isAnonymous: document.getElementById('pr-anon-toggle').checked })
    })
    .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
    .then(function(res) {
      if (!res.ok) { err.textContent = res.d.error || 'Something went wrong.'; err.style.display = 'block'; btn.disabled = false; btn.textContent = 'Submit Ratings'; return; }
      location.reload();
    })
    .catch(function() { err.textContent = 'Network error.'; err.style.display = 'block'; btn.disabled = false; btn.textContent = 'Submit Ratings'; });
  });
})();
<\/script>`;
}

function communityRatingsCard(summary, isOwnProfile = false) {
  if (!summary.count) {
    const emptyMsg = isOwnProfile
      ? 'No one has rated you yet.'
      : 'No ratings yet — be the first.';
    return `<div class="card" id="community-ratings">
  <div class="card-label">COMMUNITY RATINGS</div>
  <p style="padding:16px 18px;color:var(--text-muted);font-size:13px">${emptyMsg}</p>
</div>`;
  }
  const rows = RATING_CATEGORIES.map(cat => {
    const avg = summary.averages[cat.key];
    const pct = Math.round((avg / 5) * 100);
    return `<div class="meter-row">
      <div class="meter-row__top">
        <span class="meter-row__label"><span class="meter-row__emoji">${cat.emoji}</span>${escHtml(cat.label)}</span>
        <span class="meter-row__stat"><span class="meter-row__avg">${avg.toFixed(1)}</span><span class="meter-row__count">${summary.count} rating${summary.count === 1 ? '' : 's'}</span></span>
      </div>
      <div class="meter-track"><div class="meter-fill meter-fill--${cat.kind}" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
  return `<div class="card" id="community-ratings">
  <div class="card-label">COMMUNITY RATINGS</div>
  <div class="panel-body panel-body--flush-top">${rows}</div>
</div>`;
}

function ratingFeedCard(feed) {
  if (!feed.length) return '';
  const rows = feed.slice(0, 25).map(item => {
    const topCat = RATING_CATEGORIES.reduce((best, c) => (item.scores[c.key] > (item.scores[best.key] ?? 0) ? c : best), RATING_CATEGORIES[0]);
    const nameHtml = item.isAnonymous
      ? `<span class="rater-row__who rater-row__who--anon">${escHtml(item.raterName)}${item.realName ? ` <span class="rater-row__real" title="Visible to super admin only">(${escHtml(item.realName)})</span>` : ''}</span>`
      : `<span class="rater-row__who">${escHtml(item.raterName)}</span>`;
    return `<div class="rater-row">
      ${nameHtml}
      <span class="rater-row__cat">rated ${escHtml(topCat.label)} highest</span>
      <span class="rater-row__score${topCat.kind === 'roast' ? ' rater-row__score--roast' : ''}">${item.scores[topCat.key]} ★</span>
      <span class="rater-row__time">${escHtml(timeAgo(item.updatedAt))}</span>
    </div>`;
  }).join('');
  return `<div class="card">
  <div class="card-label" style="display:flex;align-items:center;justify-content:space-between">
    <span>RATING FEED</span>
    <span class="feed-note">Anonymous names are masked${feed.some(f => f.realName) ? ' &middot; you can see who is behind them' : ''}</span>
  </div>
  <div class="panel-body panel-body--flush-top">${rows}</div>
</div>`;
}

// ── Main export ───────────────────────────────────────────────────────────────
export function playerPage({
  player, totals, statsByType, gameLogs, potgGames, careerHighs, awards, financialSection = '', isAdmin = false,
  fbLinked = null, isOwnProfile = false, balanceAmount = 0, papawisGames = [], coachNote = null,
  peerRatingsEnabled = false, peerRatingSummary = null, peerRatingsFeed = [], canRate = false,
  viewerExistingRating = null, viewerCooldownActive = false, viewerCooldownUntil = 0,
}) {
  const potgGameIds = new Set(potgGames.map(g => g.id));
  // fbLinked = true/false when this is the owner's own profile; null = not owner
  const fbCard = fbLinked !== null ? fbConnectCard(fbLinked) : '';
  const sidebarHtml = isOwnProfile ? myProfileSidebar({ balanceAmount, papawisGames }) : '';
  const coachNoteHtml = isOwnProfile ? coachNoteCard(coachNote) : '';

  const peerRatingsHtml = peerRatingsEnabled ? `
    ${canRate ? rateThisPlayerCard(player.id, viewerExistingRating, viewerCooldownActive, viewerCooldownUntil) : ''}
    ${ratingFeedCard(peerRatingsFeed)}
  ` : '';
  const ratingSnapshotHtml = peerRatingsEnabled ? communityRatingsCard(peerRatingSummary, isOwnProfile) : '';

  return `${heroSection(player, totals, isAdmin, isOwnProfile)}
${coachNoteHtml}
<div class="game-detail-layout">
  <div class="game-detail-left">
    ${gameLog(gameLogs, player, potgGameIds)}
    ${peerRatingsHtml}
    ${fbCard}
  </div>
  <div class="game-detail-right">
    ${sidebarHtml}
    ${ratingSnapshotHtml}
    ${awardsSection(awards)}
    ${potgWriteups(potgGames, player)}
  </div>
</div>`;
}
