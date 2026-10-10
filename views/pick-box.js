import { escHtml } from './layout.js';
import { teamColor } from './utils.js';
import { gameSlug } from '../lib/slugs.js';
import { MARGIN_MAX } from '../lib/picks.js';

// ── "Who wins?" pick box — one component for every surface that takes a pick ──────────
// The homepage widget, /games Up next, /picks (Open picks + each game's preview), the game
// detail page and the player's own profile all render pickBox() and share pickBoxScript(),
// so a pick made anywhere looks and behaves the same.
//
// The pick is one bar plus a footer line (Paolo, 2026-10-09: "seam badge", then "F+A").
// Bar: two tap halves (always 50/50). Behind them the team colours split where the fans do,
// with a lit break on the seam; the break is clamped in from each end (--safe in CSS) so it
// never runs under a team's name or count. The pick-count badge rides the break and opens
// "Who picked". Your side fills brighter; the bar itself carries no "Your pick" text.
// Footer: what you picked / what to do next / when picks close, plus "Remove pick" and
// "Who picked →". Picking plays a short stamp across your side (the badge steps aside for
// it). Tapping your own side again just replays the stamp — removing is the footer's job.
// Guests: any tap goes to log in, and the tapped side comes back with them (?pick=a:<id>).
// The box keeps its exact height in every state.
//
// Data shape (server.js openPicks()):
//   { id, a, b, ymd, counts: {a,b}, myPick: 'a'|'b'|null, closed, odds: {pctA,pctB,fav}|null,
//     pickers: { a: [face], b: [face] } | null, recA, recB, h2h, href, closeHm }
// pickers: logged-in players only (Paolo, 2026-10-08: they see who picked before picking);
// guests never get names or faces. face = { id, name, ini, color, me }

// The full matchup preview for a game — its own page, /games/<slug> (the old /picks/<slug>
// redirects there). Takes a pick-shaped game ({ id, a, b }) or a games row.
export function previewHref(g) {
  return `/games/${encodeURIComponent(gameSlug({ id: g.id, team_a_name: g.a ?? g.team_a_name, team_b_name: g.b ?? g.team_b_name }))}`;
}

// "Talk trash →" under a pick: shown once you've picked (pickBoxScript reveals it the moment
// you do), leading to that game's pre-game chatter. Only where comments are on.
export function talkLink(gameId, href, shown) {
  return `<a href="${escHtml(href)}" class="pk-talk" data-talk="${escHtml(gameId)}"${shown ? '' : ' hidden'}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>Picked. Now talk trash in the pre-game chatter</span><b aria-hidden="true">→</b></a>`;
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
      // Each side's share of fans; none until the split shows (the footer says why)
      pct: !t || early ? null : Math.round(sh * 100),
    };
  }
  return {
    total: t, early: early, split: Math.round(share * 1000) / 10,
    lead: !t || early || share === 0.5 ? '' : share > 0.5 ? 'a' : 'b',
    a: side('a', share), b: side('b', 1 - share), closed: !!closed,
  };
}

// The footer line: { lead, pick, tail } (pick is the bold team name) and whether
// "Remove pick" shows. Shared with the browser like pickBarState.
function pickFootState(st, mine, names, closeLabel, isPlayer) {
  function tcap(s) { s = String(s || ''); return s.charAt(0) + s.slice(1).toLowerCase(); }
  var t = st.total, picks = t + (t === 1 ? ' pick' : ' picks');
  if (st.closed) return mine ? { lead: 'Picks closed · you picked ', pick: tcap(names[mine]), tail: '' } : { lead: 'Picks closed · ' + picks, pick: '', tail: '' };
  if (mine && isPlayer) return { lead: 'You picked ', pick: tcap(names[mine]), tail: '', remove: true };
  if (!t) return { lead: 'Be the first to pick', pick: '', tail: closeLabel ? ' · ' + closeLabel : '' };
  if (st.early) return { lead: 'Tap a team to pick', pick: '', tail: ' · the fan split shows after 5 picks' };
  return { lead: 'Tap a team to pick', pick: '', tail: closeLabel ? ' · ' + closeLabel : ' · ' + t + ' picked so far' };
}

// "closes Sun 6:00 AM" — game day (Manila calendar date) + the picks_close_time setting
function closeLabelFor(ymd, hm) {
  if (!ymd || !hm) return '';
  const day = new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  return `closes ${day} ${fmtCloseTime(hm)}`;
}
const barVars = st => `--split:${st.split}%;--ka1:${st.a.k1}%;--ka2:${st.a.k2}%;--kb1:${st.b.k1}%;--kb2:${st.b.k2}%`;

// The odds as a thin two-colour edge — each side as wide as its chance, the favourite glowing
// a little more. Sits on the bottom of a header (pick cards) or a photo banner (/games).
export function oddsEdge(a, b, odds) {
  if (!odds) return '';
  return `<div class="pkb-edge" role="img" aria-label="Odds: ${escHtml(tcase(a))} ${odds.pctA}%, ${escHtml(tcase(b))} ${odds.pctB}%"><i class="${odds.fav === 'a' ? 'is-fav' : ''}" style="width:${odds.pctA}%;--c:${edgeColor(a)}"></i><i class="${odds.fav === 'b' ? 'is-fav' : ''}" style="--c:${edgeColor(b)}"></i></div>`;
}

function tileLabel(name, mine, closed, isPlayer, n) {
  return closed ? `${tcase(name)} · ${n} picked` : !isPlayer ? `Log in to pick ${tcase(name)}` : mine ? `${tcase(name)} · your pick` : `Pick ${tcase(name)}`;
}

// "69% of fans" — "of" drops on narrow bars (CSS)
const subHtml = pct => (pct == null ? '' : `${pct}%<span class="pkt__of"> of</span> fans`);

function pickTile(o, side, isPlayer, st) {
  const name = side === 'a' ? o.a : o.b;
  const mine = o.myPick === side;
  return `<button type="button" class="pkt pkt--${side}${mine ? ' is-mine' : ''}${o.myPick && !mine ? ' is-other' : ''}"${String(name).toUpperCase() === 'WHITE' ? ' data-light' : ''} data-tile="${side}" aria-pressed="${mine}" aria-label="${escHtml(tileLabel(name, mine, o.closed, isPlayer, o.counts[side]))}"${o.closed ? ' disabled' : ''}>
      <span class="pkt__id"><span class="pkt__name"><span>${escHtml(name)}</span></span><span class="pkt__sub" data-tile-sub>${subHtml(st[side].pct)}</span></span>
      <b class="pkt__n font-condensed" data-tile-n>${o.counts[side]}</b>
    </button>`;
}

// The pick count, riding the break. Players: opens "Who picked". Guests: goes to log in
// (the script handles both). Closed: a lock (the list still opens).
function pickBadge(o, isPlayer, st) {
  const canList = !!(o.pickers && st.total);
  const label = !isPlayer && !o.closed ? `${st.total} pick${st.total === 1 ? '' : 's'} · log in to pick` : canList ? `Who picked · ${st.total} pick${st.total === 1 ? '' : 's'}` : o.closed ? 'Picks closed' : 'No picks yet';
  const off = isPlayer && !canList;
  return `<button type="button" class="pkt-badge" data-badge${isPlayer ? ` data-faces-side="${o.myPick || 'a'}"` : ''} aria-label="${escHtml(label)}"${off ? ' disabled' : ''}>${o.closed ? LOCK_SVG : `<b class="font-condensed" data-badge-n>${st.total}</b><small data-badge-w>${st.total ? 'picks' : 'vs'}</small>`}</button>`;
}

// The footer line under the bar
function pickFoot(o, isPlayer, st, closeLabel) {
  const f = pickFootState(st, o.myPick, { a: o.a, b: o.b }, closeLabel, isPlayer);
  const who = !!(o.pickers && st.total);
  return `<div class="pkt-foot" data-pick-foot><div class="pkt-foot__in">
      <span class="pkt-foot__text" data-foot-text aria-live="polite">${escHtml(f.lead)}${f.pick ? `<b>${escHtml(f.pick)}</b>` : ''}${escHtml(f.tail)}</span>
      <span class="pkt-foot__acts">${isPlayer && !o.closed ? `<button type="button" data-remove${f.remove ? '' : ' hidden'}>Remove pick</button>` : ''}${o.pickers ? `<button type="button" class="pkt-foot__who" data-faces-side="${o.myPick || 'a'}"${who ? '' : ' hidden'}>Who picked →</button>` : ''}</span>
    </div></div>`;
}

// Finals Game 1 only: the margin-guess tiebreaker under the footer. Always drawn on that game
// (disabled until you pick) so the box doesn't jump when you do. o.marginGuess = { mine }.
function marginRow(o, isPlayer) {
  if (!o.marginGuess) return '';
  if (!isPlayer) return `<div class="pkt-margin is-guest"><span class="pkt-margin__k">Tiebreaker</span><span class="pkt-margin__msg">Pick a side, then guess the winning margin. It's the last Pickmaster tiebreaker. <a href="/picks/rules">Rules</a></span></div>`;
  const mine = o.myPick, saved = o.marginGuess.mine;
  const team = mine ? tcase(mine === 'a' ? o.a : o.b) : 'Your side';
  if (o.closed) {
    return `<div class="pkt-margin is-closed"><span class="pkt-margin__k">Tiebreaker</span><span class="pkt-margin__msg">${mine && saved != null ? `Your guess: <b>${escHtml(team)} by ${saved}</b>` : 'No margin guess'}</span></div>`;
  }
  return `<div class="pkt-margin" data-margin data-saved="${saved ?? ''}">
      <span class="pkt-margin__k">Tiebreaker</span>
      <label class="pkt-margin__q"><span data-margin-team>${escHtml(team)}</span> wins by
        <input type="number" inputmode="numeric" min="1" max="${MARGIN_MAX}" step="1" value="${saved ?? ''}" placeholder="–" data-margin-in aria-label="Winning margin guess"${mine ? '' : ' disabled'}> pts</label>
      <button type="button" class="pkt-margin__save" data-margin-save hidden>Save</button>
      <span class="pkt-margin__msg" data-margin-msg aria-live="polite">${mine ? (saved == null ? 'Optional' : '') : 'Pick a side first'}</span>
    </div>`;
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
  const closeLabel = closeLabelFor(o.ymd, o.closeHm);
  return `<div class="gm-pick${closed ? ' is-closed' : ''}${myPick ? ' has-pick' : ''}" data-game-id="${escHtml(o.id)}" data-a="${counts.a}" data-b="${counts.b}" data-mine="${myPick || ''}" data-player="${isPlayer ? '1' : ''}" data-next="${escHtml(next)}" data-fav="${o.odds?.fav || ''}" data-names="${escHtml(names)}" data-close="${escHtml(closeLabel)}"${o.pickers ? ` data-pickers="${escHtml(JSON.stringify(o.pickers))}"` : ''}>
      ${oddsHtml}
      <div class="pkt-bar" data-pick-bar data-lead="${st.lead}" style="--ca:${edgeColor(o.a)};--cb:${edgeColor(o.b)};--cm:${mineColor || 'transparent'};${barVars(st)}">
        <span class="pkt-bar__fill" aria-hidden="true"></span><span class="pkt-bar__seam" aria-hidden="true"></span>
        ${pickTile(o, 'a', isPlayer, st)}${pickTile(o, 'b', isPlayer, st)}
        ${pickBadge(o, isPlayer, st)}
      </div>
      ${pickFoot(o, isPlayer, st, closeLabel)}
      ${marginRow(o, isPlayer)}
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
      ${o.talk && isPlayer && !o.closed ? talkLink(o.id, `${href}#talk`, !!o.myPick) : ''}
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
  // Picked → the "Talk trash" link for that game shows up; removed → it hides again.
  document.addEventListener('wknd:pick', function (e) {
    document.querySelectorAll('[data-talk]').forEach(function (a) { if (a.dataset.talk === e.detail.gameId) a.hidden = !e.detail.side; });
  });
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
  ${pickFootState.toString()}
  var CHECK = ${JSON.stringify(CHECK_SVG)};
  function subFill(node, pct) {
    node.textContent = '';
    if (pct == null) return;
    node.appendChild(document.createTextNode(pct + '%'));
    node.appendChild(el('span', 'pkt__of', ' of'));
    node.appendChild(document.createTextNode(' fans'));
  }
  function footFill(box, st, mine) {
    var foot = box.querySelector('[data-pick-foot]'); if (!foot || foot.classList.contains('is-error')) return;
    var f = pickFootState(st, mine, JSON.parse(box.dataset.names), box.dataset.close || '', !!box.dataset.player);
    var text = foot.querySelector('[data-foot-text]');
    text.textContent = f.lead;
    if (f.pick) text.appendChild(el('b', '', f.pick));
    if (f.tail) text.appendChild(document.createTextNode(f.tail));
    var rm = foot.querySelector('[data-remove]'); if (rm) rm.hidden = !f.remove;
    var who = foot.querySelector('.pkt-foot__who'); if (who) { who.hidden = !(box.dataset.pickers && st.total); who.dataset.facesSide = mine || 'a'; }
  }
  // Finals Game 1 guess row: follows the pick (team name, enabled); removing the pick clears it.
  function marginFill(box, mine) {
    var row = box.querySelector('[data-margin]'); if (!row) return;
    var names = JSON.parse(box.dataset.names), inp = row.querySelector('[data-margin-in]'), msg = row.querySelector('[data-margin-msg]');
    row.querySelector('[data-margin-team]').textContent = mine ? tc(names[mine]) : 'Your side';
    inp.disabled = !mine;
    if (!mine) { inp.value = ''; row.dataset.saved = ''; row.querySelector('[data-margin-save]').hidden = true; msg.textContent = 'Pick a side first'; }
    else if (msg.textContent === 'Pick a side first') msg.textContent = row.dataset.saved ? '' : 'Optional';
  }
  function marginDirty(row) {
    row.querySelector('[data-margin-save]').hidden = row.querySelector('[data-margin-in]').value.trim() === (row.dataset.saved || '');
  }
  function saveMargin(box) {
    var row = box.querySelector('[data-margin]'); if (!row || row.dataset.busy) return;
    var inp = row.querySelector('[data-margin-in]'), msg = row.querySelector('[data-margin-msg]'), btn = row.querySelector('[data-margin-save]');
    var v = inp.value.trim(), n = v === '' ? null : Number(v);
    if (n !== null && !(n % 1 === 0 && n >= 1 && n <= +inp.max)) { msg.textContent = 'Whole number, 1 to ' + inp.max; return; }
    row.dataset.busy = '1'; msg.textContent = 'Saving…';
    fetch('/games/' + encodeURIComponent(box.dataset.gameId) + '/pick/margin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ margin: n }) })
      .then(function (r) { if (r.status === 401) { toLogin(box, null); return null; } return r.json().catch(function () { return {}; }); })
      .then(function (d) {
        delete row.dataset.busy; if (!d) return;
        if (d.ok) { row.dataset.saved = d.margin == null ? '' : String(d.margin); inp.value = row.dataset.saved; btn.hidden = true; msg.textContent = d.margin == null ? 'Guess cleared' : 'Saved'; }
        else msg.textContent = d.error || "Couldn't save your guess.";
      })
      .catch(function () { delete row.dataset.busy; msg.textContent = "Couldn't save. Check your connection."; });
  }
  document.addEventListener('input', function (e) { var row = e.target.closest('[data-margin]'); if (row) marginDirty(row); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || !e.target.matches('[data-margin-in]')) return;
    e.preventDefault(); saveMargin(e.target.closest('.gm-pick'));
  });
  // A problem saving shows in the footer for a few seconds instead of a pop-up.
  function footError(box, msg) {
    var foot = box.querySelector('[data-pick-foot]'); if (!foot) return;
    clearTimeout(foot._errT);
    foot.classList.add('is-error');
    foot.querySelector('[data-foot-text]').textContent = msg;
    foot._errT = setTimeout(function () {
      foot.classList.remove('is-error');
      var c = { a: +box.dataset.a, b: +box.dataset.b }, m = box.dataset.mine || null;
      footFill(box, pickBarState(c, m, box.classList.contains('is-closed')), m);
    }, 5000);
  }
  // The halves stay put; the colour split, counts, share lines, badge and footer change.
  function render(box, counts, mine, pickers) {
    var names = JSON.parse(box.dataset.names), player = !!box.dataset.player;
    var t = counts.a + counts.b;
    if (pickers) box.dataset.pickers = JSON.stringify(pickers);
    box.dataset.a = counts.a; box.dataset.b = counts.b;
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
      c.setAttribute('aria-label', mine === s ? tc(names[s]) + ' · your pick' : 'Pick ' + tc(names[s]));
      c.querySelector('[data-tile-n]').textContent = counts[s];
      subFill(c.querySelector('[data-tile-sub]'), st[s].pct);
    });
    var badge = box.querySelector('[data-badge]');
    if (badge) {
      var n = badge.querySelector('[data-badge-n]'), w = badge.querySelector('[data-badge-w]');
      if (n) n.textContent = t;
      if (w) w.textContent = t ? 'picks' : 'vs';
      if (player) {
        badge.dataset.facesSide = mine || 'a';
        badge.disabled = !(box.dataset.pickers && t);
        badge.setAttribute('aria-label', t ? 'Who picked · ' + t + (t === 1 ? ' pick' : ' picks') : 'No picks yet');
      }
    }
    footFill(box, st, mine);
    marginFill(box, mine);
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
  // The stamp across your side ("Picked White" / "Switched to Maroon"), or "Pick removed"
  // across the bar. The badge steps aside while a stamp plays (.is-flash).
  function fx(box, side, kind) {
    var bar = box.querySelector('[data-pick-bar]'); if (!bar) return;
    var old = bar.querySelector('.pkt-fx'); if (old) old.remove();
    clearTimeout(bar._fxT); bar.classList.remove('is-flash');
    var names = JSON.parse(box.dataset.names);
    var f = el('span', 'pkt-fx ' + (kind === 'clear' ? 'pkt-fx--clear' : 'pkt-fx--' + side));
    f.setAttribute('aria-hidden', 'true');
    var stamp = el('span', 'pkt-fx__stamp');
    if (kind === 'clear') stamp.textContent = 'Pick removed';
    else {
      if (String(names[side]).toUpperCase() === 'WHITE') f.setAttribute('data-light', '');
      f.appendChild(el('i', 'pkt-fx__sweep'));
      stamp.innerHTML = CHECK;
      stamp.appendChild(el('span', '', kind === 'switch' ? 'Switched' : 'Picked'));
      stamp.appendChild(el('span', 'pkt-fx__team', (kind === 'switch' ? ' to ' : ' ') + names[side]));
      void bar.offsetWidth; bar.classList.add('is-flash');
    }
    f.appendChild(stamp); bar.appendChild(f);
    bar._fxT = setTimeout(function () { f.remove(); bar.classList.remove('is-flash'); }, kind === 'clear' ? 1600 : 2300);
  }
  // Guests: off to log in, carrying the side they tapped (?pick=a:<game id>) so it's
  // picked for them when they land back here.
  function toLogin(box, side) {
    var next = box.dataset.next || '/picks';
    if (side) next += (next.indexOf('?') < 0 ? '?' : '&') + 'pick=' + side + ':' + encodeURIComponent(box.dataset.gameId);
    window.location.href = '/login?next=' + encodeURIComponent(next);
  }
  // The bar changes the moment you tap; if saving fails it goes back and the footer says so.
  function send(box, side) {
    if (box.dataset.busy) return;
    box.dataset.busy = '1';
    var prev = { a: +box.dataset.a, b: +box.dataset.b }, prevMine = box.dataset.mine || null;
    var prevPickers = box.dataset.pickers ? JSON.parse(box.dataset.pickers) : null;
    var c = { a: prev.a, b: prev.b };
    if (prevMine) c[prevMine] = Math.max(0, c[prevMine] - 1);
    if (side) c[side]++;
    render(box, c, side, null);
    fx(box, side, side ? (prevMine ? 'switch' : 'pick') : 'clear');
    if (side && navigator.vibrate) { try { navigator.vibrate(12); } catch (err) {} }
    function undo(msg) {
      render(box, prev, prevMine, prevPickers);
      var bar = box.querySelector('[data-pick-bar]');
      if (bar) { var o = bar.querySelector('.pkt-fx'); if (o) o.remove(); bar.classList.remove('is-flash'); }
      footError(box, msg);
    }
    fetch('/games/' + encodeURIComponent(box.dataset.gameId) + '/pick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ side: side }) })
      .then(function (r) {
        if (r.status === 401) { toLogin(box, side); return null; }
        return r.json().catch(function () { return {}; });
      })
      .then(function (d) {
        delete box.dataset.busy;
        if (!d) return;
        if (d.ok) {
          render(box, d.counts, d.side, d.pickers);
          // Same game shown twice on a page (e.g. profile + another widget): keep them in step.
          document.querySelectorAll('.gm-pick[data-game-id="' + CSS.escape(box.dataset.gameId) + '"]').forEach(function (o) { if (o !== box && !o.classList.contains('is-closed')) render(o, d.counts, d.side, d.pickers); });
        } else undo(d.error || "Couldn't save your pick. Try again.");
      })
      .catch(function () { delete box.dataset.busy; undo("Couldn't save your pick. Check your connection and try again."); });
  }
  document.addEventListener('click', function (e) {
    var box = e.target.closest('.gm-pick'); if (!box) return;
    var player = !!box.dataset.player, closed = box.classList.contains('is-closed');
    if (!player && !closed && e.target.closest('[data-badge]')) { toLogin(box, null); return; }
    var faces = e.target.closest('[data-faces-side]');
    if (faces) { openList(box, faces.dataset.facesSide); return; }
    if (closed) return;
    if (e.target.closest('[data-margin-save]')) { saveMargin(box); return; }
    if (e.target.closest('[data-margin]')) return;
    if (e.target.closest('[data-remove]')) { if (box.dataset.mine) send(box, null); return; }
    var tile = e.target.closest('[data-tile]'); if (!tile) return;
    var s = tile.dataset.tile;
    if (!player) { toLogin(box, s); return; }
    // Your own side again: nothing to change, just show it's yours. Removing lives in the footer.
    if (box.dataset.mine === s) { fx(box, s, 'pick'); return; }
    send(box, s);
  });
  // Back from logging in with ?pick=a:<id>: make that pick, then tidy the address bar.
  function pickFromLogin() {
    var q = new URLSearchParams(location.search), v = q.get('pick');
    if (!v) return;
    q.delete('pick');
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    var side = v.charAt(0), id = v.slice(2);
    if ((side !== 'a' && side !== 'b') || !id) return;
    var box = document.querySelector('.gm-pick[data-game-id="' + CSS.escape(id) + '"]');
    if (!box || !box.dataset.player || box.classList.contains('is-closed')) return;
    if (box.dataset.mine === side) { fx(box, side, 'pick'); return; }
    box.scrollIntoView({ block: 'center' });
    send(box, side);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pickFromLogin); else pickFromLogin();
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
