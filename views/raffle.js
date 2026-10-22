// /raffle (lib/raffle.js, docs/plans/ratings-and-raffle.md Phase 2; mockup: canvas "Raffle
// Page Mockup"). The current round's countdown, your tickets and odds, games still to rate,
// who's in, your ticket history and prizes, past draws, the rules and the fairness code.
// At draw time the page polls /raffle/state.json and plays the reel when the result lands;
// the server already picked the winner, the reel only reveals it. Styles: public/styles.css
// "Raffle".
import { escHtml } from './layout.js';

const fmtWhen = ms => new Date(ms).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
const fmtDay = ms => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
const TICKET = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M13 6v2M13 11v2M13 16v2"/></svg>';
const LOCK = '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const SOURCE_LABEL = { game_rated: 'Rated a game', first_court_review: 'First review of a court', carried: 'Carried over', admin: 'Given by an admin' };
const sh = (title, aside = '') => `<div class="section-header"><h2>${escHtml(title)}</h2>${aside}</div>`;

function drawCard(x) {
  if (x.paused) return `<section class="card rf-hero"><b class="rf-hero__h">The raffle is paused</b><p class="rf-muted">No draws for now. Tickets you already have stay in the round.</p></section>`;
  const r = x.round;
  return `<section class="card rf-hero" aria-labelledby="rf-next">
    <div class="rf-hero__top"><h2 id="rf-next" class="rf-label">Next draw</h2><span class="rf-hero__when">${escHtml(fmtWhen(r.drawsAt))}</span></div>
    <div class="rf-cd" role="timer" data-rf-cd="${r.drawsAt}">${['days', 'hrs', 'min', 'sec'].map(l => `<div class="rf-cd__cell"><span class="rf-cd__n" data-u="${l}">--</span><span class="rf-cd__l">${l}</span></div>`).join('')}</div>
    <div class="rf-hero__stats">
      <span><b>${r.players}</b> player${r.players === 1 ? '' : 's'} in</span>
      <span><b>${r.tickets}</b> ticket${r.tickets === 1 ? '' : 's'}</span>
      <span>${r.players >= x.minPlayers ? `<b class="rf-ok">✓</b> Min. ${x.minPlayers} reached` : `${x.minPlayers - r.players} more player${x.minPlayers - r.players === 1 ? '' : 's'} needed`}</span>
    </div>
    <p class="rf-muted">Prize: <b class="rf-text">${escHtml(x.prizeLabel)}</b>, used on any run you sign up for.</p>
  </section>`;
}

function mineCard(x) {
  const m = x.me;
  if (!m) return `<section class="card rf-mine"><div><b class="rf-mine__h">Play, rate, win</b><p class="rf-muted"><a href="/login?next=/raffle">Log in</a> to see your tickets. You earn one for every game you rate.</p></div></section>`;
  const odds = x.round.tickets && m.tickets && !m.exclusion ? Math.max(1, Math.round(m.tickets / x.round.tickets * 100)) : 0;
  const left = m.games.filter(g => !g.done).length;
  return `<section class="card rf-mine" aria-labelledby="rf-mine-h">
    <div class="rf-mine__ring"><b>${m.tickets}</b><span>ticket${m.tickets === 1 ? '' : 's'}</span></div>
    <div class="rf-mine__body">
      <h2 id="rf-mine-h" class="rf-mine__h">Your tickets this round</h2>
      ${m.exclusion ? `<p class="rf-warn">${escHtml(m.exclusion)}: you can't win this draw. Your tickets still count once that's sorted.</p>`
        : `<p class="rf-muted">${m.tickets ? `${m.tickets} of ${x.round.tickets} tickets · about a ${odds}% chance` : 'None yet: rate your next game to get in.'}</p>`}
      ${left ? `<p class="rf-text">Rate ${left} more game${left === 1 ? '' : 's'} for <b class="rf-amber">+${left}</b> before the draw.</p>` : ''}
    </div>
  </section>`;
}

function gamesList(m) {
  if (!m?.games.length) return '';
  return `${sh('Games to rate', '<span class="rf-muted rf-small">3 days to rate each</span>')}
  <div class="rf-list">${m.games.map(g => `<a class="card rf-game${g.done ? ' is-done' : ''}" href="/rate/${g.kind}/${encodeURIComponent(g.ref)}">
      <span class="rf-game__main"><span class="rf-kicker">${g.kind === 'league' ? 'League game' : 'Papawis run'} · rate by ${escHtml(fmtDay(g.windowEndsAt))}</span><b>${escHtml(g.title)}</b><span class="rf-muted rf-small">${escHtml(g.line)}</span></span>
      <span class="rf-game__tix">${g.done ? '✓ Ticket earned' : '+1 ticket →'}</span>
    </a>`).join('')}</div>`;
}

function entrantsList(x) {
  if (!x.entrants.length) return '';
  const shown = x.entrants.slice(0, 10);
  return `${sh("Who's in", `<span class="rf-muted rf-small">${x.entrants.length} player${x.entrants.length === 1 ? '' : 's'}</span>`)}
  <div class="card rf-rows">${shown.map(e => `<div class="rf-row"><span class="rf-av"><span>${escHtml(e.initials)}</span><img src="/api/player/${encodeURIComponent(e.id)}/photo?w=96" alt="" loading="lazy" onerror="this.remove()"></span><span class="rf-row__name">${escHtml(e.name)}${e.me ? ' <small>you</small>' : ''}</span><b class="rf-num">${e.n}</b><span class="rf-muted rf-small">ticket${e.n === 1 ? '' : 's'}</span></div>`).join('')}
    ${x.entrants.length > shown.length ? `<p class="rf-muted rf-small rf-more">and ${x.entrants.length - shown.length} more</p>` : ''}</div>`;
}

function historyList(m) {
  if (!m?.history.length) return '';
  return `${sh('Your ticket history', '<span class="rf-muted rf-small">This round</span>')}
  <div class="card rf-rows">${m.history.map(h => `<div class="rf-row"><span class="rf-row__name">${escHtml(SOURCE_LABEL[h.source] || h.source)}<small class="rf-muted">${escHtml(h.label || '')}</small></span><b class="rf-num rf-amber">+${h.amount}</b></div>`).join('')}</div>`;
}

function prizesList(m) {
  if (!m?.vouchers.length && !m?.wins.length) return '';
  const st = { active: 'Ready to use', reserved: 'On an upcoming run', used: 'Used', expired: 'Expired' };
  return `${sh('Your prizes')}
  <div class="card rf-rows">${m.vouchers.map(v => `<div class="rf-row"><span class="rf-row__name">${escHtml(v.label)}<small class="rf-muted">${v.status === 'active' ? `Sign up for a run, then tap "Use my free run" on its card.${v.expires_season ? ` Good through Season ${escHtml(v.expires_season)}.` : ''}` : ''}</small></span><b class="${v.status === 'active' ? 'rf-amber' : 'rf-muted'}">${st[v.status] || v.status}</b></div>`).join('')}
  ${m.wins.map(w => `<div class="rf-row"><span class="rf-row__name">Show my name as winner of Round ${w.number}<small class="rf-muted">Off: you show as "A lucky player".</small></span><button type="button" class="rf-toggle" aria-pressed="${w.hide ? 'false' : 'true'}" data-rf-hide="${escHtml(w.roundId)}">${w.hide ? 'Hidden' : 'Shown'}</button></div>`).join('')}</div>`;
}

function pastList(x) {
  if (!x.past.length) return '';
  return `${sh('Past draws')}
  <div class="rf-past">${x.past.map(p => `<div class="card rf-pastcard">
      <span class="rf-kicker">Round ${p.number} · ${escHtml(fmtDay(p.drawnAt))}</span>
      <b>${p.status === 'drawn' ? escHtml(p.winner) : p.status === 'rolled' ? 'Rolled over' : 'Skipped'}</b>
      <span class="rf-muted rf-small">${p.status === 'drawn' ? `${p.tickets} tickets · ${p.players} players` : escHtml(p.note)}</span>
      ${p.status === 'drawn' ? `<button type="button" class="rf-linkbtn" data-rf-replay="${escHtml(p.id)}">Watch replay</button>` : ''}
    </div>`).join('')}</div>`;
}

function rules(x) {
  const items = [
    ['Play a run or a league game', 'Only games you played in count.'],
    ['Rate it within 3 days: +1 ticket', 'The court and everyone you played with. Skip counts, and the answers you give never change your tickets.'],
    [`First review of a court: +${x.reviewBonus} more`, `Write ${x.reviewMin}+ characters; it counts once an admin approves it.`],
    [`Every other Sunday at 8 PM`, `The draw runs on its own. It needs ${x.minPlayers}+ players, or tickets roll over once. Tickets reset after each draw.`],
    ['Who can win', 'Active players in good standing. Admins can’t win, and a winner sits out for 3 months.'],
  ];
  return `<span id="rf-how"></span>${sh('How it works')}
  <div class="card rf-rules">${items.map(([t, d], i) => `<div class="rf-rule"><span class="rf-rule__n">${i + 1}</span><span><b>${escHtml(t)}</b><span class="rf-muted">${escHtml(d)}</span></span></div>`).join('')}</div>
  <div class="rf-fair">${LOCK}<span><b>Fair draw, no one picks the winner.</b> This round's secret number was locked when it opened. Its fingerprint is below; the number is shown after the draw so anyone can check it.</span><code>${escHtml(x.round?.seedHash || '')}</code></div>`;
}

// x: { name, paused, round: { id, number, drawsAt, players, tickets, seedHash }, minPlayers, prizeLabel,
//      reviewBonus, reviewMin, me: { tickets, exclusion, games, history, vouchers, wins } | null,
//      entrants: [{ id, name, initials, n, me }], past: [...], last: { id, … } | null }
export function rafflePage(x) {
  return `<div class="container"><div class="page-content rf-page">
  <div class="rf-head"><span class="rf-kicker rf-amber">${escHtml(x.name)}${x.round ? ` · Round ${x.round.number}` : ''}</span>
    <h1 class="rf-title">Rate your games.<br><span class="rf-amber">Win a free run.</span></h1>
    <p class="rf-muted">Every other Sunday at 8 PM, one player wins a free Papawis run. Rate the court and the players after each game to earn tickets.</p></div>
  <section class="card rf-stage" id="rf-stage" hidden aria-live="polite">
    <span class="rf-label" data-rf-stage-label>Drawing…</span>
    <div class="rf-reel"><div class="rf-reel__track" data-rf-track></div><i class="rf-reel__ptr" aria-hidden="true"></i></div>
    <div class="rf-stage__result" data-rf-result hidden></div>
  </section>
  ${drawCard(x)}
  ${mineCard(x)}
  ${gamesList(x.me)}
  ${entrantsList(x)}
  ${historyList(x.me)}
  ${prizesList(x.me)}
  ${pastList(x)}
  ${rules(x)}
  </div></div>
<script>
(function () {
  var cd = document.querySelector('[data-rf-cd]');
  var openRound = ${JSON.stringify(x.round?.id || '')}, lastSeen = ${JSON.stringify(x.last?.id || '')};
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function tick() {
    if (!cd) return;
    var ms = Math.max(0, Number(cd.getAttribute('data-rf-cd')) - Date.now()), s = Math.floor(ms / 1000);
    var v = { days: Math.floor(s / 86400), hrs: Math.floor(s / 3600) % 24, min: Math.floor(s / 60) % 60, sec: s % 60 };
    for (var k in v) { var el = cd.querySelector('[data-u="' + k + '"]'); if (el) el.textContent = pad(v[k]); }
    return ms;
  }
  tick(); setInterval(tick, 1000);
  var stage = document.getElementById('rf-stage'), track = stage.querySelector('[data-rf-track]'), result = stage.querySelector('[data-rf-result]');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // One card per ticket (scaled down past 60), shuffled from the round id so a replay is the
  // same reel; the winner's card sits near the end where the reel stops.
  function rand(seed) { var h = 2166136261; for (var i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); } return function () { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; }
  function play(d) {
    var r = rand(d.id), total = d.entrants.reduce(function (t, e) { return t + e.n; }, 0), scale = total > 60 ? 60 / total : 1, cards = [];
    d.entrants.forEach(function (e) { for (var i = 0, k = Math.max(1, Math.round(e.n * scale)); i < k; i++) cards.push(e); });
    while (cards.length < 36) cards = cards.concat(cards);
    for (var i = cards.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = cards[i]; cards[i] = cards[j]; cards[j] = t; }
    var win = cards.length - 5, w = d.entrants.filter(function (e) { return e.id === d.winnerId; })[0];
    if (w) cards[win] = w;
    track.innerHTML = cards.map(function (c, i) { return '<div class="rf-card' + (i === win ? ' is-win' : '') + '"><span class="rf-av"><span>' + esc(c.initials) + '</span><img src="/api/player/' + encodeURIComponent(c.id) + '/photo?w=96" alt="" onerror="this.remove()"></span><b>' + esc(c.name) + '</b><small>' + c.n + (c.n === 1 ? ' ticket' : ' tickets') + '</small></div>'; }).join('');
    stage.hidden = false; result.hidden = true; stage.classList.remove('is-done');
    stage.querySelector('[data-rf-stage-label]').textContent = 'Drawing… Round ' + d.number;
    stage.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    var slot = 120, center = track.parentNode.clientWidth / 2, jitter = Math.round(r() * 70 - 35);
    track.style.transition = 'none'; track.style.transform = 'translateX(' + (center - 2 * slot - 56) + 'px)';
    track.getBoundingClientRect();
    track.style.transition = reduce ? 'none' : 'transform 6.5s cubic-bezier(0.08, 0.72, 0.14, 1)';
    track.style.transform = 'translateX(' + (center - win * slot - 56 + jitter) + 'px)';
    setTimeout(function () {
      stage.classList.add('is-done');
      stage.querySelector('[data-rf-stage-label]').textContent = 'Round ' + d.number + ' winner';
      result.innerHTML = '<b class="rf-win">' + esc(d.winnerName) + '</b><span>wins a <b class="rf-amber">' + esc(d.prize) + '</b></span><small class="rf-muted">' + d.tickets + ' tickets · ' + d.players + ' players</small>' + (d.seed ? '<small class="rf-muted">Secret number: <code>' + esc(d.seed) + '</code></small>' : '');
      result.hidden = false;
    }, reduce ? 300 : 6700);
  }
  function state() { return fetch('/raffle/state.json', { credentials: 'same-origin' }).then(function (r) { return r.json(); }); }
  // Around draw time, poll; when the round we were watching is drawn, play it once.
  setInterval(function () {
    var ms = cd ? Number(cd.getAttribute('data-rf-cd')) - Date.now() : Infinity;
    if (ms > 180000 || ms < -600000) return;
    state().then(function (s) {
      if (s.last && s.last.id !== lastSeen && s.last.id === openRound) {
        lastSeen = s.last.id;
        if (s.last.status === 'drawn') play(s.last); else location.reload();
      }
    }).catch(function () {});
  }, 5000);
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-rf-replay]');
    if (b) { fetch('/raffle/rounds/' + encodeURIComponent(b.getAttribute('data-rf-replay')) + '.json').then(function (r) { return r.json(); }).then(play).catch(function () {}); return; }
    var h = e.target.closest('[data-rf-hide]');
    if (h) {
      var show = h.getAttribute('aria-pressed') !== 'true';
      fetch('/raffle/rounds/' + encodeURIComponent(h.getAttribute('data-rf-hide')) + '/name', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hide: !show }) })
        .then(function (r) { if (r.ok) { h.setAttribute('aria-pressed', show ? 'true' : 'false'); h.textContent = show ? 'Shown' : 'Hidden'; } });
    }
  });
})();
</script>`;
}
