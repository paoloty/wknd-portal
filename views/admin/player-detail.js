import { escHtml } from '../layout.js';
import { displayPlayerName, teamColor } from '../utils.js';
import { ovrColor } from '../../lib/ratings.js';

const ICON_CHEVRON_L = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.5L5 7l4 4.5"/></svg>`;
const ICON_RECOMPUTE = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 6.5A4.5 4.5 0 1 1 8 2.5"/><path d="M8 1v3h3"/></svg>`;
const ICON_CHECK     = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7.5l3 3 6-7"/></svg>`;
const ICON_X         = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="1.5" y1="1.5" x2="9.5" y2="9.5"/><line x1="9.5" y1="1.5" x2="1.5" y2="9.5"/></svg>`;

const ATTRS = [
  { key: 'scoring',     label: 'Scoring',     color: '#f59332' },
  { key: 'shooting',    label: 'Shooting',    color: '#f59332' },
  { key: 'playmaking',  label: 'Playmaking',  color: '#06b6d4' },
  { key: 'rebounding',  label: 'Rebounding',  color: '#06b6d4' },
  { key: 'defense',     label: 'Defense',     color: '#22c55e' },
  { key: 'iq',          label: 'IQ',          color: '#94a3b8' },
  { key: 'usage',       label: 'Usage',       color: '#22c55e' },
];

function ratingBar(val, color) {
  if (val == null) return `<div class="h-1 bg-admin-border rounded-full"></div>`;
  const pct = Math.round((val / 99) * 100);
  return `<div class="h-1 bg-admin-border rounded-full overflow-hidden">
    <div style="width:${pct}%;height:100%;background:${color};border-radius:99px"></div>
  </div>`;
}

function eff(rating, key) {
  if (!rating) return null;
  return rating[key + '_ovr'] ?? rating[key] ?? null;
}

export function adminPlayerDetailBody({ player, rating = null, stats = null, seasons = [], season = '', teams = [], currentSlug = null, isSuperAdmin = false } = {}) {
  const name  = displayPlayerName(player.name);
  const color = teamColor(player.team_name);
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const seasonPills = seasons.map(s =>
    `<a href="/admin/players/${escHtml(player.id)}?season=${encodeURIComponent(s)}" class="agm-pill${String(s) === String(season) ? ' is-active' : ''}" style="font-size:11px">S${escHtml(String(s))}</a>`
  ).join('');

  // ── OVR ──────────────────────────────────────────────────────────────────
  const effOvr = eff(rating, 'overall');
  const ovrColor_ = ovrColor(effOvr);

  // ── Stat reference ────────────────────────────────────────────────────────
  const gp  = stats?.games_played ?? 0;
  const avg = n => gp > 0 ? (n / gp).toFixed(1) : '—';
  const fg3a = (stats?.fg3m ?? 0) + (stats?.fg3m_miss ?? 0);
  const fg3pct = fg3a > 0 ? Math.round(((stats?.fg3m ?? 0) / fg3a) * 100) + '%' : '—';

  const statCell = (lbl, val) =>
    `<div class="text-center">
      <div class="text-[10px] text-slate-500 uppercase tracking-widest mb-0.5">${lbl}</div>
      <div class="text-sm font-bold text-slate-200 font-saira">${val}</div>
    </div>`;

  const statsGrid = `<div class="grid grid-cols-4 gap-2 pt-3 mt-2.5 border-t border-admin-border">
    ${statCell('GP',  String(gp))}
    ${statCell('PPG', avg(stats?.pts ?? 0))}
    ${statCell('RPG', avg(stats?.reb ?? 0))}
    ${statCell('APG', avg(stats?.ast ?? 0))}
    ${statCell('SPG', avg(stats?.stl ?? 0))}
    ${statCell('BPG', avg(stats?.blk ?? 0))}
    ${statCell('3P%', fg3pct)}
    ${statCell('TOV', avg(stats?.turnover ?? 0))}
  </div>`;

  // ── Rating attribute rows ─────────────────────────────────────────────────
  const attrRows = ATTRS.map(({ key, label, color: c }) => {
    const computed  = rating?.[key] ?? null;
    const override  = rating?.[key + '_ovr'] ?? null;
    const effective = override ?? computed;
    return `<div class="grid items-center gap-2.5 py-2 border-b border-admin-border/50 last:border-b-0" style="grid-template-columns:90px 1fr 72px">
      <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">${label}</div>
      <div>${ratingBar(effective, c)}</div>
      <div class="flex items-center gap-1.5">
        <span class="text-xs text-slate-500 min-w-[20px] text-right">${computed ?? '—'}</span>
        <input type="number" name="${key}_ovr" min="1" max="99" placeholder="—" value="${override ?? ''}"
          class="admin-input" style="width:44px;padding:3px 5px;font-size:12px;text-align:center"
          title="Override">
      </div>
    </div>`;
  }).join('');

  // ── Profile fields ────────────────────────────────────────────────────────
  const d = player;
  const field = (label, id, val, ph = '') =>
    `<div><label class="admin-field-label">${label}</label>
     <input type="text" id="${id}" class="admin-input mt-1" value="${escHtml(val || '')}" placeholder="${ph}"></div>`;

  const positions = (() => { try { return JSON.parse(player.positions || '[]'); } catch { return []; } })();

  const posOpts = ['PG','SG','SF','PF','C'].map(pos =>
    `<label class="inline-flex items-center gap-1.5 mr-3 text-sm cursor-pointer text-slate-300">
      <input type="checkbox" class="pos-check accent-brand" value="${pos}"${positions.includes(pos) ? ' checked' : ''}> ${pos}
    </label>`
  ).join('');

  const teamOpts = teams.map(t =>
    `<option value="${escHtml(t.id)}"${t.id === player.team_id ? ' selected' : ''}>${escHtml(t.name)}</option>`
  ).join('');

  const isInactive = player.status === 'inactive';

  return `
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.min.css">
<div class="agm-edit-bar">
  <a href="/admin/players" class="agm-edit-bar__back">${ICON_CHEVRON_L} Players</a>
  <div class="agm-edit-bar__right">
    <span id="save-msg" class="agm-save-msg"></span>
    <button id="plr-save-all" class="agm-edit-bar__save">${ICON_CHECK} Save Changes</button>
  </div>
</div>

<div class="grid grid-cols-1 gap-5 mt-5 lg:grid-cols-[1fr_300px] items-start">

  <!-- ── Main column ─────────────────────────────────────────────────────── -->
  <div class="flex flex-col gap-4">

    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Photo &amp; Number</div>
      <div class="p-4">
        <div class="flex items-center gap-5">
          <div class="relative shrink-0">
            <div id="plr-photo-wrap" class="w-16 h-16 rounded-full overflow-hidden bg-admin-border flex items-center justify-center">
              ${player.picture_url
                ? `<img src="/api/player/${escHtml(player.id)}/photo" class="w-full h-full object-cover object-top" alt="">`
                : `<span class="text-xl font-extrabold text-slate-500">${escHtml(initials)}</span>`}
            </div>
            <label for="plr-photo-input" title="Change photo" class="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-brand flex items-center justify-center cursor-pointer border-2 border-admin-bg">
              <svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4.5A1.5 1.5 0 0 1 2.5 3h.68L4.1 1.5h5.8L10.82 3H11.5A1.5 1.5 0 0 1 13 4.5v6A1.5 1.5 0 0 1 11.5 12h-9A1.5 1.5 0 0 1 1 10.5v-6z"/><circle cx="7" cy="7.5" r="2"/></svg>
            </label>
            <input type="file" id="plr-photo-input" accept="image/*" class="hidden">
          </div>
          <div>
            <label class="admin-field-label">Jersey Number</label>
            <input type="text" id="val-number" class="admin-input mt-1.5" value="${escHtml(player.number || '')}"
              placeholder="e.g. 23" style="width:80px;text-align:center;font-size:20px;font-weight:700">
          </div>
          <div id="photo-msg" class="text-xs text-slate-500"></div>
        </div>
      </div>
    </div>

    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Bio</div>
      <div class="p-4">
        <label class="admin-field-label">Writeup</label>
        <textarea id="val-writeup" class="admin-input mt-1.5" rows="5" style="resize:vertical">${escHtml(player.writeup || '')}</textarea>
      </div>
    </div>

    ${isSuperAdmin ? `<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">URL Slug</div>
      <div class="p-4">
        <label class="admin-field-label">Player URL</label>
        <div class="flex items-center gap-2 mt-1.5">
          <span class="text-[11px] text-slate-500 shrink-0">/players/</span>
          <input type="text" id="slug-input" class="admin-input flex-1" value="${escHtml(currentSlug || '')}" placeholder="e.g. juan-dela-cruz">
          <button onclick="saveSlug()" class="admin-btn" style="white-space:nowrap">Save</button>
        </div>
        <div id="slug-msg" class="text-[11px] mt-1.5 text-slate-500"></div>
      </div>
    </div>` : ''}

    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Profile</div>
      <div class="p-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          ${field('First Name',    'val-first_name',    d.first_name)}
          ${field('Last Name',     'val-last_name',     d.last_name)}
          ${field('Nickname',      'val-nickname',      d.nickname)}
          ${field('Hometown',      'val-hometown',      d.hometown)}
          ${field('School',        'val-school',        d.school)}
          ${field('Height',        'val-height',        d.height,        'e.g. 6\'2"')}
          ${field('Weight',        'val-weight',        d.weight,        'e.g. 185 lbs')}
          ${field('Wingspan',      'val-wingspan',      d.wingspan)}
          ${field('Dominant Hand', 'val-dominant_hand', d.dominant_hand, 'Left / Right')}
          ${field('Years Playing', 'val-years_playing', d.years_playing)}
          ${field('Instagram',     'val-social_instagram', d.social_instagram, '@handle')}
          ${field('Twitter / X',   'val-social_twitter',   d.social_twitter,   '@handle')}
        </div>
        <label class="admin-field-label">Positions</label>
        <div class="mt-2">${posOpts}</div>
      </div>
    </div>

  </div>

  <!-- ── Sidebar ──────────────────────────────────────────────────────────── -->
  <div class="flex flex-col gap-4">

    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="px-4 py-3 border-b border-admin-border text-[10px] font-bold uppercase tracking-widest text-slate-500">Player</div>
      <div class="p-4">
        <div class="mb-3">
          <label class="admin-field-label">Team</label>
          <select id="val-team" class="admin-input mt-1">
            <option value="">— No Team —</option>
            ${teamOpts}
          </select>
        </div>
        <div>
          <label class="admin-field-label">Status</label>
          <select id="val-status" class="admin-input mt-1">
            <option value="active"${!isInactive ? ' selected' : ''}>Active</option>
            <option value="inactive"${isInactive ? ' selected' : ''}>Inactive</option>
          </select>
        </div>
      </div>
    </div>

    <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">
      <div class="flex items-center justify-between px-4 py-3 border-b border-admin-border">
        <span class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Ratings</span>
        <button id="plr-recompute" class="admin-btn admin-btn--sm">${ICON_RECOMPUTE} Recompute</button>
      </div>
      <div class="p-4">

        ${seasons.length ? `<div class="flex flex-wrap gap-1 mb-3">
          <a href="/admin/players/${escHtml(player.id)}" class="agm-pill${!season ? ' is-active' : ''}" style="font-size:11px">All</a>
          ${seasonPills}
        </div>` : ''}

        <div class="flex items-baseline gap-2.5 mb-2">
          <span class="font-saira font-extrabold leading-none" style="font-size:40px;color:${ovrColor_}">${effOvr ?? '—'}</span>
          <span class="text-[11px] text-slate-500 font-semibold uppercase tracking-widest">OVR</span>
          ${effOvr != null ? `<span class="text-[11px] text-slate-500">${escHtml(player.team_name || '')}</span>` : ''}
        </div>

        ${statsGrid}

        <form id="ratings-form" class="mt-1.5">
          <div class="text-[10px] text-slate-500 text-right pb-1 pt-2">Calc → Override</div>
          ${attrRows}
          <div class="flex items-center gap-2.5 py-2.5">
            <div class="flex-1 text-[11px] font-semibold text-slate-300 uppercase tracking-wide">Overall Override</div>
            <input type="number" name="overall_ovr" min="1" max="99" placeholder="—"
              value="${rating?.overall_ovr ?? ''}"
              class="admin-input" style="width:44px;padding:3px 5px;font-size:12px;text-align:center">
          </div>
          <span id="ratings-msg" class="text-xs block mb-2"></span>
          <button type="submit" class="agm-new-btn admin-btn--block">${ICON_CHECK} Save Ratings</button>
        </form>
      </div>
    </div>

  </div>
</div>

<div class="pcp-backdrop" id="pcp-backdrop" hidden>
  <div class="pcp-modal">
    <div class="pcp-modal__header">
      <span class="pcp-modal__title">Crop Photo</span>
      <button class="pcp-modal__close" id="pcp-close">&#x2715;</button>
    </div>
    <div class="pcp-modal__body">
      <img id="pcp-img" src="" alt="" style="max-width:100%;display:block">
    </div>
    <div class="pcp-modal__footer">
      <button class="admin-btn" id="pcp-cancel">${ICON_X} Cancel</button>
      <button class="agm-new-btn" id="pcp-save">${ICON_CHECK} Crop &amp; Save</button>
    </div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.min.js"><\/script>
<script>
  var PLAYER_ID = '${escHtml(player.id)}';
  var SEASON    = '${escHtml(String(season ?? ''))}';

  // ── Photo crop modal ──────────────────────────────────────────────────────
  (function() {
    var fileInput = document.getElementById('plr-photo-input');
    var backdrop  = document.getElementById('pcp-backdrop');
    var cropImg   = document.getElementById('pcp-img');
    var saveBtn   = document.getElementById('pcp-save');
    var saveBtnOrigHtml = saveBtn.innerHTML;
    var cropper   = null;

    function openCrop(src) {
      cropImg.src = src;
      backdrop.hidden = false;
      document.body.style.overflow = 'hidden';
      if (cropper) { cropper.destroy(); }
      cropper = new Cropper(cropImg, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 0.85,
        guides: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
      });
    }

    function closeCrop() {
      backdrop.hidden = true;
      document.body.style.overflow = '';
      if (cropper) { cropper.destroy(); cropper = null; }
      fileInput.value = '';
      saveBtn.disabled = false;
      saveBtn.innerHTML = saveBtnOrigHtml;
    }

    fileInput.addEventListener('change', function() {
      var file = this.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(e) { openCrop(e.target.result); };
      reader.readAsDataURL(file);
    });

    document.getElementById('pcp-close').addEventListener('click', closeCrop);
    document.getElementById('pcp-cancel').addEventListener('click', closeCrop);
    backdrop.addEventListener('click', function(e) { if (e.target === backdrop) closeCrop(); });

    saveBtn.addEventListener('click', function() {
      if (!cropper) return;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      var canvas = cropper.getCroppedCanvas({ width: 400, height: 400, imageSmoothingQuality: 'high' });
      var dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      var msg = document.getElementById('photo-msg');
      fetch('/admin/players/' + PLAYER_ID + '/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: dataUrl })
      }).then(function(r) {
        if (!r.ok) throw new Error('failed');
        var wrap = document.getElementById('plr-photo-wrap');
        wrap.innerHTML = '';
        var img = document.createElement('img');
        img.src = '/api/player/' + PLAYER_ID + '/photo?t=' + Date.now();
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;object-position:top';
        wrap.appendChild(img);
        msg.style.color = '#22c55e';
        msg.textContent = 'Photo saved.';
        closeCrop();
      }).catch(function() {
        msg.style.color = '#f87171';
        msg.textContent = 'Upload failed.';
        saveBtn.disabled = false;
        saveBtn.innerHTML = saveBtnOrigHtml;
      });
    });
  })();

  // ── Single save (bio + number + profile + team + status) ──────────────────
  document.getElementById('plr-save-all').addEventListener('click', async function() {
    var btn = this;
    var origHtml = btn.innerHTML;
    var msg = document.getElementById('save-msg');
    btn.disabled = true; btn.textContent = 'Saving…';
    msg.className = 'agm-save-msg'; msg.textContent = '';

    var positions = [...document.querySelectorAll('.pos-check:checked')].map(function(c){ return c.value; });
    var body = {
      first_name:       document.getElementById('val-first_name').value.trim(),
      last_name:        document.getElementById('val-last_name').value.trim(),
      number:           document.getElementById('val-number').value.trim(),
      writeup:          document.getElementById('val-writeup').value,
      team_id:          document.getElementById('val-team').value,
      status:           document.getElementById('val-status').value,
      nickname:         document.getElementById('val-nickname').value,
      hometown:         document.getElementById('val-hometown').value,
      school:           document.getElementById('val-school').value,
      height:           document.getElementById('val-height').value,
      weight:           document.getElementById('val-weight').value,
      wingspan:         document.getElementById('val-wingspan').value,
      dominant_hand:    document.getElementById('val-dominant_hand').value,
      years_playing:    document.getElementById('val-years_playing').value,
      social_instagram: document.getElementById('val-social_instagram').value,
      social_twitter:   document.getElementById('val-social_twitter').value,
      positions:        positions,
    };

    try {
      var r = await fetch('/admin/players/' + PLAYER_ID + '/bio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      msg.className = 'agm-save-msg agm-save-msg--ok';
      msg.textContent = 'Saved.';
    } catch(err) {
      msg.className = 'agm-save-msg agm-save-msg--err';
      msg.textContent = err.message;
    } finally { btn.disabled = false; btn.innerHTML = origHtml; }
  });

  // ── Ratings overrides save ────────────────────────────────────────────────
  document.getElementById('ratings-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    var btn = e.target.querySelector('[type=submit]');
    var origHtml = btn.innerHTML;
    var msg = document.getElementById('ratings-msg');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      var r = await fetch('/admin/players/' + PLAYER_ID + '/ratings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...Object.fromEntries(new FormData(e.target)), season: SEASON })
      });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      msg.style.color = '#22c55e'; msg.textContent = 'Saved. Reloading…';
      setTimeout(function(){ location.reload(); }, 600);
    } catch(err) {
      msg.style.color = '#f87171'; msg.textContent = err.message;
      btn.disabled = false; btn.innerHTML = origHtml;
    }
  });

  // ── Slug save ────────────────────────────────────────────────────────────
  window.saveSlug = async function() {
    var input = document.getElementById('slug-input');
    var msg   = document.getElementById('slug-msg');
    if (!input) return;
    var slug = input.value.trim();
    if (!slug) { msg.style.color = '#f87171'; msg.textContent = 'Slug cannot be empty.'; return; }
    try {
      var r = await fetch('/admin/players/' + PLAYER_ID + '/slug', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      input.value = j.slug;
      msg.style.color = '#4ade80'; msg.textContent = 'Saved ✓ — new URL: /players/' + j.slug;
      setTimeout(function() { msg.textContent = ''; }, 4000);
    } catch(err) {
      msg.style.color = '#f87171'; msg.textContent = err.message;
    }
  };

  // ── Recompute ─────────────────────────────────────────────────────────────
  document.getElementById('plr-recompute').addEventListener('click', async function() {
    var btn = this; btn.disabled = true; btn.style.opacity = '0.6';
    var msg = document.getElementById('ratings-msg');
    try {
      var r = await fetch('/admin/players/' + PLAYER_ID + '/recompute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season: SEASON })
      });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      msg.style.color = '#22c55e'; msg.textContent = 'Recomputed. Reloading…';
      setTimeout(function(){ location.reload(); }, 600);
    } catch(err) {
      msg.style.color = '#f87171'; msg.textContent = err.message;
      btn.disabled = false; btn.style.opacity = '';
    }
  });
</script>`;
}
