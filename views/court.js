// Public court pages: /courts (every court with a page) and /courts/:slug. Data comes from
// lib/court-page.js buildCourtPage; styles in public/courts.css. Mockup:
// https://claude.ai/artifact/F6TwMXGhU9er4iS1Hv4bo9 (page + "A · Tabs (animated)" stats).
import { escHtml } from './layout.js';
import { playerAvatar } from './utils.js';
import { gameCard, gameCardScript } from './games.js';
import { COURT_INFO_FIELDS } from '../lib/court-page.js';

const MESSENGER_URL = 'https://m.me/wkndbasketball';
const ymdLabel = (ymd, opts) => new Date(`${ymd}T00:00:00`).toLocaleDateString('en-US', opts);
const ICON = {
  pin: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  out: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>',
  chart: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>',
  prev: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  next: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
};
const mapsHref = c => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address || `${c.name} ${c.city || ''}`)}`;
const fmtStat = (s) => {
  if (s.n == null) return '—';
  const n = s.n;
  switch (s.f) {
    case 'pct': return `${Math.round(n)}%`;
    case 'peso': return `₱${Math.round(n)}+`;
    case 'peso0': return `₱${Math.round(n)}`;
    case 'dh': return `${Math.floor(n / 24)}d ${Math.round(n % 24)}h`;
    case 'h': return `${n}h`;
    case 'of': return `${n}/${s.of}`;
    default: return String(Math.round(n * 10) / 10);
  }
};

function hero(p, court) {
  const facts = [
    p.playedRuns ? [String(p.playedRuns), `Papawis run${p.playedRuns === 1 ? '' : 's'} played`] : null,
    p.players ? [String(p.players), 'players have run here'] : null,
    p.finalsCount ? [String(p.finalsCount), `league game${p.finalsCount === 1 ? '' : 's'}`] : null,
    p.avgPrice ? [`₱${p.avgPrice}+`, 'avg per player'] : null,
  ].filter(Boolean).slice(0, 3);
  const bg = p.photos[0] ? `<img class="crt-hero__img" src="${escHtml(p.photos[0].src)}" alt="${escHtml(p.photos[0].alt)}" fetchpriority="high">` : '';
  return `<section class="crt-hero${bg ? '' : ' crt-hero--plain'}" aria-label="Court">
    ${bg}<div class="crt-hero__shade"></div>
    <div class="crt-hero__in">
      <nav class="crt-crumbs" aria-label="Breadcrumb"><a href="/papawis">Papawis</a><span aria-hidden="true">/</span><a href="/courts">Courts</a></nav>
      <span class="crt-kicker">Basketball court${p.city ? ` · ${escHtml(p.city)}` : ''}</span>
      <h1 class="crt-h1">${escHtml(p.name)}</h1>
      ${court.address ? `<p class="crt-addr">${ICON.pin}<span>${escHtml(court.address)}</span></p>` : ''}
      <div class="crt-hero__row">
        ${facts.map(([v, l]) => `<div class="crt-fact"><b class="font-condensed">${escHtml(v)}</b><span>${escHtml(l)}</span></div>`).join('')}
        <a class="crt-btn crt-btn--ghost" href="${escHtml(mapsHref(court))}" target="_blank" rel="noopener">Get directions ${ICON.out}</a>
      </div>
    </div>
  </section>`;
}

function about(court) {
  if (!court.writeup) return '';
  const paras = String(court.writeup).split(/\n{2,}/).map(t => t.trim()).filter(Boolean);
  return `<section class="crt-sec" aria-labelledby="crt-about-h">
    <div class="section-header"><h2 id="crt-about-h">About this court</h2></div>
    <div class="crt-about">${paras.map(t => `<p>${escHtml(t)}</p>`).join('')}</div>
  </section>`;
}

function nextRun(p) {
  const r = p.nextRun;
  if (!r) return '';
  const max = Number(r.max_slots) || 0;
  const full = max && r.confirmed >= max;
  const pct = max ? Math.min(100, Math.round(r.confirmed / max * 100)) : 0;
  return `<section class="crt-sec" aria-labelledby="crt-next-h">
    <div class="section-header"><h2 id="crt-next-h">Next run here</h2><a class="section-header__link" href="/papawis">All Papawis runs</a></div>
    <div class="card crt-next">
      <div class="crt-date"><span>${escHtml(ymdLabel(r.ymd, { month: 'short' }).toUpperCase())}</span><b class="font-condensed">${escHtml(ymdLabel(r.ymd, { day: 'numeric' }))}</b></div>
      <div class="crt-next__body">
        <b>${escHtml(ymdLabel(r.ymd, { weekday: 'long' }))}${r.time ? ` · ${escHtml(r.time)}` : ''}</b>
        <span class="crt-muted">Papawis pickup run · first come, first served</span>
        ${max ? `<div class="crt-meter"><i style="width:${pct}%"></i></div><span class="crt-meter__lbl">${r.confirmed} / ${max}${full ? ' · full, waitlist open' : ' · slots open'}</span>` : ''}
      </div>
      <a class="crt-btn crt-btn--amber" href="/papawis#pw-game-${encodeURIComponent(r.id)}">${full ? 'Join the waitlist' : 'Sign up'} &rarr;</a>
    </div>
  </section>`;
}

function pastRuns(p) {
  if (!p.pastRuns.length) return '';
  return `<section class="crt-sec" aria-labelledby="crt-past-h">
    <div class="section-header"><h2 id="crt-past-h">Past runs here <span class="section-header__sub">${p.pastRuns.length} played${p.cancelled ? ` · ${p.cancelled} cancelled` : ''}</span></h2></div>
    <div class="card crt-list">${p.pastRuns.slice(0, 8).map(r => `<a class="crt-row" href="/papawis#pw-game-${encodeURIComponent(r.id)}">
        <span class="crt-row__day font-condensed">${escHtml(ymdLabel(r.ymd, { month: 'short', day: 'numeric' }).toUpperCase())}</span>
        <span class="crt-row__main"><b>${escHtml(ymdLabel(r.ymd, { weekday: 'long' }))}${r.time ? ` · ${escHtml(r.time)}` : ''}</b><small>${r.players} played</small></span>
        <span class="crt-row__go">Teams &amp; who played &rarr;</span>
      </a>`).join('')}</div>
  </section>`;
}

function gallery(p) {
  if (!p.photos.length) return '';
  const first = p.photos[0];
  const many = p.photos.length > 1;
  return `<section class="crt-sec" aria-labelledby="crt-gal-h" data-crt-gallery>
    <div class="section-header"><h2 id="crt-gal-h">Gallery <span class="section-header__sub">${p.photos.length} photo${p.photos.length === 1 ? '' : 's'}</span></h2></div>
    <div class="crt-stage">
      <img class="crt-stage__img" src="${escHtml(first.src)}" alt="${escHtml(first.alt)}" loading="lazy" data-stage-img>
      <div class="crt-stage__cap"><span class="crt-kicker" data-stage-tag>${escHtml(first.tag)}</span><b data-stage-cap>${escHtml(first.caption)}</b></div>
      ${many ? `<span class="crt-stage__pos font-condensed" data-stage-pos>1 / ${p.photos.length}</span>
      <button type="button" class="crt-stage__nav crt-stage__nav--prev" aria-label="Previous photo" data-stage-step="-1">${ICON.prev}</button>
      <button type="button" class="crt-stage__nav crt-stage__nav--next" aria-label="Next photo" data-stage-step="1">${ICON.next}</button>` : ''}
    </div>
    ${many ? `<div class="crt-thumbs">${p.photos.map((x, i) => `<button type="button" class="crt-thumb${i ? '' : ' is-on'}" aria-label="${escHtml(x.alt)}" aria-pressed="${i ? 'false' : 'true'}" data-thumb="${i}" data-src="${escHtml(x.src)}" data-alt="${escHtml(x.alt)}" data-tag="${escHtml(x.tag)}" data-cap="${escHtml(x.caption)}"><img src="${escHtml(x.src)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
  </section>`;
}

// "Stats for nerds", variant A: tabs, counting numbers, growing bars. Fixed height on every
// tab; values render server-side (works without JS), the script animates them in.
function stats(p) {
  if (!p.tabs.length) return '';
  const tab = (t, i) => {
    const max = Math.max(1, ...t.bars.map(b => b.v));
    return `<div class="crt-nerd__panel" role="tabpanel" id="crt-tab-${i}" aria-labelledby="crt-tabbtn-${i}"${i ? ' hidden' : ''}>
      <div class="crt-nerd__grid">
        ${t.stats.map(s => `<div class="crt-nerd__stat"><b class="font-condensed" data-count="${s.n ?? ''}" data-fmt="${escHtml(s.f || 'int')}" data-of="${s.of ?? ''}">${escHtml(fmtStat(s))}</b><span>${escHtml(s.label)}</span><small>${escHtml(s.sub || '')}</small></div>`).join('')}
        <div class="crt-nerd__chart">
          <span class="crt-nerd__chartlbl">${escHtml(t.chart)}</span>
          ${t.bars.length ? `<div class="crt-bars">${t.bars.slice(-6).map(b => `<div class="crt-bar"><em class="font-condensed" data-count="${b.v}" data-fmt="${escHtml(t.bf)}">${escHtml(fmtStat({ n: b.v, f: t.bf }))}</em><i data-h="${Math.max(4, Math.round(b.v / max * 44))}" style="height:${Math.max(4, Math.round(b.v / max * 44))}px"${b.v === max ? ' class="is-top"' : ''}></i><small>${escHtml(b.d)}</small></div>`).join('')}</div>`
            : '<div class="crt-nerd__empty">Fills in once league games are set to this court.</div>'}
        </div>
      </div>
      <p class="crt-nerd__line"><i aria-hidden="true"></i><span>${escHtml(t.line)}</span></p>
    </div>`;
  };
  return `<section class="crt-sec" aria-labelledby="crt-nerd-h">
    <div class="crt-nerd" data-crt-nerd>
      <div class="crt-nerd__head">
        <div><span class="crt-kicker">Stats for nerds</span><h2 id="crt-nerd-h">${escHtml(p.name)} by the numbers</h2></div>
        <div class="crt-tabs" role="tablist" aria-label="Stat groups"><span class="crt-tabs__pill" aria-hidden="true"></span>
          ${p.tabs.map((t, i) => `<button type="button" role="tab" id="crt-tabbtn-${i}" aria-controls="crt-tab-${i}" aria-selected="${i ? 'false' : 'true'}" data-tab="${i}">${escHtml(t.label)}</button>`).join('')}
        </div>
      </div>
      ${p.tabs.map(tab).join('')}
    </div>
  </section>`;
}

function league(p, games, extras) {
  if (!games.length) return '';
  return `<section class="crt-sec" aria-labelledby="crt-league-h">
    <div class="section-header"><h2 id="crt-league-h">League games here <span class="section-header__sub">WKND Basketball League</span></h2><a class="section-header__link" href="/games">All games</a></div>
    <div class="crt-games">${games.map(g => gameCard(g, { commentsEnabled: extras.commentsEnabled, social: extras.socialByGame?.[g.id] || { commentsCount: 0, reactCount: 0, reacted: false }, topScorer: extras.topScorerByGame?.[g.id], odds: extras.oddsByGame?.[g.id] || null })).join('')}</div>
  </section>`;
}

function courtCard(p, court) {
  const info = p.info || {};
  const rows = COURT_INFO_FIELDS.filter(f => info[f.key] && (!f.adminOnly || info.contact_public)).map(f => [f.label, info[f.key]]);
  return `<section class="crt-sec" aria-labelledby="crt-court-h">
    <div class="section-header"><h2 id="crt-court-h">The court</h2></div>
    <div class="card crt-court">
      <a href="${escHtml(mapsHref(court))}" target="_blank" rel="noopener" class="crt-map"><img src="/api/papawis-map/photo?loc=${encodeURIComponent(court.address || court.name)}" alt="Map showing ${escHtml(p.name)}${p.city ? `, ${escHtml(p.city)}` : ''}" loading="lazy" onerror="this.parentNode.remove()"></a>
      <dl class="crt-dl">
        ${court.address ? `<div><dt>Address</dt><dd>${escHtml(court.address)}</dd></div>` : ''}
        ${p.city ? `<div><dt>City</dt><dd>${escHtml(p.city)}</dd></div>` : ''}
        ${rows.map(([k, v]) => `<div><dt>${escHtml(k)}</dt><dd>${escHtml(v)}</dd></div>`).join('')}
      </dl>
      <a class="crt-link" href="${escHtml(mapsHref(court))}" target="_blank" rel="noopener">Open in Google Maps ${ICON.out}</a>
    </div>
  </section>`;
}

function regulars(p) {
  if (!p.regulars.length) return '';
  return `<section class="crt-sec" aria-labelledby="crt-reg-h">
    <div class="section-header"><h2 id="crt-reg-h">Regulars <span class="section-header__sub">most runs here</span></h2></div>
    <div class="card crt-list">${p.regulars.map(r => `<a class="crt-reg" href="/players/${encodeURIComponent(r.slug)}">
        ${playerAvatar(r.id, r.name, 'rgba(255,255,255,0.14)', { className: 'crt-reg__av' })}
        <b>${escHtml(r.name)}</b><small>${r.runs} run${r.runs === 1 ? '' : 's'}</small>
      </a>`).join('')}</div>
  </section>`;
}

function playHere(isLoggedIn) {
  return `<section class="card crt-cta" aria-label="Play here">
    <span class="crt-kicker">Play here</span>
    <b class="crt-cta__h">Weekend basketball in Makati, Mandaluyong and Pasig</b>
    <span class="crt-muted">League seasons with stats and recaps, plus Papawis pickup runs.</span>
    ${isLoggedIn ? '<a class="crt-btn crt-btn--amber" href="/papawis">See Papawis runs &rarr;</a>'
      : `<a class="crt-btn crt-btn--amber" href="/register" data-cta="court-join">Join the next season &rarr;</a>
         <a class="crt-link crt-link--center" href="${MESSENGER_URL}" target="_blank" rel="noopener" data-cta="court-messenger">Questions? Message us</a>`}
  </section>`;
}

const SCRIPT = `<script>
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Gallery: thumbnails and arrows swap the main scene.
  document.querySelectorAll('[data-crt-gallery]').forEach(function (g) {
    var thumbs = [].slice.call(g.querySelectorAll('[data-thumb]'));
    if (!thumbs.length) return;
    var img = g.querySelector('[data-stage-img]'), i = 0;
    function show(n) {
      i = (n + thumbs.length) % thumbs.length;
      var t = thumbs[i];
      img.classList.add('is-swap');
      setTimeout(function () {
        img.src = t.dataset.src; img.alt = t.dataset.alt;
        g.querySelector('[data-stage-tag]').textContent = t.dataset.tag;
        g.querySelector('[data-stage-cap]').textContent = t.dataset.cap;
        g.querySelector('[data-stage-pos]').textContent = (i + 1) + ' / ' + thumbs.length;
        img.classList.remove('is-swap');
      }, reduce ? 0 : 160);
      thumbs.forEach(function (b, k) { b.classList.toggle('is-on', k === i); b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
    }
    thumbs.forEach(function (b, k) { b.addEventListener('click', function () { show(k); }); });
    g.querySelectorAll('[data-stage-step]').forEach(function (b) { b.addEventListener('click', function () { show(i + Number(b.dataset.stageStep)); }); });
  });
  // Stats: tabs with a sliding pill; numbers count up and bars grow on view and on tab change.
  function fmt(v, f, of) {
    if (f === 'pct') return Math.round(v) + '%';
    if (f === 'peso') return '\\u20b1' + Math.round(v) + '+';
    if (f === 'peso0') return '\\u20b1' + Math.round(v);
    if (f === 'dh') { var h = Math.round(v); return Math.floor(h / 24) + 'd ' + (h % 24) + 'h'; }
    if (f === 'h') return Math.round(v) + 'h';
    if (f === 'of') return Math.round(v) + '/' + of;
    return String(Math.round(v));
  }
  function animate(panel) {
    var nums = [].slice.call(panel.querySelectorAll('[data-count]')).filter(function (el) { return el.dataset.count !== ''; });
    var bars = [].slice.call(panel.querySelectorAll('[data-h]'));
    panel.classList.remove('is-in'); void panel.offsetWidth; panel.classList.add('is-in');
    if (reduce) return;
    var t0 = performance.now(), dur = 700;
    function step(now) {
      var x = Math.min(1, (now - t0) / dur), p = 1 - Math.pow(1 - x, 3);
      nums.forEach(function (el) { el.textContent = fmt(Number(el.dataset.count) * p, el.dataset.fmt, el.dataset.of); });
      bars.forEach(function (el) { el.style.height = Math.max(4, Math.round(Number(el.dataset.h) * p)) + 'px'; });
      if (x < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  document.querySelectorAll('[data-crt-nerd]').forEach(function (box) {
    var btns = [].slice.call(box.querySelectorAll('[data-tab]'));
    var panels = [].slice.call(box.querySelectorAll('[role=tabpanel]'));
    var pill = box.querySelector('.crt-tabs__pill');
    function place(b) { pill.style.width = b.offsetWidth + 'px'; pill.style.transform = 'translateX(' + (b.offsetLeft - 4) + 'px)'; }
    function select(k, focus) {
      btns.forEach(function (b, j) { b.setAttribute('aria-selected', j === k ? 'true' : 'false'); b.tabIndex = j === k ? 0 : -1; });
      panels.forEach(function (p, j) { p.hidden = j !== k; });
      place(btns[k]); animate(panels[k]); if (focus) btns[k].focus();
    }
    btns.forEach(function (b, k) {
      b.tabIndex = k ? -1 : 0;
      b.addEventListener('click', function () { select(k); });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); select((k + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length, true); }
      });
    });
    place(btns[0]);
    window.addEventListener('resize', function () { var on = btns.filter(function (b) { return b.getAttribute('aria-selected') === 'true'; })[0]; if (on) place(on); });
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); animate(panels[0]); } }, { threshold: 0.35 });
      io.observe(box);
    }
  });
})();
</script>`;

export function courtPage({ court, p, games = [], extras = {}, isLoggedIn = false }) {
  return `<div class="page-content crt">
  ${hero(p, court)}
  <div class="crt-cols">
    <div class="crt-main">
      ${about(court)}
      ${nextRun(p)}
      ${pastRuns(p)}
      ${gallery(p)}
      ${stats(p)}
      ${league(p, games, extras)}
    </div>
    <aside class="crt-side" aria-label="About the court">
      ${courtCard(p, court)}
      ${regulars(p)}
      ${playHere(isLoggedIn)}
    </aside>
  </div>
</div>
${games.length ? gameCardScript() : ''}
${SCRIPT}`;
}

// /courts: every court with a public page, busiest first.
export function courtsIndexPage({ courts }) {
  return `<div class="page-content crt">
  <header class="crt-index__head">
    <span class="crt-kicker">Papawis · League</span>
    <h1 class="crt-h1">Courts</h1>
    <p class="crt-muted">Where WKND plays: pickup runs and league games in Makati, Mandaluyong and Pasig.</p>
  </header>
  <div class="crt-index">${courts.map(({ court, p }) => `<a class="card crt-tile" href="/courts/${encodeURIComponent(court.slug)}">
      <span class="crt-tile__img">${p.photos[0] ? `<img src="${escHtml(p.photos[0].src)}" alt="${escHtml(p.photos[0].alt)}" loading="lazy">` : ''}</span>
      <span class="crt-tile__body">
        <span class="crt-kicker">${escHtml(p.city || 'Metro Manila')}</span>
        <b>${escHtml(p.name)}</b>
        <small>${[p.playedRuns ? `${p.playedRuns} run${p.playedRuns === 1 ? '' : 's'}` : '', p.finalsCount ? `${p.finalsCount} league game${p.finalsCount === 1 ? '' : 's'}` : '', p.players ? `${p.players} players` : ''].filter(Boolean).join(' · ')}</small>
        ${p.nextRun ? `<span class="crt-tile__next">Next run ${escHtml(ymdLabel(p.nextRun.ymd, { weekday: 'short', month: 'short', day: 'numeric' }))}</span>` : ''}
      </span>
    </a>`).join('')}</div>
</div>`;
}
