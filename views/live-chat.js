// Live chat (server.js liveChatData; public/live-chat.js runs it): while a game's live score
// shows, its comments float over the bottom of the live view, newest last, older ones fading
// (mockup option B, Paolo 2026-10-26); on a wide screen (the site, 1100px+) a sidebar on the
// right. The eye hides it to a pill (kept on the phone). Messages are the game's comments, so
// they stay as its comments after the game ("During the game").

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.9 17.9A10 10 0 0 1 12 20C5 20 1 12 1 12a18 18 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.2 3.2"/><path d="M1 1l22 22"/></svg>';
const FLAME = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-9-1 2-2 3-4 3 0-2 0-4-2-6-1 4-4 6-4 11 0 4 3 8 7 8z"/></svg>';
const BUBBLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>';
const SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>';

// One message: the same markup public/live-chat.js builds for new ones.
export const chatItem = c => `<div class="lc__m" data-id="${esc(c.id)}"><span class="lc__av" style="--c:${esc(c.color || '#5b6475')}">${esc(c.initials || '?')}</span><span class="lc__b"><b${c.playerId || c.player_id ? ` data-pid="${esc(c.playerId || c.player_id)}"` : ''}>${esc(c.displayName)}</b> ${esc(c.body)}</span></div>`;

export function liveChatHtml(chat) {
  if (!chat) return '';
  const id = encodeURIComponent(chat.gameId);
  return `<div class="lc-spacer" aria-hidden="true"></div><div class="lc" data-live-chat data-post="/games/${id}/comments" data-fire="/games/${id}/react" data-ws="/ws/games/${id}/comments" data-login="${esc(chat.login)}">
    <div class="lc__head"><b>Chat</b><span class="lc__watch" data-lc-watch${chat.watching > 1 ? '' : ' hidden'}><i></i><span data-lc-watch-n>${chat.watching}</span> watching</span><span class="lc__sp"></span><button type="button" class="lc__btn" data-lc-hide aria-label="Hide chat">${EYE_OFF}</button></div>
    <span class="lc__watch lc__watch--float" data-lc-watch${chat.watching > 1 ? '' : ' hidden'}><i></i><span data-lc-watch-n>${chat.watching}</span> watching</span>
    <div class="lc__list" data-lc-list role="log" aria-live="polite" aria-label="Chat">${chat.items.map(chatItem).join('')}</div>
    <div class="lc__side"><button type="button" class="lc__btn" data-lc-hide aria-label="Hide chat">${EYE_OFF}</button><button type="button" class="lc__btn lc__btn--fire" data-lc-fire aria-label="Fire">${FLAME}</button></div>
    ${chat.canPost ? `<form class="lc__bar" data-lc-form><input type="text" name="body" maxlength="500" placeholder="Say something…" aria-label="Message" autocomplete="off" enterkeyhint="send"><button type="submit" class="lc__send" aria-label="Send">${SEND}</button></form>`
      : `<a class="lc__bar lc__bar--login" href="${esc(chat.login)}">Sign in to chat</a>`}
    <p class="lc__tip" data-lc-tip hidden></p>
    <button type="button" class="lc__show" data-lc-show hidden aria-label="Show chat">${BUBBLE}<span>Chat</span><b data-lc-new hidden>0</b></button>
  </div>`;
}
