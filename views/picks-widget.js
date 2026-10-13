import { escHtml } from './layout.js';
import { summaryPanel } from './home.js';
import { dayLabel, pickAvatar, barsScript, swipeScript } from './games.js';
import { fmtCloseTime } from './pick-box.js';
import { pickCard, pickCardScript, pickResultCard } from './pick-card.js';
import { fmtPts } from '../lib/picks.js';

// ── Homepage "Who wins?" widget (placement A: under the registration banner) ────────────
// Two modes, picked in server.js (homePicksWidget):
//   open    — the next game day's games side by side, one card each: matchup summary,
//             the go-to scorers face-off (VS), pick buttons at the bottom; race strip under
//   results — no game day coming up yet: the last game day's "Who called it?" cards
// Same pick box and cards as /picks and /games, so a pick here is the same pick everywhere.

const CHECK = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
const CROSS = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

// Your record as ✓/✗ chips, oldest → newest left to right.
export function resultChips(recent) {
  if (!recent?.length) return '';
  return `<span class="pkw-chips" aria-label="Your last ${recent.length} picks">${[...recent].reverse().map(r =>
    `<span class="pkw-chip ${r.ok ? 'is-ok' : 'is-miss'}" title="${r.ok ? 'Called it' : 'Missed'}">${r.ok ? CHECK : CROSS}</span>`).join('')}</span>`;
}

// ── Results mode: the race card beside the "Who called it?" game cards ──────────
// Top 5 of each board plus your own row, with a Pickmaster / Beat the Odds switch (no switch
// when the odds are off). Same card shell as the game cards so the row lines up. No team
// shown on the rows: picks are personal, teams don't count here.
const rankLbl = (rank, tied) => (tied ? `T${rank}` : String(rank));
const fmtOdds = n => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(2)}`;
const pickerHref = (id, season) => `/picks/players/${encodeURIComponent(id)}?season=${encodeURIComponent(season)}`;

function raceRow(r, kind, w, { me = false } = {}) {
  const odds = kind === 'odds';
  const rank = odds ? r.oddsRank : r.rank;
  const tied = me ? (odds ? r.oddsTied : r.tied) : r.tied;
  const isMe = me || r.playerId === w.me?.playerId;
  return `<a href="${pickerHref(r.playerId, w.season)}" class="pkw-lb${rank === 1 ? ' is-top' : ''}${isMe ? ' is-me' : ''}${me ? ' pkw-lb--me' : ''}">
          <span class="pkw-lb__n font-condensed">${rank ? rankLbl(rank, tied) : '–'}</span>
          ${pickAvatar({ id: r.playerId, name: r.name, team: r.team }, 28, false)}
          <span class="pkw-lb__nm">${me ? 'You' : escHtml(r.name)}</span>
          <span class="pkw-lb__wl">${r.correct}–${r.wrong}</span>
          <span class="pkw-lb__pt font-condensed">${odds ? fmtOdds(r.oddsPts) : fmtPts(r.net)}</span>
        </a>`;
}

// Your own row under the top 5, the same height in every state.
function meRow(kind, w) {
  if (!w.isPlayer) return '<a href="/login?next=%2F" class="pkw-lb pkw-lb--me pkw-lb--note">Log in on any game to join the race →</a>';
  if (!w.me) return '<span class="pkw-lb pkw-lb--me pkw-lb--note">You’re on the board after your first final</span>';
  return raceRow(w.me, kind, w, { me: true });
}

// rows: how many of each board to list — 5 beside the results cards, 8 as the open-mode
// column next to the pick cards.
function raceCard(w, { rows: max = 5 } = {}) {
  const b = w.boards || { pts: [], odds: null, size: 0 };
  const two = !!b.odds && b.pts.length > 0;
  const list = (kind, rows, hidden) => `<div class="pkw-lb__list" data-pkw-board="${kind}"${hidden ? ' hidden' : ''}>
        <div class="pkw-lb__head" aria-hidden="true"><span>#</span><span></span><span>Player</span><span>W–L</span><span>Pts</span></div>
        ${rows.slice(0, max).map(r => raceRow(r, kind, w)).join('')}
        ${meRow(kind, w)}
      </div>`;
  // Same shell as the pick cards beside it (views/pick-card.js): the tinted header band with
  // its bottom edge, the body, and a full-width button pinned to the bottom.
  return `<section class="pkc pkw-race" aria-label="Pickmaster race, season ${escHtml(String(w.season))}">
      <div class="pkc__head pkw-race__head">
        <a href="/picks" class="pkw-race__ttl"><b>Pickmaster race</b><small class="font-condensed">S${escHtml(String(w.season))}${b.size ? ` · ${b.size} on the board` : ''}</small></a>
        ${two ? `<span class="pkw-seg" role="group" aria-label="Leaderboard"><button type="button" class="is-on" data-pkw-show="pts" aria-pressed="true">Pickmaster</button><button type="button" data-pkw-show="odds" aria-pressed="false">Beat the Odds</button></span>` : ''}
        <div class="pkc__edge pkw-race__edge" aria-hidden="true"><i style="--c:var(--amber);flex-basis:100%"></i></div>
      </div>
      <div class="pkc__body">
        ${b.pts.length ? `${list('pts', b.pts, false)}${two ? list('odds', b.odds, true) : ''}`
          : '<p class="pkw-lb__empty">The board fills after the first finals. Every settled pick counts.</p>'}
        <a href="/picks" class="pkc-btn pkw-race__more">Full race &amp; rules <span class="pkc-arr">→</span></a>
      </div>
    </section>`;
}

function raceScript() {
  return `<script>
(function () {
  if (window.__wkndPkwRace) return;
  window.__wkndPkwRace = true;
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-pkw-show]');
    if (!btn) return;
    var card = btn.closest('.pkw-race');
    card.querySelectorAll('[data-pkw-show]').forEach(function (b) {
      var on = b === btn;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    card.querySelectorAll('[data-pkw-board]').forEach(function (l) { l.hidden = l.dataset.pkwBoard !== btn.dataset.pkwShow; });
  });
})();
</script>`;
}

// ── Face-off (open mode): the shared duel sides (views/duel.js) ─────────────────
function faceoff(o, w) {
  return faceoffCard(o, { isPlayer: w.isPlayer, next: '/' });
}

// The homepage's pick card: the shared pick card (views/pick-card.js), slim 'card' variant.
// Also the team page's "Up next" (views/team-detail.js).
export function faceoffCard(o, { isPlayer = false, next = '/' } = {}) {
  return pickCard(o, { variant: 'card', isPlayer, next });
}

export function picksWidget(w, { summary = null, isAdmin = false } = {}) {
  if (!w) return '';
  const panel = summaryPanel(summary, 'picks', isAdmin);
  if (w.mode === 'open') {
    const allClosed = w.games.every(g => g.closed);
    const when = `${escHtml(dayLabel(w.ymd))} · ${allClosed ? 'picks closed' : `picks close ${escHtml(fmtCloseTime(w.closeTime))}`}`;
    return `<section class="home-section pkw" aria-labelledby="pkw-h">
  <div class="section-header"><h2 id="pkw-h">Who wins? <span class="section-header__sub">${when}</span></h2><a href="/picks" class="section-header__link">Pickmaster race →</a></div>
  ${panel}
  <div class="pkf-games${w.games.length === 1 ? ' is-one' : ''}">
    ${w.games.map(o => faceoff(o, w)).join('')}
    ${raceCard(w, { rows: w.isPlayer ? 5 : 6 })}
  </div>
</section>
${raceScript()}
${pickCardScript()}
${barsScript()}`;
  }
  return `<section class="home-section pkw" aria-labelledby="pkw-h">
  <div class="section-header"><h2 id="pkw-h">Who called it? <span class="section-header__sub">${escHtml(dayLabel(w.ymd))} · Final</span></h2><a href="/picks" class="section-header__link">All results →</a></div>
  ${panel}
  <div class="pkw-res swipe-row" style="--cols:${Math.min(4, w.cards.length + 1)}" data-swipe>
    ${w.cards.map(s => pickResultCard(s.result, { variant: 'card', isPlayer: w.isPlayer })).join('')}
    ${raceCard(w)}
  </div>
</section>
${raceScript()}
${pickCardScript()}
${swipeScript()}`;
}
