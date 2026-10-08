import { escHtml } from './layout.js';
import { teamColor } from './utils.js';
import { gameSlug } from '../lib/slugs.js';

// ── "Who wins?" pick box — one component for every surface that takes a pick ──────────
// /games matchup cards, the /picks "Open picks" section, the homepage widget and the
// player's own profile all render pickBox() and share pickBoxScript(), so a pick made
// anywhere behaves the same: buttons → fan split + the faces of who picked which side.
//
// Data shape (server.js openPickFor()):
//   { id, a, b, ymd, counts: {a,b}, myPick: 'a'|'b'|null, closed, odds: {pctA,pctB,fav}|null,
//     pickers: { a: [face], b: [face] } | null, recA, recB, h2h }
// pickers is null unless the viewer is a logged-in player who has picked (or picks are
// closed) — the crowd stays hidden until you commit, so nobody copies a teammate.
// face = { id, name, ini, color, me }

// The full matchup preview for a game — /picks/<slug>. Takes a pick-shaped game ({ id, a, b })
// or a games row.
export function previewHref(g) {
  return `/picks/${encodeURIComponent(gameSlug({ id: g.id, team_a_name: g.a ?? g.team_a_name, team_b_name: g.b ?? g.team_b_name }))}`;
}

// Team colour for the odds edge — Black is too dark on the header, so a lighter slate.
const edgeColor = team => (String(team).toUpperCase() === 'BLACK' ? '#8a94a6' : teamColor(team));

const tcase = s => String(s || '').charAt(0) + String(s || '').slice(1).toLowerCase();
const dot = (name, size = 9) => `<span class="team-dot" style="background:${teamColor(name)};width:${size}px;height:${size}px"></span>`;
const FACES_SHOWN = 5;
const NARROW = 34; // % below which a split segment drops the team name

function face(p, size = 28) {
  return `<span class="pk-av${p.me ? ' pk-av--me' : ''}" style="--team:${escHtml(p.color)};width:${size}px;height:${size}px" title="${escHtml(p.me ? 'You' : p.name)}">
      <span class="pk-av__init">${escHtml(p.ini)}</span>
      <img src="/api/player/${encodeURIComponent(p.id)}/photo" alt="" loading="lazy" onerror="this.remove()">
    </span>`;
}

function facesSide(list, side, teamName) {
  if (!list.length) return `<span class="pkb-faces__side pkb-faces__side--${side} is-empty">No picks yet</span>`;
  const shown = list.slice(0, FACES_SHOWN);
  const more = list.length - shown.length;
  return `<button type="button" class="pkb-faces__side pkb-faces__side--${side}" data-faces-side="${side}" aria-label="See the ${list.length} player${list.length === 1 ? '' : 's'} who picked ${escHtml(tcase(teamName))}">
      ${shown.map(p => face(p)).join('')}${more > 0 ? `<span class="pk-av pk-av--more" style="width:28px;height:28px">+${more}</span>` : ''}
    </button>`;
}

function facesRow(o) {
  if (!o.pickers) return '<div class="pkb-faces" data-faces hidden></div>';
  return `<div class="pkb-faces" data-faces>${facesSide(o.pickers.a, 'a', o.a)}${facesSide(o.pickers.b, 'b', o.b)}</div>`;
}

// Compact odds line for surfaces without the /games odds panel.
export function oddsMini(o) {
  if (!o.odds?.fav) return o.odds ? '<div class="pkb-odds"><span class="pkb-odds__k">Odds</span><b>Toss-up</b></div>' : '';
  return `<div class="pkb-odds" aria-label="Odds: ${escHtml(tcase(o.a))} ${o.odds.pctA}%, ${escHtml(tcase(o.b))} ${o.odds.pctB}%">
      <span class="pkb-odds__k">Odds · ${escHtml(tcase(o.odds.fav === 'a' ? o.a : o.b))} favoured</span>
      <span class="pkb-odds__row" aria-hidden="true">
        <b class="${o.odds.fav === 'a' ? 'is-fav' : ''}">${escHtml(tcase(o.a))} ${o.odds.pctA}%</b>
        <span class="pkb-odds__bar"><i class="${o.odds.fav === 'a' ? 'is-fav' : ''}" style="width:${o.odds.pctA}%"></i><i class="${o.odds.fav === 'b' ? 'is-fav' : ''}"></i></span>
        <b class="${o.odds.fav === 'b' ? 'is-fav' : ''}">${o.odds.pctB}% ${escHtml(tcase(o.b))}</b>
      </span>
    </div>`;
}

// The pick itself. opts.oddsHtml replaces the compact odds line (/games passes its own panel).
export function pickBox(o, { isPlayer = false, next = '/picks', oddsHtml = null } = {}) {
  const { counts, myPick, closed } = o;
  const total = counts.a + counts.b;
  const pctA = total ? Math.round((counts.a / total) * 100) : 50;
  const showSplit = !!myPick || closed;
  const fanFav = total && counts.a !== counts.b ? (counts.a > counts.b ? 'a' : 'b') : null;
  const disagree = showSplit && o.odds?.fav && fanFav && o.odds.fav !== fanFav;
  const loginHref = `/login?next=${encodeURIComponent(next)}`;
  const names = JSON.stringify({ a: o.a, b: o.b });
  return `<div class="gm-pick${closed ? ' is-closed' : ''}" data-game-id="${escHtml(o.id)}" data-a="${counts.a}" data-b="${counts.b}" data-mine="${myPick || ''}" data-player="${isPlayer ? '1' : ''}" data-next="${escHtml(next)}" data-fav="${o.odds?.fav || ''}" data-names="${escHtml(names)}"${o.pickers ? ` data-pickers="${escHtml(JSON.stringify(o.pickers))}"` : ''}>
      ${oddsHtml ?? oddsMini(o)}
      ${closed ? '' : `<div class="gm-pick__btns"${myPick ? ' hidden' : ''}>
        <button type="button" class="gm-pick__btn" data-side="a">${dot(o.a)}${escHtml(o.a)}</button>
        <button type="button" class="gm-pick__btn" data-side="b">${escHtml(o.b)}${dot(o.b)}</button>
      </div>`}
      ${!closed && !myPick && !isPlayer ? `<div class="gm-pick__login"><a href="${escHtml(loginHref)}">Log in to pick</a>${total ? ` and see who picked · ${total} so far` : ' and be the first'}</div>` : ''}
      ${!closed && !myPick && isPlayer ? `<div class="pkb-hint" data-pick-hint>${total ? `${total} player${total === 1 ? ' has' : 's have'} picked · pick to see who` : 'Nobody has picked yet · be the first'}</div>` : ''}
      <div class="gm-pick__result"${showSplit ? '' : ' hidden'}>
        ${o.odds ? `<div class="gm-pick__lbl">Fan picks · <span data-pick-n>${total}</span></div>` : ''}
        <div class="gm-pick__split">
          <span class="gm-pick__seg${myPick === 'a' ? ' is-mine' : ''}${pctA < NARROW ? ' is-narrow' : ''}" data-seg="a" style="width:${pctA}%">${dot(o.a, 8)}<span class="gm-pick__nm">${escHtml(o.a)}</span> <b>${pctA}%</b></span>
          <span class="gm-pick__seg gm-pick__seg--b${myPick === 'b' ? ' is-mine' : ''}${100 - pctA < NARROW ? ' is-narrow' : ''}" data-seg="b" style="width:${100 - pctA}%"><b>${100 - pctA}%</b> <span class="gm-pick__nm">${escHtml(o.b)}</span>${dot(o.b, 8)}</span>
        </div>
        ${facesRow(o)}
        <div class="gm-pick__flag" data-pick-flag${disagree ? '' : ' hidden'}><b>Fans vs odds</b> · <span data-flag-text>${disagree ? `fans lean ${escHtml(tcase(fanFav === 'a' ? o.a : o.b))}, the odds like ${escHtml(tcase(o.odds.fav === 'a' ? o.a : o.b))}` : ''}</span></div>
        <div class="gm-pick__note">${closed
          ? `<span>Picks are closed${myPick ? ` · you picked <b>${escHtml(myPick === 'b' ? o.b : o.a)}</b>` : ''} · results after the final</span>`
          : `<span>You picked <b data-mine-name>${escHtml(myPick === 'b' ? o.b : o.a)}</b> · results after the final</span><button type="button" class="gm-pick__change">Change</button>`}</div>
      </div>
    </div>`;
}

// A whole open-pick card: team header (records + head to head) around pickBox().
// size 'lg' = /picks (photo-less glare header); 'sm' = homepage widget / profile tile.
// middle: HTML placed between the matchup summary (head + odds) and the pick buttons — the
// homepage puts the player face-off there, so the actions sit at the bottom.
export function openPickCard(o, { isPlayer = false, next = '/picks', size = 'lg', label = '', middle = '', more = true } = {}) {
  const needs = isPlayer && !o.myPick && !o.closed;
  const total = o.counts.a + o.counts.b;
  const white = n => (n === 'WHITE' ? 0.45 : 1);
  const glare = `radial-gradient(65% 130% at 0% 85%, color-mix(in srgb, ${teamColor(o.a)} ${Math.round(55 * white(o.a))}%, transparent) 0%, transparent 62%), radial-gradient(65% 130% at 100% 85%, color-mix(in srgb, ${teamColor(o.b)} ${Math.round(55 * white(o.b))}%, transparent) 0%, transparent 62%)`;
  const rec = r => (r ? `${r.w}–${r.l}` : '0–0');
  const h2h = o.h2h?.meetings
    ? `<span class="pkb-h2h"><span>Head to head</span><b class="font-condensed">${o.h2h.a}–${o.h2h.b}</b></span>`
    : '<span class="pkb-h2h"><span>First meeting</span></span>';
  const compact = !!middle;
  const odds = compact && o.odds?.fav !== undefined ? o.odds : null;
  const pct = side => (odds ? ` · <span class="pkb-pct${odds.fav === side ? ' is-fav' : ''}">${side === 'a' ? odds.pctA : odds.pctB}%</span>` : '');
  const oddsEdge = odds
    ? `<div class="pkb-edge" role="img" aria-label="Odds: ${escHtml(tcase(o.a))} ${odds.pctA}%, ${escHtml(tcase(o.b))} ${odds.pctB}%"><i class="${odds.fav === 'a' ? 'is-fav' : ''}" style="width:${odds.pctA}%;--c:${edgeColor(o.a)}"></i><i class="${odds.fav === 'b' ? 'is-fav' : ''}" style="--c:${edgeColor(o.b)}"></i></div>`
    : '';
  const chips = compact ? '' : [
    label ? `<span class="pkb-chip">${escHtml(label)}</span>` : '',
    o.closed ? '<span class="pkb-chip">Picks closed</span>' : '',
    needs ? '<span class="pkb-chip pkb-chip--need" data-needs-chip>Needs your pick</span>' : '',
  ].join('');
  return `<article class="pkb-card pkb-card--${size}${needs ? ' is-needs' : ''}" aria-label="${escHtml(tcase(o.a))} vs ${escHtml(tcase(o.b))}">
    <div class="pkb-head${odds ? ' has-edge' : ''}" style="background:${glare}">
      ${chips ? `<div class="pkb-chips">${chips}</div>` : ''}
      <div class="pkb-teams">
        <span class="pkb-team"><b>${dot(o.a, size === 'lg' ? 10 : 9)}${escHtml(o.a)}</b><small class="font-condensed">S${escHtml(String(o.season))} ${rec(o.recA)}${pct('a')}</small></span>
        ${h2h}
        <span class="pkb-team pkb-team--b"><b>${escHtml(o.b)}${dot(o.b, size === 'lg' ? 10 : 9)}</b><small class="font-condensed">${odds ? `<span class="pkb-pct${odds.fav === 'b' ? ' is-fav' : ''}">${odds.pctB}%</span> · ` : ''}S${escHtml(String(o.season))} ${rec(o.recB)}</small></span>
      </div>
      ${oddsEdge}
    </div>
    <div class="pkb-body">
      ${middle ? `${middle}
      ${pickBox(o, { isPlayer, next, oddsHtml: '' })}` : pickBox(o, { isPlayer, next })}
      ${size === 'lg'
        ? `<div class="pkb-foot"><span data-pick-total>${total ? `${total} pick${total === 1 ? '' : 's'}` : 'No picks yet'}</span><a href="${escHtml(o.href || previewHref(o))}">Full matchup preview →</a></div>`
        : more ? `<a href="${escHtml(o.href || previewHref(o))}" class="pkb-more">Full preview →</a>` : ''}
    </div>
  </article>`;
}

// One script for every pick box on the page. Safe to include more than once.
export function pickBoxScript() {
  return `<script>
(function () {
  if (window.__wkndPickBox) return; window.__wkndPickBox = true;
  var SHOWN = ${FACES_SHOWN};
  function tc(s) { s = String(s || ''); return s.charAt(0) + s.slice(1).toLowerCase(); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function faceEl(p, size, link) {
    var f = el(link ? 'a' : 'span', 'pk-av' + (p.me ? ' pk-av--me' : ''));
    if (link) f.href = '/players/' + encodeURIComponent(p.id);
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
        row.appendChild(faceEl(p, 30, false));
        row.appendChild(el('span', '', p.me ? 'You' : p.name));
        col.appendChild(row);
      });
      cols.appendChild(col);
    });
    dlg.appendChild(cols);
    dlg.showModal();
  }
  function renderFaces(box, pickers) {
    var wrap = box.querySelector('[data-faces]'); if (!wrap) return;
    wrap.innerHTML = '';
    if (!pickers) { wrap.hidden = true; box.removeAttribute('data-pickers'); return; }
    box.dataset.pickers = JSON.stringify(pickers);
    var names = JSON.parse(box.dataset.names);
    ['a', 'b'].forEach(function (s) {
      var list = pickers[s];
      if (!list.length) { wrap.appendChild(el('span', 'pkb-faces__side pkb-faces__side--' + s + ' is-empty', 'No picks yet')); return; }
      var b = el('button', 'pkb-faces__side pkb-faces__side--' + s); b.type = 'button'; b.dataset.facesSide = s;
      b.setAttribute('aria-label', 'See the ' + list.length + ' player' + (list.length === 1 ? '' : 's') + ' who picked ' + tc(names[s]));
      list.slice(0, SHOWN).forEach(function (p) { b.appendChild(faceEl(p, 28, false)); });
      if (list.length > SHOWN) { var m = el('span', 'pk-av pk-av--more', '+' + (list.length - SHOWN)); m.style.width = m.style.height = '28px'; b.appendChild(m); }
      wrap.appendChild(b);
    });
    wrap.hidden = false;
  }
  function render(box, counts, mine, pickers) {
    var names = JSON.parse(box.dataset.names);
    var t = counts.a + counts.b, pa = t ? Math.round(counts.a / t * 100) : 50;
    var a = box.querySelector('[data-seg="a"]'), b = box.querySelector('[data-seg="b"]');
    a.style.width = pa + '%'; b.style.width = (100 - pa) + '%';
    a.querySelector('b').textContent = pa + '%'; b.querySelector('b').textContent = (100 - pa) + '%';
    a.classList.toggle('is-mine', mine === 'a'); b.classList.toggle('is-mine', mine === 'b');
    a.classList.toggle('is-narrow', pa < ${NARROW}); b.classList.toggle('is-narrow', 100 - pa < ${NARROW});
    var mn = box.querySelector('[data-mine-name]'); if (mn) mn.textContent = mine === 'b' ? names.b : names.a;
    var btns = box.querySelector('.gm-pick__btns'); if (btns) btns.hidden = !!mine;
    box.querySelector('.gm-pick__result').hidden = !mine;
    var hint = box.querySelector('[data-pick-hint]');
    if (hint) { hint.hidden = !!mine; hint.textContent = t ? t + (t === 1 ? ' player has' : ' players have') + ' picked · pick to see who' : 'Nobody has picked yet · be the first'; }
    var n = box.querySelector('[data-pick-n]'); if (n) n.textContent = t;
    var fav = box.dataset.fav, fanFav = t && counts.a !== counts.b ? (counts.a > counts.b ? 'a' : 'b') : '';
    var flag = box.querySelector('[data-pick-flag]');
    if (flag) {
      var on = !!(mine && fav && fanFav && fav !== fanFav);
      flag.hidden = !on;
      if (on) flag.querySelector('[data-flag-text]').textContent = 'fans lean ' + tc(names[fanFav]) + ', the odds like ' + tc(names[fav]);
    }
    box.dataset.mine = mine || '';
    renderFaces(box, mine ? pickers : null);
    var scope = box.closest('.gm-card, .pkb-card');
    if (scope) {
      var total = scope.querySelector('[data-pick-total]');
      if (total) total.textContent = t ? t + (t === 1 ? ' pick' : ' picks') : (scope.classList.contains('gm-card') ? 'Be the first to pick' : 'No picks yet');
      var chip = scope.querySelector('[data-needs-chip]'); if (chip) chip.hidden = !!mine;
      scope.classList.toggle('is-needs', !mine && !!chip);
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
    var btn = e.target.closest('.gm-pick__btn');
    if (btn) { send(box, btn.dataset.side); return; }
    if (e.target.closest('.gm-pick__change')) send(box, null);
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
