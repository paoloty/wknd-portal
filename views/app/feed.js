// The feed on Home and the screens it opens: a game (/app/games/:id) and a news post
// (/app/posts/:slug). Items arrive newest first from server.js appFeedItems(), one lazy
// page at a time (/app/feed/items → JSON { html, next }), each page carrying the day of its
// last item so a day header isn't repeated across pages.
import { esc, appAvatar, icons, backChev, soonTag, lazyList } from './layout.js';
import { pickOption, pickCard } from './picks.js';
import { appSocialBar, appThreadPanel } from './comments.js';
import { papawisAction } from './papawis.js';
import { todoCard } from './home.js';
import { lineScore, gameRecapSections, boxCard, jumpBar } from './game.js';
import { liveWhen } from '../../lib/live-score.js';
import { liveExtrasHtml } from '../live-extras.js';
import { liveChatHtml } from '../live-chat.js';

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
  // hidden (the feed's pages); feed cards below the top two wait instead (appFeedRows). A picture that fails is retried once, then logged and removed
  // (public/app.js "Pictures that fail").
  // srcset: the photo in three widths; a card is the screen less 32px, up to 528px (.app max 560).
  const sized = img && srcset ? ` srcset="${esc(srcset)}" sizes="(min-width: 560px) 528px, calc(100vw - 32px)"` : '';
  const pic = `<img src="${esc(img || ytThumb(yt))}"${sized} alt="" decoding="async">`;
  const tag = label ? `<em>${esc(label)}</em>` : '';
  if (!yt) return `<span class="media">${pic}</span>`;
  if (inCard) return `<span class="media">${pic}<i class="media__play">${icons.play}</i>${tag}</span>`;
  return `<div class="media player" data-yt="${esc(yt)}">${pic}<i class="media__play">${icons.play}</i>${tag}</div>`;
}

const potgLabel = p => (p.co ? 'Co-player of the game' : 'Player of the game');
const potgStrip = (p, label = potgLabel(p)) => `<div class="potg"${p.playerId ? ` data-pid="${esc(p.playerId)}"` : ''}>${appAvatar({ playerId: p.playerId, initials: p.initials, ring: p.ring, photoUrl: p.photoUrl })}
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
  return `<div class="gx__hero${band ? ' gx__hero--band' : ''}${g.live || g.inReview ? ' gx__hero--live' : ''}">
      ${src ? `<img class="gx__img" src="${esc(src)}"${sized} alt="" decoding="async">` : ''}
      <div class="gx__top"><span class="sx__chip sx__chip--glass${g.live ? ' sx__chip--live' : ''}">${esc(g.kicker)}</span>${chip ? `<span class="sx__chip sx__chip--glass">${esc(chip)}</span>` : ''}</div>
      <div class="gx__score">${row(g.a)}${row(g.b)}</div>
    </div>`;
}
// Player of the game: the amber strip with a ★ on their ring.
const potgBox = (p, label = potgLabel(p)) => `<div class="gx__potg"${p.playerId ? ` data-pid="${esc(p.playerId)}"` : ''}>${appAvatar({ playerId: p.playerId, initials: p.initials, ring: p.ring, photoUrl: p.photoUrl })}<i class="gx__star" aria-hidden="true">★</i>
  <div class="potg__t">${label ? `<small>${label}</small>` : ''}<b>${esc(p.name)}</b><em>${esc(p.line)}</em></div></div>`;

// social: the 🔥 / 💬 bar (views/app/comments.js), outside the link so its buttons work.
function gameCard(g) {
  return `<article class="sx gx${g.social ? ' has-cx' : ''}"><a class="gx__link" href="${esc(g.href)}">
    ${gameHero(g)}
    <div class="sx__body">
      ${g.title ? `<h3>${esc(g.title)}</h3>` : ''}
      ${g.excerpt ? `<p class="gx__ex">${esc(g.excerpt)}</p>` : ''}
      ${g.potg.map(p => potgBox(p)).join('')}
      ${g.mine ? `<div class="gx__mine"><span>Your line</span><b class="num">${esc(g.mine)}</b></div>` : ''}
    </div>
  </a><div class="sx__act">${g.shareHref ? `<a class="btn" href="${esc(g.shareHref)}">${icons.share}<span>Share my stats</span></a>` : `<a class="btn btn--ghost" href="${esc(g.href)}">Box score &amp; recap</a>`}</div>${appSocialBar(g.social)}</article>`;
}

function annCard(a) {
  return `<article class="sx ax${a.pinned ? ' is-pinned' : ''}"><div class="sx__body">
    <div class="ax__head"><span class="ax__ico" aria-hidden="true">${icons.megaphone}</span><div><b>${esc(a.by || 'WKND League')}</b><small>Announcement · ${esc(a.when)}</small></div>${a.pinned ? `<span class="sx__chip sx__chip--amber">${icons.pinned}Pinned</span>` : ''}</div>
    ${a.media?.img || a.yt ? `<div class="ax__media">${media({ ...a.media, yt: a.yt })}</div>` : ''}
    ${a.title ? `<h3>${esc(a.title)}</h3>` : ''}
    ${a.body ? `<div class="ax__body">${paras(a.body)}</div>` : ''}
  </div>${appSocialBar(a.social)}</article>`;
}

function postCard(p) {
  return `<article class="sx nx"><a class="gx__link" href="${esc(p.href)}">
    ${p.img ? `<div class="nx__pic"><img src="${esc(p.img)}" alt="" decoding="async"></div>` : ''}
    <div class="sx__body"><div class="nx__top"><span class="sx__chip sx__chip--amber">News</span><span class="sx__when">${esc(p.when)}</span></div>
      <h3>${esc(p.title)}</h3>${p.excerpt ? `<p>${esc(p.excerpt)}</p>` : ''}</div>
  </a><div class="sx__act"><a class="btn btn--ghost" href="${esc(p.href)}">Read</a></div></article>`;
}

// A Papawis run with its action right on the card (the Papawis tab's button, same rules;
// public/app.js initPapawis). The rest of the card opens the Papawis tab.
// it.run: server.js appPapawisRuns (faces, state, photo: papawisCoverUrl).
function papawisCard(it) {
  const r = it.run;
  const pct = r.max ? Math.min(100, Math.round((r.filled / r.max) * 100)) : 0;
  const faces = r.faces.slice(0, 8); // overlapping, as on the Papawis tab
  return `<article class="sx px${it.social ? ' has-cx' : ''}" data-pw-card="${esc(r.id)}"><a class="gx__link" href="/app/papawis">
    ${r.photo ? `<div class="px__pic"><img src="${esc(r.photo)}" alt="" decoding="async"></div>` : ''}
    <div class="sx__body">
      <div class="px__top"><span class="sx__chip sx__chip--amber">Papawis</span><span class="px__when">${esc([r.today ? 'Today' : r.day, r.time].filter(Boolean).join(' · '))}</span></div>
      <h3>${esc(r.title)}</h3>
      <p class="px__where">${icons.pin}${esc(r.place)}</p>
      <div class="px__bar"><i style="width:${pct}%"></i></div>
      ${faces.length ? `<span class="pwr__stack px__stack"><span class="pwr__faces">${faces.map(f => `<span class="pwr__face${f.me ? ' is-me' : ''}">${appAvatar({ playerId: f.playerId, initials: f.ini, ring: f.color, photoUrl: f.photoUrl })}</span>`).join('')}${r.faces.length > faces.length ? `<span class="pwr__more">+${r.faces.length - faces.length}</span>` : ''}</span></span>` : ''}
      <div class="px__foot"><span>${r.filled} of ${r.max} in${r.waiting ? ` · ${r.waiting} waiting` : ''}</span><b>${r.full ? 'Full' : `${r.open} spot${r.open === 1 ? '' : 's'} left`}</b></div>
    </div>
  </a><div class="sx__act pwr__action">${papawisAction(r)}<p class="msg msg--err" data-pw-msg hidden></p></div>${appSocialBar(it.social)}</article>`;
}

// A finished Papawis run (2026-10-31): the AI recap (or the run's name till it's written), each
// game's Light–Dark score, the Player of the Day, everyone who played. Opens the run screen.
// it: server.js appFeedItem 'pwres'.
const boldNames = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
function papawisResultCard(r) {
  const faces = r.faces.slice(0, 8);
  const s = r.summary;
  return `<article class="sx px pxr${r.social ? ' has-cx' : ''}"><a class="gx__link" href="${esc(r.href)}">
    <div class="sx__body">
      <div class="px__top"><span class="sx__chip sx__chip--amber">Papawis</span><span class="px__when">${esc(s ? r.title : 'Results')}</span></div>
      <h3>${s?.headline ? boldNames(s.headline) : esc(r.title)}</h3>
      ${s?.body ? `<p class="gx__ex">${esc(s.body.replace(/\*\*/g, ''))}</p>` : r.place ? `<p class="px__where">${icons.pin}${esc(r.place)}</p>` : ''}
      <div class="pxr__games">${r.games.map(g => `<div class="pxr__g"><span class="pxr__n">Game ${g.n}</span><span class="pxr__s"><span class="pw-shirt pw-shirt--light" aria-hidden="true"></span>Light <b class="num${g.b > g.a ? ' is-dim' : ''}">${g.a}</b><span aria-hidden="true">–</span><b class="num${g.a > g.b ? ' is-dim' : ''}">${g.b}</b> Dark <span class="pw-shirt pw-shirt--dark" aria-hidden="true"></span></span></div>`).join('')}</div>
      ${r.potd ? potgBox(r.potd, 'Player of the Day') : ''}
      ${faces.length ? `<div class="pxr__who"><span class="pwr__stack px__stack"><span class="pwr__faces">${faces.map(f => `<span class="pwr__face${f.me ? ' is-me' : ''}">${appAvatar(f)}</span>`).join('')}${r.faces.length > faces.length ? `<span class="pwr__more">+${r.faces.length - faces.length}</span>` : ''}</span></span><span>${r.faces.length} played</span></div>` : ''}
      ${r.mine ? `<div class="gx__mine"><span>Your line</span><b class="num">${esc(r.mine)}</b></div>` : ''}
    </div>
  </a><div class="sx__act"><a class="btn btn--ghost" href="${esc(r.href)}">Full results</a></div>${appSocialBar(r.social)}</article>`;
}

const CARD = { game: gameCard, ann: annCard, post: postCard, papawis: papawisCard, pwres: papawisResultCard };

// A card's pictures wait as data-src until the card nears the screen (public/app.js wakeImgs):
// Home used to pull all 20 covers, ~1.7 MB, for the one and a half cards in view (Fable speed
// audit, 2026-10-28). The faces too, now that the first page comes in Home's own HTML: there
// they'd load ahead of the app's script.
const deferImgs = html => html.replace(/<img\b[^>]*>/g, tag => tag.replace(' src="', ' data-src="').replace(' srcset="', ' data-srcset="'));

// items: [{ kind, day, ... }]; prevDay: the day header already shown above this page.
// eager: how many cards load their pictures at once (the first page's top two).
export function appFeedRows(items, prevDay = '', { eager = 0 } = {}) {
  let day = prevDay;
  return items.map((it, i) => {
    const head = it.day && it.day !== day ? `<div class="feed-day"><span>${esc(it.day)}</span></div>` : '';
    if (it.day) day = it.day;
    // data-fk: the card's key, so a fresh Home can update only the cards that changed
    // (public/app.js patchHome).
    const fk = it.href || (it.kind === 'papawis' ? `pw:${it.run?.id}` : `${it.kind}:${it.id || i}`);
    const card = CARD[it.kind] ? CARD[it.kind](it).replace(/^\s*<([a-z]+)/, `<$1 data-fk="${esc(fk)}"`) : '';
    return head + (i < eager ? card : deferImgs(card));
  }).join('');
}

// Home: setup card, then (only when something has a deadline) the To do card, the pinned
// announcement, and the feed. Up next lives on My Team and the full To do on Me.
// todos: views/app/home.js todoCard items · pinned: an announcement item or null
// rail: the next game day's games (server.js appRailHtml), '' for none. Built in, not loaded after:
// a block that lands after the screen pushes everything under it down (Paolo: "jittery", 2026-10-29).
// live: the live card (server.js appLiveNowHtml), '' when nothing's live: then Home only checks once
// a minute; while live, every 15 s. data-block-have: already filled, no load on arrival.
// The notifications card is shown by the script after it, before the first paint, for the same
// reason (public/app.js initPush shows it after a swap).
// feed: the feed's first page ({ html, next }, server.js appFeedPage), in the screen itself so
// the cards come with Home instead of one request later (Fable speed audit, 2026-10-28).
export function appHomeFeedPage({ header, setupHtml = '', installHtml = '', todos = [], pinned = null, rail = '', live = '', feed = null }) {
  const strip = todoCard(todos);
  return `${header}
  ${setupHtml}
  ${installHtml}
  <div class="card glow push-ask" data-push-ask hidden>
    <b>Turn on notifications?</b>
    <p>Picks closing, new Papawis runs, your stat card after a game. You choose which in Settings.</p>
    <div class="push-ask__btns"><button type="button" class="btn" data-push-ask-on>Turn on notifications</button><button type="button" class="btn btn--plain" data-push-ask-off>Not now</button></div>
  </div><script>(function(){try{if('serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window&&Notification.permission==='default'&&Date.now()>Number(localStorage.getItem('wknd-push-ask')||0))document.currentScript.previousElementSibling.hidden=false;}catch(e){}})();</script>
  ${strip}
  ${pinned ? `<div class="feed feed--pinned">${annCard(pinned)}</div>` : ''}
  <div class="live-now" data-block-src="/app/live-now" data-block-every="15000" data-block-idle="60000" data-block-have${live ? '' : ' hidden'}>${live}</div>
  ${rail ? `<div class="rail-block" data-block-src="/app/rail" data-block-have>${rail}</div>` : ''}
  ${lazyList({ src: '/app/feed/items', cards: true, first: feed, empty: 'Nothing here yet. Results, news and announcements show up here.' })}`;
}

const navbar = (back, title) => `<div class="navbar"><a class="navbar__back" href="${esc(back.href)}">${backChev}${esc(back.label)}</a><span class="navbar__title">${esc(title)}</span><span></span></div>`;

// g: { title, a, b, media, meta, final, recap: { title, paras[] }, potg: [...+writeup], mine,
//      teams: [boxTeam, boxTeam], thread: appThreadData() | null (comments off),
//      fire, back: { href, label }, meId }
//      full: server.js appGameRecap() (views/app/game.js), myTeamId
export function appGamePage(g) {
  const potg = g.potg.length ? `<section class="fc art">${g.potg.map(p => `
      <div class="kick">${potgLabel(p)}</div>
      ${potgBox(p, '')}
      ${p.writeup ? paras(p.writeup) : ''}`).join('<div class="art__gap"></div>')}</section>` : '';
  // thread: appThreadData (server.js), the same panel the feed's sheet shows.
  const comments = g.thread ? `<section class="fc art th-sec" id="comments">
      <div class="kick">Comments<span data-th-count-label>${g.thread.count ? ` · ${g.thread.count}` : ''}</span></div>
      ${appThreadPanel(g.thread)}
    </section>` : '';
  const video = !!g.media?.yt;
  return `${navbar(g.back, g.title)}
  ${reviewCard(g.review)}
  <section class="sx gx gx--screen">
    ${video ? `<div class="gx__video">${media(g.media)}</div>` : ''}
    ${gameHero(g, { band: video })}
    <div class="sx__body">${g.meta ? `<p class="gx__meta">${esc(g.meta)}</p>` : ''}
      ${g.teams.length === 2 ? lineScore(g.teams[0], g.teams[1], g.full.quarters) : ''}
      ${g.mine ? `<div class="gx__mine"><span>Your line</span><b class="num">${esc(g.mine)}</b></div>` : ''}
      ${g.shareHref ? `<a class="btn gx__share" href="${esc(g.shareHref)}">${icons.share}<span>Share my stats</span></a>` : ''}</div>
  </section>
  ${gameRecapSections(g, { potgHtml: potg, commentsHtml: comments, commentCount: g.thread?.count || 0,
    emptyRecap: '<div class="empty gr-empty" id="gr-recap">The recap isn\'t written yet. It shows up here once it is.</div>' })}
  <div style="height:12px"></div>`;
}

// A finished game's Review card (server.js appReviewCard, games admins only).
function reviewCard(r) {
  if (!r) return '';
  const go = (kind, label, primary) => `<form method="post" action="${esc(r.action)}"><input type="hidden" name="kind" value="${kind}"><button type="submit" class="btn${primary ? '' : ' btn--ghost'}">${esc(label)}</button></form>`;
  if (r.state === 'held') {
    const t = r.take;
    const take = !t ? '' : t.superAdmin
      ? `<button type="button" class="btn" data-adm-post="${esc(t.url)}" data-adm-body="${esc(JSON.stringify({ action: 'take' }))}" data-adm-ask-title="Take over from ${esc(r.holder)}?" data-adm-ask-yes="Take over" data-adm-ask-icon="flag" data-adm-ask="${esc(`${r.holder} gets a bell that you took the review. What their phone already sent stays in it.`)}" data-adm-done="You have the review">Take over</button>`
      : t.asked ? `<p class="foot-note" style="margin:0">You asked ${esc(r.holder)} to hand it over.</p>`
      : `<button type="button" class="btn btn--ghost" data-adm-post="${esc(t.url)}" data-adm-body="${esc(JSON.stringify({ action: 'ask' }))}" data-adm-done="Asked">Ask ${esc(r.holder)} to hand it over</button>`;
    return `<section class="fc rv-card"><div class="kick">Review</div><p><b>${esc(r.holder)}</b> is reviewing this game.</p><div class="rv-card__b">${take}${r.watch ? `<a class="btn btn--ghost" href="${esc(r.watch)}">Watch the review live</a>` : ''}</div></section>`;
  }
  // Its track at Game over: Publish (the site's publish route, public/app.js [data-adm-post]).
  const saveBtn = (final, label, primary) => `<button type="button" class="btn${primary ? '' : ' btn--ghost'}" data-adm-post="${esc(r.publish.url)}" data-adm-body="${esc(JSON.stringify({ pass: r.publish.pass, final }))}" data-adm-ask-title="Save the box score?" data-adm-ask-yes="Save it" data-adm-ask-icon="up" data-adm-ask="${esc(`${final === 'plays' ? `Final score ${r.publish.mismatch.plays.a}–${r.publish.mismatch.plays.b} from the plays. ` : final === 'typed' ? `Final score stays ${r.publish.mismatch.typed.a}–${r.publish.mismatch.typed.b}. ` : ''}${r.publish.hidden ? 'The stats go on the site and in the app once Visible to everyone is on; the POTG and recap come next' : 'The stats go on the site and in the app now; the POTG and recap come next'}`)}" data-adm-done="Box score saved">${esc(label)}</button>`;
  // The plays and the typed final differ: say so, and save with either one (Paolo, 2026-10-27).
  const mm = r.publish && r.publish.mismatch;
  const pub = !r.publish ? '' : mm
    ? `<p class="rv-card__mm">The plays add up to <b>${mm.plays.a}–${mm.plays.b}</b>; the final score says <b>${mm.typed.a}–${mm.typed.b}</b>.</p>${saveBtn('plays', `Save with ${mm.plays.a}–${mm.plays.b} (the plays)`, true)}${saveBtn('typed', `Save with ${mm.typed.a}–${mm.typed.b} (the final score)`, false)}`
    : saveBtn('', 'Save the box score', true);
  // Published from the court: the stats wait for a games admin (Looks right, or Fix the plays).
  if (r.state === 'pending') return `<section class="fc rv-card"><div class="kick">Stats pending review</div><p><b>${esc(r.by)}</b> published it from the court. Check the box score: if it looks right, mark it checked; if not, fix the plays (the box score comes off meanwhile, the final score stays).</p>
    <div class="rv-card__b"><button type="button" class="btn" data-adm-post="${esc(r.approve)}" data-adm-ask-title="Mark the stats as checked?" data-adm-ask-yes="Looks right" data-adm-ask-icon="flag" data-adm-ask="The “Stats pending review” tag comes off the game" data-adm-done="Stats checked">Looks right</button><button type="button" class="btn btn--ghost" data-adm-post="${esc(r.fix)}" data-adm-ask-title="Fix the plays?" data-adm-ask-yes="Fix the plays" data-adm-ask-icon="flag" data-adm-ask="The box score comes off while you review the plays; the final score and picks stay" data-adm-done="Review started">Fix the plays</button>${r.finish ? `<a class="btn btn--ghost" href="${esc(r.finish)}">Finish the game</a>` : ''}</div></section>`;
  // Box score saved: the next step until the POTG and the recap are in (the site's Content tab).
  if (r.state === 'next') return `<section class="fc rv-card"><div class="kick">Next · admins</div><p>Box score saved. ${!r.potg && !r.recap ? 'Next: the POTG and the recap.' : !r.potg ? 'Next: the POTG.' : 'Next: the recap.'}</p><div class="rv-card__b"><a class="btn" href="${esc(r.next)}">${!r.potg && !r.recap ? 'Finish the game' : !r.potg ? 'Pick the POTG' : 'Write the recap'}</a></div></section>`;
  if (r.state === 'mine') return `<section class="fc rv-card"><div class="kick">Review · yours</div><p>${r.publish ? `Your ${r.kind === 'video' ? 're-track' : 'review'} is at Game over. Save the box score, or go back in to fix plays.` : `You’re ${r.kind === 'video' ? 're-tracking it from the video' : 'checking the plays'}.`}</p><div class="rv-card__b">${pub}${go(r.kind || 'plays', 'Continue the review', !pub)}${r.watch ? `<a class="btn btn--ghost" href="${esc(r.watch)}">Watch it live</a>` : ''}</div></section>`;
  return `<section class="fc rv-card"><div class="kick">Review · admins</div>
    <p>${r.state === 'scored' ? 'This game was scored live. Check the plays, or re-track it from the video.' : r.hasBox ? 'This game’s box score came from wknd-stats. Re-track it from the video to check it; publishing the review replaces that box score (the final score stays).' : 'This game has a final score but no plays. Fill in the box score: re-track it from the video, or enter the plays.'}</p>
    <div class="rv-card__b">${go('video', 'Re-track from the video', r.video)}${go('plays', r.state === 'scored' ? 'Check the plays' : 'Enter the plays', !r.video)}</div>
    ${r.video ? '' : '<p class="foot-note">No video on this game yet: add its YouTube link on the site’s admin to re-track from it.</p>'}</section>`;
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

// Being scored: the live score (the card opens the live game).
function railLiveCard(g) {
  const mine = g.myPick ? (g.myPick === 'a' ? g.a : g.b) : null;
  const side = (t, n) => `<div class="rc-live__t"><span class="dot" style="--c:${esc(t.color)}"></span><span>${esc(t.name)}</span><b class="num">${n}</b></div>`;
  return `<a class="rc rc--live" href="/app/games/${encodeURIComponent(g.id)}?from=home">
    <div class="rc__top"><span class="kick live-kick">Live</span><span class="rc__tag num">${esc(g.live.when)}</span></div>
    ${side(g.a, g.live.a)}${side(g.b, g.live.b)}
    <div class="rc__foot"><span>${mine ? `Your pick: <b style="color:${esc(mine.color)}">●</b> ${esc(mine.name)}` : 'You didn\'t pick this one'}</span><span class="rc__go">Watch live ›</span></div>
  </a>`;
}
// Home's live card: games being scored right now (server.js /app/live-now), in the finished
// game's card design (gameHero: the photo, both teams, the score), LIVE blinking red.
export function appLiveNow(cards) {
  return cards.map(c => { const href = c.href || `/app/games/${encodeURIComponent(c.id)}?from=home`; return `<article class="sx gx gx--live${c.review ? ' gx--review' : ''}"><a class="gx__link" href="${esc(href)}">
    ${gameHero({ kicker: c.kicker, when: c.when, media: c.media, live: !c.review, inReview: !!c.review, a: { ...c.a, won: c.a.score > c.b.score }, b: { ...c.b, won: c.b.score > c.a.score } })}
    ${c.line ? `<div class="sx__body"><p class="gx__ex live-now__line">${esc(c.line)}</p></div>` : ''}
  </a><div class="sx__act"><a class="btn btn--ghost" href="${esc(href)}">${c.review ? 'Watch the review' : 'Watch live'}</a></div></article>`; }).join('');
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
  <div class="rail${one ? ' rail--one' : ''}" data-rail>${cards.map(c => (c.live ? railLiveCard(c) : c.closed ? railPreviewCard(c) : railPickCard(c))).join('')}${one ? '' : '<a class="rc rc--end" href="/app/picks"><i>›</i>Pickmaster<br>&amp; all games</a>'}</div>
  ${one ? '' : `<div class="dots" data-rail-dots>${cards.map((c, i) => `<i${i ? '' : ' class="on"'}></i>`).join('')}</div>`}`;
}

// ── Live: while the game is being scored (lib/live-score.js liveScoreData), before publish ──
// The site's live view, app-styled: the score on the hero, team fouls and timeouts, the line
// score, the box score (the finished game's own table) and the play-by-play. "In review" from the final till
// published. public/live-score.js swaps both parts in as plays arrive.
export function appLiveParts(l, { meId = '', myTeamId = '', extras = null } = {}) {
  const side = t => ({ ...t, won: t.score >= (t === l.a ? l.b : l.a).score });
  const a = side(l.a), b = side(l.b);
  const tf = t => `<div class="lv-tf__t"><span class="dot" style="--c:${esc(t.color)}"></span><span>${t.fouls} foul${t.fouls === 1 ? '' : 's'}${t.penalty ? ' · <b>Penalty</b>' : t.penaltyNext ? ' · <b>Penalty next</b>' : ''}</span><span class="mut">${t.toLeft} TO left</span></div>`;
  const hero = `<section class="sx gx gx--screen lv">
    ${gameHero({ kicker: l.ended ? 'Final · in review' : 'Live', when: liveWhen(l), live: !l.ended, inReview: l.ended, a: { ...a, won: a.score >= b.score }, b: { ...b, won: b.score >= a.score } })}
    <div class="sx__body">
      <div class="lv-tf">${tf(a)}${tf(b)}</div>
      ${lineScore(a, b, l.quarters)}
      <p class="foot-note">${l.ended ? 'Scored live and now in review. Official once it’s published.' : 'Updates as the scorer logs each play. Clock as of the last play.'}</p>
    </div>
  </section>`;
  const row = p => `<div class="lv-pl${p.end ? ' lv-pl--end' : ''}" data-lv-play="${esc(p.id)}">
      <span class="lv-pl__t">${esc(p.period)}${p.clock ? ` <small>${esc(p.clock)}</small>` : ''}</span>
      <span class="lv-pl__x">${p.end ? '' : `<span class="dot" style="--c:${esc(p.side === 'b' ? b.color : p.side === 'a' ? a.color : '#5b6475')}"></span>`}<b>${esc(p.who)}</b>${p.what ? ` ${esc(p.what)}` : ''}</span>
      <span class="lv-pl__s num${p.scoring ? ' is-score' : ''}">${p.score.a}–${p.score.b}</span></div>`;
  const box = a.rows.length + b.rows.length ? boxCard([a, b], meId, myTeamId, []) : '';
  const body = `${liveExtrasHtml(extras, l)}${box}
  <section class="fc gr" id="lv-plays">
    <div class="gr-head"><span class="kick">Play-by-play</span><span class="gr-hint">${l.count} so far</span></div>
    <div class="lv-scroll" data-lv-scroll>${l.plays.map(row).join('') || '<p class="gr-note">Plays show here as they’re scored.</p>'}</div>
    <p class="gr-note gr-note--foot">${l.ended ? 'In review: these stats can still change until the game is published.' : 'Updates with every play.'} Season stats, picks and the recap come once it’s published.</p>
  </section>`;
  return { hero, body };
}

// Before tip-off: the game's preview. pick: the pick card while picks are open (or the pick
// made); preview: server.js appPreview.
// thread: appThreadData (server.js) — the game's comments, the same thread as the site's
// pre-game talk; null while it's live (the live chat is the talk then) or comments are off.
export function appGamePreviewPage({ back, title, kicker, meta, court = '', a, b, pick, preview: p, lastHref, scoreHref = '', scoreOpens = 0, scoreOpensLabel = '', live = null, reviewLive = false, review = null, chat = null, thread = null }) {
  const w = (p.watch || []).filter(Boolean);
  // The section bar (the finished game's, sticky, lights the section in view), once there are
  // three or more sections below the top. Live: the live screen's own sections (the cards it
  // has), then one Preview chip for the pre-game sections below (Paolo, 2026-10-26: it showed
  // the preview's sections only). Before tip-off: the preview's.
  const LIVE = [['lx-odds', 'Win odds'], ['lx-mom', 'Momentum'], ['lx-hot', 'Who’s hot'], ['lx-pace', 'Pace'], ['lx-picks', 'Picks'], ['gr-box', 'Box score'], ['lv-plays', 'Plays']];
  const chips = live?.parts
    ? [...LIVE.filter(([id]) => live.parts.body.includes(`id="${id}"`)), [p.story ? 'pv-story' : 'pv-matchup', 'Preview']]
    : [p.story ? ['pv-story', 'Storyline'] : null, ['pv-matchup', 'Matchup'], w.length ? ['pv-watch', 'Players to watch'] : null, thread ? ['comments', 'Comments'] : null].filter(Boolean);
  const bar = chips.length > 2 ? jumpBar(chips) : '';
  // While there's a pick card it is the top of the screen (it has the matchup, day and time).
  return `${navbar(back, title)}
  ${reviewLive ? '<div class="msg msg--warn review-live">Review, watched live. Only admins see this, and it isn’t in the feed. Switch it off on the game’s Scoring tab.</div>' : ''}
  ${reviewCard(review)}
  ${scoreHref && !reviewLive ? (scoreOpens > Date.now()
    // Locked until 2 hours before tip-off (Paolo, 2026-10-30). public/app.js initScoreStart
    // turns it on at that time (on the phone's clock, so a kept copy does too) and keeps the
    // scorer on the phone meanwhile, so it opens with no signal at the court.
    ? `<div class="sc-start" data-sc-opens="${scoreOpens}" data-sc-href="${esc(scoreHref)}" data-sc-go="${esc(`${icons.play}<span>Start scoring</span>`)}"><button type="button" class="btn" disabled>${icons.clock}<span>${esc(scoreOpensLabel)}</span></button><p class="foot-note">You’re a scorer for this game. Scoring opens 2 hours before tip-off, and works with no signal.</p></div>`
    : `<div class="sc-start"><a class="btn" href="${esc(scoreHref)}">${icons.play}<span>Start scoring</span></a><p class="foot-note">You’re a scorer for this game. It works with no signal once it’s open.</p></div>`) : ''}
  ${live ? `<div data-live-src="${esc(live.src)}" data-live-ws="${esc(live.ws)}">${live.parts ? `<div data-live="hero">${live.parts.hero}</div>${bar}<div data-live="body">${live.parts.body}</div>` : ''}</div>` : ''}
  ${live?.parts ? '' : pick ? `<div class="pv-pick">${pickCard(pick)}</div>${court ? `<p class="foot-note" style="margin-top:-4px;margin-bottom:12px">At ${esc(court)}</p>` : ''}` : `<section class="fc glow game-hero">
    <div class="fc__top"><span class="kick">Preview · ${esc(kicker)}</span></div>
    ${matchup({ a, b })}
    <p class="mut game-hero__meta">${esc(meta)}</p>
  </section>`}
  ${live?.parts ? '' : bar}
  ${p.story ? `<section class="fc art" id="pv-story"><div class="kick">Storyline</div><h2>${esc(p.story.headline)}</h2>${p.story.body ? `<p>${esc(p.story.body)}</p>` : ''}</section>` : ''}
  <section class="fc art" id="pv-matchup">
    <div class="kick">The matchup</div>
    <div class="pv__line"><span>Records</span><b>${esc(a.name)} ${esc(a.rec || '–')} · ${esc(b.name)} ${esc(b.rec || '–')}</b></div>
    ${p.formA || p.formB ? `<div class="pv__line"><span>Last 5</span><span class="pv__forms"><span>${esc(a.name)} ${formChips(p.formA)}</span><span>${esc(b.name)} ${formChips(p.formB)}</span></span></div>` : ''}
    ${p.last ? `<a class="pv__line" href="${esc(lastHref)}"><span>Last met</span><b>${esc(p.last.text)} · ${esc(p.last.date)} ›</b></a>` : '<div class="pv__line"><span>Last met</span><b>First meeting</b></div>'}
    ${p.series ? `<div class="pv__line"><span>All-time series</span><b>${esc(p.series)}</b></div>` : ''}
  </section>
  ${w.length ? `<section class="fc art" id="pv-watch"><div class="kick">Players to watch</div>${w.map(x => potgStrip(x, '')).join('')}</section>` : ''}
  ${thread ? `<section class="fc art th-sec" id="comments">
      <div class="kick">Comments<span data-th-count-label>${thread.count ? ` · ${thread.count}` : ''}</span></div>
      ${appThreadPanel(thread)}
    </section>` : ''}
  <div style="height:12px"></div>${chat ? liveChatHtml(chat) : ''}`;
}
