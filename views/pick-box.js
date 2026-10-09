import { escHtml } from './layout.js';
import { teamColor } from './utils.js';
import { gameSlug } from '../lib/slugs.js';

// ── "Who wins?" pick box — one component for every surface that takes a pick ──────────
// The homepage widget, /games Up next, /picks (Open picks + each game's preview), the game
// detail page and the player's own profile all render pickBox() and share pickBoxScript(),
// so a pick made anywhere looks and behaves the same.
//
// The pick is one bar (Paolo, 2026-10-09: the "seam badge" mockup). Two tap halves, always
// 50/50, so the badge between them lines up with the homepage face-off's VS. Behind them the
// team colours split where the fans do, with a lit break on the seam; the break is clamped
// in from each end (--safe in CSS) so it never runs under a team's name or count. Picked:
// your side fills brighter + ✓, the other dims; tap yours to cancel, the other to switch.
// The badge in the middle is the action: pick total → "Who picked" list, your face once
// you've picked, a lock once closed, "Log in" for guests. The box keeps its exact height
// in every state.
//
// Data shape (server.js openPicks()):
//   { id, a, b, ymd, counts: {a,b}, myPick: 'a'|'b'|null, closed, odds: {pctA,pctB,fav}|null,
//     pickers: { a: [face], b: [face] } | null, recA, recB, h2h, href }
// pickers: logged-in players only (Paolo, 2026-10-08: they see who picked before picking);
// guests never get names or faces. face = { id, name, ini, color, me }

// The full matchup preview for a game — /picks/<slug>. Takes a pick-shaped game ({ id, a, b })
// or a games row.
export function previewHref(g) {
  return `/picks/${encodeURIComponent(gameSlug({ id: g.id, team_a_name: g.a ?? g.team_a_name, team_b_name: g.b ?? g.team_b_name }))}`;
}

// Team colours on the tiles and the odds edge are Paolo's call (an exception to "team colours
// = dots/chips only"). Black is too dark on the cards, so it gets a lighter slate.
const edgeColor = team => (String(team).toUpperCase() === 'BLACK' ? '#8a94a6' : teamColor(team));

const tcase = s => String(s || '').charAt(0) + String(s || '').slice(1).toLowerCase();
const dot = (name, size = 9) => `<span class="team-dot" style="background:${teamColor(name)};width:${size}px;height:${size}px"></span>`;
const CHECK_SVG = '<svg class="pkt__check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
const LOCK_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

// How the bar splits and how strong each colour runs. Shared with the browser
// (pickBoxScript injects its source) so a pick redraws exactly as the server would.
// Under SPLIT_MIN picks the bar holds at 50/50 — one early vote shouldn't paint it 100/0.
function pickBarState(counts, mine, closed) {
  var SPLIT_MIN = 5;
  var t = counts.a + counts.b, early = t > 0 && t < SPLIT_MIN;
  var share = !t || early ? 0.5 : counts.a / t;
  function side(s, sh) {
    var me = mine === s, other = !!mine && !me;
    return {
      k1: me ? 60 : other ? Math.round(8 + 18 * sh) : Math.round(10 + 30 * sh),
      k2: me ? 30 : Math.round(3 + 9 * sh),
      sub: me ? 'Your pick' : !t ? 'No picks yet' : early ? 'Early picks' : Math.round(sh * 100) + '% of fans',
    };
  }
  return {
    total: t, split: Math.round(share * 1000) / 10,
    lead: !t || early || share === 0.5 ? '' : share > 0.5 ? 'a' : 'b',
    a: side('a', share), b: side('b', 1 - share), closed: !!closed,
  };
}
const barVars = st => `--split:${st.split}%;--ka1:${st.a.k1}%;--ka2:${st.a.k2}%;--kb1:${st.b.k1}%;--kb2:${st.b.k2}%`;

function face(p, size = 22) {
  return `<span class="pk-av${p.me ? ' pk-av--me' : ''}" style="--team:${escHtml(p.color)};width:${size}px;height:${size}px" title="${escHtml(p.me ? 'You' : p.name)}">
      <span class="pk-av__init">${escHtml(p.ini)}</span>
      <img src="/api/player/${encodeURIComponent(p.id)}/photo" alt="" loading="lazy" onerror="this.remove()">
    </span>`;
}

// The odds as a thin two-colour edge — each side as wide as its chance, the favourite glowing
// a little more. Sits on the bottom of a header (pick cards) or a photo banner (/games).
export function oddsEdge(a, b, odds) {
  if (!odds) return '';
  return `<div class="pkb-edge" role="img" aria-label="Odds: ${escHtml(tcase(a))} ${odds.pctA}%, ${escHtml(tcase(b))} ${odds.pctB}%"><i class="${odds.fav === 'a' ? 'is-fav' : ''}" style="width:${odds.pctA}%;--c:${edgeColor(a)}"></i><i class="${odds.fav === 'b' ? 'is-fav' : ''}" style="--c:${edgeColor(b)}"></i></div>`;
}

function tileLabel(name, mine, closed, isPlayer, n) {
  return closed ? `${tcase(name)} · ${n} picked` : !isPlayer ? `Log in to pick ${tcase(name)}` : mine ? `Cancel your ${tcase(name)} pick` : `Pick ${tcase(name)}`;
}

function pickTile(o, side, isPlayer, st) {
  const name = side === 'a' ? o.a : o.b;
  const mine = o.myPick === side;
  return `<button type="button" class="pkt pkt--${side}${mine ? ' is-mine' : ''}${o.myPick && !mine ? ' is-other' : ''}"${String(name).toUpperCase() === 'WHITE' ? ' data-light' : ''} data-tile="${side}" aria-pressed="${mine}" aria-label="${escHtml(tileLabel(name, mine, o.closed, isPlayer, o.counts[side]))}"${mine && !o.closed ? ' title="Tap to cancel your pick"' : ''}${o.closed ? ' disabled' : ''}>
      <span class="pkt__id"><span class="pkt__name">${CHECK_SVG}<span>${escHtml(name)}</span></span><span class="pkt__sub" data-tile-sub>${escHtml(st[side].sub)}</span></span>
      <b class="pkt__n font-condensed" data-tile-n>${o.counts[side]}</b>
    </button>`;
}

// The middle of the bar. Guests: a link to log in. Players: opens "Who picked" (the faces
// list); shows your face once you've picked. Closed: a lock (the list still opens).
function badgeInner(st, mineFace) {
  if (st.closed) return LOCK_SVG;
  if (mineFace) return face(mineFace, 30);
  return `<b class="font-condensed">${st.total}</b><small>${st.total ? 'picks' : 'vs'}</small>`;
}
function pickBadge(o, isPlayer, next, st) {
  if (!isPlayer && !o.closed) {
    return `<a class="pkt-badge" href="${escHtml(`/login?next=${encodeURIComponent(next)}`)}" aria-label="Log in to pick"><b class="font-condensed">${st.total}</b><small>log in</small></a>`;
  }
  const mineFace = o.myPick ? (o.pickers?.[o.myPick] || []).find(p => p.me) : null;
  const canList = !!(o.pickers && st.total);
  return `<button type="button" class="pkt-badge${mineFace && !o.closed ? ' is-me' : ''}" data-badge data-faces-side="${o.myPick || 'a'}" aria-label="${canList ? `Who picked · ${st.total} pick${st.total === 1 ? '' : 's'}` : o.closed ? 'Picks closed' : 'No picks yet'}"${canList ? '' : ' disabled'}>${badgeInner(st, mineFace)}</button>`;
}

// "Fans vs odds" — where the pickers lean against the favourite (the /picks/<game> preview).
function fansVsOdds(o) {
  const { counts } = o;
  const fanFav = counts.a !== counts.b ? (counts.a > counts.b ? 'a' : 'b') : null;
  const on = !!(o.odds?.fav && fanFav && o.odds.fav !== fanFav);
  return `<div class="pkt-flag" data-pick-flag${on ? '' : ' hidden'}><b>Fans vs odds</b> · <span data-flag-text>${on ? `fans lean ${escHtml(tcase(fanFav === 'a' ? o.a : o.b))}, the odds like ${escHtml(tcase(o.odds.fav === 'a' ? o.a : o.b))}` : ''}</span></div>`;
}

// The pick itself. oddsHtml: an odds panel above the tiles (the /picks/<game> preview passes
// its full "How it's figured" panel); flag: show the Fans vs odds line.
export function pickBox(o, { isPlayer = false, next = '/picks', oddsHtml = '', flag = false } = {}) {
  const { counts, myPick, closed } = o;
  const names = JSON.stringify({ a: o.a, b: o.b });
  const st = pickBarState(counts, myPick, closed);
  const mineColor = myPick ? `var(--c${myPick})` : '';
  return `<div class="gm-pick${closed ? ' is-closed' : ''}${myPick ? ' has-pick' : ''}" data-game-id="${escHtml(o.id)}" data-a="${counts.a}" data-b="${counts.b}" data-mine="${myPick || ''}" data-player="${isPlayer ? '1' : ''}" data-next="${escHtml(next)}" data-fav="${o.odds?.fav || ''}" data-names="${escHtml(names)}"${o.pickers ? ` data-pickers="${escHtml(JSON.stringify(o.pickers))}"` : ''}>
      ${oddsHtml}
      <div class="pkt-bar" data-pick-bar data-lead="${st.lead}" style="--ca:${edgeColor(o.a)};--cb:${edgeColor(o.b)};--cm:${mineColor || 'transparent'};${barVars(st)}">
        <span class="pkt-bar__fill" aria-hidden="true"></span><span class="pkt-bar__seam" aria-hidden="true"></span>
        ${pickTile(o, 'a', isPlayer, st)}${pickTile(o, 'b', isPlayer, st)}
        ${pickBadge(o, isPlayer, next, st)}
      </div>
      ${flag ? fansVsOdds(o) : ''}
    </div>`;
}

// A whole pick card: team header (records, odds %, head to head, the odds edge) around
// pickBox(). size 'lg' = /picks Open picks; 'sm' = homepage, game detail, profile.
// middle: HTML between the header and the tiles — the homepage puts the player face-off
// there, so the pick sits at the bottom. An unpicked game gets an amber outline (is-needs).
export function openPickCard(o, { isPlayer = false, next = '/picks', size = 'lg', middle = '', more = true } = {}) {
  const needs = isPlayer && !o.myPick && !o.closed;
  const total = o.counts.a + o.counts.b;
  const white = n => (n === 'WHITE' ? 0.45 : 1);
  const glare = `radial-gradient(65% 130% at 0% 85%, color-mix(in srgb, ${teamColor(o.a)} ${Math.round(55 * white(o.a))}%, transparent) 0%, transparent 62%), radial-gradient(65% 130% at 100% 85%, color-mix(in srgb, ${teamColor(o.b)} ${Math.round(55 * white(o.b))}%, transparent) 0%, transparent 62%)`;
  const rec = r => (r ? `${r.w}–${r.l}` : '0–0');
  const h2h = o.h2h?.meetings
    ? `<span class="pkb-h2h"><span>Head to head</span><b class="font-condensed">${o.h2h.a}–${o.h2h.b}</b></span>`
    : '<span class="pkb-h2h"><span>First meeting</span></span>';
  const odds = o.odds || null;
  const pct = side => (odds ? `<span class="pkb-pct${odds.fav === side ? ' is-fav' : ''}">${side === 'a' ? odds.pctA : odds.pctB}%</span>` : '');
  const href = o.href || previewHref(o);
  return `<article class="pkb-card pkb-card--${size}${needs ? ' is-needs' : ''}" aria-label="${escHtml(tcase(o.a))} vs ${escHtml(tcase(o.b))}">
    <div class="pkb-head${odds ? ' has-edge' : ''}" style="background:${glare}">
      <div class="pkb-teams">
        <span class="pkb-team"><b>${dot(o.a, size === 'lg' ? 10 : 9)}${escHtml(o.a)}</b><small class="font-condensed">S${escHtml(String(o.season))} ${rec(o.recA)}${odds ? ` · ${pct('a')}` : ''}</small></span>
        ${h2h}
        <span class="pkb-team pkb-team--b"><b>${escHtml(o.b)}${dot(o.b, size === 'lg' ? 10 : 9)}</b><small class="font-condensed">${odds ? `${pct('b')} · ` : ''}S${escHtml(String(o.season))} ${rec(o.recB)}</small></span>
      </div>
      ${oddsEdge(o.a, o.b, odds)}
    </div>
    <div class="pkb-body">
      ${middle}
      ${pickBox(o, { isPlayer, next })}
      ${size === 'lg'
        ? `<div class="pkb-foot"><span data-pick-total>${total ? `${total} pick${total === 1 ? '' : 's'}` : 'No picks yet'}</span><a href="${escHtml(href)}">Full matchup preview →</a></div>`
        : more ? `<a href="${escHtml(href)}" class="pkb-more">Full preview →</a>` : ''}
    </div>
  </article>`;
}

// One script for every pick box on the page. Safe to include more than once.
export function pickBoxScript() {
  return `<script>
(function () {
  if (window.__wkndPickBox) return; window.__wkndPickBox = true;
  function tc(s) { s = String(s || ''); return s.charAt(0) + s.slice(1).toLowerCase(); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function faceEl(p, size) {
    var f = el('span', 'pk-av' + (p.me ? ' pk-av--me' : ''));
    f.style.setProperty('--team', p.color); f.style.width = f.style.height = size + 'px';
    f.title = p.me ? 'You' : p.name;
    f.appendChild(el('span', 'pk-av__init', p.ini));
    var img = document.createElement('img'); img.src = '/api/player/' + encodeURIComponent(p.id) + '/photo'; img.alt = ''; img.loading = 'lazy';
    img.onerror = function () { img.remove(); }; f.appendChild(img);
    return f;
  }
  var dlg;
  function openList(box, side) {
    var data = JSON.parse(box.dataset.pickers || 'null'); if (!data) return;
    var names = JSON.parse(box.dataset.names);
    if (!dlg) {
      dlg = el('dialog', 'pkb-dlg'); dlg.setAttribute('aria-label', 'Who picked which');
      dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('[data-dlg-close]')) dlg.close(); });
      document.body.appendChild(dlg);
    }
    dlg.innerHTML = '';
    var head = el('div', 'pkb-dlg__head');
    head.appendChild(el('b', '', tc(names.a) + ' vs ' + tc(names.b) + ' · picks'));
    var x = el('button', 'pkb-dlg__x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.setAttribute('data-dlg-close', '');
    head.appendChild(x); dlg.appendChild(head);
    var cols = el('div', 'pkb-dlg__cols');
    ['a', 'b'].forEach(function (s) {
      var col = el('div', 'pkb-dlg__col' + (s === side ? ' is-on' : ''));
      col.appendChild(el('div', 'pkb-dlg__k', tc(names[s]) + ' · ' + data[s].length));
      if (!data[s].length) col.appendChild(el('p', 'pkb-dlg__none', 'No picks yet'));
      data[s].forEach(function (p) {
        var row = el('a', 'pkb-dlg__p'); row.href = '/players/' + encodeURIComponent(p.id);
        row.appendChild(faceEl(p, 30));
        row.appendChild(el('span', '', p.me ? 'You' : p.name));
        col.appendChild(row);
      });
      cols.appendChild(col);
    });
    dlg.appendChild(cols);
    dlg.showModal();
  }
  ${pickBarState.toString()}
  // The halves stay put; the colour split, counts, lines under the names and the badge change.
  function render(box, counts, mine, pickers) {
    var names = JSON.parse(box.dataset.names);
    var t = counts.a + counts.b;
    if (pickers) box.dataset.pickers = JSON.stringify(pickers);
    var st = pickBarState(counts, mine, box.classList.contains('is-closed'));
    var bar = box.querySelector('[data-pick-bar]');
    if (bar) {
      bar.style.setProperty('--split', st.split + '%');
      bar.style.setProperty('--ka1', st.a.k1 + '%'); bar.style.setProperty('--ka2', st.a.k2 + '%');
      bar.style.setProperty('--kb1', st.b.k1 + '%'); bar.style.setProperty('--kb2', st.b.k2 + '%');
      bar.style.setProperty('--cm', mine ? 'var(--c' + mine + ')' : 'transparent');
      bar.dataset.lead = st.lead;
    }
    ['a', 'b'].forEach(function (s) {
      var c = box.querySelector('[data-tile="' + s + '"]'); if (!c) return;
      c.classList.toggle('is-mine', mine === s);
      c.classList.toggle('is-other', !!mine && mine !== s);
      c.setAttribute('aria-pressed', mine === s ? 'true' : 'false');
      c.setAttribute('aria-label', (mine === s ? 'Cancel your ' : 'Pick ') + tc(names[s]) + (mine === s ? ' pick' : ''));
      if (mine === s) c.title = 'Tap to cancel your pick'; else c.removeAttribute('title');
      c.querySelector('[data-tile-n]').textContent = counts[s];
      c.querySelector('[data-tile-sub]').textContent = st[s].sub;
    });
    var badge = box.querySelector('[data-badge]');
    if (badge) {
      var me = mine && pickers ? (pickers[mine] || []).filter(function (p) { return p.me; })[0] : null;
      badge.innerHTML = '';
      if (me) badge.appendChild(faceEl(me, 30));
      else { badge.appendChild(el('b', 'font-condensed', String(t))); badge.appendChild(el('small', '', t ? 'picks' : 'vs')); }
      badge.classList.toggle('is-me', !!me);
      badge.dataset.facesSide = mine || 'a';
      badge.disabled = !(pickers && t);
      badge.setAttribute('aria-label', t ? 'Who picked · ' + t + (t === 1 ? ' pick' : ' picks') : 'No picks yet');
    }
    box.classList.toggle('has-pick', !!mine);
    box.dataset.mine = mine || '';
    var fav = box.dataset.fav, fanFav = t && counts.a !== counts.b ? (counts.a > counts.b ? 'a' : 'b') : '';
    var flag = box.querySelector('[data-pick-flag]');
    if (flag) {
      var on = !!(fav && fanFav && fav !== fanFav);
      flag.hidden = !on;
      if (on) flag.querySelector('[data-flag-text]').textContent = 'fans lean ' + tc(names[fanFav]) + ', the odds like ' + tc(names[fav]);
    }
    var scope = box.closest('.gm-card, .pkb-card');
    if (scope) {
      var total = scope.querySelector('[data-pick-total]');
      if (total) total.textContent = t ? t + (t === 1 ? ' pick' : ' picks') : (scope.classList.contains('gm-card') ? 'Be the first to pick' : 'No picks yet');
      if (player && scope.classList.contains('pkb-card')) scope.classList.toggle('is-needs', !mine);
    }
    document.dispatchEvent(new CustomEvent('wknd:pick', { detail: { gameId: box.dataset.gameId, side: mine || null } }));
  }
  function send(box, side) {
    var next = box.dataset.next || '/picks';
    if (!box.dataset.player) { window.location.href = '/login?next=' + encodeURIComponent(next); return; }
    box.classList.add('is-busy');
    fetch('/games/' + encodeURIComponent(box.dataset.gameId) + '/pick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ side: side }) })
      .then(function (r) { if (r.status === 401) { window.location.href = '/login?next=' + encodeURIComponent(next); return null; } return r.json(); })
      .then(function (d) {
        box.classList.remove('is-busy');
        if (d && d.ok) {
          render(box, d.counts, d.side, d.pickers);
          // Same game shown twice on a page (e.g. profile + another widget): keep them in step.
          document.querySelectorAll('.gm-pick[data-game-id="' + CSS.escape(box.dataset.gameId) + '"]').forEach(function (o) { if (o !== box && !o.classList.contains('is-closed')) render(o, d.counts, d.side, d.pickers); });
        } else if (d && d.error) alert(d.error);
      })
      .catch(function () { box.classList.remove('is-busy'); });
  }
  document.addEventListener('click', function (e) {
    var box = e.target.closest('.gm-pick'); if (!box) return;
    var faces = e.target.closest('[data-faces-side]');
    if (faces) { openList(box, faces.dataset.facesSide); return; }
    if (box.classList.contains('is-closed') || box.classList.contains('is-busy')) return;
    // Your side cancels, the other side picks / switches.
    var tile = e.target.closest('[data-tile]');
    if (tile) send(box, box.dataset.mine === tile.dataset.tile ? null : tile.dataset.tile);
  });
  // "You've picked N of M" counters (/picks, profile).
  document.addEventListener('wknd:pick', function () {
    document.querySelectorAll('[data-pick-progress]').forEach(function (p) {
      var boxes = document.querySelectorAll(p.dataset.pickProgress + ' .gm-pick:not(.is-closed)');
      var ids = {}, done = {};
      boxes.forEach(function (b) { ids[b.dataset.gameId] = 1; if (b.dataset.mine) done[b.dataset.gameId] = 1; });
      var n = Object.keys(done).length, m = Object.keys(ids).length;
      var c = p.querySelector('[data-progress-n]'); if (c) c.textContent = n + ' of ' + m;
      var bar = p.querySelector('[data-progress-bar]'); if (bar) bar.style.width = (m ? Math.round(n / m * 100) : 0) + '%';
      p.classList.toggle('is-done', m > 0 && n === m);
    });
  });
})();
</script>`;
}

// "06:00" → "6:00 AM" for the cut-off line.
export function fmtCloseTime(hm) {
  const [h, m] = String(hm || '06:00').split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// "You've picked N of M" with a bar; pickBoxScript keeps it live. scope = a CSS selector
// for the element holding the boxes it counts.
export function pickProgress(open, scope) {
  const live = open.filter(o => !o.closed);
  if (!live.length) return '';
  const done = live.filter(o => o.myPick).length;
  return `<div class="pkb-prog${done === live.length ? ' is-done' : ''}" data-pick-progress="${escHtml(scope)}">
      <span>You've picked <b data-progress-n>${done} of ${live.length}</b></span>
      <span class="pkb-prog__bar" aria-hidden="true"><i data-progress-bar style="width:${Math.round((done / live.length) * 100)}%"></i></span>
    </div>`;
}
