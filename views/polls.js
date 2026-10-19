import { escHtml, pageHeader } from './layout.js';

const TIER_LABEL = { admins: 'Admins', heads: 'Team Heads', players: 'All Players' };
export const ICON_CHECK = `<svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 7.3l3 3 6-6.6"/></svg>`;

function tally(poll) {
  const counts = poll.options.map(() => 0);
  for (const v of poll.votes) if (counts[v.option_index] !== undefined) counts[v.option_index]++;
  const total = counts.reduce((a, b) => a + b, 0);
  return { counts, total };
}

// poll: { id, question, description, options, status, visibility, voter_eligibility, votes, myVote, canVote }
// Messenger-poll style: each option is one row that's both the result (a fill proportional to
// its share of votes) and the vote target itself — no separate "results" vs. "vote" sections,
// no distinct selected/unselected button treatment beyond a small checkmark on your own pick.
function pollCard(poll) {
  const { counts, total } = tally(poll);
  const isOpen = poll.status === 'open';
  const clickable = poll.canVote && isOpen;
  const myIndex = poll.myVote ? poll.myVote.option_index : -1;

  const rows = poll.options.map((opt, i) => {
    const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
    const mine = i === myIndex;
    const attrs = clickable
      ? `data-action="vote" data-poll="${escHtml(poll.id)}" data-option="${i}"`
      : 'disabled';
    return `
      <button type="button" class="plp-option${mine ? ' plp-option--mine' : ''}" ${attrs}>
        <span class="plp-option-fill" style="width:${pct}%"></span>
        <span class="plp-option-row">
          <span class="plp-option-text">${mine ? `<span class="plp-check-pop">${ICON_CHECK}</span>` : ''}<span class="plp-option-label">${escHtml(opt)}</span></span>
          <span class="plp-option-pct">${counts[i]} &middot; ${pct}%</span>
        </span>
        ${poll.option_details?.[i] ? `<span class="plp-option-detail">${escHtml(poll.option_details[i])}</span>` : ''}
      </button>`;
  }).join('');

  return `
  <article class="plp-card" id="poll-${escHtml(poll.id)}">
    <div class="plp-card-titlebar">
      <div class="plp-question">${escHtml(poll.question)}</div>
      <span class="plp-badge ${isOpen ? 'plp-badge--open' : 'plp-badge--closed'}">${isOpen ? 'Open' : 'Closed'}</span>
    </div>
    <div class="plp-card-body">
      ${poll.description ? `<p class="plp-description">${escHtml(poll.description)}</p>` : ''}
      <div class="plp-scope">${TIER_LABEL[poll.visibility]}${poll.voter_eligibility !== poll.visibility ? ` &middot; ${TIER_LABEL[poll.voter_eligibility]} vote` : ''} &middot; n=<span class="plp-n" data-n="${escHtml(poll.id)}">${total}</span></div>
      <div class="plp-options" data-poll="${escHtml(poll.id)}">${rows}</div>
      <span class="plp-vote-msg" data-msg="${escHtml(poll.id)}"></span>
      ${!poll.canVote && isOpen ? `<p class="plp-hint">Only ${TIER_LABEL[poll.voter_eligibility].toLowerCase()} can vote in this one.</p>` : ''}
    </div>
  </article>`;
}

// polls: pre-filtered server-side to whatever this viewer qualifies to see (see /polls route).
export function pollsPage({ polls = [] } = {}) {
  const cards = polls.length === 0
    ? `<div class="card" style="padding:32px;text-align:center;color:var(--text-muted)">No polls right now.</div>`
    : polls.map(pollCard).join('');

  return `<div class="page-content">
  ${pageHeader({ title: 'League Polls', description: "Quick votes on what's happening around the league. Who can see the results and who can vote can differ per poll — check the line under each question." })}

  ${polls.length ? `<div class="plp-grid">${cards}</div>` : cards}
</div>

<style>
/* Same auto-fill (not auto-fit) pattern as Papawis's .pw-grid — every column stays a fixed
   width across the whole grid, so a lone trailing card doesn't stretch to fill the row. */
.plp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
@media (max-width: 640px) {
  .plp-grid { grid-template-columns: 1fr; }
}
.plp-card { display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--border); border-radius: 15px; overflow: hidden; }
.plp-card-titlebar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 13px 18px; background: rgba(255,255,255,.03); border-bottom: 1px solid var(--border); }
.plp-question { font-size: 15px; font-weight: 700; letter-spacing: -.005em; color: var(--text); line-height: 1.35; }
.plp-badge { flex-shrink: 0; font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; padding: 3px 9px; border-radius: 99px; }
.plp-badge--open { background: rgba(245,147,50,.12); color: var(--amber); border: 1px solid rgba(245,147,50,.3); }
.plp-badge--closed { background: var(--bg); color: var(--text-muted); border: 1px solid var(--border); }
.plp-card-body { display: flex; flex-direction: column; gap: 10px; padding: 16px 18px 18px; }
.plp-description { font-size: 12.5px; color: var(--text-muted); line-height: 1.5; margin: -2px 0 0; }
.plp-scope { font-size: 11px; color: var(--text-muted); }
.plp-options { display: flex; flex-direction: column; gap: 7px; }
/* color set directly here (not left to inherit through the button) — browsers apply their
   own default text color to <button> elements regardless of ancestors, so a child span
   relying on inheritance alone renders in the browser's default (often black) instead of
   the theme's text color. */
.plp-option { position: relative; display: block; width: 100%; padding: 0; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); color: var(--text); overflow: hidden; cursor: pointer; font-family: inherit; text-align: left; transition: border-color .12s, box-shadow .5s ease; }
.plp-option:not(:disabled):hover { border-color: var(--text-muted); }
.plp-option:disabled { cursor: default; }
.plp-option-fill { position: absolute; inset: 0; width: 0; background: rgba(148,163,184,.12); transition: width .45s cubic-bezier(.22,.9,.35,1); }
.plp-option--mine .plp-option-fill { background: rgba(245,147,50,.18); }
.plp-option-row { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; }
.plp-option-text { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--text); transition: color .3s ease; }
.plp-option--mine .plp-option-text { color: var(--amber); }
.plp-option-text svg { flex-shrink: 0; color: var(--amber); }
.plp-option-detail { position: relative; display: block; padding: 0 14px 10px; margin-top: -4px; font-size: 12px; line-height: 1.4; color: var(--text-muted); }
.plp-option-pct { font-size: 12px; color: var(--text-muted); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.plp-vote-msg { font-size: 11.5px; color: var(--text-muted); min-height: 14px; }
.plp-hint { font-size: 11.5px; color: var(--text-muted); margin: 0; font-style: italic; }

/* Checkmark pops in when a vote lands on this option; the row itself gets a brief amber
   ring so the just-voted option reads as "confirmed" without a page reload. */
.plp-check-pop { display: inline-flex; animation: plp-check-in .28s cubic-bezier(.34,1.56,.64,1); }
@keyframes plp-check-in { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.plp-option--pulse { animation: plp-pulse .6s ease-out; }
@keyframes plp-pulse { 0% { box-shadow: 0 0 0 0 rgba(245,147,50,.4); } 100% { box-shadow: 0 0 0 10px rgba(245,147,50,0); } }
@media (prefers-reduced-motion: reduce) {
  .plp-option, .plp-option-fill, .plp-option-text, .plp-check-pop, .plp-option--pulse { animation: none !important; transition: none !important; }
}
</style>

<script>
(function() {
  var CHECK_SVG = ${JSON.stringify(ICON_CHECK)};

  function updateOptionRow(btn, count, pct, isMine) {
    var fill = btn.querySelector('.plp-option-fill');
    var text = btn.querySelector('.plp-option-text');
    var pctEl = btn.querySelector('.plp-option-pct');
    fill.style.width = pct + '%';
    pctEl.textContent = count + ' · ' + pct + '%';
    btn.classList.toggle('plp-option--mine', isMine);
    // Always clear whatever's there first, then re-add if needed — rather than "only add if
    // missing," which silently stacked a second checkmark once the server-rendered one (now
    // also a .plp-check-pop, but wasn't originally) went out of sync with what this function
    // was looking for.
    var existingCheck = text.querySelector('.plp-check-pop');
    if (existingCheck) existingCheck.remove();
    if (isMine) {
      var span = document.createElement('span');
      span.className = 'plp-check-pop';
      span.innerHTML = CHECK_SVG;
      text.insertBefore(span, text.firstChild);
    }
  }

  document.querySelectorAll('[data-action="vote"]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var pollId = btn.dataset.poll;
      var optionIndex = Number(btn.dataset.option);
      var group = document.querySelector('.plp-options[data-poll="' + pollId + '"]');
      var msg = document.querySelector('[data-msg="' + pollId + '"]');
      var buttons = group.querySelectorAll('.plp-option');
      Array.prototype.forEach.call(buttons, function(b) { b.disabled = true; });
      msg.style.color = 'var(--text-muted)'; msg.textContent = 'Saving…';
      fetch('/polls/' + pollId + '/vote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ option_index: optionIndex }),
      })
      .then(function(r) { return r.json().then(function(j) { return { ok: r.ok, j: j }; }); })
      .then(function(res) {
        if (!res.ok) throw new Error(res.j.error || 'Failed.');
        var counts = res.j.counts, total = res.j.total, myOption = res.j.myOption;
        Array.prototype.forEach.call(buttons, function(b) {
          var i = Number(b.dataset.option);
          var pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
          updateOptionRow(b, counts[i], pct, i === myOption);
        });
        var nEl = document.querySelector('[data-n="' + pollId + '"]');
        if (nEl) nEl.textContent = total;
        msg.textContent = '';
        Array.prototype.forEach.call(buttons, function(b) { b.disabled = false; });
        btn.classList.add('plp-option--pulse');
        setTimeout(function() { btn.classList.remove('plp-option--pulse'); }, 650);
      })
      .catch(function(e) {
        msg.style.color = '#f87171'; msg.textContent = e.message;
        Array.prototype.forEach.call(buttons, function(b) { b.disabled = false; });
      });
    });
  });
})();
</script>`;
}

// "Fri 8 PM" in Manila time (a date too when it's more than six days out); minutes only when
// they aren't :00.
export function pollClosesLabel(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const day = d.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'short' });
  const time = d.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }).replace(':00', '');
  const date = ms - Date.now() > 6 * 86400000 ? ` ${d.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })}` : '';
  return `${day}${date} ${time}`;
}

// The sitewide poll popup (2026-10-19): one poll, switched on per poll at /admin/polls/:id,
// shown to a logged-in member who can vote in it and hasn't yet (picked in server.js
// pollPopupFor). Art is optional and shown whole: beside the poll when it's portrait or square,
// above it when it's landscape, and as a banner across the top on a phone. "Ask me later" (when
// the poll allows it) hides it in this browser until the next Manila day; voting is the other
// way out, and after that the server never renders it for them again. Styles: "Poll popup"
// block in public/styles.css (ppop-).
export function pollPopup({ poll, total = 0 }) {
  const id = escHtml(poll.id);
  const later = !!poll.popup_later;
  const hasArt = poll.has_art && poll.art_ver;
  const wide = hasArt && poll.art_w > poll.art_h * 1.15;
  const art = hasArt
    ? `<div class="ppop-art"><img src="/api/poll-art/${encodeURIComponent(poll.id)}?v=${poll.art_ver}" alt="" width="${poll.art_w}" height="${poll.art_h}" decoding="async"></div>`
    : '';
  const closes = poll.closes_at ? `Voting closes <b>${escHtml(pollClosesLabel(poll.closes_at))}</b> · ` : '';
  const rows = poll.options.map((opt, i) => `
      <button type="button" class="ppop-opt" data-ppop-opt="${i}">
        <span class="ppop-opt-fill"></span>
        <span class="ppop-opt-head"><span class="ppop-opt-label">${escHtml(opt)}</span><span class="ppop-opt-pct"></span></span>
        ${poll.option_details?.[i] ? `<span class="ppop-opt-detail">${escHtml(poll.option_details[i])}</span>` : ''}
      </button>`).join('');

  return `
<div class="ppop" id="ppop" data-poll="${id}" data-later="${later ? '1' : '0'}" hidden>
  <div class="ppop-scrim"${later ? ' data-ppop-later' : ''}></div>
  <div class="ppop-card${hasArt ? (wide ? ' ppop-card--art-top' : ' ppop-card--art-side') : ''}" role="dialog" aria-modal="true" aria-labelledby="ppop-q" tabindex="-1">
    ${art}
    <div class="ppop-main">
      <div class="ppop-top">
        <span class="ppop-kicker">Players are voting</span>
        ${later ? '<button type="button" class="ppop-close" data-ppop-later aria-label="Close, ask me later">&times;</button>' : ''}
      </div>
      <h2 class="ppop-q" id="ppop-q">${escHtml(poll.question)}</h2>
      ${poll.description ? `<p class="ppop-desc">${escHtml(poll.description)}</p>` : ''}
      <p class="ppop-sub">${closes}<span data-ppop-n>${total}</span> voted so far</p>
      <div class="ppop-opts">${rows}</div>
      <div class="ppop-foot">
        <span class="ppop-msg" data-ppop-msg>Tap one to vote. You can change it later on /polls.</span>
        ${later ? '<button type="button" class="ppop-btn" data-ppop-later>Ask me later</button>' : ''}
        <button type="button" class="ppop-btn ppop-btn--done" data-ppop-done hidden>Done</button>
      </div>
    </div>
  </div>
</div>
<script>
(function () {
  var root = document.getElementById('ppop'); if (!root) return;
  var pollId = root.getAttribute('data-poll'), canLater = root.getAttribute('data-later') === '1';
  var KEY = 'wknd_poll_later_' + pollId;
  if (canLater) { try { if (Number(localStorage.getItem(KEY) || 0) > Date.now()) return; } catch (e) {} }
  var opts = root.querySelectorAll('[data-ppop-opt]'), msg = root.querySelector('[data-ppop-msg]');
  var done = root.querySelector('[data-ppop-done]'), card = root.querySelector('.ppop-card'), lastFocus = null, voted = false;

  function open() {
    lastFocus = document.activeElement;
    root.hidden = false;
    document.documentElement.classList.add('ppop-lock');
    requestAnimationFrame(function () { root.classList.add('is-in'); });
    // Focus the dialog itself, not the first option: a ring on an option reads as a pick.
    card.focus({ preventScroll: true });
  }
  function close() {
    root.classList.remove('is-in');
    document.documentElement.classList.remove('ppop-lock');
    setTimeout(function () { root.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }, 180);
  }
  // Until the start of the next day in Manila (UTC+8, no DST).
  function later() {
    var H8 = 8 * 3600000, DAY = 86400000;
    try { localStorage.setItem(KEY, String(Math.floor((Date.now() + H8) / DAY + 1) * DAY - H8)); } catch (e) {}
    close();
  }
  root.querySelectorAll('[data-ppop-later]').forEach(function (b) { b.addEventListener('click', function () { if (voted) close(); else later(); }); });
  done.addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (root.hidden) return;
    if (e.key === 'Escape' && (canLater || voted)) { if (voted) close(); else later(); return; }
    if (e.key !== 'Tab') return;
    // Keep keyboard focus inside the popup.
    var f = [].slice.call(root.querySelectorAll('button:not([hidden]):not([disabled])'));
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  opts.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var i = Number(btn.getAttribute('data-ppop-opt'));
      opts.forEach(function (b) { b.disabled = true; });
      msg.classList.remove('is-error'); msg.textContent = 'Saving…';
      fetch('/polls/' + encodeURIComponent(pollId) + '/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ option_index: i }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok || !res.j.ok) throw new Error(res.j.error || 'Couldn’t save your vote. Try again.');
          voted = true;
          var counts = res.j.counts, total = res.j.total;
          root.classList.add('is-voted');
          opts.forEach(function (b, k) {
            var pct = total ? Math.round(counts[k] / total * 100) : 0;
            b.classList.toggle('is-mine', k === i);
            b.querySelector('.ppop-opt-fill').style.width = pct + '%';
            b.querySelector('.ppop-opt-pct').textContent = counts[k] + ' · ' + pct + '%';
            b.disabled = false;
          });
          root.querySelector('[data-ppop-n]').textContent = total;
          msg.textContent = '✓ Locked in: ' + btn.querySelector('.ppop-opt-label').textContent;
          msg.classList.add('is-done');
          root.querySelectorAll('.ppop-btn[data-ppop-later]').forEach(function (b) { b.hidden = true; });
          done.hidden = false;
        })
        .catch(function (e) {
          opts.forEach(function (b) { b.disabled = false; });
          msg.classList.add('is-error'); msg.textContent = e.message;
        });
    });
  });

  setTimeout(open, 900);
})();
</script>`;
}
