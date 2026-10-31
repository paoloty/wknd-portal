// Share my stats (/app/games/:id/share): one full screen, like an Instagram story editor
// (Paolo, 2026-10-24). The card fills the screen on a preview backdrop; the tools sit down
// the top right (Templates, Colour, Stats, Backdrop, Share), each opening its choices on one
// seamless fade at the bottom. The card is full width, as on a story; closing the open tool
// (tap it again, or tap the card) leaves the card on its own. Share → Save image, Copy image,
// Share to… (the phone's share sheet).
// The card is the site's /api/games/:id/my-stat-card.png in the site's templates
// (views/game.js SSC_FAMILIES / SSC_ACCENTS), 1080×1920 and see-through, except the premium
// ones the phone draws itself (public/share-cards.js) while the player isn't locked. Premium
// templates save with a lock while the player owes (shareCardsLocked), made on the server.
// Client: public/app.js initShare.
import { esc, icons } from './layout.js';
import { SSC_FAMILIES, SSC_ACCENTS } from '../game.js';

const LOCK = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const TOOLS = [['tpl', 'Templates', 'layers'], ['colour', 'Colour', 'palette'], ['stats', 'Stats to show', 'me'], ['bg', 'Backdrop', 'image'], ['share', 'Share', 'share']];

// game: { id, opp, day, line } · focus: the opening "stats to show" · bgs: [{ key, label, css }]
// phone: { keys, data, photo } when the phone draws those templates itself (not locked):
// public/share-cards.js, loaded as a module script by initShare.
// missingText: the empty state's line (a Papawis run says run, not game).
export function appSharePage({ back, missing = false, missingText = 'Only players in this game can make its stat card.', game, focus = 'all', locked = false, bgs = [], phone = null }) {
  if (missing) return `<div class="navbar"><a class="navbar__back" href="${esc(back.href)}">‹ ${esc(back.label)}</a><span class="navbar__title">Share my stats</span><span></span></div>
    <div class="empty" style="margin-top:12px">${esc(missingText)}</div>`;
  const chip = (attr, k, label, on) => `<button type="button" class="se__chip${on ? ' is-on' : ''}" data-${attr}="${esc(k)}">${esc(label)}</button>`;
  const row = (act, icon, title, sub) => `<button type="button" class="se__row" data-sh-do="${act}"><i>${icons[icon]}</i><span><b>${title}</b><small>${sub}</small></span></button>`;
  return `<div class="se" data-sh data-game="${esc(game.id)}" data-locked="${locked ? 1 : 0}" data-focus="${esc(focus)}"${phone ? ` data-phone="${esc(phone.keys.join(' '))}" data-photo="${esc(phone.photo)}"` : ''}>
    ${phone ? `<script type="application/json" data-sh-card>${JSON.stringify(phone.data).replace(/</g, '\\u003c')}</script>` : ''}
    <div class="se__bg" data-sh-stage style="${esc(bgs[0]?.css || '')}"></div>
    <img class="se__card" data-sh-img alt="Your stat card: ${esc(game.line)} vs ${esc(game.opp)}" hidden>
    <span class="ptr__spin se__spin" data-sh-spin aria-hidden="true"></span>
    <div class="se__top">
      <a class="se__x" href="${esc(back.href)}" aria-label="Close">${icons.close}</a>
      <div class="se__tools">${TOOLS.map(([k, label, ic]) => `<button type="button" class="se__tool" data-tool="${k}" aria-label="${label}" aria-expanded="false">${icons[ic]}</button>`).join('')}</div>
    </div>
    <div class="se__bottom">
      <div data-panel="tpl">
        <div class="se__tpls">${SSC_FAMILIES.map((f, i) => `<button type="button" class="se__tpl${i === 0 ? ' is-on' : ''}" data-tpl="${esc(f.def)}" data-fam="${esc(f.key)}"${f.premium ? ' data-premium' : ''}>
          <span class="se__thumb"><img alt="" data-thumb="${esc(f.def)}">${f.premium && locked ? `<i class="se__lock">${LOCK}</i>` : ''}</span><span class="se__tl">${esc(f.label)}</span></button>`).join('')}</div>
        ${SSC_FAMILIES.filter(f => f.variants.length > 1).map(f => `<div class="se__chips se__vars" data-vars="${esc(f.key)}" hidden>${f.variants.map(([k, l]) => chip('variant', k, l, k === f.def)).join('')}</div>`).join('')}
      </div>
      <div data-panel="colour" hidden><div class="se__h">Colour</div><div class="se__sws">${SSC_ACCENTS.map(([k, c], i) => `<button type="button" class="se__sw${i === 0 ? ' is-on' : ''}" data-accent="${esc(k)}" style="--sw:${esc(c)}" aria-label="${esc(k)}"></button>`).join('')}</div></div>
      <div data-panel="stats" hidden><div class="se__h">Stats to show</div><div class="se__chips">${[['all', 'All-around'], ['offense', 'Offense'], ['defense', 'Defense']].map(([k, l]) => chip('focus', k, l, k === focus)).join('')}</div></div>
      <div data-panel="bg" hidden><div class="se__h">Backdrop <em>· just for the preview, the card saves see-through</em></div><div class="se__chips">${bgs.map((b, i) => `<button type="button" class="se__chip${i === 0 ? ' is-on' : ''}" data-bg="${esc(b.key)}" data-css="${esc(b.css)}">${esc(b.label)}</button>`).join('')}</div></div>
      <div data-panel="share" hidden><div class="se__h">Share</div>
        ${locked ? '<p class="se__note" data-sh-lockmsg hidden>Premium cards save with a lock while you have a balance. <a class="link" href="/app/settle?from=me">Settle it</a> to unlock them.</p>' : ''}
        ${row('save', 'download', 'Save image', 'To your photos')}
        ${row('copy', 'copy', 'Copy image', 'Paste it into a story or chat')}
        ${row('send', 'share', 'Share to…', 'Instagram, Messenger and the rest')}
      </div>
      <p class="se__msg" data-sh-msg hidden></p>
    </div>
  </div>`;
}
