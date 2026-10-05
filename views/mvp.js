import { escHtml } from './layout.js';
import { displayPlayerName, teamColor, initials } from './utils.js';

const RANK_LABELS = ['', 'FRONTRUNNER', 'CLOSE SECOND', 'IN THE MIX'];

// Admin-only, hidden once playoffs lock every writeup.
function regenBtn(playerId, season, isAdmin, playoffsStarted) {
  if (!isAdmin || playoffsStarted) return '';
  return `<button type="button" class="mvpx-admin-btn mvp-regen-btn" data-pid="${escHtml(String(playerId))}" data-season="${escHtml(String(season))}" title="Regenerate writeup">↺</button>`;
}

// Admin-only photo picker trigger (dialog + script at the bottom of the page).
function photoBtn(c, isAdmin) {
  if (!isAdmin) return '';
  return `<button type="button" class="mvpx-admin-btn mvpx-photo-btn" data-pid="${escHtml(String(c.player.id))}" data-name="${escHtml(displayPlayerName(c.player.name))}">Photo</button>`;
}

// Week-over-week movement pill. prevRank: undefined = no earlier week to compare (render
// nothing), null = wasn't in last week's pool (NEW), number = last week's rank.
// Also used by the homepage MVP card (views/home.js).
export function moveBadge(rank, prevRank) {
  if (prevRank === undefined) return '';
  if (prevRank === null) return `<span class="mvp-move mvp-move--new" title="New this week">NEW</span>`;
  const delta = prevRank - rank;
  const prev  = `<span class="mvp-move__prev">Last week #${prevRank}</span>`;
  if (delta > 0) return `<span class="mvp-move mvp-move--up">▲${delta}</span>${prev}`;
  if (delta < 0) return `<span class="mvp-move mvp-move--down">▼${-delta}</span>${prev}`;
  return `<span class="mvp-move mvp-move--same">–</span>${prev}`;
}

// Movement as plain text: `short` for table cells, otherwise a sentence for the cards.
function moveText(rank, prevRank, short = false) {
  if (prevRank === undefined) return { text: '', cls: '' };
  if (prevRank === null) return { text: short ? 'NEW' : 'New to the race this week', cls: 'is-new' };
  const d = prevRank - rank;
  if (d > 0) return { text: short ? `▲${d}` : `▲${d} from #${prevRank} last week`, cls: 'is-up' };
  if (d < 0) return { text: short ? `▼${-d}` : `▼${-d} from #${prevRank} last week`, cls: 'is-down' };
  return { text: short ? '–' : `Held #${rank} from last week`, cls: 'is-same' };
}

// Initials sit underneath; the photo covers them once it loads and removes itself if it
// 404s. Crop comes from the admin's MVP photo override (object-position + scale).
function photo(c) {
  const p = c.photo || { url: `/api/player/${encodeURIComponent(String(c.player.id))}/photo`, x: 50, y: 50, zoom: 1 };
  const m = p.phone || p;
  // Desktop crop in --x/--y/--z, phone crop in --mx/--my/--mz (the stylesheet swaps them
  // at the phone breakpoint); a different phone photo comes in through <picture>.
  const vars = `--x:${p.x}%;--y:${p.y}%;--z:${p.zoom};--mx:${m.x}%;--my:${m.y}%;--mz:${m.zoom}`;
  const img = `<img class="mvpx-img" src="${escHtml(p.url)}" alt="" loading="lazy" style="${vars}" onerror="this.remove()">`;
  return `<span class="mvpx-ph font-condensed" aria-hidden="true">${escHtml(initials(displayPlayerName(c.player.name)))}</span>
    ${m.url && m.url !== p.url ? `<picture><source media="(max-width: 720px)" srcset="${escHtml(m.url)}">${img}</picture>` : img}`;
}

function perGame(stats) {
  const gp = stats.gp || 1;
  const tsDenom = 2 * ((stats.fga || 0) + 0.44 * (stats.fta || 0));
  return {
    ppg: (stats.pts / gp).toFixed(1),
    rpg: (stats.reb / gp).toFixed(1),
    apg: (stats.ast / gp).toFixed(1),
    spg: (stats.stl / gp).toFixed(1),
    ts:  tsDenom > 0 ? String(Math.round(stats.pts / tsDenom * 100)) : '—',
  };
}

const href = (c) => `/players/${encodeURIComponent(String(c.player.id))}`;

// ── #1 — the big card ─────────────────────────────────────────────────────────
function leadCard(c, ctx) {
  const name  = displayPlayerName(c.player.name);
  const color = teamColor(c.stats.team_name);
  const pg    = perGame(c.stats);
  const move  = moveText(1, c.prevRank);
  const rankNote = (r) => (r && r <= 5 ? `#${r} in league` : '');
  const tiles = [
    ['PPG', pg.ppg, rankNote(c.ranks?.ppg)],
    ['RPG', pg.rpg, rankNote(c.ranks?.rpg)],
    ['APG', pg.apg, rankNote(c.ranks?.apg)],
    ['SPG', pg.spg, rankNote(c.ranks?.spg)],
    ['TS%', pg.ts,  rankNote(c.ranks?.ts)],
  ];
  return `<div class="mvpx-admin-wrap">
  <a href="${href(c)}" class="mvpx-lead">
    <div class="mvpx-lead__photo">
      ${photo(c)}
      <span class="mvpx-lead__rank font-condensed">1</span>
    </div>
    <div class="mvpx-lead__body">
      <div class="mvpx-lead__top">
        <div class="mvpx-lead__id">
          <span class="mvpx-tags"><span class="mvpx-badge mvpx-badge--solid">${RANK_LABELS[1]}</span>${move.text ? `<span class="mvpx-move ${move.cls}">${escHtml(move.text)}</span>` : ''}</span>
          <span class="mvpx-lead__name">${escHtml(name)}</span>
          <span class="mvpx-team"><span class="team-dot" style="background:${color}"></span>${escHtml(String(c.stats.team_name || '').toUpperCase())} · ${c.stats.gp} GP</span>
        </div>
        <div class="mvpx-lead__score"><b class="font-condensed">${c.mvpScore.toFixed(1)}</b><span>MVP score</span></div>
      </div>
      <div class="mvpx-tiles">
        ${tiles.map(([k, v, note]) => `<div class="mvpx-tile"><b class="font-condensed">${v}</b><span>${k}</span>${note ? `<em>${note}</em>` : ''}</div>`).join('')}
      </div>
      ${c.writeup
        ? `<p class="mvpx-writeup">${escHtml(c.writeup)}</p>`
        : ctx.isAdmin ? `<p class="mvpx-writeup is-muted">Writeup unavailable (AI provider error or quota). Try ↺ later.</p>` : ''}
      <span class="mvpx-cta">Full profile &rarr;</span>
    </div>
  </a>
  <div class="mvpx-admin">${photoBtn(c, ctx.isAdmin)}${regenBtn(c.player.id, ctx.season, ctx.isAdmin, ctx.playoffsStarted)}</div>
</div>`;
}

// ── #2 and #3 ─────────────────────────────────────────────────────────────────
function chaserCard(c, rank, lead, ctx) {
  const name  = displayPlayerName(c.player.name);
  const color = teamColor(c.stats.team_name);
  const pg    = perGame(c.stats);
  const move  = moveText(rank, c.prevRank);
  const gap   = Math.max(0, lead.mvpScore - c.mvpScore).toFixed(1);
  return `<div class="mvpx-admin-wrap">
  <a href="${href(c)}" class="mvpx-chaser">
    <div class="mvpx-chaser__photo">
      ${photo(c)}
      <span class="mvpx-chaser__rank font-condensed">${rank}</span>
    </div>
    <div class="mvpx-chaser__body">
      <div class="mvpx-chaser__top">
        <div class="mvpx-chaser__id">
          <span class="mvpx-tags"><span class="mvpx-badge">${RANK_LABELS[rank]}</span>${move.text ? `<span class="mvpx-move ${move.cls}">${escHtml(move.text)}</span>` : ''}</span>
          <span class="mvpx-chaser__name">${escHtml(name)}</span>
          <span class="mvpx-team"><span class="team-dot" style="background:${color}"></span>${escHtml(String(c.stats.team_name || '').toUpperCase())} · ${c.stats.gp} GP</span>
        </div>
        <div class="mvpx-chaser__score"><b class="font-condensed">${c.mvpScore.toFixed(1)}</b><span>${gap} behind #1</span></div>
      </div>
      <span class="mvpx-line">${pg.ppg} PPG · ${pg.rpg} RPG · ${pg.apg} APG · ${pg.ts}${pg.ts === '—' ? '' : '%'} TS</span>
      ${c.writeup
        ? `<p class="mvpx-writeup mvpx-writeup--sm">${escHtml(c.writeup)}</p>`
        : ctx.isAdmin ? `<p class="mvpx-writeup mvpx-writeup--sm is-muted">Writeup unavailable. Try ↺ later.</p>` : ''}
    </div>
  </a>
  <div class="mvpx-admin">${photoBtn(c, ctx.isAdmin)}${regenBtn(c.player.id, ctx.season, ctx.isAdmin, ctx.playoffsStarted)}</div>
</div>`;
}

// ── #4 onwards — the table ────────────────────────────────────────────────────
function chaseRow(c, rank, lead, ctx) {
  const name  = displayPlayerName(c.player.name);
  const color = teamColor(c.stats.team_name);
  const pg    = perGame(c.stats);
  const move  = moveText(rank, c.prevRank, true);
  const pct   = lead.mvpScore > 0 ? Math.max(4, Math.round(c.mvpScore / lead.mvpScore * 100)) : 0;
  const toggle = c.writeup
    ? `<button type="button" class="mvpx-toggle" aria-expanded="false" aria-label="Read ${escHtml(name)}'s MVP case"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg></button>`
    : '<span></span>';
  return `<div class="mvpx-row">
  <a href="${href(c)}" class="mvpx-row__link" aria-label="${escHtml(name)}"></a>
  <span class="mvpx-row__rank font-condensed">${rank}</span>
  <span class="mvpx-move ${move.cls}">${escHtml(move.text)}</span>
  <span class="mvpx-row__player">
    <span class="mvpx-row__avatar" style="border-color:${color}">${photo(c)}</span>
    <span class="mvpx-row__name">${escHtml(name)}</span>
  </span>
  <span class="mvpx-num mvpx-col-ppg font-condensed">${pg.ppg}</span>
  <span class="mvpx-num mvpx-col-opt font-condensed">${pg.rpg}</span>
  <span class="mvpx-num mvpx-col-opt font-condensed">${pg.apg}</span>
  <span class="mvpx-num mvpx-col-opt font-condensed">${pg.spg}</span>
  <span class="mvpx-num mvpx-col-opt font-condensed">${pg.ts}</span>
  <span class="mvpx-row__score">
    <span class="mvpx-bar"><span style="width:${pct}%"></span></span>
    <b class="font-condensed">${c.mvpScore.toFixed(1)}</b>
  </span>
  <span class="mvpx-row__tools">${photoBtn(c, ctx.isAdmin)}${regenBtn(c.player.id, ctx.season, ctx.isAdmin, ctx.playoffsStarted)}${toggle}</span>
</div>
${c.writeup ? `<div class="mvpx-row-writeup" hidden><p>${escHtml(c.writeup)}</p></div>` : ''}`;
}

function photoDialog(season) {
  return `<dialog class="mvpx-dlg" id="mvpx-photo-dlg" data-season="${escHtml(String(season))}">
  <form method="dialog" class="mvpx-dlg__form">
    <div class="mvpx-dlg__head">
      <h2>MVP Race photo — <span data-dlg-name></span></h2>
      <button type="submit" value="cancel" class="mvpx-dlg__x" aria-label="Close">&times;</button>
    </div>
    <div class="mvpx-dlg__tabs" role="tablist" aria-label="Which screen">
      <button type="button" role="tab" class="mvpx-dlg__tab" data-dlg-tab="desktop" aria-selected="true">Desktop</button>
      <button type="button" role="tab" class="mvpx-dlg__tab" data-dlg-tab="phone" aria-selected="false">Phone</button>
      <span class="mvpx-dlg__tab-note" data-dlg-note></span>
    </div>
    <div class="mvpx-dlg__body">
      <div class="mvpx-dlg__preview"><img data-dlg-preview alt="Preview"></div>
      <div class="mvpx-dlg__side">
        <span class="mvpx-dlg__label">Choose a photo</span>
        <div class="mvpx-dlg__opts" data-dlg-opts><span class="mvpx-dlg__loading">Loading…</span></div>
        <label class="mvpx-dlg__upload">Upload a new photo<input type="file" accept="image/*" data-dlg-file hidden></label>
        <span class="mvpx-dlg__label">Position</span>
        <label class="mvpx-dlg__range">Left / right<input type="range" min="0" max="100" step="1" data-dlg-x></label>
        <label class="mvpx-dlg__range">Up / down<input type="range" min="0" max="100" step="1" data-dlg-y></label>
        <label class="mvpx-dlg__range">Zoom<input type="range" min="1" max="3" step="0.05" data-dlg-zoom></label>
      </div>
    </div>
    <p class="mvpx-dlg__msg" data-dlg-msg></p>
    <div class="mvpx-dlg__actions">
      <button type="button" class="mvpx-dlg__btn" data-dlg-reset>Use profile photo</button>
      <span></span>
      <button type="submit" value="cancel" class="mvpx-dlg__btn">Cancel</button>
      <button type="button" class="mvpx-dlg__btn mvpx-dlg__btn--primary" data-dlg-save>Save</button>
    </div>
  </form>
</dialog>
<script>
(function () {
  var dlg = document.getElementById('mvpx-photo-dlg');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  var season = dlg.dataset.season;
  var $ = function (sel) { return dlg.querySelector(sel); };
  var pv = $('[data-dlg-preview]'), opts = $('[data-dlg-opts]'), msg = $('[data-dlg-msg]'), note = $('[data-dlg-note]');
  var inX = $('[data-dlg-x]'), inY = $('[data-dlg-y]'), inZ = $('[data-dlg-zoom]'), resetBtn = $('[data-dlg-reset]');
  // st.d = desktop, st.m = phone. Phone 'same' shows whatever desktop currently shows.
  var st = {}, data = null;
  function side() { return st.tab === 'phone' ? st.m : st.d; }
  function urlOf(s) { return s.source === 'same' ? st.d.url : s.url; }
  function paint() {
    var s = side();
    dlg.classList.toggle('is-phone', st.tab === 'phone');
    dlg.querySelectorAll('[data-dlg-tab]').forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.dlgTab === st.tab)); });
    note.textContent = st.tab === 'phone'
      ? (st.mReset ? 'Phones will follow desktop (top-weighted crop).' : st.mSet || st.mTouched ? 'Phones use their own settings.' : 'Not set yet — phones follow desktop, cropped toward the top.')
      : '';
    resetBtn.textContent = st.tab === 'phone' ? 'Match desktop' : 'Use profile photo';
    pv.src = urlOf(s);
    pv.style.objectPosition = s.x + '% ' + s.y + '%';
    pv.style.transformOrigin = s.x + '% ' + s.y + '%';
    pv.style.transform = 'scale(' + s.zoom + ')';
    inX.value = s.x; inY.value = s.y; inZ.value = s.zoom;
    opts.querySelectorAll('.mvpx-dlg__opt').forEach(function (b) { b.classList.toggle('is-selected', b.dataset.key === s.source); });
  }
  function touch() { if (st.tab === 'phone') { st.mTouched = true; st.mReset = false; } }
  function addOpt(key, label, url) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'mvpx-dlg__opt'; b.dataset.key = key;
    var img = document.createElement('img'); img.src = url; img.alt = ''; img.loading = 'lazy';
    img.onerror = function () { b.remove(); };
    var span = document.createElement('span'); span.textContent = label;
    b.appendChild(img); b.appendChild(span);
    b.addEventListener('click', function () { var s = side(); s.source = key; s.url = url; s.dataUrl = null; touch(); paint(); });
    opts.appendChild(b);
  }
  function renderOpts() {
    opts.innerHTML = '';
    if (!data) return;
    if (st.tab === 'phone') {
      addOpt('same', 'Same as desktop', st.d.url);
      if (data.phone.currentUrl) addOpt('current', 'Current phone photo', data.phone.currentUrl);
    } else if (data.desktop.currentUrl) {
      addOpt('current', 'Current MVP photo', data.desktop.currentUrl);
    }
    data.options.forEach(function (o) { addOpt(o.key, o.label, o.url); });
    var s = side();
    if (s.source === 'upload' && s.dataUrl) addOpt('upload', 'New upload', s.dataUrl);
  }
  function setTab(t) { st.tab = t; renderOpts(); paint(); }
  function open(pid, name) {
    st = { pid: pid, tab: 'desktop', mTouched: false, mReset: false, mSet: false,
      d: { source: 'profile', url: '', x: 50, y: 50, zoom: 1, dataUrl: null },
      m: { source: 'same', url: '', x: 50, y: 25, zoom: 1, dataUrl: null } };
    data = null;
    $('[data-dlg-name]').textContent = name;
    msg.textContent = '';
    opts.innerHTML = '<span class="mvpx-dlg__loading">Loading…</span>';
    dlg.showModal();
    fetch('/admin/mvp/photo-options?season=' + encodeURIComponent(season) + '&player_id=' + encodeURIComponent(pid))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        data = d;
        var profile = d.options[0].url;
        st.d = { source: d.desktop.source, url: d.desktop.currentUrl || profile, x: d.desktop.offset_x, y: d.desktop.offset_y, zoom: d.desktop.zoom, dataUrl: null };
        st.m = { source: d.phone.source, url: d.phone.source === 'profile' ? profile : (d.phone.currentUrl || ''), x: d.phone.offset_x, y: d.phone.offset_y, zoom: d.phone.zoom, dataUrl: null };
        st.mSet = d.phone.set;
        setTab('desktop');
      })
      .catch(function () { opts.innerHTML = ''; msg.textContent = 'Could not load photos.'; });
  }
  dlg.querySelectorAll('[data-dlg-tab]').forEach(function (t) { t.addEventListener('click', function () { setTab(t.dataset.dlgTab); }); });
  [[inX, 'x'], [inY, 'y'], [inZ, 'zoom']].forEach(function (p) {
    p[0].addEventListener('input', function () { side()[p[1]] = Number(this.value); touch(); paint(); });
  });
  $('[data-dlg-file]').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () { var s = side(); s.source = 'upload'; s.dataUrl = rd.result; s.url = rd.result; touch(); renderOpts(); paint(); };
    rd.readAsDataURL(f);
    this.value = '';
  });
  resetBtn.addEventListener('click', function () {
    if (st.tab === 'phone') {
      st.m = { source: 'same', url: '', x: st.d.x, y: Math.min(st.d.y, 25), zoom: st.d.zoom, dataUrl: null };
      st.mReset = true; st.mTouched = false;
    } else {
      st.d = { source: 'profile', url: data ? data.options[0].url : st.d.url, x: 50, y: 50, zoom: 1, dataUrl: null };
    }
    renderOpts(); paint();
  });
  function payload(s) { return { source: s.source, dataUrl: s.source === 'upload' ? s.dataUrl : null, offset_x: s.x, offset_y: s.y, zoom: s.zoom }; }
  $('[data-dlg-save]').addEventListener('click', function () {
    var btn = this; btn.disabled = true; msg.textContent = 'Saving…';
    fetch('/admin/mvp/photo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season: season, player_id: st.pid, desktop: payload(st.d), phone: st.mReset ? 'reset' : st.mTouched ? payload(st.m) : null })
    }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Save failed'); }); })
      .then(function () { location.reload(); })
      .catch(function (e) { msg.textContent = e.message; btn.disabled = false; });
  });
  document.querySelectorAll('.mvpx-photo-btn').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); open(b.dataset.pid, b.dataset.name); });
  });
})();
</script>`;
}

export function mvpPage({ candidates = [], season, week = null, totalGames, seasonGames, isAdmin = false, playoffsStarted = false }) {
  const kicker = `Season ${escHtml(String(season))}${playoffsStarted ? ' · Final' : week ? ` · After week ${escHtml(String(week))}` : ''}`;
  const head = (side = '') => `<header class="mvpx-head">
    <div class="mvpx-head__main">
      <span class="mvpx-kicker"><span class="mvpx-kicker__dot" aria-hidden="true"></span>${kicker}</span>
      <h1 class="mvpx-title">MVP Race</h1>
    </div>
    ${side}
  </header>`;

  if (!candidates.length) {
    return `<div class="page-content mvpx">
  ${head()}
  <div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">No games played yet this season.</div>
</div>`;
  }

  const totalSlots = seasonGames * 2;
  const pct = totalSlots ? Math.min(100, Math.round(totalGames / totalSlots * 100)) : 0;
  const side = `<div class="mvpx-head__side">
    ${playoffsStarted
      ? `<span class="mvpx-badge mvpx-badge--solid">Season final</span>`
      : `<div class="mvpx-progress">
          <span class="mvpx-progress__label"><span>Regular season</span><span><b>${totalGames}</b> of ${totalSlots} games</span></span>
          <span class="mvpx-progress__bar"><span style="width:${pct}%"></span></span>
        </div>`}
    <details class="mvpx-how">
      <summary>How the score works</summary>
      <p>Per game: points + 0.8×rebounds + 0.9×assists + 1.5×steals + 2×blocks − turnovers. That's then scaled by shooting efficiency (true shooting %), team win rate, and games played, so a hot two-game stretch can't top a full season.</p>
    </details>
    ${isAdmin && !playoffsStarted ? `<button type="button" id="mvp-regen-all" class="mvpx-admin-btn" data-season="${escHtml(String(season))}">↺ Regenerate all</button>` : ''}
  </div>`;

  const ctx = { isAdmin, season, playoffsStarted };
  const lead = candidates[0];
  const chasers = candidates.slice(1, 3);
  const rest = candidates.slice(3);

  const chaseTable = rest.length ? `<section class="mvpx-chase card">
    <div class="mvpx-chase__head"><span>The chase · #4–${rest.length + 3}</span><span class="mvpx-chase__hint">Per game · bar = score vs. #1</span></div>
    <div class="mvpx-row mvpx-row--labels" aria-hidden="true">
      <span>Rk</span><span></span><span>Player</span>
      <span class="mvpx-num mvpx-col-ppg">PPG</span><span class="mvpx-num mvpx-col-opt">RPG</span><span class="mvpx-num mvpx-col-opt">APG</span><span class="mvpx-num mvpx-col-opt">SPG</span><span class="mvpx-num mvpx-col-opt">TS%</span>
      <span class="mvpx-num">Score</span><span></span>
    </div>
    ${rest.map((c, i) => chaseRow(c, i + 4, lead, ctx)).join('')}
  </section>` : '';

  const scripts = `<script>
(function () {
  document.querySelectorAll('.mvpx-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var row = btn.closest('.mvpx-row');
      var panel = row && row.nextElementSibling;
      if (!panel || !panel.classList.contains('mvpx-row-writeup')) return;
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      panel.hidden = open;
      row.classList.toggle('is-expanded', !open);
    });
  });
})();
</script>${isAdmin ? `
<script>
(function () {
  async function regen(pid, season, btn) {
    btn.disabled = true; btn.textContent = '…';
    await fetch('/admin/mvp/regenerate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pid ? { player_id: pid, season: season } : { season: season })
    });
    location.reload();
  }
  document.querySelectorAll('.mvp-regen-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); regen(this.dataset.pid, this.dataset.season, this); });
  });
  var all = document.getElementById('mvp-regen-all');
  if (all) all.addEventListener('click', function () { regen(null, this.dataset.season, this); });
})();
</script>
${photoDialog(season)}` : ''}`;

  return `<div class="page-content mvpx">
  ${head(side)}
  ${leadCard(lead, ctx)}
  ${chasers.length ? `<div class="mvpx-chasers">${chasers.map((c, i) => chaserCard(c, i + 2, lead, ctx)).join('')}</div>` : ''}
  ${chaseTable}
</div>
${scripts}`;
}
