// The feed on Home and the screens it opens: a game (/app/games/:id) and a news post
// (/app/posts/:slug). Items arrive newest first from server.js appFeedItems(), one lazy
// page at a time (/app/feed/items → JSON { html, next }), each page carrying the day of its
// last item so a day header isn't repeated across pages.
import { esc, appAvatar, icons, backChev, soonTag, lazyList } from './layout.js';

// A YouTube watch/share/embed URL → its 11-character video id, or ''.
export const ytId = url => (String(url || '').match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/) || [])[1] || '';
const ytThumb = id => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

// Picture on top of a card or screen. With a video it's our player (public/app.js
// mountPlayer: YouTube loads under this picture), so it plays inside the app; the photo beats
// YouTube's auto-picked frame when both exist. inCard: inside a tappable card, so the
// picture is just a picture (the card opens the screen where it plays).
function media({ img = '', srcset = '', yt = '', label = '' } = {}, { inCard = false } = {}) {
  if (!img && !yt) return '';
  // Not loading="lazy": iPhone Safari never loads a lazy image added while its list is still
  // hidden (the feed's pages). A picture that fails is retried once, then logged and removed
  // (public/app.js "Pictures that fail").
  // srcset: the photo in two widths; a card is the screen less 32px, up to 528px (.app max 560).
  const sized = img && srcset ? ` srcset="${esc(srcset)}" sizes="(min-width: 560px) 528px, calc(100vw - 32px)"` : '';
  const pic = `<img src="${esc(img || ytThumb(yt))}"${sized} alt="" decoding="async">`;
  const tag = label ? `<em>${esc(label)}</em>` : '';
  if (!yt) return `<span class="media">${pic}</span>`;
  if (inCard) return `<span class="media">${pic}<i class="media__play">${icons.play}</i>${tag}</span>`;
  return `<div class="media player" data-yt="${esc(yt)}">${pic}<i class="media__play">${icons.play}</i>${tag}</div>`;
}

const scoreRows = (a, b) => `<div class="score">
  ${[a, b].map(t => `<div class="score__t${t.won ? ' is-w' : ''}"><span class="dot" style="--c:${esc(t.color)}"></span><span class="score__n">${esc(t.name)}</span><b class="num">${esc(t.score)}</b></div>`).join('')}
</div>`;

const potgLabel = p => (p.co ? 'Co-player of the game' : 'Player of the game');
const potgStrip = (p, label = potgLabel(p)) => `<div class="potg">${appAvatar({ playerId: p.playerId, initials: p.initials, ring: p.ring, photoUrl: p.photoUrl })}
  <div class="potg__t">${label ? `<small>${label}</small>` : ''}<b>${esc(p.name)}</b><em>${esc(p.line)}</em></div></div>`;

const paras = text => String(text || '').split(/\n{2,}/).map(t => t.trim()).filter(Boolean)
  .map(t => `<p>${esc(t).replace(/\n/g, '<br>')}</p>`).join('');

function gameCard(g) {
  return `<a class="fc fc--link" href="${esc(g.href)}">
    <div class="fc__top"><span class="kick">${esc(g.kicker)}</span><span class="fc__t">${esc(g.when)}</span></div>
    ${media(g.media, { inCard: true })}
    ${scoreRows(g.a, g.b)}
    ${g.title ? `<h3>${esc(g.title)}</h3>` : ''}
    ${g.excerpt ? `<p class="clamp">${esc(g.excerpt)}</p><span class="more">Read the recap</span>` : ''}
    ${g.potg.map(p => potgStrip(p)).join('')}
    ${g.mine ? `<div class="mine"><span>Your line</span><b class="num">${esc(g.mine)}</b></div>` : ''}
    <div class="fc__foot">${g.fire ? `<span>🔥 ${g.fire}</span>` : ''}${g.comments != null ? `<span>💬 ${g.comments} comment${g.comments === 1 ? '' : 's'}</span>` : ''}<span class="fc__go">Box score ›</span></div>
  </a>`;
}

function annCard(a) {
  return `<article class="fc${a.pinned ? ' fc--pin' : ''}">
    <div class="fc__top"><span class="kick">${a.pinned ? '📌 ' : ''}Announcement</span><span class="fc__t">${esc(a.when)}</span></div>
    ${media({ ...a.media, yt: a.yt })}
    ${a.title ? `<h3>${esc(a.title)}</h3>` : ''}
    ${a.body ? `<div class="fc__body">${paras(a.body)}</div>` : ''}
  </article>`;
}

function postCard(p) {
  return `<a class="fc fc--link" href="${esc(p.href)}">
    <div class="fc__top"><span class="kick">News</span><span class="fc__t">${esc(p.when)}</span></div>
    <h3>${esc(p.title)}</h3>
    ${p.excerpt ? `<p class="clamp mut">${esc(p.excerpt)}</p>` : ''}<span class="more">Read</span>
  </a>`;
}

// View only for now: joining happens on the Papawis tab once it's built into the app.
function papawisCard(r) {
  const pct = r.max ? Math.min(100, Math.round((r.confirmed / r.max) * 100)) : 0;
  const left = Math.max(0, r.max - r.confirmed);
  return `<article class="fc">
    <div class="fc__top"><span class="kick">Papawis</span><span class="fc__t">${esc(r.when)}</span></div>
    <h3>${esc(r.title)}</h3>
    <p class="mut">${esc([r.runDay, r.time, r.place].filter(Boolean).join(' · '))}</p>
    <div class="prog"><div style="width:${pct}%"></div></div>
    <div class="fc__row"><span class="mut">${r.confirmed} of ${r.max} in${left ? ` · ${left} spot${left === 1 ? '' : 's'} left` : ' · full'}${r.waitlist ? ` · ${r.waitlist} waiting` : ''}</span>${soonTag}</div>
  </article>`;
}

const CARD = { game: gameCard, ann: annCard, post: postCard, papawis: papawisCard };

// items: [{ kind, day, ... }]; prevDay: the day header already shown above this page.
export function appFeedRows(items, prevDay = '') {
  let day = prevDay;
  return items.map(it => {
    const head = it.day && it.day !== day ? `<div class="feed-day">${esc(it.day)}</div>` : '';
    if (it.day) day = it.day;
    return head + (CARD[it.kind] ? CARD[it.kind](it) : '');
  }).join('');
}

// Home: setup card, then (only when something has a deadline) the action strip, the pinned
// announcement, and the feed. Up next lives on My Team and To do on Me now.
// actions: [{ text, sub, href, soon }] · pinned: an announcement item or null
export function appHomeFeedPage({ header, setupHtml = '', installHtml = '', actions = [], pinned = null }) {
  const strip = actions.length ? `<div class="actions" role="list">${actions.map(a => {
    const inner = `<span class="actions__dot" aria-hidden="true"></span><span class="actions__t">${esc(a.text)}${a.sub ? `<small>${esc(a.sub)}</small>` : ''}</span>${a.href ? '<span class="actions__go">›</span>' : soonTag}`;
    return a.href ? `<a class="actions__row" role="listitem" href="${esc(a.href)}">${inner}</a>` : `<div class="actions__row" role="listitem">${inner}</div>`;
  }).join('')}</div>` : '';
  return `${header}
  ${setupHtml}
  ${installHtml}
  ${strip}
  ${pinned ? `<div class="feed feed--pinned">${annCard(pinned)}</div>` : ''}
  <div class="sec">Latest</div>
  ${lazyList({ src: '/app/feed/items', cards: true, empty: 'Nothing here yet. Results, news and announcements show up here.' })}`;
}

const navbar = (back, title) => `<div class="navbar"><a class="navbar__back" href="${esc(back.href)}">${backChev}${esc(back.label)}</a><span class="navbar__title">${esc(title)}</span><span></span></div>`;

// Box score for one team; the viewer's own row stands out.
function boxTable(team, meId) {
  return `<div class="box">
    <div class="box__head"><span class="dot" style="--c:${esc(team.color)}"></span><b>${esc(team.name)}</b>${team.won ? '<span class="box__w">W</span>' : ''}</div>
    <table class="bx"><thead><tr><th></th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th></tr></thead><tbody>
    ${team.rows.map(r => `<tr${r.playerId === meId ? ' class="is-me"' : ''}><td>${r.number !== '' ? `<span class="bx__no">${esc(r.number)}</span>` : ''}${esc(r.name)}${r.playerId === meId ? ' <small>· you</small>' : ''}</td><td>${r.pts}</td><td>${r.reb}</td><td>${r.ast}</td><td>${r.stl}</td><td>${r.blk}</td></tr>`).join('')}
    </tbody></table></div>`;
}

// g: { title, a, b, media, meta, final, recap: { title, paras[] }, potg: [...+writeup], mine,
//      teams: [boxTeam, boxTeam], comments: [{ name, initials, ring, playerId, photoUrl, body, when }] | null,
//      fire, back: { href, label }, meId }
export function appGamePage(g) {
  const recap = g.recap && (g.recap.title || g.recap.paras.length) ? `<section class="fc art">
      <div class="kick">Recap</div>
      ${g.recap.title ? `<h2>${esc(g.recap.title)}</h2>` : ''}
      ${g.recap.paras.map(t => `<p>${esc(t)}</p>`).join('')}
    </section>` : (g.final ? '<div class="empty" style="margin-top:12px">The recap isn\'t written yet. It shows up here once it is.</div>' : '');
  const potg = g.potg.length ? `<section class="fc art">${g.potg.map(p => `
      <div class="kick">${potgLabel(p)}</div>
      ${potgStrip(p, '')}
      ${p.writeup ? paras(p.writeup) : ''}`).join('<div class="art__gap"></div>')}</section>` : '';
  const comments = g.comments ? `<section class="fc art">
      <div class="kick">Comments · ${g.comments.length}</div>
      ${g.comments.length ? g.comments.map(c => `<div class="cm">${appAvatar({ playerId: c.playerId, initials: c.initials, ring: c.ring, photoUrl: c.photoUrl })}
        <div><b>${esc(c.name)}<small>${esc(c.when)}</small></b><p>${esc(c.body)}</p></div></div>`).join('') : '<p class="mut">No comments yet.</p>'}
      <p class="cm__soon">Commenting in the app ${soonTag}</p>
    </section>` : '';
  return `${navbar(g.back, g.title)}
  <section class="fc game-hero">
    ${media(g.media)}
    ${scoreRows(g.a, g.b)}
    <p class="mut game-hero__meta">${esc(g.meta)}</p>
    ${g.mine ? `<div class="mine"><span>Your line</span><b class="num">${esc(g.mine)}</b></div>` : ''}
  </section>
  ${recap}
  ${potg}
  ${g.teams.length ? `<section class="fc art"><div class="kick">Box score</div>${g.teams.map(t => boxTable(t, g.meId)).join('')}</section>` : ''}
  ${comments}
  <div style="height:12px"></div>`;
}

// A news post. bodyHtml is the admin-written article, rendered as the site renders it.
export function appPostPage({ title, when, bodyHtml, back }) {
  return `${navbar(back, 'News')}
  <article class="fc art post">
    <div class="kick">News · ${esc(when)}</div>
    <h1>${esc(title)}</h1>
    <div class="post__body">${bodyHtml}</div>
  </article>
  <div style="height:12px"></div>`;
}
