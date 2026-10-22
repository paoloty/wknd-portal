// "Rate your game" (/rate/:kind/:ref, lib/game-rate-ask.js): one screen per game where a
// player rates the court and everyone else who played. Opened from the post-game email (a
// signed link, so no login) or the bell. Court stars save to court_ratings (the court page
// shows them); answers about players save to game_ratings (admins, and the rated player's
// own good tags). Styles: public/styles.css "Rate your game".
import { escHtml } from './layout.js';
import { displayPlayerName, playerPhotoUrl, initials, teamColor } from './utils.js';
import { RATE_ANSWERS, GOOD_TAGS, BAD_TAGS, NOTE_MAX } from '../lib/game-ratings.js';

const STAR = '<svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24"><path fill="currentColor" d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>';
const fmtDay = ms => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });

function avatar(p) {
  return `<span class="rg-av" style="box-shadow:0 0 0 2px ${escHtml(teamColor(p.team_name))}"><span>${escHtml(initials(p.name))}</span><img src="${playerPhotoUrl(p.id, 96)}" alt="" loading="lazy" onerror="this.remove()"></span>`;
}

function courtBlock(x) {
  const c = x.court;
  if (!c) return '';
  const m = c.myRating;
  const stars = x.preStars || c.check?.stars || m?.stars || 0;
  const head = m
    ? `<p class="rg-muted">You rated it ${m.stars}★ on ${escHtml(fmtDay(m.updated_at))}. Still right? Tap to change. <a href="/courts/${encodeURIComponent(c.slug)}#crt-rate">Full court rating</a></p>`
    : `<p class="rg-muted">Floor, rims, lights, getting there: how was it overall?</p>`;
  return `<section class="card rg-card" aria-labelledby="rg-court-h">
    <h2 id="rg-court-h" class="rg-h">How was ${escHtml(c.name)}?</h2>
    ${head}
    <div class="rg-stars" role="radiogroup" aria-label="Court rating">${[1, 2, 3, 4, 5].map(i => `<label><input type="radio" name="court_stars" value="${i}"${stars === i ? ' checked' : ''}><span aria-label="${i} star${i === 1 ? '' : 's'}">${STAR}</span></label>`).join('')}</div>
    ${m ? '' : `<label class="rg-field"><span>First time here? A short review helps the next player. <em>Optional</em></span>
      <textarea name="court_body" rows="3" maxlength="600" placeholder="What should someone know before their first run here?"></textarea></label>
      <label class="rg-check"><input type="checkbox" name="court_anon"> <span>Post anonymously (shows as "A WKND player"; admins still see who wrote it)</span></label>`}
    ${c.done ? '<p class="rg-done">✓ Court rated for this game</p>' : ''}
  </section>`;
}

function playerRow(p, mine, pre) {
  const answer = pre?.answer || mine?.answer || '';
  const tags = new Set(JSON.parse(mine?.tags_json || '[]'));
  const tagBtn = ([k, l], bad) => `<button type="button" class="rg-tag${bad ? ' rg-tag--bad' : ''}" aria-pressed="${tags.has(k) ? 'true' : 'false'}" data-tag="${escHtml(k)}">${escHtml(l)}</button>`;
  const hasBad = BAD_TAGS.some(([k]) => tags.has(k));
  return `<li class="rg-player" data-player="${escHtml(p.id)}">
    <div class="rg-player__top">
      ${avatar(p)}
      <span class="rg-player__name">${escHtml(displayPlayerName(p.name))}${mine ? '<small>Saved</small>' : ''}</span>
    </div>
    <div class="rg-answers" role="radiogroup" aria-label="${escHtml(`Would you play with ${displayPlayerName(p.name)} again?`)}">
      ${RATE_ANSWERS.map(a => `<label class="rg-answer rg-answer--${a.key}"><input type="radio" name="a_${escHtml(p.id)}" value="${a.key}"${answer === a.key ? ' checked' : ''}><span>${a.label}</span></label>`).join('')}
    </div>
    <div class="rg-tags" role="group" aria-label="What stood out (optional)">${GOOD_TAGS.map(t => tagBtn(t, false)).join('')}</div>
    <details class="rg-bad"${hasBad || answer === 'no' ? ' open' : ''}>
      <summary>Something off? <em>Only admins see this</em></summary>
      <div class="rg-tags" role="group" aria-label="What went wrong">${BAD_TAGS.map(t => tagBtn(t, true)).join('')}</div>
      <label class="rg-field"><span>Note for admins <em>Optional</em></span><textarea rows="2" maxlength="${NOTE_MAX}" data-note>${escHtml(mine?.note || '')}</textarea></label>
    </details>
  </li>`;
}

// x: { game, players: [{ id, name, team_name }], mine: { id: row }, court: { name, slug,
// myRating, check, done } | null, preStars, prePlayer: { id, answer } | null, viaLink,
// viewerName, closed }
export function rateGamePage(x) {
  const g = x.game;
  const intro = `<div class="rg-head">
      <span class="rg-kicker">Rate your game</span>
      <h1 class="rg-title">${escHtml(g.title)}</h1>
      <p class="rg-sub">${escHtml(g.line)}${x.court ? ` · ${escHtml(x.court.name)}` : ''}</p>
      ${x.viaLink ? `<p class="rg-who">Rating as <b>${escHtml(displayPlayerName(x.viewerName))}</b> · <a href="/rate/not-me?next=${encodeURIComponent(`/rate/${g.kind}/${g.ref}`)}">Not you?</a></p>` : ''}
    </div>`;
  if (x.closed) {
    return `<div class="container"><div class="page-content rg-page">${intro}
      <div class="card rg-card"><p>Ratings for this game have closed. Watch for the link after your next game.</p></div></div></div>`;
  }
  const pre = x.prePlayer;
  const players = [...x.players].sort((a, b) => (pre && a.id === pre.id ? -1 : pre && b.id === pre.id ? 1 : 0));
  return `<div class="container"><div class="page-content rg-page">${intro}
    <form class="rg-form" data-rate-game="${escHtml(`/rate/${g.kind}/${encodeURIComponent(g.ref)}`)}" novalidate>
      ${courtBlock(x)}
      ${players.length ? `<section class="card rg-card" aria-labelledby="rg-players-h">
        <h2 id="rg-players-h" class="rg-h">Would you play with them again?</h2>
        <p class="rg-muted">One tap each. Your answers are anonymous to other players. Players only ever see their good tags.</p>
        <ul class="rg-players">${players.map(p => playerRow(p, x.mine[p.id], pre && pre.id === p.id ? pre : null)).join('')}</ul>
      </section>` : ''}
      <div class="rg-foot">
        <span class="rg-msg" data-msg role="status"></span>
        <button type="submit" class="rg-btn">Done</button>
      </div>
      <p class="rg-fine">Ratings help admins keep runs fun and respectful. They never decide anything on their own: qualification is based on fines and reports.</p>
    </form>
  </div></div>
<script>
(function () {
  var f = document.querySelector('[data-rate-game]');
  if (!f) return;
  var msg = f.querySelector('[data-msg]');
  f.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tag]');
    if (!t) return;
    t.setAttribute('aria-pressed', t.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
  });
  f.addEventListener('change', function (e) {
    if (e.target.name && e.target.name.indexOf('a_') === 0 && e.target.value === 'no') {
      var d = e.target.closest('.rg-player').querySelector('.rg-bad');
      if (d) d.open = true;
    }
  });
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var body = { players: [] };
    var cs = f.querySelector('input[name="court_stars"]:checked');
    if (cs) {
      var tb = f.querySelector('textarea[name="court_body"]');
      var an = f.querySelector('input[name="court_anon"]');
      body.court = { stars: Number(cs.value), body: tb ? tb.value : undefined, anon: an ? an.checked : undefined };
    }
    var bad = null;
    f.querySelectorAll('.rg-player').forEach(function (li) {
      var a = li.querySelector('input[type="radio"]:checked');
      if (!a) return;
      var tags = [].map.call(li.querySelectorAll('[data-tag][aria-pressed="true"]'), function (b) { return b.getAttribute('data-tag'); });
      if (a.value === 'no' && !li.querySelector('.rg-tag--bad[aria-pressed="true"]')) bad = bad || li;
      body.players.push({ id: li.getAttribute('data-player'), answer: a.value, tags: tags, note: (li.querySelector('[data-note]') || {}).value || '' });
    });
    if (bad) { msg.textContent = 'For a "No", pick what went wrong.'; bad.querySelector('.rg-bad').open = true; bad.scrollIntoView({ block: 'center' }); return; }
    if (!body.court && !body.players.length) { msg.textContent = 'Rate the court or at least one player first.'; return; }
    var btn = f.querySelector('.rg-btn'); btn.disabled = true; msg.textContent = 'Saving…';
    fetch(f.getAttribute('data-rate-game'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        btn.disabled = false;
        if (!x.ok) { msg.textContent = x.d.error || 'Could not save. Try again.'; return; }
        msg.textContent = x.d.message || 'Saved. Thanks!';
        body.players.forEach(function (p) {
          var n = f.querySelector('.rg-player[data-player="' + p.id + '"] .rg-player__name');
          if (n && !n.querySelector('small')) n.insertAdjacentHTML('beforeend', '<small>Saved</small>');
        });
        if (/[?&](u|t|stars|p|a)=/.test(location.search)) history.replaceState(null, '', location.pathname);
      })
      .catch(function () { btn.disabled = false; msg.textContent = 'Could not save. Check your connection.'; });
  });
})();
</script>`;
}
