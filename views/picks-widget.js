import { escHtml } from './layout.js';
import { calledItCard, FLAME, dayLabel } from './games.js';
import { openPickCard, pickBoxScript, fmtCloseTime } from './pick-box.js';

// ── Homepage "Who wins?" widget (placement A: under the registration banner) ────────────
// Two modes, picked in server.js (homePicksWidget):
//   open    — the next game day's games, pickable right here, plus your record
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

function sidePanel(w) {
  if (!w.isPlayer) {
    return `<aside class="pkw-side">
      <span class="pkw-side__k">Think you know ball?</span>
      <p class="pkw-side__p">Pick every game, climb the race, and win the <b>Pickmaster</b> award at season's end.</p>
      <a href="/login?next=%2F" class="pkw-cta">Log in to pick</a>
    </aside>`;
  }
  const me = w.me;
  if (!me) {
    return `<aside class="pkw-side">
      <span class="pkw-side__k">Your S${escHtml(String(w.season))} picks</span>
      <p class="pkw-side__p">No picks settled yet. Get ${w.minPicks} right-or-wrong calls in to join the <b>Pickmaster</b> race.</p>
      <a href="/picks" class="pkw-side__link">How the race works →</a>
    </aside>`;
  }
  const standing = me.rank
    ? `<b>#${me.rank}</b> in the race`
    : `${Math.max(0, w.minPicks - me.picks)} more to get ranked`;
  return `<aside class="pkw-side">
      <span class="pkw-side__k">Your S${escHtml(String(w.season))} picks</span>
      <div class="pkw-rec"><b class="font-condensed">${me.correct}</b><span>of ${me.picks} called</span></div>
      ${resultChips(w.recent)}
      <span class="pkw-side__p">${standing}${me.streak >= 2 ? ` · <span class="pkw-streak">${FLAME}${me.streak} in a row</span>` : ''}</span>
      <a href="/picks/players/${encodeURIComponent(me.playerId)}?season=${encodeURIComponent(w.season)}" class="pkw-side__link">See all your picks →</a>
    </aside>`;
}

export function picksWidget(w) {
  if (!w) return '';
  if (w.mode === 'open') {
    const allClosed = w.games.every(g => g.closed);
    const when = `${escHtml(dayLabel(w.ymd))} · ${allClosed ? 'picks closed' : `picks close ${escHtml(fmtCloseTime(w.closeTime))}`}`;
    return `<section class="home-section pkw" aria-labelledby="pkw-h">
  <div class="section-header"><h2 id="pkw-h">Who wins? <span class="section-header__sub">${when}</span></h2><a href="/picks" class="section-header__link">Pickmaster race →</a></div>
  <div class="pkw-grid${w.games.length === 1 ? ' is-one' : ''}">
    ${w.games.map(o => openPickCard(o, { isPlayer: w.isPlayer, next: '/', size: 'sm' })).join('')}
    ${sidePanel(w)}
  </div>
</section>
${pickBoxScript()}`;
  }
  return `<section class="home-section pkw" aria-labelledby="pkw-h">
  <div class="section-header"><h2 id="pkw-h">Who called it? <span class="section-header__sub">${escHtml(dayLabel(w.ymd))} · Final</span></h2><a href="/picks" class="section-header__link">All results →</a></div>
  <div class="pkw-grid pkw-grid--res${w.cards.length === 1 ? ' is-one' : ''}">
    ${w.cards.map(s => calledItCard(s, w.isPlayer)).join('')}
    ${sidePanel(w)}
  </div>
</section>`;
}
