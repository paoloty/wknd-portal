// Rate your game in the app (/app/rate/:kind/:ref): the site's /rate screen (views/rate-game.js)
// for a phone. The court's stars, then one row per player who played: Yes / Maybe / No / Skip,
// good tags, and admin-only bad tags with a note. Saving posts to the site's own
// /rate/:kind/:ref (public/app.js initRate). Styles: public/app.css "Rate your game".
import { esc, backChev, appAvatar } from './layout.js';
import { displayPlayerName, playerPhotoUrl, initials } from '../utils.js';
import { RATE_ANSWERS, GOOD_TAGS, BAD_TAGS, NOTE_MAX } from '../../lib/game-ratings.js';

const star = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/></svg>';
const fmtDay = ms => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });

function courtCard(c) {
  const m = c.myRating;
  const stars = c.check?.stars || m?.stars || 0;
  return `<div class="sec">The court</div>
  <div class="card rt__court">
    <b class="rt__h">How was ${esc(c.name)}?</b>
    <p class="rt__sub">${m ? `You gave it ${m.stars} of 5 on ${esc(fmtDay(m.updated_at))}. Still right?` : 'Floor, rims, lights, getting there: how was it overall?'}</p>
    <div class="rt__stars" role="radiogroup" aria-label="Court rating">${[1, 2, 3, 4, 5].map(i => `<label><input type="radio" name="court_stars" value="${i}"${stars === i ? ' checked' : ''}><span aria-label="${i} of 5">${star}</span></label>`).join('')}</div>
    ${m ? '' : `<label class="st__field rt__field"><span>A short review <i>optional</i></span><textarea name="court_body" rows="3" maxlength="600" placeholder="What should someone know before their first run here?" enterkeyhint="done"></textarea></label>
    <label class="rt__check"><input type="checkbox" name="court_anon"><span>Post anonymously. Admins still see who wrote it.</span></label>`}
    ${c.done ? '<p class="rt__done">Court rated for this game</p>' : ''}
  </div>`;
}

function playerCell(p, mine) {
  const answer = mine?.answer || '';
  const tags = new Set(JSON.parse(mine?.tags_json || '[]'));
  const name = displayPlayerName(p.name);
  const tag = ([k, l], bad) => `<button type="button" class="rt__tag${bad ? ' rt__tag--bad' : ''}" aria-pressed="${tags.has(k)}" data-rt-tag="${esc(k)}">${esc(l)}</button>`;
  const open = answer === 'no' || BAD_TAGS.some(([k]) => tags.has(k));
  return `<div class="rt__p" data-rt-player="${esc(p.id)}">
    <div class="rt__who">${appAvatar({ playerId: p.id, initials: initials(p.name), ring: p.ring, photoUrl: playerPhotoUrl(p.id, 96) })}<b>${esc(name)}</b>${mine ? '<span class="rt__saved">Saved</span>' : ''}</div>
    <div class="seg rt__seg" role="radiogroup" aria-label="${esc(`Play with ${name} again?`)}">${RATE_ANSWERS.map(a => `<label><input type="radio" name="a_${esc(p.id)}" value="${a.key}"${answer === a.key ? ' checked' : ''}><span>${a.label}</span></label>`).join('')}</div>
    <div class="rt__tags" role="group" aria-label="What stood out (optional)">${GOOD_TAGS.map(t => tag(t, false)).join('')}</div>
    <details class="rt__bad"${open ? ' open' : ''}>
      <summary>Something off? <i>Only admins see this</i></summary>
      <div class="rt__tags" role="group" aria-label="What went wrong">${BAD_TAGS.map(t => tag(t, true)).join('')}</div>
      <label class="st__field rt__field"><span>Note for admins <i>optional</i></span><textarea rows="2" maxlength="${NOTE_MAX}" data-rt-note enterkeyhint="done">${esc(mine?.note || '')}</textarea></label>
    </details>
  </div>`;
}

// back: { href, label } · game: resolveRateGame() · players, court, mine: rateScreenData()
// closed: the window has passed · missing: why there's nothing to rate
export function appRatePage({ back, game, players = [], court = null, mine = {}, closed = false, missing = '' }) {
  const nav = `<div class="navbar"><a class="navbar__back" href="${esc(back.href)}">${backChev}${esc(back.label)}</a><span class="navbar__title">Rate your game</span><span></span></div>`;
  if (missing) return `${nav}<div class="empty rt__top">${esc(missing)}</div>`;
  const head = `<div class="card rt__top rt__head"><div class="kick">Rate your game</div><b class="rt__title">${esc(game.title)}</b><p class="rt__sub">${esc(game.line)}${court ? ` · ${esc(court.name)}` : ''}</p></div>`;
  if (closed) return `${nav}${head}<p class="msg msg--info">Ratings for this game have closed. You'll get the next one after your next game.</p>`;
  const left = players.filter(p => !mine[p.id]).length;
  return `${nav}${head}
  <form data-rt-form="${esc(`/rate/${game.kind}/${encodeURIComponent(game.ref)}`)}" novalidate>
    ${court ? courtCard(court) : ''}
    ${players.length ? `<div class="sec">Play with them again?</div>
    <div class="group rt__players">${players.map(p => playerCell(p, mine[p.id])).join('')}</div>
    <p class="foot-note">One tap each. Other players never see your answers, only their own good tags.${left && left < players.length ? ` ${left} left to rate.` : ''}</p>` : ''}
    <p class="msg msg--err" data-rt-msg role="alert" hidden></p>
    <div class="rt__send"><button type="submit" class="btn" data-rt-send>Done</button></div>
    <p class="foot-note rt__fine">Ratings help admins keep runs fun and respectful. They never decide anything on their own: fines and reports do.</p>
  </form>`;
}
