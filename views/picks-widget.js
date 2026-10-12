import { escHtml } from './layout.js';
import { summaryPanel } from './home.js';
import { calledItCard, FLAME, dayLabel, shortDayLabel, pickAvatar, barsScript, swipeScript } from './games.js';
import { teamColor } from './utils.js';
import { openPickCard, pickBoxScript, fmtCloseTime } from './pick-box.js';
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

function raceCard(w) {
  const b = w.boards || { pts: [], odds: null, size: 0 };
  const two = !!b.odds && b.pts.length > 0;
  const list = (kind, rows, hidden) => `<div class="pkw-lb__list" data-pkw-board="${kind}"${hidden ? ' hidden' : ''}>
        <div class="pkw-lb__head" aria-hidden="true"><span>#</span><span></span><span>Player</span><span>W–L</span><span>Pts</span></div>
        ${rows.map(r => raceRow(r, kind, w)).join('')}
        ${meRow(kind, w)}
      </div>`;
  return `<section class="pk-card pkw-race" aria-label="Pickmaster race, season ${escHtml(String(w.season))}">
      <div class="pk-card__top">
        <a href="/picks" class="pk-card__when">Race · S${escHtml(String(w.season))}</a>
        ${two ? `<span class="pkw-seg" role="group" aria-label="Leaderboard"><button type="button" class="is-on" data-pkw-show="pts" aria-pressed="true">Pickmaster</button><button type="button" data-pkw-show="odds" aria-pressed="false">Beat the Odds</button></span>`
          : b.size ? `<span class="pk-fav">${b.size} on the board</span>` : ''}
      </div>
      ${b.pts.length ? `${list('pts', b.pts, false)}${two ? list('odds', b.odds, true) : ''}`
        : '<p class="pkw-lb__empty">The board fills after the first finals. Every settled pick counts.</p>'}
      <a href="/picks" class="pk-card__prev">Full race &amp; rules →</a>
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

// ── Face-off (open mode) ──────────────────────────────────────────────────────
const BARS_SHOWN = 6;   // last N games in the chart
const BAR_MAX_PX = 44;
// Team colour for the bars (Paolo's call, an exception to dots/chips only). Black is too dark
// on the card, so it gets a lighter slate.
// "2026-07-19" → "7/19" for phone-width charts.
const numDay = ymd => (ymd ? `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}` : '');
const barColor = team => (team === 'BLACK' ? '#8a94a6' : teamColor(team));

// Points per game against this opponent (or this season), newest on the right. Both players
// share one scale so their bars compare honestly; the dashed line is the player's average.
function chart(p, max, side) {
  const pts = p.series.slice(-BARS_SHOWN);
  const dates = (p.dates || []).slice(-BARS_SHOWN);
  const best = Math.max(...pts);
  const px = v => Math.max(4, Math.round((v / max) * BAR_MAX_PX));
  return `<span class="pkf-chart pkf-chart--${side}" data-bars aria-label="Points in each game: ${pts.join(', ')}">
      <span class="pkf-bars">
        <i class="pkf-avg" style="bottom:${px(p.ppg)}px" aria-hidden="true"></i>
        ${pts.map((v, i) => `<span class="pkf-col" style="--i:${i}"><em data-bar-lbl>${v}</em><span class="pkf-bar${v === best ? ' is-best' : ''}" data-bar style="height:${px(v)}px"></span></span>`).join('')}
      </span>
      <span class="pkf-dates" aria-hidden="true">${pts.map((_, i) => `<small><span class="pkf-d-long">${escHtml(shortDayLabel(dates[i]))}</span><span class="pkf-d-short">${escHtml(numDay(dates[i]))}</span></small>`).join('')}</span>
    </span>`;
}

function facePlayer(p, side, max, lead) {
  if (!p) return `<div class="pkf-p pkf-p--${side} pkf-p--empty">No box scores yet</div>`;
  return `<a href="/players/${encodeURIComponent(p.id)}" class="pkf-p pkf-p--${side}" style="--team:${teamColor(p.team)};--bar:${barColor(p.team)}">
      <span class="pkf-p__head">
        ${pickAvatar({ id: p.id, name: p.name, team: p.team }, 34, false)}
        <span class="pkf-p__id"><b>${escHtml(p.name)}</b><span><span class="team-dot" style="background:${teamColor(p.team)}"></span>${escHtml(p.team)}${p.number !== '' && p.number != null ? ` · #${escHtml(String(p.number))}` : ''}</span></span>
      </span>
      <span class="pkf-p__ppg"><b class="font-condensed${lead ? ' is-lead' : ''}">${p.ppg.toFixed(1)}</b><span>${p.basis === 'season' ? 'PPG this season' : `PPG vs ${escHtml(p.opp)}`}</span></span>
      ${chart(p, max, side)}
    </a>`;
}

function faceoff(o, w) {
  return faceoffCard(o, { isPlayer: w.isPlayer, next: '/' });
}

// The homepage's pick card with the scorer face-off in the middle — also the team page's
// "Up next" (views/team-detail.js). o.face comes from server.js homeFaceoff().
export function faceoffCard(o, { isPlayer = false, next = '/' } = {}) {
  const [pa, pb] = o.face?.scorers || [null, null];
  const max = Math.max(1, ...[pa, pb].filter(Boolean).flatMap(p => p.series.slice(-BARS_SHOWN)));
  const basis = (pa || pb)?.basis === 'season' ? 'Top scorers · this season' : 'Go-to scorers · in this matchup';
  const middle = `<div class="pkf-duel">
        <div class="pkf-k"><span>${basis}</span><a href="${escHtml(o.href)}">Full preview →</a></div>
        <div class="pkf-duel__row">
          ${facePlayer(pa, 'a', max, pa && pb && pa.ppg > pb.ppg)}
          ${facePlayer(pb, 'b', max, pa && pb && pb.ppg > pa.ppg)}
          <span class="pkf-vs font-condensed" aria-hidden="true">VS</span>
        </div>
      </div>`;
  return openPickCard(o, { isPlayer, next, size: 'sm', middle, more: false });
}

// Race strip under the face-off: the leader, your own line, a link to /picks.
function raceStrip(w) {
  const lead = w.leader
    ? `<b>${escHtml(w.leader.name)}</b> leads on ${fmtPts(w.leader.net)}${w.leader.tied > 1 ? ' (tied)' : ''}`
    : 'Nobody on the board yet · first finals put you in';
  const me = w.me;
  const mine = !w.isPlayer ? 'Log in on any game to pick'
    : me ? `You: <b>${fmtPts(me.net)}</b> (${me.correct}–${me.wrong})${me.rank ? ` · #${me.rank}` : ''}${me.streak >= 2 ? ` · <span class="pkw-streak">${FLAME}${me.streak}</span>` : ''}`
    : 'Your picks show here once games settle';
  return `<a href="/picks" class="pkf-race">
      <span class="pkf-race__k">Pickmaster race · S${escHtml(String(w.season))}</span>
      <span class="pkf-race__t">${lead}</span>
      <span class="pkf-race__me">${mine}${w.isPlayer && me ? resultChips(w.recent) : ''}</span>
      <span class="pkf-race__go">Picks &amp; race →</span>
    </a>`;
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
  <div class="pkf">
    <div class="pkf-games${w.games.length === 1 ? ' is-one' : ''}">${w.games.map(o => faceoff(o, w)).join('')}</div>
    ${raceStrip(w)}
  </div>
</section>
${pickBoxScript()}
${barsScript()}`;
  }
  return `<section class="home-section pkw" aria-labelledby="pkw-h">
  <div class="section-header"><h2 id="pkw-h">Who called it? <span class="section-header__sub">${escHtml(dayLabel(w.ymd))} · Final</span></h2><a href="/picks" class="section-header__link">All results →</a></div>
  ${panel}
  <div class="pkw-res swipe-row" style="--cols:${Math.min(4, w.cards.length + 1)}" data-swipe>
    ${w.cards.map(s => calledItCard(s, w.isPlayer, { maxFaces: 6 })).join('')}
    ${raceCard(w)}
  </div>
</section>
${raceScript()}
${swipeScript()}`;
}
