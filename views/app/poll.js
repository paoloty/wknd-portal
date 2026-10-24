// The poll takeover (2026-10-24): the site's poll popup (views/polls.js pollPopup) in the app.
// Same poll, same rules (server.js popupPollFor): open, switched to "Show as popup", one the
// player can vote in and hasn't. Full screen over Home with Home blurred behind it, the poll
// centred, and a live countdown when the poll has a closing time. It comes in Home's own
// HTML; public/app.js initPollTakeover lifts it out of the screen, opens it, and keeps
// "Ask me later" (until the next Manila day, same key as the site) on this phone.
import { esc, icons } from './layout.js';

export function appPollTakeover({ poll, total = 0 }) {
  const later = !!poll.popup_later;
  const hasArt = poll.has_art && poll.art_ver;
  const art = hasArt
    ? `<div class="tk__art"><img src="/api/poll-art/${encodeURIComponent(poll.id)}?v=${poll.art_ver}" alt="" width="${poll.art_w}" height="${poll.art_h}" decoding="async"></div>`
    : '';
  const voted = `<span><b data-tk-n>${total}</b> voted so far</span>`;
  const count = poll.closes_at
    ? `<div class="tk__cd" data-tk-cd="${Number(poll.closes_at)}">
        <div class="tk__cd-l"><span>Voting closes in</span>${voted}</div>
        <div class="tk__cd-row">
          <div><b data-tk-d>–</b><small>Days</small></div>
          <div><b data-tk-h>–</b><small>Hrs</small></div>
          <div><b data-tk-m>–</b><small>Min</small></div>
          <div class="tk__cd-sec"><b data-tk-s>–</b><small>Sec</small></div>
        </div>
      </div>`
    : `<p class="tk__n">${voted}</p>`;
  const rows = poll.options.map((opt, i) => `
      <button type="button" class="tk__opt" data-tk-opt="${i}">
        <span class="tk__fill"></span>
        <span class="tk__head"><span class="tk__label">${esc(opt)}</span><span class="tk__pct"></span></span>
        ${poll.option_details?.[i] ? `<span class="tk__detail">${esc(poll.option_details[i])}</span>` : ''}
      </button>`).join('');

  return `<div class="tk" data-tk="${esc(poll.id)}" data-tk-later="${later ? '1' : '0'}" hidden>
  ${later ? `<button type="button" class="tk__x" data-tk-later aria-label="Close, ask me later">${icons.close}</button>` : ''}
  <div class="tk__box" role="dialog" aria-modal="true" aria-labelledby="tk-q" tabindex="-1">
    ${art}
    <div class="kick tk__kick">Players are voting</div>
    <h2 class="tk__q" id="tk-q">${esc(poll.question)}</h2>
    ${count}
    <div class="tk__opts">${rows}</div>
    <p class="tk__msg" data-tk-msg role="status">Tap one to vote. You can change it later.</p>
    ${later ? '<button type="button" class="btn btn--plain" data-tk-later data-tk-later-btn>Ask me later</button>' : ''}
    <button type="button" class="btn" data-tk-done hidden>Done</button>
  </div>
</div>`;
}
