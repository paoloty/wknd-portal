import { escHtml } from './layout.js';

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
  <div class="plp-page-header">
    <h1 class="plp-page-header__title">League Polls</h1>
    <p class="plp-page-header__sub">Quick votes on what's happening around the league. Who can see the results and who can vote can differ per poll — check the line under each question.</p>
  </div>

  ${polls.length ? `<div class="plp-grid">${cards}</div>` : cards}
</div>

<style>
.plp-page-header { padding: 4px 0 28px; }
.plp-page-header__title { font-size: clamp(28px, 4vw, 38px); font-weight: 800; letter-spacing: -.02em; color: var(--text); margin: 0; }
.plp-page-header__sub { margin-top: 8px; font-size: 14px; color: var(--text-muted); max-width: 68ch; }
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
