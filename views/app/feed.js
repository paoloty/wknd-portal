// The feed on Home and the screens it opens: a game (/app/games/:id) and a news post
// (/app/posts/:slug). Items arrive newest first from server.js appFeedItems(), one lazy
// page at a time (/app/feed/items → JSON { html, next }), each page carrying the day of its
// last item so a day header isn't repeated across pages.
import { esc, appAvatar, icons, backChev, soonTag, lazyList } from './layout.js';
import { pickOption, pickCard } from './picks.js';

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

const potgLabel = p => (p.co ? 'Co-player of the game' : 'Player of the game');
const potgStrip = (p, label = potgLabel(p)) => `<div class="potg">${appAvatar({ playerId: p.playerId, initials: p.initials, ring: p.ring, photoUrl: p.photoUrl })}
  <div class="potg__t">${label ? `<small>${label}</small>` : ''}<b>${esc(p.name)}</b><em>${esc(p.line)}</em></div></div>`;

const paras = text => String(text || '').split(/\n{2,}/).map(t => t.trim()).filter(Boolean)
  .map(t => `<p>${esc(t).replace(/\n/g, '<br>')}</p>`).join('');

// ── Feed cards (styled: Paolo, 2026-10-23). Amber stays the only accent; team colours only
// in dots and rings. ──

// The game photo (cover, else the video's thumbnail) as the hero, the score set on it. No
// picture: the same hero on a dark gradient. A picture that fails is removed (app.js), which
// leaves that gradient.
// The score on the game's picture (feed card and game screen). band: no picture behind it
// (the game screen with a video, where the player sits above it).
function gameHero(g, { band = false } = {}) {
  const m = g.media || {};
  const src = band ? '' : m.img || (m.yt ? ytThumb(m.yt) : '');
  const sized = m.img && m.srcset && !band ? ` srcset="${esc(m.srcset)}" sizes="(min-width: 560px) 528px, calc(100vw - 32px)"` : '';
  const row = t => `<div class="gx__row${t.won ? ' is-w' : ''}"><span class="dot" style="--c:${esc(t.color)}"></span><span class="gx__t">${esc(t.name)}</span><b>${esc(t.score)}</b></div>`;
  const chip = !band && m.yt ? '▶ Video' : g.when;
  return `<div class="gx__hero${band ? ' gx__hero--band' : ''}">
      ${src ? `<img class="gx__img" src="${esc(src)}"${sized} alt="" decoding="async">` : ''}
      <div class="gx__top"><span class="sx__chip sx__chip--glass">${esc(g.kicker)}</span>${chip ? `<span class="sx__chip sx__chip--glass">${esc(chip)}</span>` : ''}</div>
      <div class="gx__score">${row(g.a)}${row(g.b)}</div>
    </div>`;
}
// Player of the game: the amber strip with a ★ on their ring.
const potgBox = (p, label = potgLabel(p)) => `<div class="gx__potg">${appAvatar({ playerId: p.playerId, initials: p.initials, ring: p.ring, photoUrl: p.photoUrl })}<i class="gx__star" aria-hidden="true">★</i>
  <div class="potg__t">${label ? `<small>${label}</small>` : ''}<b>${esc(p.name)}</b><em>${esc(p.line)}</em></div></div>`;

function gameCard(g) {
  return `<a class="sx gx" href="${esc(g.href)}">
    ${gameHero(g)}
    <div class="sx__body">
      ${g.title ? `<h3>${esc(g.title)}</h3>` : ''}
      ${g.excerpt ? `<p class="gx__ex">${esc(g.excerpt)}</p>` : ''}
      ${g.potg.map(p => potgBox(p)).join('')}
      ${g.mine ? `<div class="gx__mine"><span>Your line</span><b class="num">${esc(g.mine)}</b></div>` : ''}
      <div class="gx__foot">${g.fire ? `<span>🔥 ${g.fire}</span>` : ''}${g.comments != null ? `<span>💬 ${g.comments}</span>` : ''}<span class="gx__go">Box score ›</span></div>
    </div>
  </a>`;
}

function annCard(a) {
  return `<article class="sx ax${a.pinned ? ' is-pinned' : ''}"><div class="sx__body">
    <div class="ax__head"><span class="ax__ico" aria-hidden="true">📣</span><div><b>${esc(a.by || 'WKND League')}</b><small>Announcement · ${esc(a.when)}</small></div>${a.pinned ? '<span class="sx__chip sx__chip--amber">📌 Pinned</span>' : ''}</div>
    ${a.media?.img || a.yt ? `<div class="ax__media">${media({ ...a.media, yt: a.yt })}</div>` : ''}
    ${a.title ? `<h3>${esc(a.title)}</h3>` : ''}
    ${a.body ? `<div class="ax__body">${paras(a.body)}</div>` : ''}
  </div></article>`;
}

function postCard(p) {
  return `<a class="sx nx" href="${esc(p.href)}">
    ${p.img ? `<div class="nx__pic"><img src="${esc(p.img)}" alt="" decoding="async"></div>` : ''}
    <div class="sx__body"><div class="nx__top"><span class="sx__chip sx__chip--amber">News</span><span class="sx__when">${esc(p.when)}</span></div>
      <h3>${esc(p.title)}</h3>${p.excerpt ? `<p>${esc(p.excerpt)}</p>` : ''}<span class="sx__go">Read ›</span></div>
  </a>`;
}

// Opens the Papawis tab, where the player joins.
// faces: [{ ini, color }] of who's in (up to 5).
function papawisCard(r) {
  const pct = r.max ? Math.min(100, Math.round((r.confirmed / r.max) * 100)) : 0;
  const left = Math.max(0, r.max - r.confirmed);
  return `<a class="sx px" href="/app/papawis"><div class="sx__body">
    <div class="px__top"><span class="sx__chip sx__chip--amber">Papawis</span><span class="px__when">${esc([r.runDay, r.time].filter(Boolean).join(' · '))}</span></div>
    <h3>${esc(r.title)}</h3>
    ${r.place ? `<p class="px__where">📍 ${esc(r.place)}</p>` : ''}
    <div class="px__bar"><i style="width:${pct}%"></i></div>
    <div class="px__foot">${r.faces?.length ? `<span class="px__faces">${r.faces.map(f => `<i style="--c:${esc(f.color)}">${esc(f.ini)}</i>`).join('')}</span>` : ''}<span>${r.confirmed} of ${r.max} in${r.waitlist ? ` · ${r.waitlist} waiting` : ''}</span><b>${left ? `${left} spot${left === 1 ? '' : 's'} left` : 'Full'}</b></div>
    <span class="sx__go">${left ? 'Join ›' : 'Join the waitlist ›'}</span>
  </div></a>`;
}

const CARD = { game: gameCard, ann: annCard, post: postCard, papawis: papawisCard };

// items: [{ kind, day, ... }]; prevDay: the day header already shown above this page.
export function appFeedRows(items, prevDay = '') {
  let day = prevDay;
  return items.map(it => {
    const head = it.day && it.day !== day ? `<div class="feed-day"><span>${esc(it.day)}</span></div>` : '';
    if (it.day) day = it.day;
    return head + (CARD[it.kind] ? CARD[it.kind](it) : '');
  }).join('');
}

// Home: setup card, then (only when something has a deadline) the action strip, the pinned
// announcement, and the feed. Up next lives on My Team and To do on Me now.
// actions: [{ text, sub, href, soon }] · pinned: an announcement item or null
// rail: the next game day's games (loaded after the screen from /app/rail, public/app.js initBlocks).
export function appHomeFeedPage({ header, setupHtml = '', installHtml = '', actions = [], pinned = null, rail = false }) {
  const strip = actions.length ? `<div class="actions" role="list">${actions.map(a => {
    const inner = `<span class="actions__dot" aria-hidden="true"></span><span class="actions__t">${esc(a.text)}${a.sub ? `<small>${esc(a.sub)}</small>` : ''}</span>${a.href ? '<span class="actions__go">›</span>' : soonTag}`;
    return a.href ? `<a class="actions__row" role="listitem" href="${esc(a.href)}">${inner}</a>` : `<div class="actions__row" role="listitem">${inner}</div>`;
  }).join('')}</div>` : '';
  return `${header}
  ${setupHtml}
  ${installHtml}
  <div class="card glow push-ask" data-push-ask hidden>
    <b>Turn on notifications?</b>
    <p>Picks closing, new Papawis runs, your stat card after a game. You choose which in Settings.</p>
    <div class="push-ask__btns"><button type="button" class="btn" data-push-ask-on>Turn on</button><button type="button" class="btn btn--ghost" data-push-ask-off>Not now</button></div>
  </div>
  ${strip}
  ${pinned ? `<div class="feed feed--pinned">${annCard(pinned)}</div>` : ''}
  ${rail ? '<div class="rail-block" data-block-src="/app/rail"><div class="rail-h"><b class="skel skel--line skel--short" style="width:120px"></b></div><div class="rail"><div class="rc skel-card"><span class="skel skel--line skel--short"></span><span class="skel skel--block"></span><span class="skel skel--line"></span></div><div class="rc skel-card"></div></div></div>' : ''}
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
      ${potgBox(p, '')}
      ${p.writeup ? paras(p.writeup) : ''}`).join('<div class="art__gap"></div>')}</section>` : '';
  const comments = g.comments ? `<section class="fc art">
      <div class="kick">Comments · ${g.comments.length}</div>
      ${g.comments.length ? g.comments.map(c => `<div class="cm">${appAvatar({ playerId: c.playerId, initials: c.initials, ring: c.ring, photoUrl: c.photoUrl })}
        <div><b>${esc(c.name)}<small>${esc(c.when)}</small></b><p>${esc(c.body)}</p></div></div>`).join('') : '<p class="mut">No comments yet.</p>'}
      <p class="cm__soon">Commenting in the app ${soonTag}</p>
    </section>` : '';
  const video = !!g.media?.yt;
  return `${navbar(g.back, g.title)}
  <section class="sx gx gx--screen">
    ${video ? `<div class="gx__video">${media(g.media)}</div>` : ''}
    ${gameHero(g, { band: video })}
    <div class="sx__body">${g.meta ? `<p class="gx__meta">${esc(g.meta)}</p>` : ''}
      ${g.mine ? `<div class="gx__mine"><span>Your line</span><b class="num">${esc(g.mine)}</b></div>` : ''}</div>
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

// ── The next game day (Home's rail and the game preview screen) ──
const ring = t => `<span class="rc__ring" style="--c:${esc(t.color)}">${esc(t.name.slice(0, 2))}</span>`;
const matchup = g => `<div class="rc__mu">
    <div class="rc__tm">${ring(g.a)}<b>${esc(g.a.name)}</b><small>${esc(g.a.rec || ' ')}</small></div>
    <span class="rc__vs">VS</span>
    <div class="rc__tm">${ring(g.b)}<b>${esc(g.b.name)}</b><small>${esc(g.b.rec || ' ')}</small></div>
  </div>`;
const formChips = f => `<span class="form">${String(f || '').split('').map(x => `<i class="${x === 'W' ? 'w' : 'l'}">${x}</i>`).join('')}</span>`;
const pickedLine = g => {
  const n = g.counts.a + g.counts.b;
  return g.myPick ? `You${n > 1 ? ` + ${n - 1}` : ''} picked` : n ? `${n} picked · tap a team` : 'Be the first to pick';
};

// A pick card for the rail: same buttons and data as views/app/picks.js (public/app.js
// initPicks saves them), plus Preview ›.
function railPickCard(g) {
  return `<section class="rc pick" data-pick-game="${esc(g.id)}" data-pick-a="${esc(g.a.name)}" data-pick-b="${esc(g.b.name)}" data-close-label="${esc(g.closeLabel)}">
    <div class="rc__top"><span class="kick">${esc([g.title, g.tip].filter(Boolean).join(' · '))}</span>${g.closeAt ? `<span class="rc__clock" data-close-at="${g.closeAt}"></span>` : ''}</div>
    ${matchup(g)}
    <div class="pick__opts">${pickOption(g, 'a')}${pickOption(g, 'b')}</div>
    <div class="rc__foot"><span>${pickedLine(g)}</span><a href="/app/games/${encodeURIComponent(g.id)}?from=home">Preview ›</a></div>
    <p class="pick__msg" data-pick-msg hidden></p>
  </section>`;
}

// Picks closed: the preview, with the player's pick.
function railPreviewCard(g) {
  const p = g.preview || {};
  const mine = g.myPick ? (g.myPick === 'a' ? g.a : g.b) : null;
  const w = (p.watch || []).filter(Boolean);
  return `<a class="rc rc--pv" href="/app/games/${encodeURIComponent(g.id)}?from=home">
    <div class="rc__top"><span class="kick">Preview${g.tip ? ` · ${esc(g.tip)}` : ''}</span><span class="rc__tag">Picks closed</span></div>
    ${matchup(g)}
    ${p.last ? `<div class="pv__line"><span>Last met</span><b>${esc(p.last.text)} · ${esc(p.last.date)}</b></div>` : '<div class="pv__line"><span>First meeting</span><b>New matchup</b></div>'}
    ${p.formA || p.formB ? `<div class="pv__line"><span>Last 5</span>${formChips(p.formA)}${formChips(p.formB)}</div>` : ''}
    ${w.length ? `<div class="pv__watch">${w.map(x => `<span>${esc(x.name)} <small>${esc(x.line)}</small></span>`).join('')}</div>` : ''}
    <div class="rc__foot"><span>${mine ? `Your pick: <b style="color:${esc(mine.color)}">●</b> ${esc(mine.name)}` : 'You didn\'t pick this one'}</span><span class="rc__go">Preview ›</span></div>
  </a>`;
}

// cards: app picks shaping (server.js appPickGame), closed ones with .preview (appPreview).
export function appRail({ dayLabel, cards }) {
  if (!cards.length) return '';
  const open = cards.some(c => !c.closed);
  const one = cards.length === 1;
  return `<div class="rail-h"><b>${open ? `Who wins? · ${esc(dayLabel)}` : `${esc(dayLabel)}'s games`}</b><a href="/app/picks">${open ? 'All picks' : 'Picks'} ›</a></div>
  <div class="rail${one ? ' rail--one' : ''}" data-rail>${cards.map(c => (c.closed ? railPreviewCard(c) : railPickCard(c))).join('')}${one ? '' : '<a class="rc rc--end" href="/app/picks"><i>›</i>Pickmaster<br>&amp; all games</a>'}</div>
  ${one ? '' : `<div class="dots" data-rail-dots>${cards.map((c, i) => `<i${i ? '' : ' class="on"'}></i>`).join('')}</div>`}`;
}

// Before tip-off: the game's preview. pick: the pick card while picks are open (or the pick
// made); preview: server.js appPreview.
export function appGamePreviewPage({ back, title, kicker, meta, court = '', a, b, pick, preview: p, lastHref }) {
  const w = (p.watch || []).filter(Boolean);
  // While there's a pick card it is the top of the screen (it has the matchup, day and time).
  return `${navbar(back, title)}
  ${pick ? `<div class="pv-pick">${pickCard(pick)}</div>${court ? `<p class="foot-note" style="margin-top:-4px;margin-bottom:12px">At ${esc(court)}</p>` : ''}` : `<section class="fc glow game-hero">
    <div class="fc__top"><span class="kick">Preview · ${esc(kicker)}</span></div>
    ${matchup({ a, b })}
    <p class="mut game-hero__meta" style="text-align:center;margin-top:10px !important">${esc(meta)}</p>
  </section>`}
  ${p.story ? `<section class="fc art"><div class="kick">Storyline</div><h2>${esc(p.story.headline)}</h2>${p.story.body ? `<p>${esc(p.story.body)}</p>` : ''}</section>` : ''}
  <section class="fc art">
    <div class="kick">The matchup</div>
    <div class="pv__line"><span>Records</span><b>${esc(a.name)} ${esc(a.rec || '–')} · ${esc(b.name)} ${esc(b.rec || '–')}</b></div>
    ${p.formA || p.formB ? `<div class="pv__line"><span>Last 5</span><span class="pv__forms"><span>${esc(a.name)} ${formChips(p.formA)}</span><span>${esc(b.name)} ${formChips(p.formB)}</span></span></div>` : ''}
    ${p.last ? `<a class="pv__line" href="${esc(lastHref)}"><span>Last met</span><b>${esc(p.last.text)} · ${esc(p.last.date)} ›</b></a>` : '<div class="pv__line"><span>Last met</span><b>First meeting</b></div>'}
    ${p.series ? `<div class="pv__line"><span>All-time series</span><b>${esc(p.series)}</b></div>` : ''}
  </section>
  ${w.length ? `<section class="fc art"><div class="kick">Players to watch</div>${w.map(x => potgStrip(x, '')).join('')}</section>` : ''}
  <div style="height:12px"></div>`;
}
