// Share my stats (/app/games/:id/share): the player's own stat card for one game, in the
// site's templates (views/game.js SSC_FAMILIES; the PNG is the site's own
// /api/games/:id/my-stat-card.png, 1080×1920, see-through). Pick a template and a colour,
// then Share opens the phone's share sheet (Instagram story, Messenger, Save Image) or Save
// downloads it. Premium templates save with a lock while the player owes (shareCardsLocked).
// Client: public/app.js initShare.
import { esc, backChev, icons } from './layout.js';
import { SSC_FAMILIES, SSC_ACCENTS } from '../game.js';

const LOCK = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

// game: { id, opp, day, line } · focus: the opening style (offense/defense/all) ·
// bgs: [{ key, label, css }] preview backdrops (the card itself saves see-through)
export function appSharePage({ back, missing = false, game, focus = 'all', locked = false, bgs = [] }) {
  const nav = `<div class="navbar"><a class="navbar__back" href="${esc(back.href)}">${backChev}${esc(back.label)}</a><span class="navbar__title">Share my stats</span><span></span></div>`;
  if (missing) return `${nav}<div class="empty" style="margin-top:12px">Only players in this game can make its stat card.</div>`;
  const chip = (attr, k, label, on) => `<button type="button" class="chip sh__chip${on ? ' is-on' : ''}" data-${attr}="${esc(k)}"><span>${esc(label)}</span></button>`;
  return `${nav}
  <div class="sh" data-sh data-game="${esc(game.id)}" data-locked="${locked ? 1 : 0}" data-focus="${esc(focus)}">
    <div class="sh__stage" data-sh-stage style="${esc(bgs[0]?.css || '')}">
      <img class="sh__card" data-sh-img alt="Your stat card" hidden>
      <span class="ptr__spin sh__spin" data-sh-spin aria-hidden="true"></span>
    </div>
    <p class="sh__line">vs ${esc(game.opp)} · ${esc(game.day)} · <b>${esc(game.line)}</b></p>

    <div class="sec">Template</div>
    <div class="rail sh__tpls">${SSC_FAMILIES.map((f, i) => `<button type="button" class="sh__tpl${i === 0 ? ' is-on' : ''}" data-tpl="${esc(f.def)}" data-fam="${esc(f.key)}"${f.premium ? ' data-premium' : ''}>
      <span class="sh__thumb"><img alt="" data-thumb="${esc(f.def)}">${f.premium && locked ? `<i class="sh__lock">${LOCK}</i>` : ''}</span><span class="sh__tl">${esc(f.label)}</span></button>`).join('')}</div>
    ${SSC_FAMILIES.filter(f => f.variants.length > 1).map((f, i) => `<div class="pad chips sh__vars" data-vars="${esc(f.key)}"${i === 0 && SSC_FAMILIES[0].key === f.key ? '' : ' hidden'}>${f.variants.map(([k, l]) => chip('variant', k, l, k === f.def)).join('')}</div>`).join('')}

    <div class="sec">Colour</div>
    <div class="pad sh__sws">${SSC_ACCENTS.map(([k, c], i) => `<button type="button" class="sh__sw${i === 0 ? ' is-on' : ''}" data-accent="${esc(k)}" style="--sw:${esc(c)}" aria-label="${esc(k)}"></button>`).join('')}</div>

    <div class="sec">Stats to show</div>
    <div class="pad chips">${[['all', 'All-around'], ['offense', 'Offense'], ['defense', 'Defense']].map(([k, l]) => chip('focus', k, l, k === focus)).join('')}</div>

    <div class="sec">Preview on</div>
    <div class="pad chips">${bgs.map((b, i) => `<button type="button" class="chip sh__chip${i === 0 ? ' is-on' : ''}" data-bg="${esc(b.key)}" data-css="${esc(b.css)}"><span>${esc(b.label)}</span></button>`).join('')}</div>
    <p class="foot-note">Just for the preview: your card saves see-through, ready to drop on a story.</p>

    ${locked ? `<p class="msg msg--warn sh__lockmsg" data-sh-lockmsg hidden>Premium cards save with a lock while you have a balance. <a class="link" href="/app/settle?from=me">Settle your balance</a> to unlock them.</p>` : ''}
    <p class="msg msg--err" data-sh-msg hidden></p>
    <div class="pad sh__acts">
      <button type="button" class="btn" data-sh-share disabled>${icons.share}<span>Share</span></button>
      <button type="button" class="btn btn--ghost" data-sh-save disabled>Save image</button>
    </div>
  </div>
  <div style="height:12px"></div>`;
}
