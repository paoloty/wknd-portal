import { escHtml } from './layout.js';
import { teamColor, displayPlayerName, formatDate, truncate, initials, playerAvatar } from './utils.js';
import { FOCUS_LABELS, FOCUS_VIDEOS } from '../lib/player-analysis.js';
import { RATING_CATEGORIES } from '../lib/peer-ratings.js';
import { ICON_CHECK as POLL_ICON_CHECK } from './polls.js';
import { BADGE_ICONS } from '../lib/badges.js';
import { openPickCard, pickBoxScript, pickProgress, fmtCloseTime } from './pick-box.js';
import { resultChips } from './picks-widget.js';
import { fmtPts } from '../lib/picks.js';
import { gameSlug } from '../lib/slugs.js';

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

// ── Hero building blocks (shared by the old and new profile) ────────────────────
// Camera button over the avatar — own profile or admin. Pairs with photoUploadScript.
function photoUploadOverlay() {
  return `
    <label class="player-avatar-replace" id="pcp-label" title="Replace photo">
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
      <input type="file" id="pcp-file" accept="image/*" style="display:none">
    </label>`;
}

// Everyone else (including logged-out visitors) just gets a click-to-enlarge lightbox —
// same avatar image, same "has a photo → pointer cursor" affordance as the edit path, but
// no crop tool, no file input, nothing that implies they can change it.
function photoLightbox() {
  return `
<div class="pcp-backdrop" id="pv-backdrop" hidden>
  <div class="pcp-modal" style="max-width:420px">
    <div class="pcp-modal__header">
      <span class="pcp-modal__title">Photo</span>
      <button class="pcp-modal__close" id="pv-close">&#x2715;</button>
    </div>
    <div class="pcp-modal__body" style="display:flex;align-items:center;justify-content:center">
      <img id="pv-img" src="" alt="" style="max-width:100%;max-height:520px;object-fit:contain;display:block">
    </div>
  </div>
</div>
<script>
(function() {
  var img = document.getElementById('player-avatar-img');
  var backdrop = document.getElementById('pv-backdrop');
  var lightboxImg = document.getElementById('pv-img');
  var closeBtn = document.getElementById('pv-close');
  if (!img || !backdrop) return;

  function open() {
    lightboxImg.src = img.src;
    backdrop.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function close() {
    backdrop.hidden = true;
    document.body.style.overflow = '';
  }

  function markHasPhoto() { img.classList.add('player-avatar-img--has-photo'); }
  if (img.complete && img.naturalWidth > 0) markHasPhoto();
  else img.addEventListener('load', markHasPhoto);

  img.addEventListener('click', function() {
    if (!img.classList.contains('player-avatar-img--has-photo')) return;
    open();
  });
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', function(e) { if (e.target === backdrop) close(); });
})();
</script>`;
}

// Crop-and-save flow behind the camera button. Admins post to the admin endpoint, a player
// on their own profile to /me/photo.
function photoUploadScript(player, isAdmin) {
  return `
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
    fetch(${isAdmin ? "'/admin/player/' + encodeURIComponent(playerId) + '/photo'" : "'/me/photo'"}, {
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
<\/script>`;
}

// Inline intro editor (#bio-input / #bio-edit-btn / #bio-actions) → POST /me/writeup.
function bioEditorScript() {
  return `
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
<\/script>`;
}

// ── Report player ───────────────────────────────────────────────────────────────
// Deliberately understated compared to "Rate This Player" (a full card) — a conduct
// report is a serious, reputation-affecting accusation, not something that should read as
// equally casual as a peer rating. A plain text link opens a Facebook-style drill-down
// modal: pick a category → pick a specific example (if the category has any) → a final
// free-text step for detail, always available as a fallback ("Something else") at either
// level. Structured choices do most of the work so the free-text box is a supplement, not
// the only option — reduces both blank-page friction and pure text-dump reports.
// Built on the .pcp-modal/.pcp-backdrop convention already used above for the photo-crop
// modal (globally styled in public/styles.css) but NOT .pcp-modal__body — that class is
// crop-tool-specific (black background, fixed crop-container sizing), wrong for a form.
function reportPlayerSection(player, categories, otherCategoryId) {
  const categoriesData = JSON.stringify(categories.map(c => ({ id: c.id, label: c.label, description: c.description || '', examples: c.examples || [] }))).replace(/</g, '\\u003c');
  return `<div class="player-report-entry">
  <button type="button" class="player-report-link" id="rp-open-btn">⚑ Report this player</button>
</div>

<div class="pcp-backdrop" id="rp-backdrop" hidden>
  <div class="pcp-modal" style="max-width:420px">
    <div class="pcp-modal__header">
      <button type="button" class="rp-back-btn" id="rp-back" hidden aria-label="Back">&#8249;</button>
      <span class="pcp-modal__title" id="rp-title">Report Player</span>
      <button class="pcp-modal__close" id="rp-close">&#x2715;</button>
    </div>

    <div class="rp-step" id="rp-step-category">
      <p class="rp-intro">Reports are reviewed by admins before anything happens — the player you're reporting is never notified unless a case is actually escalated and resolved.</p>
      <div class="rp-option-list" id="rp-category-list"></div>
    </div>

    <div class="rp-step" id="rp-step-example" hidden>
      <div class="rp-option-list" id="rp-example-list"></div>
    </div>

    <div class="rp-step" id="rp-step-detail" hidden>
      <div class="rp-detail-body">
        <div class="rp-context-note" id="rp-context-note"></div>
        <textarea id="rp-description" rows="5" maxlength="500" placeholder="Tell us what happened — game, context, who else saw it…"></textarea>
        <div class="rp-charcount" id="rp-charcount">0 / 500</div>
        <div id="rp-msg" hidden></div>
      </div>
      <div class="pcp-modal__footer">
        <button class="pcp-modal__cancel" id="rp-cancel">Cancel</button>
        <button class="pcp-modal__save" id="rp-submit">File Report</button>
      </div>
    </div>
  </div>
</div>

<style>
.player-report-entry { margin-top: 5px; }
.player-report-link { background: none; border: none; padding: 0; font-size: 12px; color: var(--text-subtle); cursor: pointer; transition: color .15s; }
.player-report-link:hover { color: var(--amber); }

.rp-back-btn { width: 28px; height: 28px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: none; border: none; margin: 0; padding: 0; font-size: 22px; line-height: 1; color: var(--text-muted); cursor: pointer; }
.rp-back-btn[hidden] { display: none; width: 0; }
.rp-back-btn:hover { color: var(--text); }
.pcp-modal__header #rp-title { flex: 1; text-align: center; }

.rp-intro { margin: 0; padding: 14px 18px 4px; font-size: 12px; color: var(--text-muted); line-height: 1.5; }
.rp-option-list { display: flex; flex-direction: column; max-height: 50vh; overflow-y: auto; }
.rp-option-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; padding: 12px 18px; background: none; border: none; border-top: 1px solid var(--border); text-align: left; cursor: pointer; }
.rp-option-list .rp-option-row:first-child { border-top: none; }
.rp-option-row:hover { background: rgba(255,255,255,0.04); }
.rp-option-row__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.rp-option-row__label { font-size: 13.5px; font-weight: 600; color: var(--text); }
.rp-option-row__desc { font-size: 11.5px; color: var(--text-muted); line-height: 1.4; }
.rp-option-row__chevron { flex-shrink: 0; color: var(--text-subtle); font-size: 16px; }
.rp-option-row--other .rp-option-row__label { color: var(--text-muted); font-weight: 500; }

.rp-detail-body { display: flex; flex-direction: column; gap: 8px; padding: 16px 18px; }
.rp-context-note { font-size: 11.5px; font-weight: 600; color: var(--amber); text-transform: uppercase; letter-spacing: .03em; }
.rp-detail-body textarea { width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 9px 11px; font-size: 13.5px; color: var(--text); font-family: inherit; resize: vertical; }
.rp-charcount { font-size: 11px; color: var(--text-subtle); text-align: right; }
#rp-msg { font-size: 12px; color: #f87171; }
</style>

<script>
(function() {
  var PLAYER_ID  = '${escHtml(player.id)}';
  var CATEGORIES = ${categoriesData};
  var OTHER_ID   = '${escHtml(otherCategoryId)}';

  var openBtn   = document.getElementById('rp-open-btn');
  var backdrop  = document.getElementById('rp-backdrop');
  var closeBtn  = document.getElementById('rp-close');
  var backBtn   = document.getElementById('rp-back');
  var title     = document.getElementById('rp-title');
  var cancelBtn = document.getElementById('rp-cancel');
  var submitBtn = document.getElementById('rp-submit');
  var msg       = document.getElementById('rp-msg');
  var textarea  = document.getElementById('rp-description');
  var charcount = document.getElementById('rp-charcount');
  var contextNote = document.getElementById('rp-context-note');
  var steps = {
    category: document.getElementById('rp-step-category'),
    example:  document.getElementById('rp-step-example'),
    detail:   document.getElementById('rp-step-detail'),
  };

  var state = { categoryId: '', categoryLabel: '', example: null, fromExample: false };

  function optionRow(label, desc, onClick, isOther) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rp-option-row' + (isOther ? ' rp-option-row--other' : '');
    btn.innerHTML =
      '<span class="rp-option-row__text">' +
        '<span class="rp-option-row__label"></span>' +
        (desc ? '<span class="rp-option-row__desc"></span>' : '') +
      '</span><span class="rp-option-row__chevron">\\u203a</span>';
    btn.querySelector('.rp-option-row__label').textContent = label;
    if (desc) btn.querySelector('.rp-option-row__desc').textContent = desc;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function showStep(name) {
    Object.keys(steps).forEach(function(k) { steps[k].hidden = k !== name; });
    backBtn.hidden = name === 'category';
    title.textContent = name === 'detail' ? 'What happened?' : 'Report Player';
  }

  function goToDetail() {
    contextNote.textContent = state.categoryLabel + (state.example ? ' — ' + state.example : '');
    textarea.value = state.example || '';
    charcount.textContent = textarea.value.length + ' / 500';
    msg.hidden = true;
    showStep('detail');
  }

  function renderCategoryList() {
    var list = document.getElementById('rp-category-list');
    list.innerHTML = '';
    CATEGORIES.forEach(function(cat) {
      list.appendChild(optionRow(cat.label, cat.description, function() {
        state.categoryId = cat.id;
        state.categoryLabel = cat.label;
        state.example = null;
        if (cat.examples && cat.examples.length) {
          state.fromExample = true;
          renderExampleList(cat);
          showStep('example');
        } else {
          state.fromExample = false;
          goToDetail();
        }
      }));
    });
    list.appendChild(optionRow('Something else', '', function() {
      state.categoryId = OTHER_ID;
      state.categoryLabel = 'Something else';
      state.example = null;
      state.fromExample = false;
      goToDetail();
    }, true));
  }

  function renderExampleList(cat) {
    var list = document.getElementById('rp-example-list');
    list.innerHTML = '';
    cat.examples.forEach(function(ex) {
      list.appendChild(optionRow(ex, '', function() {
        state.example = ex;
        goToDetail();
      }));
    });
    list.appendChild(optionRow('Something else', '', function() {
      state.example = null;
      goToDetail();
    }, true));
  }

  function reset() {
    state = { categoryId: '', categoryLabel: '', example: null, fromExample: false };
    showStep('category');
  }

  function close() { backdrop.hidden = true; }

  openBtn.addEventListener('click', function() {
    renderCategoryList();
    reset();
    backdrop.hidden = false;
  });
  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  backdrop.addEventListener('click', function(e) { if (e.target === backdrop) close(); });

  backBtn.addEventListener('click', function() {
    if (!steps.detail.hidden) { showStep(state.fromExample ? 'example' : 'category'); return; }
    showStep('category');
  });

  textarea.addEventListener('input', function() {
    charcount.textContent = textarea.value.length + ' / 500';
  });

  submitBtn.addEventListener('click', function() {
    msg.hidden = true;
    submitBtn.disabled = true;
    fetch('/players/' + PLAYER_ID + '/report', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: state.categoryId, description: textarea.value }),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        submitBtn.disabled = false;
        if (!res.ok) { msg.textContent = res.d.error || 'Could not file the report.'; msg.hidden = false; return; }
        close();
        alert('Report filed — admins will review it.');
      })
      .catch(function() { submitBtn.disabled = false; msg.textContent = 'Network error.'; msg.hidden = false; });
  });
})();
<\/script>`;
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
    const isPO     = g.game_type === 'playoff';
    const isFinals = g.game_type === 'finals';

    const oppCell = `<div class="gl-opp">
      <span class="team-dot" style="background:${teamColor(oppName)}"></span>
      <a href="/games/${encodeURIComponent(g.id)}" class="gl-opp__link">${escHtml(String(oppName).toUpperCase())}</a>
      ${isPO ? '<span class="gl-badge gl-badge--po">PO</span>' : ''}
      ${isFinals ? '<span class="gl-badge gl-badge--finals">F</span>' : ''}
    </div>`;

    if (g.status === 'dnp') {
      return `<tr class="gl-row gl-row--dnp">
      <td class="gl-date">${escHtml(formatDate(g.date))} <span class="dnp-pill">DNP</span></td>
      <td>${oppCell}</td>
      <td class="gl-result ${won ? 'gl-result--w' : 'gl-result--l'}">${won ? 'W' : 'L'} ${myScore}–${opScore}</td>
      <td colspan="20" class="gl-stat">–</td>
    </tr>`;
    }

    const fgm  = (g.fg2m || 0) + (g.fg3m || 0) + (g.fg4m || 0);
    const fgMs = (g.fg2m_miss || 0) + (g.fg3m_miss || 0) + (g.fg4m_miss || 0);
    const fga  = fgm + fgMs;
    const tpm  = g.fg3m || 0;
    const tpMs = g.fg3m_miss || 0;
    const tpa  = tpm + tpMs;
    const qpm  = g.fg4m || 0;
    const qpMs = g.fg4m_miss || 0;
    const qpa  = qpm + qpMs;
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
      <td class="gl-stat gl-group-start">${qpm}</td>
      <td class="gl-stat">${qpa}</td>
      <td class="gl-stat gl-pct">${pct(qpm, qpMs)}</td>
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
    const fgm  = sum('fg2m') + sum('fg3m') + sum('fg4m');
    const fgMs = sum('fg2m_miss') + sum('fg3m_miss') + sum('fg4m_miss');
    const fga  = fgm + fgMs;
    const tpm  = sum('fg3m');
    const tpMs = sum('fg3m_miss');
    const tpa  = tpm + tpMs;
    const qpm  = sum('fg4m');
    const qpMs = sum('fg4m_miss');
    const qpa  = qpm + qpMs;
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
      <td class="gl-stat gl-group-start">${(qpm/gp).toFixed(1)}</td>
      <td class="gl-stat">${(qpa/gp).toFixed(1)}</td>
      <td class="gl-stat gl-pct">${pct(qpm, qpMs)}</td>
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
        const fgm = (g.fg2m||0)+(g.fg3m||0)+(g.fg4m||0), fga = fgm+(g.fg2m_miss||0)+(g.fg3m_miss||0)+(g.fg4m_miss||0);
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
          <th colspan="3" class="gl-group">4-POINTERS</th>
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
  four_pm_leader:  { label: '4-Pointers Leader',             icon: '🚀', bg: '#f59332', text: '#10141d' },
  champion:        { label: 'League Champion',                icon: '👑', bg: '#facc15', text: '#10141d' },
  finals_mvp:      { label: 'Finals MVP',                     icon: '🥇', bg: '#ef4444', text: '#fff'    },
  pickmaster:      { label: 'Pickmaster',                     icon: '🔮', bg: '#f59332', text: '#10141d' },
};

// "Who wins?" card. Everyone sees the settled record for the current season (server.js →
// lib/picks.js). On your own profile it's also where you pick: this week's open games
// (same pick box as /picks and the homepage) and your recent results. Pending picks are
// only ever shown to you.
function pickRecordCard(r, isOwnProfile) {
  if (!r) return '';
  const flame = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z"/></svg>`;
  const rank = r.rank
    ? `#${r.rank} of ${r.ranked} in the Pickmaster race`
    : 'On the board after your next final';
  const own = isOwnProfile ? r.own : null;
  const record = r.settled === false
    ? `<p class="pk-me__rank">Your first picks settle after the final. Every settled pick counts toward the Pickmaster race.</p>`
    : `<div class="pk-me__main">
    <span class="pk-me__rec"><b class="font-condensed">${fmtPts(r.net)}</b><span>pts</span></span>
    <span class="pk-me__pct font-condensed">${r.correct}–${r.wrong}</span>
    ${own?.recent?.length ? resultChips(own.recent) : ''}
  </div>
  <div class="pk-me__stats">
    <span><b class="font-condensed">${r.streak >= 2 ? `<i class="pk-me__flame">${flame}</i>` : ''}${r.streak}</b>Streak</span>
    <span><b class="font-condensed">${r.best}</b>Best run</span>
    <span><b class="font-condensed">${r.upsets}</b>Upsets called</span>
  </div>
  <p class="pk-me__rank">${escHtml(rank)}</p>`;
  const openHtml = own?.open?.length ? `<div class="pk-me__sec">
    <div class="pk-me__sec-h"><span>${own.open.every(o => o.closed || o.myPick) ? 'Your picks' : 'Pick now'}</span><span>${escHtml(shortDay(own.open[0].ymd))}${own.open.every(o => o.closed) ? ' · closed' : ` · closes ${escHtml(fmtCloseTime(own.closeTime))}`}</span></div>
    ${pickProgress(own.open, '.pk-me')}
    <div class="pk-me__open">${own.open.map(o => openPickCard(o, { isPlayer: true, next: '/me', size: 'sm' })).join('')}</div>
  </div>` : '';
  const recentHtml = own?.recent?.length ? `<div class="pk-me__sec">
    <div class="pk-me__sec-h"><span>Recent results</span></div>
    <div class="pk-me__res">${own.recent.slice(0, 3).map(x => {
      const picked = x.side === 'a' ? x.a : x.b;
      const win = x.sa > x.sb;
      return `<a href="/games/${encodeURIComponent(x.id)}" class="pk-me__res-row">
        <span class="pk-me__res-d font-condensed">${escHtml(monthDay(x.ymd))}</span>
        <span class="pk-me__res-t">Picked <b>${escHtml(tcase(picked))}</b> · ${escHtml(tcase(win ? x.a : x.b))} ${Math.max(x.sa, x.sb)}–${Math.min(x.sa, x.sb)} ${escHtml(tcase(win ? x.b : x.a))}${x.ok && x.upset ? ' · <span class="pk-me__upset">upset call</span>' : ''}</span>
        <span class="pkw-chip ${x.ok ? 'is-ok' : 'is-miss'}" title="${x.ok ? 'Called it' : 'Missed'}">${x.ok ? '✓' : '✕'}</span>
      </a>`;
    }).join('')}</div>
  </div>` : '';
  return `<div class="card pk-me${own ? ' pk-me--own' : ''}">
  <div class="card-label">WHO WINS? · S${escHtml(String(r.season))} PICKS</div>
  ${record}
  ${openHtml}
  ${recentHtml}
  <div class="pk-me__links">
    ${r.settled === false ? '<a href="/picks" class="pk-me__link">Pickmaster race →</a>' : `<a href="/picks/players/${encodeURIComponent(r.playerId)}?season=${encodeURIComponent(r.season)}" class="pk-me__link">${isOwnProfile ? 'See all your picks' : 'See every pick'} →</a>`}
    ${isOwnProfile && !own?.open?.length ? '<a href="/picks" class="pk-me__link">Pickmaster race →</a>' : ''}
  </div>
</div>
${own?.open?.length ? pickBoxScript() : ''}`;
}

const tcase = s => String(s || '').charAt(0) + String(s || '').slice(1).toLowerCase();
const monthDay = ymd => (ymd ? new Date(`${ymd}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() : '');
const shortDay = ymd => (ymd ? new Date(`${ymd}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '');

function awardsSection(awards) {
  if (!awards?.length) return '';

  const bySeason = {};
  for (const a of awards) {
    (bySeason[a.season] ??= []).push(a);
  }

  const rows = Object.keys(bySeason).sort((a, b) => b - a).map(s => {
    const badges = bySeason[s].map(a => {
      const meta = AWARD_META[a.award_type] || { label: a.award_type, icon: '', bg: '#f59332', text: '#10141d' };
      return `<span class="player-award-badge" style="background:${meta.bg}22;color:${meta.bg};border-color:${meta.bg}55">${meta.icon ? `<span class="player-award-badge__icon">${meta.icon}</span>` : ''}${escHtml(meta.label)}</span>`;
    }).join('');
    return `<div class="player-award-season">
      <div class="player-award-season__label">Season ${escHtml(String(s))}</div>
      <div>${badges}</div>
    </div>`;
  }).join('');

  return `<div class="card">
  <div class="card-label">AWARDS &amp; HONORS</div>
  ${rows}
</div>`;
}

// ── Season/Career stats table ─────────────────────────────────────────────────
function statsTable(statsByType) {
  if (!statsByType || !statsByType.seasons?.length) return '';

  const { seasons, career } = statsByType;
  const hasPlayoffs = seasons.some(r => r.game_type === 'playoff');

  const fgPct  = r => pct((r.fg2m || 0) + (r.fg3m || 0) + (r.fg4m || 0), (r.fg2m_miss || 0) + (r.fg3m_miss || 0) + (r.fg4m_miss || 0));
  const tpPct  = r => { const att = (r.fg3m || 0) + (r.fg3m_miss || 0); return att >= 3 ? pct(r.fg3m, r.fg3m_miss) : '—'; };
  const qpPct  = r => { const att = (r.fg4m || 0) + (r.fg4m_miss || 0); return att >= 1 ? pct(r.fg4m || 0, r.fg4m_miss || 0) : '—'; };
  const ftPct  = r => { const att = (r.ftm || 0) + (r.ft_miss || 0); return att >= 3 ? pct(r.ftm, r.ft_miss) : '—'; };

  const statRow = (r, label, isCareer = false) => {
    const gp = r.games_played || 0;
    if (!gp) return '';
    const rowClass = isCareer ? 'st-career-row' : 'st-row';
    return `<tr class="${rowClass}">
      <td>${escHtml(label)}</td>
      <td>${gp}</td>
      <td>${avg(r.pts, gp)}</td>
      <td>${avg(r.reb, gp)}</td>
      <td>${avg(r.ast, gp)}</td>
      <td>${avg(r.stl, gp)}</td>
      <td>${avg(r.blk, gp)}</td>
      <td class="st-pct">${fgPct(r)}</td>
      <td class="st-pct">${tpPct(r)}</td>
      <td class="st-pct">${qpPct(r)}</td>
      <td class="st-pct">${ftPct(r)}</td>
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

  return `<div class="card" style="overflow:hidden">
  <div class="card-label">STATS</div>
  <div class="st-wrap">
    <table class="st-table">
      <thead>
        <tr>
          <th></th><th>GP</th><th>PPG</th><th>RPG</th><th>APG</th><th>SPG</th><th>BPG</th><th>FG%</th><th>3P%</th><th>4P%</th><th>FT%</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        ${careerRow}
      </tbody>
    </table>
  </div>
</div>`;
}

// "2026-08-02" -> "Sun, Aug 2"
function fmtShortDate(d) {
  return d
    ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : '—';
}

// Owner-only — top of the right sidebar on your own profile. Balance notice is
// deliberately not dismissable (unlike the site-wide balance-bar): this is the one place
// on the site meant to be a persistent record, not a transient reminder.
// Status badges only shown for anything other than 'confirmed' — a confirmed charge/payment
// is just a normal line, the ones actually worth flagging to the player are "this hasn't
// been confirmed yet" or "this got voided," same distinction admin's ledger view makes.
const TX_STATUS_LABEL = { pending: 'Pending', voided: 'Voided' };

// Votable in place, same as the Messenger-style /polls page (views/polls.js) — a click
// POSTs to the shared /polls/:id/vote endpoint and updates fills/checkmark/count in place,
// no page reload. Buttons stay disabled (no data-action) whenever the poll is closed or
// this viewer's eligibility tier can't vote, so the interactive state always matches what
// the server would actually accept. latestPoll is pre-filtered server-side to the most
// recent poll this viewer's visibility tier qualifies to see.
// Overlapping avatar stack of who's voted — mirrors marketplace's avatarStack (views/marketplace.js),
// capped the same way. Shows who participated, not what they picked — that stays aggregate-only here.
const POLL_MAX_AVATARS = 8;
function pollVoterAvatars(voterPlayers) {
  if (!voterPlayers.length) return '';
  const shown = voterPlayers.slice(0, POLL_MAX_AVATARS);
  const overflow = voterPlayers.length - shown.length;
  const avatars = shown.map(p =>
    playerAvatar(p.id, p.name, teamColor(p.team_name), { className: 'mp-poll-avatar', link: true })
  ).join('');
  const moreBubble = overflow > 0 ? `<span class="mp-poll-avatar mp-poll-avatar--more">+${overflow}</span>` : '';
  return `<div class="mp-poll-avatar-stack">${avatars}${moreBubble}</div>`;
}

function pollSidebarCard(poll) {
  if (!poll) return '';
  const isOpen = poll.status === 'open';
  const clickable = poll.canVote && isOpen;
  const counts = poll.options.map(() => 0);
  for (const v of poll.votes) if (counts[v.option_index] !== undefined) counts[v.option_index]++;
  const total = counts.reduce((a, b) => a + b, 0);
  const myIndex = poll.myVote ? poll.myVote.option_index : -1;

  const optionRows = poll.options.map((opt, i) => {
    const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
    const mine = i === myIndex;
    const attrs = clickable ? `data-action="vote" data-option="${i}"` : 'disabled';
    return `
      <button type="button" class="mp-poll-option${mine ? ' mp-poll-option--mine' : ''}" ${attrs}>
        <span class="mp-poll-option__fill" style="width:${pct}%"></span>
        <span class="mp-poll-option__row">
          <span class="mp-poll-option__text">${mine ? `<span class="mp-poll-check-pop">${POLL_ICON_CHECK}</span>` : ''}<span class="mp-poll-option__label">${escHtml(opt)}</span></span>
          <span class="mp-poll-option__pct">${pct}%</span>
        </span>
      </button>`;
  }).join('');

  const statusNote = !poll.canVote ? 'Not open to you' : !isOpen ? 'Voting closed' : '';

  const script = clickable ? `
<script>
(function() {
  var CHECK_SVG = ${JSON.stringify(POLL_ICON_CHECK)};
  var group = document.getElementById('mp-poll-options');
  if (!group) return;
  var pollId = group.dataset.poll;
  var msg = document.getElementById('mp-poll-vote-msg');
  var totalEl = document.getElementById('mp-poll-total');
  var buttons = group.querySelectorAll('.mp-poll-option');

  function updateRow(btn, count, pct, isMine) {
    var fill = btn.querySelector('.mp-poll-option__fill');
    var text = btn.querySelector('.mp-poll-option__text');
    var pctEl = btn.querySelector('.mp-poll-option__pct');
    fill.style.width = pct + '%';
    pctEl.textContent = pct + '%';
    btn.classList.toggle('mp-poll-option--mine', isMine);
    var existing = text.querySelector('.mp-poll-check-pop');
    if (existing) existing.remove();
    if (isMine) {
      var span = document.createElement('span');
      span.className = 'mp-poll-check-pop';
      span.innerHTML = CHECK_SVG;
      text.insertBefore(span, text.firstChild);
    }
  }

  Array.prototype.forEach.call(buttons, function(btn) {
    btn.addEventListener('click', function() {
      var optionIndex = Number(btn.dataset.option);
      Array.prototype.forEach.call(buttons, function(b) { b.disabled = true; });
      if (msg) { msg.style.color = 'var(--text-muted)'; msg.textContent = 'Saving…'; }
      fetch('/polls/' + pollId + '/vote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ option_index: optionIndex }),
      })
      .then(function(r) { return r.json().then(function(j) { return { ok: r.ok, j: j }; }); })
      .then(function(res) {
        if (!res.ok) throw new Error(res.j.error || 'Failed.');
        var counts = res.j.counts, total = res.j.total, myOption = res.j.myOption;
        Array.prototype.forEach.call(buttons, function(b) {
          var i = Number(b.dataset.option);
          var pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
          updateRow(b, counts[i], pct, i === myOption);
        });
        if (totalEl) totalEl.textContent = total + ' vote' + (total === 1 ? '' : 's');
        if (msg) msg.textContent = '';
        Array.prototype.forEach.call(buttons, function(b) { b.disabled = false; });
      })
      .catch(function(e) {
        if (msg) { msg.style.color = '#f87171'; msg.textContent = e.message; }
        Array.prototype.forEach.call(buttons, function(b) { b.disabled = false; });
      });
    });
  });
})();
</script>` : '';

  return `<div class="card">
    <div class="card-label" style="display:flex;align-items:center;justify-content:space-between">
      <span>LATEST POLL</span>
      <span class="mp-poll-badge ${isOpen ? 'mp-poll-badge--open' : 'mp-poll-badge--closed'}">${isOpen ? 'Open' : 'Closed'}</span>
    </div>
    <div class="mp-poll">
      <a href="/polls#poll-${escHtml(poll.id)}" class="mp-poll__q">${escHtml(poll.question)}</a>
      ${poll.description ? `<p class="mp-poll__desc">${escHtml(poll.description)}</p>` : ''}
      <div class="mp-poll-options" id="mp-poll-options" data-poll="${escHtml(poll.id)}">${optionRows}</div>
      ${pollVoterAvatars(poll.voterPlayers || [])}
      <div class="mp-poll__meta">
        <span id="mp-poll-total">${total} vote${total === 1 ? '' : 's'}</span>
        ${statusNote ? `<span>&middot; ${statusNote}</span>` : ''}
      </div>
      <a href="/polls" class="mp-poll__viewall">View all polls →</a>
    </div>
  </div>${script}`;
}

function myProfileSidebar({ balanceAmount = 0, papawisGames = [], balanceTransactions = [], latestPoll = null, papawisProbation = false, papawisEmailsOn = null }) {
  // Most-recent-first, capped — this is a glance-level "why do I owe this" list, not a
  // full statement; the admin ledger view is the source of truth for everything.
  const breakdownRows = balanceTransactions.slice(0, 8).map(tx => {
    const isCharge = tx.type === 'charge';
    const label = tx.notes || (isCharge ? 'Charge' : 'Payment');
    const statusTag = TX_STATUS_LABEL[tx.status] ? `<span class="mp-balance-breakdown__status mp-balance-breakdown__status--${tx.status}">${TX_STATUS_LABEL[tx.status]}</span>` : '';
    return `<div class="mp-balance-breakdown__row">
      <div class="mp-balance-breakdown__label">
        <span class="mp-balance-breakdown__desc">${escHtml(label)}</span>
        <span class="mp-balance-breakdown__date">${escHtml(fmtShortDate(tx.date))}</span>
      </div>
      <span class="mp-balance-breakdown__amount mp-balance-breakdown__amount--${isCharge ? 'charge' : 'payment'}">${isCharge ? '+' : '−'}₱${Number(tx.amount).toLocaleString()}</span>
      ${statusTag}
    </div>`;
  }).join('');

  // One unified card (single border/background/radius) rather than the balance info and
  // transaction history reading as two stacked boxes — the amber "you owe money" treatment
  // now runs through the whole thing, divider between the two sections instead of a gap.
  // History stays collapsed by default and caps at a fixed height + scroll once open, so a
  // long list doesn't push Papawis/ratings further down the sidebar.
  const historyToggleHtml = breakdownRows ? `
  <button type="button" class="mp-balance-group__toggle" id="mp-balance-history-toggle" aria-expanded="false" aria-controls="mp-balance-history-body">
    <span>Transaction History</span>
    <svg class="mp-balance-history__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
  </button>
  <div class="mp-balance-history__body" id="mp-balance-history-body">
    <div class="mp-balance-breakdown">${breakdownRows}</div>
  </div>
  <script>
  (function() {
    var toggle = document.getElementById('mp-balance-history-toggle');
    var wrap = document.getElementById('mp-balance-group');
    if (!toggle || !wrap) return;
    toggle.addEventListener('click', function() {
      var open = wrap.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  })();
  </script>` : '';

  const balanceHtml = balanceAmount > 0 ? `
  <div class="mp-balance-group" id="mp-balance-group">
    <div class="mp-balance-card">
      <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7" cy="7" r="6"/><path d="M7 4v3.3"/><circle cx="7" cy="9.8" r=".2" fill="currentColor"/></svg>
      <div>
        <div class="mp-balance-card__title">Outstanding balance</div>
        <div class="mp-balance-card__amount">₱${Number(balanceAmount).toLocaleString()}</div>
        <a href="/settle-balance" class="mp-balance-card__cta">Settle balance →</a>
      </div>
    </div>
    ${historyToggleHtml}
  </div>` : '';

  // Credit on file — current_balance can go negative (e.g. a Papawis deposit that hasn't
  // been drawn down by a charge yet), which the balance card above never surfaced at all
  // since it only renders for balanceAmount > 0. No transaction history here (that's the
  // bigger, still-unbuilt "why do I have this" list) — just the number, framed positively
  // rather than as a variant of the "you owe money" card.
  const creditHtml = balanceAmount < 0 ? `
  <div class="mp-credit-card">
    <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 7h9M7 2.5v9"/></svg>
    <div>
      <div class="mp-credit-card__title">Credit on file</div>
      <div class="mp-credit-card__amount">₱${Number(-balanceAmount).toLocaleString()}</div>
      <div class="mp-credit-card__note">Applies automatically to your next charge (e.g. a Papawis game).</div>
    </div>
  </div>` : '';

  // Papawis probation — non-dismissable, mirrors the balance card's weight/placement but in
  // a distinct blue so it doesn't read as "you owe money" (see also the sitewide
  // probationReminderBar in server.js, which links here for anyone who missed this card).
  const probationHtml = papawisProbation ? `
  <div class="mp-probation-card">
    <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7" cy="7" r="6"/><path d="M7 4v3.3"/><circle cx="7" cy="9.8" r=".2" fill="currentColor"/></svg>
    <div>
      <div class="mp-probation-card__title">Papawis Probation</div>
      <div class="mp-probation-card__body">You'll be held on a waiting list when you join a papawis game until an admin confirms a deposit from you.</div>
      <a href="/settle-balance?category=${encodeURIComponent('Papawis Deposit')}" class="mp-probation-card__cta">Submit a deposit →</a>
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

  const pollHtml = pollSidebarCard(latestPoll);

  // Opt-out for the Papawis "new game" and "slot opened" emails (lib/papawis-broadcast.js).
  // null = no account to attach it to (nothing rendered).
  const emailPrefsHtml = papawisEmailsOn === null ? '' : `
  <div class="card mp-prefs">
    <div class="card-label">EMAILS</div>
    <label class="mp-prefs__row" for="mp-papawis-emails">
      <span class="mp-prefs__text">
        <span class="mp-prefs__title">Papawis game alerts</span>
        <span class="mp-prefs__hint">New games and open slots. Reminders for games you're in still come either way.</span>
      </span>
      <input type="checkbox" id="mp-papawis-emails" class="mp-prefs__toggle"${papawisEmailsOn ? ' checked' : ''}>
    </label>
    <span class="mp-prefs__msg" id="mp-papawis-emails-msg" aria-live="polite"></span>
  </div>
  <script>
  (function () {
    var box = document.getElementById('mp-papawis-emails');
    var msg = document.getElementById('mp-papawis-emails-msg');
    if (!box) return;
    box.addEventListener('change', function () {
      var on = box.checked;
      msg.textContent = 'Saving…';
      fetch('/me/papawis-emails', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: on }) })
        .then(function (r) { if (!r.ok) throw new Error(); msg.textContent = on ? 'You’ll get Papawis game alerts.' : 'Papawis game alerts turned off.'; })
        .catch(function () { box.checked = !on; msg.textContent = 'Couldn\'t save. Try again.'; });
    });
  })();
  </script>`;

  if (!balanceHtml && !creditHtml && !probationHtml && !papawisHtml && !pollHtml && !emailPrefsHtml) return '';
  return `<div class="mp-sidebar">${balanceHtml}${creditHtml}${probationHtml}${papawisHtml}${pollHtml}${emailPrefsHtml}</div>`;
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

// ── Badges ────────────────────────────────────────────────────────────────────
function badgeIconSvg(key) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${BADGE_ICONS[key] || BADGE_ICONS.basketball}</svg>`;
}

const BADGE_TIER_RANK = { legendary: 0, gold: 1, silver: 2, bronze: 3 };
const badgeRank = b => b.kind === 'legendary' ? BADGE_TIER_RANK.legendary : (b.tier ? BADGE_TIER_RANK[b.tier] : 4);

function badgeMedal(b, hasLegendary) {
  const ringClass = b.kind === 'legendary' ? 'badge-medal__ring--legendary' : (b.tier ? `badge-medal__ring--${b.tier}` : 'badge-medal__ring--feat');
  // Legendary is the only kind that still carries text (the spin that otherwise sets it
  // apart from a plain gold ring disappears under prefers-reduced-motion). That line only
  // needs to exist — and only costs vertical space — when this season's row actually has
  // one; with nobody having earned a Legendary badge league-wide yet, that's effectively never.
  const tierLabel = b.kind === 'legendary'
    ? `<div class="badge-medal__tier badge-medal__tier--legendary">Legendary</div>`
    : (hasLegendary ? `<div class="badge-medal__tier">&nbsp;</div>` : '');
  return `<div class="badge-medal" title="${escHtml(b.name)}">
      <div class="badge-medal__ring ${ringClass}"><div class="badge-medal__inner">${badgeIconSvg(b.icon)}</div></div>
      ${tierLabel}
      <div class="badge-medal__name">${escHtml(b.name)}</div>
      <div class="badge-medal__meta">${escHtml(b.meta)}</div>
    </div>`;
}

const BADGE_CHEVRON_L = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
const BADGE_CHEVRON_R = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

// .badge-scroll wrapper matches the score ticker's prev/next + edge-fade mechanics (see
// .ticker-wrap) — the actual scroll/button wiring is one shared script in badgeShowcase
// below, scoped to whichever .badge-scroll elements exist in the card at the time it runs.
function badgeSeasonRow(entry, { withLabel }) {
  const sorted = [...entry.earned].sort((a, b) => badgeRank(a) - badgeRank(b));
  const hasLegendary = sorted.some(b => b.kind === 'legendary');
  return `${withLabel ? `<div class="badge-season-label">Season ${escHtml(String(entry.season))}</div>` : ''}
  <div class="badge-scroll">
    <button type="button" class="badge-scroll__nav badge-scroll__nav--prev" aria-label="Scroll left">${BADGE_CHEVRON_L}</button>
    <div class="badge-showcase__row">${sorted.map(b => badgeMedal(b, hasLegendary)).join('')}</div>
    <button type="button" class="badge-scroll__nav badge-scroll__nav--next" aria-label="Scroll right">${BADGE_CHEVRON_R}</button>
  </div>`;
}

// Full-width, public — sits right under the hero, above Coach's Note. Only shows badges
// already earned; a not-yet-earned teaser lives in nextUpWidget below instead, gated to the
// player themselves (a public trophy case shouldn't show what you haven't won).
//
// badges.seasons is every regular season with at least one earned badge, most recent first.
// The most recent leads, expanded; anything older sits behind a "show previous seasons"
// toggle — a career could span many seasons, and this keeps the profile from growing
// unbounded while still making past achievements reachable, not deleted.
function badgeShowcase(badges) {
  const seasons = badges?.seasons || [];
  if (!seasons.length) return '';
  const [lead, ...older] = seasons;

  const olderHtml = older.length ? `
  <button type="button" class="badge-showcase__toggle" id="badge-prev-toggle" aria-expanded="false">
    Show ${older.length} previous season${older.length > 1 ? 's' : ''} &darr;
  </button>
  <div class="badge-showcase__prev" id="badge-prev-seasons" hidden>
    ${older.map(entry => badgeSeasonRow(entry, { withLabel: true })).join('')}
  </div>` : '';

  return `<div class="card badge-showcase">
  <div class="card-label">BADGES <span class="card-label__count">${lead.earned.length} EARNED &mdash; SEASON ${escHtml(String(lead.season))}</span><a href="/badges" class="card-label__link" style="margin-left:auto">All badges &rarr;</a></div>
  ${badgeSeasonRow(lead, { withLabel: false })}
  ${olderHtml}
  <script>
  (function() {
    var card = document.currentScript.closest('.badge-showcase');
    if (!card) return;

    // A .badge-scroll starts life inside a still-hidden previous-seasons panel, so its
    // scrollWidth reads as 0 until that panel is unhidden — wireScroll() is safe to call
    // repeatedly (both up front for the always-visible lead row, and again after the toggle
    // reveals the rest) since it just re-measures and re-toggles classes each time.
    function wireScroll(wrap) {
      var track = wrap.querySelector('.badge-showcase__row');
      var btnP = wrap.querySelector('.badge-scroll__nav--prev');
      var btnN = wrap.querySelector('.badge-scroll__nav--next');
      if (!track || wrap.dataset.wired) return;
      wrap.dataset.wired = '1';
      var STEP = 130;
      function update() {
        var max = track.scrollWidth - track.clientWidth;
        if (max <= 4) { wrap.classList.add('at-start', 'at-end'); return; }
        wrap.classList.toggle('at-start', track.scrollLeft < 4);
        wrap.classList.toggle('at-end', track.scrollLeft > max - 4);
      }
      track.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      btnP.addEventListener('click', function() { track.scrollBy({ left: -STEP, behavior: 'smooth' }); });
      btnN.addEventListener('click', function() { track.scrollBy({ left: STEP, behavior: 'smooth' }); });
      update();
    }

    function wireAll() { card.querySelectorAll('.badge-scroll').forEach(wireScroll); }
    wireAll();

    var toggleBtn = document.getElementById('badge-prev-toggle');
    var panel = document.getElementById('badge-prev-seasons');
    if (toggleBtn && panel) {
      toggleBtn.addEventListener('click', function() {
        var open = panel.hidden;
        panel.hidden = !open;
        toggleBtn.setAttribute('aria-expanded', String(open));
        toggleBtn.innerHTML = open ? 'Hide previous seasons &uarr;' : 'Show ${older.length} previous season${older.length > 1 ? 's' : ''} &darr;';
        if (open) wireAll();
      });
    }
  })();
  <\/script>
</div>`;
}

// Sidebar, owner-only (same isOwnProfile gate as Coach's Note) — a locked-badge progress
// teaser. Never shown to other visitors; showing what you haven't earned yet is motivation
// for you, not something worth broadcasting on your public profile.
function nextUpWidget(pending) {
  if (!pending?.length) return '';
  // Rate badges (have a real progress bar) are more actionable than the flavor-only
  // legendary ones, so they lead — capped at 2 so this stays a teaser, not a checklist.
  const picked = [...pending].sort((a, b) => (a.kind === 'rate' ? 0 : 1) - (b.kind === 'rate' ? 0 : 1)).slice(0, 2);
  const row = b => `<div class="next-up-row">
    <div class="next-up-row__icon${b.kind === 'legendary' ? ' next-up-row__icon--legendary' : ''}">${badgeIconSvg(b.icon)}</div>
    <div class="next-up-row__body">
      <div class="next-up-row__name">${escHtml(b.name)}</div>
      <div class="next-up-row__meta">${escHtml(b.meta)}</div>
      ${b.progress != null ? `<div class="next-up-row__bar"><div class="next-up-row__bar-fill" style="width:${Math.round(b.progress * 100)}%"></div></div>` : ''}
    </div>
  </div>`;
  return `<div class="card">
  <div class="card-label">NEXT UP</div>
  ${picked.map(row).join('')}
  <div class="next-up__foot">Only you see this &mdash; same as Coach's Note.</div>
</div>`;
}

// ══ Player profile ════════════════════════════════════════════════════════════════
// One page, two audiences (mockup: claude.ai/artifact/Uyy7ZMQyfrfpGxQVMZkgLT):
//   own     — "My Profile": sections ordered by what a player logs in to do. Today (stat
//             tiles for anything needing action) → This week (pick cards + Papawis) → My
//             season → Badges → Community → Career → Account & settings. On phones the
//             last four start folded (profile.css + the nav script below).
//   public  — what everyone else sees: hero, this season's averages vs career, recent games,
//             badges, community, career. Also what the owner sees with ?view=public.
// Styles: public/profile.css (prf- prefix).

const PRF_ICON = {
  share: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>',
  eye: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  star: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/></svg>',
  trophy: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
  due: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7v6"/><path d="M12 17h.01"/></svg>',
  ok: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
  play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  google: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5a4.3 4.3 0 0 1-1.9 2.8v2.3h3A9 9 0 0 0 21 12.2z"/><path d="M12 21a8.9 8.9 0 0 0 6.1-2.3l-3-2.3a5.6 5.6 0 0 1-8.3-2.9H3.7v2.4A9 9 0 0 0 12 21z"/><path d="M6.8 13.5a5.4 5.4 0 0 1 0-3.4V7.7H3.7a9 9 0 0 0 0 8.2z"/><path d="M12 6.6c1.4 0 2.6.5 3.6 1.4l2.7-2.7A9 9 0 0 0 3.7 7.7l3.1 2.4A5.4 5.4 0 0 1 12 6.6z"/></svg>',
};

const prfPeso = n => `₱${Number(n).toLocaleString()}`;
const prfFg = r => {
  const m = (r.fg2m || 0) + (r.fg3m || 0) + (r.fg4m || 0);
  return { m, a: m + (r.fg2m_miss || 0) + (r.fg3m_miss || 0) + (r.fg4m_miss || 0) };
};
const prfDay = ymd => (ymd ? new Date(`${String(ymd).slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
const prfWeekday = ymd => (ymd ? new Date(`${String(ymd).slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }) : '');

// Regular-season rows only, newest first — "this season" and the career comparison are
// both regular season, so a Finals run doesn't inflate (or sink) the headline numbers.
function prfRegular(statsByType) {
  return (statsByType?.seasons || []).filter(r => r.game_type === 'regular')
    .sort((a, b) => Number(b.season) - Number(a.season));
}
function prfLine(rows) {
  const sum = k => rows.reduce((t, r) => t + Number(r[k] || 0), 0);
  const gp = sum('games_played');
  if (!gp) return null;
  const fg = rows.reduce((t, r) => { const x = prfFg(r); return { m: t.m + x.m, a: t.a + x.a }; }, { m: 0, a: 0 });
  return {
    gp, ppg: (sum('pts') / gp).toFixed(1), rpg: (sum('reb') / gp).toFixed(1), apg: (sum('ast') / gp).toFixed(1),
    fgm: fg.m, fga: fg.a, fgPct: fg.a ? ((fg.m / fg.a) * 100).toFixed(1) : null,
  };
}

// One game-log row, from this player's side.
function prfGame(g) {
  const isA = g.player_team_id === g.team_a_id;
  const my = Number(isA ? g.team_a_score : g.team_b_score);
  const op = Number(isA ? g.team_b_score : g.team_a_score);
  return { opp: String((isA ? g.team_b_name : g.team_a_name) || '').toUpperCase(), won: my > op, my, op, fg: prfFg(g) };
}

// fold: on phones the section starts folded behind a +/– toggle in its header (own profile,
// lower sections only). The toggle is hidden on wider screens, where it's always open.
function prfSection(id, title, { sub = '', link = '', body = '', fold = false } = {}) {
  if (!body) return '';
  const toggle = fold
    ? `<button type="button" class="prf-fold" aria-expanded="false" aria-controls="${id}-body" aria-label="Show ${title.replace(/&amp;/g, '&')}"></button>` : '';
  return `<section class="prf-sec${fold ? ' prf-sec--fold' : ''}" id="${id}" aria-labelledby="${id}-h">
  <div class="section-header"><h2 id="${id}-h">${title}${sub ? ` <span class="section-header__sub">${sub}</span>` : ''}</h2>${link}${toggle}</div>
  <div class="prf-sec__body" id="${id}-body">${body}</div>
</section>`;
}
const prfLink = (href, text) => `<a href="${escHtml(href)}" class="section-header__link">${text} <span>&rarr;</span></a>`;

function prfTile({ label, chip = null, value, small = '', segs = null, sub = '', cta = null }) {
  const due = chip?.kind === 'due';
  return `<div class="card prf-kpi${due ? ' prf-kpi--due' : ''}">
    <div class="card-label"><span>${escHtml(label)}</span>${chip ? `<span class="prf-stat prf-stat--${chip.kind}">${PRF_ICON[chip.kind]}${escHtml(chip.text)}</span>` : ''}</div>
    <div class="prf-kpi__body">
      <div class="prf-kpi__val font-condensed">${escHtml(value)}${small ? `<small>${escHtml(small)}</small>` : ''}</div>
      ${segs ? `<div class="prf-segs" aria-label="${segs.done} of ${segs.total} picked">${Array.from({ length: segs.total }, (_, i) => `<i${i < segs.done ? ' class="on"' : ''}></i>`).join('')}</div>` : ''}
      ${sub ? `<div class="prf-kpi__sub">${escHtml(sub)}</div>` : ''}
    </div>
    ${cta ? `<a href="${escHtml(cta.href)}" class="prf-kpi__cta${cta.quiet ? ' prf-kpi__cta--quiet' : ''}">${escHtml(cta.text)} <span>&rarr;</span></a>` : ''}
  </div>`;
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function prfHero(o) {
  const { player, editing, canEditPhoto, isAdmin, champSeasons, latestGame, canRate, peerRatingsEnabled, canReport } = o;
  const teamName = String(player.team_name || '').toUpperCase();
  const color = teamColor(teamName);
  const positions = parsePositions(player.positions);
  const bio = String(player.writeup || '').trim();
  const champ = champSeasons.length
    ? `<span class="prf-chip prf-chip--amber">${PRF_ICON.trophy}${champSeasons.length > 1 ? `${champSeasons.length}× champion` : `Season ${champSeasons[0]} champion`}</span>` : '';
  const intro = editing ? `
      <div class="player-hero__bio-block prf-hero__bio" id="bio-block">
        <textarea class="player-hero__bio-input" id="bio-input" maxlength="500" rows="1" readonly placeholder="Add a short intro so people know a bit about you." aria-label="Your intro">${escHtml(bio)}</textarea>
        <button type="button" class="player-hero__bio-edit-btn" id="bio-edit-btn" aria-label="Edit intro" title="Edit intro">✎</button>
        <div class="player-hero__bio-actions" id="bio-actions" hidden>
          <button type="button" class="player-hero__bio-icon-btn" id="bio-cancel" aria-label="Cancel" title="Cancel">✕</button>
          <button type="button" class="player-hero__bio-icon-btn player-hero__bio-icon-btn--save" id="bio-save" aria-label="Save" title="Save">✓</button>
        </div>
      </div>` : (bio ? `<p class="prf-hero__quote">“${escHtml(bio)}”</p>` : '');
  const shareHref = latestGame ? `/games/${encodeURIComponent(gameSlug(latestGame))}?share=1` : '';
  const actions = editing
    ? `${shareHref ? `<a class="prf-btn prf-btn--amber" href="${shareHref}">${PRF_ICON.share}Share my stats</a>` : ''}
       <a class="prf-btn" href="?view=public">${PRF_ICON.eye}See public profile</a>`
    : `${canRate && peerRatingsEnabled ? `<a class="prf-btn prf-btn--amber" href="#pr-rate-card">${PRF_ICON.star}Rate player</a>` : ''}
       <button type="button" class="prf-btn" data-prf-share>${PRF_ICON.share}<span>Share</span></button>`;
  return `<section class="prf-hero" aria-label="Player">
  <div class="player-hero__avatar-wrap prf-hero__avatar-wrap">
    <div class="player-hero__avatar prf-hero__avatar" style="border-color:${color}">
      <span>${escHtml(initials(player.name))}</span>
      <img id="player-avatar-img" src="/api/player/${encodeURIComponent(player.id)}/photo" alt="" loading="lazy" onerror="this.style.display='none'">
    </div>
    ${canEditPhoto ? photoUploadOverlay() : photoLightbox()}
  </div>
  <div class="prf-hero__info">
    <h1 class="prf-hero__name">${escHtml(displayPlayerName(player.name))}</h1>
    <div class="prf-hero__meta">
      ${player.number ? `<span class="prf-hero__num font-condensed">#${escHtml(String(player.number))}</span>` : ''}
      ${positions.length ? `<span>${escHtml(positions.join(' · '))}</span>` : ''}
      ${teamName ? `<span class="prf-chip"><span class="team-dot" style="background:${color}"></span>${escHtml(teamName)}</span>` : ''}
      ${champ}
    </div>
    ${intro}
  </div>
  <div class="prf-hero__actions">
    ${actions}
    ${canReport ? reportPlayerSection(player, o.reportCategories, o.reportOtherCategoryId) : ''}
  </div>
</section>
${canEditPhoto ? photoUploadScript(player, isAdmin) : ''}
${editing ? bioEditorScript() : ''}
${editing ? '' : `<script>
(function () {
  document.querySelectorAll('[data-prf-share]').forEach(function (b) {
    b.addEventListener('click', function () {
      var url = location.origin + location.pathname, label = b.querySelector('span');
      if (navigator.share) { navigator.share({ title: document.title, url: url }).catch(function () {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () {
        label.textContent = 'Link copied'; setTimeout(function () { label.textContent = 'Share'; }, 1800);
      });
    });
  });
})();
</script>`}`;
}

// ── Own: Today tiles ────────────────────────────────────────────────────────────
function prfToday(o) {
  const tiles = [];
  let due = 0;
  if (o.balanceAmount > 0) {
    due++;
    const last = o.balanceTransactions.find(t => t.type === 'charge' && t.status !== 'voided');
    tiles.push(prfTile({ label: 'BALANCE DUE', chip: { kind: 'due', text: 'DUE' }, value: prfPeso(o.balanceAmount), sub: last?.notes ? `Latest: ${last.notes}` : 'Outstanding charges', cta: { href: '/settle-balance', text: 'Settle balance' } }));
  }
  if (o.papawisProbation) {
    due++;
    tiles.push(prfTile({ label: 'PAPAWIS DEPOSIT', chip: { kind: 'due', text: 'NEEDED' }, value: 'Hold', sub: 'You join Papawis games on the waitlist until a deposit is confirmed.', cta: { href: `/settle-balance?category=${encodeURIComponent('Papawis Deposit')}`, text: 'Submit a deposit' } }));
  }
  const live = (o.pickRecord?.own?.open || []).filter(g => !g.closed);
  if (live.length) {
    const done = live.filter(g => g.myPick).length;
    const all = done === live.length;
    if (!all) due++;
    tiles.push(prfTile({ label: `${prfWeekday(live[0].ymd).toUpperCase()} PICKS`, chip: all ? { kind: 'ok', text: 'ALL IN' } : { kind: 'due', text: 'OPEN' }, value: String(done), small: `/${live.length}`, segs: { done, total: live.length }, sub: `Closes ${prfWeekday(live[0].ymd)} ${fmtCloseTime(o.pickRecord.own.closeTime)}`, cta: { href: '#this-week', text: all ? 'Change picks' : 'Pick now', quiet: all } }));
  }
  const poll = o.latestPoll;
  if (poll && poll.status === 'open' && poll.canVote && !poll.myVote) {
    due++;
    tiles.push(prfTile({ label: 'POLLS', chip: { kind: 'due', text: 'NEW' }, value: '1', sub: truncate(String(poll.question || ''), 70), cta: { href: `/polls#poll-${poll.id}`, text: 'Vote' } }));
  }
  const next = o.papawisGames
    .filter(g => g.status !== 'completed' && g.status !== 'cancelled' && String(g.date || '') >= o.todayYmd)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
  if (next) {
    tiles.push(prfTile({ label: 'NEXT PAPAWIS', chip: next.any_confirmed ? { kind: 'ok', text: 'IN' } : { kind: 'due', text: 'WAITLIST' }, value: prfDay(next.date), sub: [prfWeekday(next.date), next.any_confirmed ? 'Confirmed' : 'Waitlist', next.title].filter(Boolean).join(' · '), cta: { href: '/papawis', text: 'View', quiet: true } }));
  }
  const body = tiles.length
    ? `<div class="prf-kpis">${tiles.join('')}</div>`
    : `<p class="prf-note">You're all caught up — nothing needs you right now.</p>`;
  return prfSection('today', 'Today', { sub: due ? `${due} need${due === 1 ? 's' : ''} action` : '', body });
}

// ── Own: This week (pick cards + Papawis) ──────────────────────────────────────
function prfThisWeek(o) {
  const own = o.pickRecord?.own;
  const open = own?.open || [];
  const papawis = o.papawisGames.slice(0, 4);
  if (!open.length && !papawis.length) return '';
  const note = open.length && o.pickRecord && !o.pickRecord.settled
    ? '<p class="prf-note">Your first picks settle after the final. Every settled pick counts toward the Pickmaster race.</p>' : '';
  const sub = open.length
    ? `${escHtml(prfWeekday(open[0].ymd))}, ${escHtml(prfDay(open[0].ymd))} game day${open.every(g => g.closed) ? ' · picks closed' : ` · picks close ${escHtml(fmtCloseTime(own.closeTime))}`}` : '';
  const body = `${note}<div class="prf-week">
    ${open.map(g => `<div class="prf-week__pick">${openPickCard(g, { isPlayer: true, next: '/me', size: 'sm' })}</div>`).join('')}
    ${papawis.length ? myProfileSidebar({ papawisGames: papawis }) : ''}
  </div>${open.length ? pickBoxScript() : ''}`;
  return prfSection('this-week', 'This week', { sub, link: o.picksOn ? prfLink('/picks', 'Pickmaster race') : '', body });
}

// ── Season averages / last games ────────────────────────────────────────────────
function prfSeasonCard(o, season, line, games) {
  const rows = games.map(g => {
    const x = prfGame(g);
    const share = `/games/${encodeURIComponent(gameSlug(g))}?share=1`;
    return `<tr>
      <td><a href="/games/${encodeURIComponent(gameSlug(g))}" class="prf-table__game">${escHtml(prfDay(g.date))} · <span class="team-dot" style="background:${teamColor(x.opp)}"></span>${escHtml(tcase(x.opp))}</a></td>
      <td class="prf-table__res">${x.won ? 'W' : 'L'} ${x.my}–${x.op}</td>
      <td class="font-condensed">${g.pts ?? 0}</td><td class="font-condensed">${g.reb ?? 0}</td><td class="font-condensed">${g.ast ?? 0}</td>
      <td class="prf-table__act"><a class="prf-share-btn" href="${share}" aria-label="Share my ${escHtml(prfDay(g.date))} stats vs ${escHtml(tcase(x.opp))}" title="Share my stats">${PRF_ICON.share}</a></td>
    </tr>`;
  }).join('');
  const stat = (v, l) => `<div><div class="prf-big font-condensed">${escHtml(v)}</div><div class="prf-k">${l}</div></div>`;
  return `<div class="card">
    <div class="card-label"><span>SEASON ${escHtml(String(season))} AVERAGES</span><span class="card-label__count">${line.gp} GP</span></div>
    <div class="prf-body">
      <div class="prf-avgs">${stat(line.ppg, 'PPG')}${stat(line.rpg, 'RPG')}${stat(line.apg, 'APG')}${stat(line.fgPct != null ? `${Math.round(line.fgPct)}%` : '—', 'FG')}</div>
      ${rows ? `<div class="prf-table-wrap"><table class="prf-table">
        <thead><tr><th>Last ${games.length} games</th><th>Result</th><th>PTS</th><th>REB</th><th>AST</th><th><span class="sr-only">Share</span></th></tr></thead>
        <tbody>${rows}</tbody></table></div>` : ''}
    </div>
  </div>`;
}

function prfCoachCard(coachNote) {
  if (!coachNote?.analysis) return '';
  const label = FOCUS_LABELS[coachNote.focus_tag] || coachNote.focus_tag;
  const video = FOCUS_VIDEOS[coachNote.focus_tag];
  const dateStr = coachNote.generated_at ? new Date(coachNote.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  return `<div class="card">
    <div class="card-label"><span>COACH'S NOTE</span><span class="prf-stat prf-stat--due prf-stat--plain">Focus: ${escHtml(label)}</span></div>
    <div class="prf-body">
      <p class="prf-coach__text">${escHtml(coachNote.analysis)}</p>
      ${video ? `<a class="prf-coach__video" href="${escHtml(video.url)}" target="_blank" rel="noopener">
        <span class="prf-coach__play">${PRF_ICON.play}</span>
        <span><span class="prf-k">WATCH · ${escHtml(label.toUpperCase())}</span><span class="prf-coach__title">${escHtml(video.title)}</span></span>
      </a>` : ''}
      ${dateStr ? `<span class="prf-small">Based on stats through ${escHtml(dateStr)} · updates the next time your averages change. Only you see this.</span>` : ''}
    </div>
  </div>`;
}

function prfMySeason(o) {
  const reg = prfRegular(o.statsByType);
  const cur = reg[0];
  const line = cur ? prfLine([cur]) : null;
  const played = o.gameLogs.filter(g => g.status === 'played');
  const last3 = cur ? played.filter(g => String(g.season) === String(cur.season)).slice(0, 3) : [];
  const cards = [line ? prfSeasonCard(o, cur.season, line, last3.length ? last3 : played.slice(0, 3)) : '', prfCoachCard(o.coachNote)].filter(Boolean);
  if (!cards.length) return '';
  return prfSection('my-season', 'My season', {
    sub: line ? `Season ${escHtml(String(cur.season))} · ${line.gp} game${line.gp === 1 ? '' : 's'}` : '',
    link: played.length ? prfLink('#career', 'Full game log') : '',
    body: `<div class="prf-grid2">${cards.join('')}</div>`,
  });
}

// ── Public: this season vs career + recent games ───────────────────────────────
function prfPublicSeason(o) {
  const reg = prfRegular(o.statsByType);
  const cur = reg[0];
  const line = cur ? prfLine([cur]) : null;
  const career = prfLine(reg);
  if (!line) return '';
  const vs = (v) => (reg.length > 1 && career ? `Career ${v}` : '');
  const tiles = [
    prfTile({ label: 'POINTS', value: line.ppg, sub: vs(career.ppg) }),
    prfTile({ label: 'REBOUNDS', value: line.rpg, sub: vs(career.rpg) }),
    prfTile({ label: 'ASSISTS', value: line.apg, sub: vs(career.apg) }),
    prfTile({ label: 'FIELD GOALS', value: line.fgPct != null ? line.fgPct : '—', small: line.fgPct != null ? '%' : '', sub: [`${line.fgm} / ${line.fga}`, reg.length > 1 && career?.fgPct != null ? `career ${career.fgPct}%` : ''].filter(Boolean).join(' · ') }),
  ];
  return prfSection('season', `Season ${escHtml(String(cur.season))}`, {
    sub: `${line.gp} game${line.gp === 1 ? '' : 's'} · regular season · per game`,
    body: `<div class="prf-kpis">${tiles.join('')}</div>`,
  });
}

function prfRecentGames(o) {
  const played = o.gameLogs.filter(g => g.status === 'played').slice(0, 5);
  if (!played.length) return '';
  const TYPE = { playoff: 'PLAYOFFS', finals: 'FINALS' };
  const rows = played.map(g => {
    const x = prfGame(g);
    return `<tr>
      <td>${escHtml(prfDay(g.date))}${TYPE[g.game_type] ? ` <span class="prf-tag">${TYPE[g.game_type]}</span>` : ''}${o.potgGameIds.has(g.id) ? ' <span class="prf-tag" title="Player of the Game">POTG</span>' : ''}</td>
      <td><a href="/games/${encodeURIComponent(gameSlug(g))}" class="prf-table__game"><span class="team-dot" style="background:${teamColor(x.opp)}"></span>${escHtml(tcase(x.opp))}</a></td>
      <td class="prf-table__res">${x.won ? 'W' : 'L'} ${x.my}–${x.op}</td>
      <td class="font-condensed">${g.pts ?? 0}</td><td class="font-condensed">${g.reb ?? 0}</td><td class="font-condensed">${g.ast ?? 0}</td>
      <td class="font-condensed">${g.stl ?? 0}</td><td class="font-condensed">${g.turnover ?? 0}</td><td class="font-condensed">${x.fg.m}–${x.fg.a}</td>
    </tr>`;
  }).join('');
  return prfSection('recent', 'Recent games', {
    link: prfLink('#career', 'Full game log'),
    body: `<div class="card"><div class="prf-table-wrap"><table class="prf-table prf-table--wide">
      <thead><tr><th>Date</th><th>Opponent</th><th>Result</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>TOV</th><th>FG</th></tr></thead>
      <tbody>${rows}</tbody></table></div></div>`,
  });
}

// ── Shared lower sections ───────────────────────────────────────────────────────
function prfBadges(o, own) {
  const show = badgeShowcase(o.badges);
  const next = own ? nextUpWidget(o.badges?.pending) : '';
  if (!show && !next) return '';
  return prfSection('badges', 'Badges', {
    fold: own,
    link: prfLink('/badges', 'All badges'),
    body: show && next ? `<div class="prf-grid-badges">${show}${next}</div>` : (show || next),
  });
}

function prfCommunity(o, own, pollInToday) {
  const cards = [];
  if (o.peerRatingsEnabled) {
    cards.push(communityRatingsCard(o.peerRatingSummary, own));
    if (!own && o.canRate) cards.push(rateThisPlayerCard(o.player.id, o.viewerExistingRating, o.viewerCooldownActive, o.viewerCooldownUntil));
    cards.push(ratingFeedCard(o.peerRatingsFeed));
  }
  if (own && o.latestPoll && !pollInToday) cards.push(myProfileSidebar({ latestPoll: o.latestPoll }));
  if (o.pickRecord?.settled) cards.push(pickRecordCard({ ...o.pickRecord, own: null }, own));
  const body = cards.filter(Boolean).join('');
  if (!body) return '';
  return prfSection('community', own ? 'Community' : 'What players say', { fold: own, body: `<div class="prf-grid2">${body}</div>` });
}

function prfHighlights(o) {
  const played = o.gameLogs.filter(g => g.status === 'played');
  const best = k => played.reduce((b, g) => (Number(g[k] || 0) > Number(b?.[k] || 0) ? g : b), null);
  const rows = [];
  for (const s of o.champSeasons) rows.push(`<div class="prf-line"><span><b>Season ${escHtml(String(s))} champion</b><small>Won the Finals</small></span><span class="prf-chip prf-chip--amber">${PRF_ICON.trophy}S${escHtml(String(s))}</span></div>`);
  if (o.potgGames.length) rows.push(`<div class="prf-line"><span><b>Player of the Game</b><small>${o.potgGames.length === 1 ? 'Once' : `${o.potgGames.length} times`}</small></span><span class="prf-big prf-big--sm font-condensed">${o.potgGames.length}</span></div>`);
  for (const [k, label] of [['pts', 'points'], ['reb', 'rebounds'], ['ast', 'assists']]) {
    const g = best(k);
    if (!g || !Number(g[k])) continue;
    const x = prfGame(g);
    rows.push(`<a class="prf-line" href="/games/${encodeURIComponent(gameSlug(g))}"><span><b>Career high: ${g[k]} ${label}</b><small>${escHtml(prfDay(g.date))} vs ${escHtml(tcase(x.opp))}</small></span><span class="prf-big prf-big--sm font-condensed">${g[k]}</span></a>`);
  }
  if (!rows.length) return '';
  return `<div class="card"><div class="card-label"><span>HIGHLIGHTS</span></div><div class="prf-body prf-body--list">${rows.join('')}</div></div>`;
}

function prfCareer(o) {
  const rows = o.gameLogs.length;
  const played = o.gameLogs.filter(g => g.status === 'played').length;
  const dnp = rows - played;
  // The season-by-season table gets its own full-width row (11 columns); the rest share a grid.
  const table = statsTable(o.statsByType);
  const cards = [prfHighlights(o), awardsSection(o.awards), potgWriteups(o.potgGames, o.player)].filter(Boolean);
  if (!table && !cards.length && !rows) return '';
  const total = o.statsByType?.career?.games_played || 0;
  return prfSection('career', 'Career', {
    fold: !!o.foldLower,
    sub: total ? `${total} game${total === 1 ? '' : 's'}` : '',
    body: `${table}${cards.length ? `<div class="prf-grid2 prf-grid2--after">${cards.join('')}</div>` : ''}
    ${rows ? `<details class="prf-log"><summary>Full game log <span>${played} game${played === 1 ? '' : 's'}${dnp ? ` · ${dnp} DNP` : ''}</span></summary>${gameLog(o.gameLogs, o.player, o.potgGameIds)}</details>` : ''}`,
  });
}

function prfAccount(o) {
  const wallet = o.balanceAmount !== 0
    ? myProfileSidebar({ balanceAmount: o.balanceAmount, balanceTransactions: o.balanceTransactions })
    : `<div class="card"><div class="card-label"><span>WALLET</span></div><div class="prf-body"><p class="prf-small" style="margin:0">No balance due.</p><a href="/settle-balance" class="prf-small-link">Make a payment &rarr;</a></div></div>`;
  const emails = myProfileSidebar({ papawisEmailsOn: o.papawisEmailsOn });
  const signIn = `<div class="card"><div class="card-label"><span>SIGN-IN</span></div>
    <div class="prf-body prf-body--list">
      <a class="prf-line" href="/forgot-password"><span><b>Change password</b><small>We email you a link to set a new one</small></span><span aria-hidden="true">&rarr;</span></a>
      <div class="prf-line prf-line--off" aria-disabled="true"><span class="prf-line__ico">${PRF_ICON.google}<b>Sign in with Google</b></span><span class="prf-chip">Coming soon</span></div>
    </div></div>`;
  return prfSection('account', 'Account &amp; settings', { fold: true, body:`<div class="prf-grid3">${wallet}${emails}${signIn}</div>` });
}

// ── Main export ───────────────────────────────────────────────────────────────
export function playerPage(o) {
  const own = !!o.isOwnProfile && !o.viewPublic;
  const d = {
    ...o,
    potgGameIds: new Set((o.potgGames || []).map(g => g.id)),
    papawisGames: o.papawisGames || [], balanceTransactions: o.balanceTransactions || [],
    champSeasons: o.champSeasons || [],
    foldLower: own,
  };
  const latestGame = d.gameLogs.find(g => g.status === 'played') || null;
  const hero = prfHero({
    player: d.player, editing: own, canEditPhoto: own || (!!d.isAdmin && !o.viewPublic), isAdmin: !!d.isAdmin,
    champSeasons: d.champSeasons, latestGame, canRate: d.canRate, peerRatingsEnabled: d.peerRatingsEnabled,
    canReport: !own && d.canReport, reportCategories: d.reportCategories, reportOtherCategoryId: d.reportOtherCategoryId,
  });
  const banner = o.isOwnProfile && o.viewPublic
    ? `<div class="prf-banner">${PRF_ICON.eye}<span>This is how other players see your profile.</span><a href="?">Back to My Profile &rarr;</a></div>` : '';

  let sections;
  if (own) {
    const poll = d.latestPoll;
    const pollInToday = !!(poll && poll.status === 'open' && poll.canVote && !poll.myVote);
    sections = [
      prfToday(d), prfThisWeek(d), prfMySeason(d), prfBadges(d, true),
      prfCommunity(d, true, pollInToday), prfCareer(d), prfAccount(d),
    ];
  } else {
    sections = [prfPublicSeason(d), prfRecentGames(d), prfBadges(d, false), prfCommunity(d, false, false), prfCareer(d)];
  }
  const NAV = { today: 'Today', 'this-week': 'This week', 'my-season': 'My season', badges: 'Badges', community: 'Community', career: 'Career', account: 'Account' };
  const nav = own ? `<nav class="prf-nav" aria-label="Profile sections">${sections.filter(Boolean).map(s => {
    const id = s.match(/id="([^"]+)"/)[1];
    return NAV[id] ? `<a href="#${id}">${NAV[id]}</a>` : '';
  }).join('')}</nav>
<script>
(function () {
  var nav = document.querySelector('.prf-nav');
  if (!nav) return;
  // Sit just under the sticky site header, whatever height it is on this screen.
  var header = document.querySelector('.site-header:not(.site-header--minimal)');
  function place() { nav.style.setProperty('--prf-nav-top', (header && getComputedStyle(header).position === 'sticky' ? header.offsetHeight : 0) + 'px'); }
  place(); window.addEventListener('resize', place);
  // Folded sections (phones): the +/– toggle, and a nav tap or #hash opens its section.
  function setOpen(sec, open) {
    var btn = sec && sec.querySelector('.prf-fold');
    if (!btn) return;
    sec.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  document.querySelectorAll('.prf-sec--fold').forEach(function (sec) {
    sec.querySelector('.prf-fold').addEventListener('click', function () { setOpen(sec, !sec.classList.contains('is-open')); });
  });
  function openHash(hash) { if (hash && hash.length > 1) setOpen(document.getElementById(hash.slice(1)), true); }
  openHash(location.hash);
  window.addEventListener('hashchange', function () { openHash(location.hash); });
  // Underline the section in view.
  var links = Array.prototype.slice.call(nav.querySelectorAll('a'));
  links.forEach(function (a) { a.addEventListener('click', function () { openHash(a.getAttribute('href')); }); });
  if (!('IntersectionObserver' in window)) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      links.forEach(function (a) { a.classList.toggle('is-on', a.getAttribute('href') === '#' + e.target.id); });
    });
  }, { rootMargin: '-35% 0px -60% 0px' });
  links.forEach(function (a) { var s = document.getElementById(a.getAttribute('href').slice(1)); if (s) io.observe(s); });
})();
</script>` : '';

  return `<div class="prf${own ? ' prf--own' : ''}">
${banner}
${hero}
${nav}
${sections.filter(Boolean).join('\n')}
</div>`;
}
