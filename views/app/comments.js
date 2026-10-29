// Comments in the app, on games and announcements (one level of replies, like Instagram).
// The thread opens in a sheet over the feed (public/app.js "Comments") or sits under a
// game's box score; both are the same panel. The feed cards carry the bar: 🔥, 💬 and the
// latest comment. Data and rules: server.js appThreadData / /app/thread/:key. Game threads
// are the site's own (game_comments), so the site's game page shows the same conversation.
import { esc, appAvatar, icons } from './layout.js';

const SEND = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6l-.01 6.53L15 12 3.39 13.87z"/></svg>';

// @Name → highlighted, for the players with a login (names: display names). Runs on escaped
// text and only wraps a known name, so nothing unescaped gets back in.
function mentions(escaped, names = []) {
  if (!names.length) return escaped;
  const list = names.map(esc).sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return escaped.replace(new RegExp('@(' + list.join('|') + ')(?![A-Za-z0-9])', 'g'), '<b class="ct__at">@$1</b>');
}

// c: { id, playerId, name, initials, ring, photoUrl, body, when, fire, fired, canDelete }
function row(c, topId, names, reply = false) {
  return `<div class="ct${reply ? ' ct--reply' : ''}" data-ct="${esc(c.id)}">
    ${appAvatar({ playerId: c.playerId, initials: c.initials, ring: c.ring, photoUrl: c.photoUrl })}
    <div class="ct__b">
      <p class="ct__text"><b${c.playerId ? ` data-pid="${esc(c.playerId)}"` : ''}>${esc(c.name)}</b> ${mentions(esc(c.body), names)}</p>
      <div class="ct__meta"><span>${esc(c.when)}</span>${c.during ? '<span class="ct__live">During the game</span>' : ''}<button type="button" data-ct-reply="${esc(topId)}" data-ct-name="${esc(c.name)}">Reply</button>${c.canDelete ? `<button type="button" data-ct-del="${esc(c.id)}">Delete</button>` : ''}</div>
    </div>
    <button type="button" class="ct__fire${c.fired ? ' is-on' : ''}" data-ct-fire="${esc(c.id)}" aria-pressed="${c.fired ? 'true' : 'false'}" aria-label="Fire">${icons.flame}<span>${c.fire || ''}</span></button>
  </div>`;
}

// The list: top-level comments oldest first, each with its replies behind "View N replies".
// open: top-level ids whose replies show (the one just replied to).
export function appThreadList({ threads = [], names = [], open = [] }) {
  if (!threads.length) return '<p class="ct__empty">No comments yet. Start the conversation.</p>';
  return threads.map(t => {
    const n = t.replies.length, shown = open.includes(t.id);
    return `${row(t, t.id, names)}${n ? `<div class="ct__kids">
      <button type="button" class="ct__more" data-ct-toggle="${esc(t.id)}" aria-expanded="${shown}"><i aria-hidden="true"></i><span>${shown ? 'Hide replies' : `View ${n} repl${n === 1 ? 'y' : 'ies'}`}</span></button>
      <div data-ct-kids="${esc(t.id)}" data-n="${n}"${shown ? '' : ' hidden'}>${t.replies.map(r => row(r, t.id, names, true)).join('')}</div>
    </div>` : ''}`;
  }).join('');
}

// The whole panel: the list and the box to write in. canPost false: why not, instead of the box.
// people: [{ id, name }] for @mentions (the composer suggests them as you type).
export function appThreadPanel(d) {
  const box = d.canPost ? `<form class="th__comp" data-th-form novalidate>
      <div class="th__to" data-th-to hidden><span>Replying to <b data-th-to-name></b></span><button type="button" data-th-to-x aria-label="Cancel reply">✕</button></div>
      <div class="th__at" data-th-at hidden></div>
      <div class="th__row">
        <textarea name="body" rows="1" maxlength="500" placeholder="Add a comment…" enterkeyhint="send" data-th-input aria-label="Comment"></textarea>
        <button type="submit" class="th__send" data-th-send disabled aria-label="Post">${SEND}</button>
      </div>
      <p class="msg msg--err" data-th-msg hidden></p>
    </form>` : `<p class="msg msg--warn th__off">${esc(d.why || 'Commenting is off.')}</p>`;
  return `<div class="th" data-th="${esc(d.key)}" data-th-count="${d.count}">
    <div class="th__list" data-th-list>${appThreadList(d)}</div>
    ${box}
    <script type="application/json" data-th-people>${JSON.stringify(d.people || []).replace(/</g, '\\u003c')}</script>
  </div>`;
}

// The bar under a feed card. s: { key, fire, fired, count, last: { name, body } | null }
export function appSocialBar(s) {
  if (!s) return '';
  return `<div class="cx" data-cx="${esc(s.key)}">
    <div class="cx__btns">
      <button type="button" class="cx__b cx__fire${s.fired ? ' is-on' : ''}" data-cx-fire aria-pressed="${s.fired ? 'true' : 'false'}">${icons.flame}<span>${s.fire ? s.fire : 'Fire'}</span></button>
      <button type="button" class="cx__b" data-cx-open>${icons.comment}<span>${s.count ? s.count : 'Comment'}</span></button>
    </div>
    ${s.last ? `<button type="button" class="cx__last" data-cx-open><b>${esc(s.last.name)}</b> ${esc(s.last.body)}</button>` : ''}
    ${s.count > 1 ? `<button type="button" class="cx__all" data-cx-open>View all ${s.count} comments</button>` : ''}
  </div>`;
}
