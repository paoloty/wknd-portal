import { escHtml } from './layout.js';
import { summaryPanel } from './home.js';
import { calledItCard, FLAME, dayLabel, shortDayLabel, pickAvatar, barsScript } from './games.js';
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

// Slot 4: the whole card links to /picks. Race leader + your own line, both from code
// (no AI here — the write-up panel above the grid already covers the game day). Before
// anyone is ranked it's fixed copy rather than a leaderboard with nobody on it.
function raceCallout(w) {
  const lead = w.leader
    ? `<b>${escHtml(w.leader.name)}</b> leads on ${fmtPts(w.leader.net)} (${w.leader.correct}–${w.leader.wrong})${w.leader.tied > 1 ? `, tied with ${w.leader.tied - 1} other${w.leader.tied > 2 ? 's' : ''}` : ''}.`
    : 'Nobody on the board yet. Your first final puts you in the race.';
  const me = w.me;
  const mine = !w.isPlayer
    ? `<span class="pkw-side__p">Log in on any game to make your pick.</span>`
    : me
      ? `<div class="pkw-rec"><b class="font-condensed">${fmtPts(me.net)}</b><span>pts · ${me.correct}–${me.wrong}</span></div>
      ${resultChips(w.recent)}
      <span class="pkw-side__p">${me.rank ? `You're <b>#${me.rank}</b> in the race` : 'On the board after your next final'}${me.streak >= 2 ? ` · <span class="pkw-streak">${FLAME}${me.streak} in a row</span>` : ''}</span>`
      : `<span class="pkw-side__p">No picks settled yet. Yours show up here.</span>`;
  return `<a href="/picks" class="pkw-side pkw-call">
      <span class="pkw-side__k">Pickmaster race · S${escHtml(String(w.season))}</span>
      <p class="pkw-side__p">${lead} Most points at season's end wins the <b>Pickmaster</b> award.</p>
      ${mine}
      <span class="pkw-side__link">Picks, race &amp; results →</span>
    </a>`;
}

// The grid always has 4 slots: the cards, empty placeholders, then the race callout last.
const SLOTS = 4;
function fillSlots(cards, w) {
  const n = Math.max(0, SLOTS - 1 - cards.length);
  const empty = Array.from({ length: n }, () => '<div class="pkw-ph" aria-hidden="true"></div>');
  return [...cards, ...empty, raceCallout(w)].join('');
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
  <div class="pkw-grid pkw-grid--res">
    ${fillSlots(w.cards.map(s => calledItCard(s, w.isPlayer)), w)}
  </div>
</section>`;
}
