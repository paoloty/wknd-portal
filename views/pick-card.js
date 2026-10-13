import { escHtml } from './layout.js';
import { teamColor, avatarStack, playerPhotoUrl } from './utils.js';
import { scorerName } from './duel.js';
import { MARGIN_MAX } from '../lib/picks.js';
import { formCheck } from './form-check.js';

// ── pickCard: the one "Who wins?" pick control ──────────────────────────────────────────
// Every pick surface renders this (2026-10-13 redesign; mockups in memory pick-card-redesign):
//   variant 'full'    /picks Open picks: header, rows, faces, talk + preview
//   variant 'card'    homepage, team page, profile, /games Up next: the same, tighter
//   variant 'inline'  the game preview page's rail: no header (the page hero has it)
//   variant 'compact' sidebars (finished game page "Up next"): two short rows + a footer line
// A poll: tap a row to pick, tap the other to switch. Rows fill with the team colours once the
// pickers' split shows (you've picked, or picks closed). Pills: FAV/DOG = the
// odds model's chance; PICKS = share of pickers. Points never show here.
// o comes from server.js openPicks(): { id, a, b, ymd, href, counts, myPick, closed, closeAt,
// odds, faces, talk, talkCount, recA, recB, h2h, season, marginGuess }.
// Faces: one mixed row (avatarStack), never split by side. Sides show in the "Who picked"
// list for logged-in players only (o.faces carries `side` only for them).

const tc = s => String(s || '').charAt(0) + String(s || '').slice(1).toLowerCase();
// Lines and fills: Black's own colour is too dark on the card, so it runs lighter here.
const LINE = { BLACK: '#8a94a6' };
const TINT = { WHITE: 0.18, BLACK: 0.42 };
const lineOf = t => LINE[String(t).toUpperCase()] || teamColor(t);
const tintOf = t => TINT[String(t).toUpperCase()] ?? 0.32;
const dot = (t, size = 9) => `<span class="team-dot" style="background:${teamColor(t)};width:${size}px;height:${size}px"></span>`;
const CHECK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
const LOCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const CHAT = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

// "Closes in 4 days" → "9h 12m" → "41:09" (last hour, ticking). Shared with the browser.
function closeText(ms) {
  if (ms <= 0) return { html: 'Picks are closing', soon: true };
  var s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  var v = d >= 1 ? d + ' day' + (d === 1 ? '' : 's') : h >= 1 ? h + 'h ' + String(m).padStart(2, '0') + 'm' : m + ':' + String(x).padStart(2, '0');
  return { html: 'Closes in <b>' + v + '</b>', soon: s < 3600 };
}

// The faces row: avatarStack (you first, amber ring) + one line of text.
export function pickFacesRow(o, isPlayer) {
  const faces = o.faces || [];
  const n = faces.length, me = faces.some(f => f.me);
  const stack = avatarStack(faces.map(f => ({ id: f.id, name: f.name, color: f.color, me: f.me })), { size: 26, max: 6, total: n });
  const text = !n ? (o.closed ? 'Nobody picked this one' : 'No picks yet · be the first')
    : `<b>${me ? (n === 1 ? 'You' : `You + ${n - 1}`) : n} picked</b>${isPlayer ? '' : ' · log in to see who picked what'}`;
  return `${stack}<span class="pkc-who__t">${text}</span>${n ? '<span class="pkc-who__go">See all →</span>' : ''}`;
}

export function pickCard(o, { variant = 'card', isPlayer = false, next = '/picks' } = {}) {
  const compact = variant === 'compact', head = variant === 'full' || variant === 'card';
  const counts = o.counts || { a: 0, b: 0 }, total = counts.a + counts.b, mine = o.myPick || null;
  // The pickers' split: once you've picked (or picks have closed), from the first pick. You only
  // see it after making your own call, so there's nothing to hold back.
  const showSplit = (o.closed || (isPlayer && !!mine)) && total > 0;
  const pct = s => (total ? Math.round(counts[s] / total * 100) : 0);
  const odds = o.odds || null;
  const names = JSON.stringify({ a: o.a, b: o.b });
  const href = o.href || '#';

  const header = !head ? '' : `<div class="pkc__head" style="--ca:${teamColor(o.a)};--cb:${teamColor(o.b)}">
      <div class="pkc__teams">
        <span class="pkc__t"><b>${dot(o.a, 10)}${escHtml(o.a)}</b><small>S${escHtml(String(o.season))} ${o.recA ? `${o.recA.w}–${o.recA.l}` : '0–0'}</small></span>
        <span class="pkc__h2h">${o.h2h?.meetings ? `<small>Head to head</small><b class="font-condensed">${o.h2h.a}–${o.h2h.b}</b>` : '<small>First meeting</small>'}</span>
        <span class="pkc__t pkc__t--b"><b>${escHtml(o.b)}${dot(o.b, 10)}</b><small>S${escHtml(String(o.season))} ${o.recB ? `${o.recB.w}–${o.recB.l}` : '0–0'}</small></span>
      </div>
      ${odds ? `<div class="pkc__edge" role="img" aria-label="Odds: ${escHtml(tc(o.a))} ${odds.pctA}%, ${escHtml(tc(o.b))} ${odds.pctB}%"><i class="${odds.fav === 'a' ? 'is-fav' : ''}" style="--c:${lineOf(o.a)};flex-basis:${odds.pctA}%"></i><i class="${odds.fav === 'b' ? 'is-fav' : ''}" style="--c:${lineOf(o.b)}"></i></div>` : ''}
    </div>`;

  const cd = o.closeAt && !o.closed ? closeText(Date.parse(o.closeAt) - Date.now()) : null;
  const countdown = cd ? `<span class="pkc-cd${cd.soon ? ' is-soon' : ''}" data-pkc-cd="${escHtml(o.closeAt)}">${cd.html}</span>` : '';
  const q = compact
    ? `<div class="pkc-q"><b>${dot(o.a, 8)} ${escHtml(tc(o.a))} <i>vs</i> ${escHtml(tc(o.b))} ${dot(o.b, 8)}</b>${o.closed ? '<span class="pkc-cd">Closed</span>' : countdown}</div>`
    : o.closed ? `<div class="pkc-q"><b>${LOCK}Picks are closed</b></div>`
    : `<div class="pkc-q"><b data-pkc-q>${mine && isPlayer ? 'Your pick is in' : 'Who wins this one?'}</b>${countdown}</div>`;

  const pill = (s) => {
    if (!odds) return '';
    const p = s === 'a' ? odds.pctA : odds.pctB;
    const kind = p > 50 ? 'FAV' : p < 50 ? 'DOG' : 'EVEN';
    return `<span class="pkc-pill${p > 50 ? ' is-fav' : ''}" title="Chance to win, from the odds model"><em>${kind}</em>${p}%</span>`;
  };
  const row = s => {
    const team = s === 'a' ? o.a : o.b, isMine = mine === s;
    const label = o.closed ? `${tc(team)}${isMine ? ' · your pick' : ''}` : !isPlayer ? `Log in to pick ${tc(team)}` : isMine ? `${tc(team)} · your pick` : `Pick ${tc(team)}`;
    return `<button type="button" role="radio" class="pkc-r${isMine ? ' is-mine' : ''}" data-pkc-side="${s}" aria-checked="${isMine}" aria-label="${escHtml(label)}"${o.closed ? ' disabled' : ''} style="--c:${lineOf(team)};--tint:${tintOf(team)}">
        <span class="pkc-r__fill" data-pkc-fill style="width:${showSplit ? pct(s) : 0}%"></span>
        <span class="pkc-r__radio">${CHECK}</span>
        <span class="pkc-r__name">${dot(team, 9)}${escHtml(tc(team))}</span>${pill(s)}
        <span class="pkc-r__right"><span class="pkc-pill pkc-pill--pk${isMine ? ' is-mine' : ''}" data-pkc-pk${showSplit ? '' : ' hidden'}><em>PICKS</em><span data-pkc-pct>${pct(s)}%</span></span></span>
      </button>`;
  };

  const hint = compact ? '' : `<p class="pkc-hint" data-pkc-hint>${hintHtml(o, isPlayer)}</p>`;
  const guestCta = !isPlayer && !o.closed && !compact
    ? `<a class="pkc-btn pkc-btn--cta" href="/login?next=${encodeURIComponent(next)}">Log in to pick</a><p class="pkc-hint">Right picks earn points in the <a href="/picks/rules">Pickmaster race</a>.</p>` : '';
  const margin = o.marginGuess ? marginHtml(o, isPlayer, compact) : '';
  // Stakes + Remind me live on the big cards only (/picks, the game preview); the homepage
  // and other 'card' surfaces stay slim.
  const big = variant === 'full' || variant === 'inline';
  const stakes = big && isPlayer ? stakesHtml(o) : '';
  const remind = big && isPlayer && o.remind && !o.closed ? remindHtml(o) : '';
  const insight = variant === 'full' ? insightHtml(o) : '';
  const faces = compact ? '' : `<button type="button" class="pkc-who" data-pkc-who${(o.faces || []).length ? '' : ' disabled'}>${pickFacesRow(o, isPlayer)}</button>`;

  const showTalk = !!o.talk && isPlayer && !!mine;
  const talkBtn = o.talk && isPlayer ? `<a class="pkc-btn pkc-btn--talk" href="${escHtml(href)}#talk" data-pkc-talk${showTalk ? '' : ' hidden'}>${CHAT}Talk trash${o.talkCount ? ` <small>${o.talkCount}</small>` : ''}</a>` : '';
  const previewBtn = head ? `<a class="pkc-btn" href="${escHtml(href)}">Full preview <span class="pkc-arr">→</span></a>` : '';
  const acts = compact ? '' : (talkBtn || previewBtn) ? `<div class="pkc-acts${talkBtn && previewBtn && showTalk ? ' is-two' : ''}" data-pkc-acts>${talkBtn}${previewBtn}</div>` : '';
  const foot = compact ? `<div class="pkc-foot" data-pkc-foot${o.talk && isPlayer ? ` data-talk="1" data-talk-n="${o.talkCount || ''}"` : ''}>${compactFoot(o, isPlayer)}</div>` : '';

  return `<article class="pkc pkc--${variant}${o.closed ? ' is-closed' : ''}${mine ? ' has-pick' : ''}" data-pkc="${escHtml(o.id)}" data-a="${counts.a}" data-b="${counts.b}" data-mine="${mine || ''}" data-player="${isPlayer ? '1' : ''}" data-next="${escHtml(next)}" data-names="${escHtml(names)}" data-href="${escHtml(href)}" data-faces="${escHtml(JSON.stringify(o.faces || []))}" aria-label="${escHtml(tc(o.a))} vs ${escHtml(tc(o.b))}">
    ${header}
    <div class="pkc__body">
      ${q}
      <div class="pkc-rows${showSplit ? ' is-split' : ''}" role="radiogroup" aria-label="Who wins: ${escHtml(tc(o.a))} or ${escHtml(tc(o.b))}">${row('a')}${row('b')}</div>
      ${guestCta}${hint}${stakes}${remind}${margin}${insight}${faces}${acts}${foot}
    </div>
  </article>`;
}

function hintHtml(o, isPlayer) {
  const mine = o.myPick, team = mine ? escHtml(tc(mine === 'a' ? o.a : o.b)) : '';
  if (!isPlayer) return '';
  if (o.closed) return mine ? `You picked <b>${team}</b>. Results land after the final.` : "You didn't pick this one.";
  return mine ? `You picked <b>${team}</b>. Tap the other team to switch. <button type="button" class="pkc-link" data-pkc-remove>Remove pick</button>` : '';
}

function compactFoot(o, isPlayer) {
  const href = escHtml(o.href || '#'), mine = o.myPick, n = (o.faces || []).length;
  const left = mine && isPlayer ? `You picked <b>${escHtml(tc(mine === 'a' ? o.a : o.b))}</b>${o.closed ? '' : ' · <button type="button" class="pkc-link" data-pkc-remove>Remove</button>'}` : `${n} picked`;
  const right = mine && isPlayer && o.talk ? `<a class="pkc-foot__talk" href="${href}#talk">${CHAT}Talk trash${o.talkCount ? ` · ${o.talkCount}` : ''}</a>` : `<a href="${href}">Preview →</a>`;
  return `<span>${left}</span>${right}`;
}

// Finals Game 1: guess the winning margin (the last Pickmaster tiebreaker). A number with −/+,
// seeded from the odds' projected margin so it's a tap or two; saved once you stop tapping.
function marginHtml(o, isPlayer, compact) {
  const mine = o.myPick, saved = o.marginGuess.mine, team = mine ? escHtml(tc(mine === 'a' ? o.a : o.b)) : '';
  if (compact) return mine && isPlayer ? `<div class="pkc-mg-line"><b>TIEBREAKER</b>${team} by <strong>${saved ?? '–'}</strong><a href="${escHtml(o.href || '#')}#picks">${saved == null ? 'Add guess' : 'Edit'} →</a></div>` : '';
  if (!isPlayer) return `<div class="pkc-mg is-off"><div class="pkc-mg__k"><b>Finals tiebreaker</b></div><span class="pkc-mg__q">Pickers also guess the winning margin. The closest guess breaks a tie for Pickmaster.</span></div>`;
  if (o.closed) return mine ? `<div class="pkc-mg"><div class="pkc-mg__k"><b>Finals tiebreaker</b></div><span class="pkc-mg__q">Your guess: <b>${team} by ${saved ?? '–'}</b></span></div>` : '';
  const seed = o.marginGuess.seed || 5;
  return `<div class="pkc-mg${mine ? '' : ' is-off'}" data-pkc-margin data-saved="${saved ?? ''}" data-seed="${seed}">
      <div class="pkc-mg__k"><b>Finals tiebreaker</b><a href="/picks/rules">How it works</a></div>
      <div class="pkc-mg__row"><span class="pkc-mg__q" data-pkc-mg-q>${mine ? `How much does <b>${team}</b> win by?` : 'Pick a side first, then guess the winning margin.'}</span>
        <span class="pkc-step"><button type="button" data-pkc-step="-1" aria-label="Lower"${mine ? '' : ' disabled'}>−</button><input type="number" inputmode="numeric" min="1" max="${MARGIN_MAX}" step="1" value="${mine ? (saved ?? '') : ''}" placeholder="${mine ? seed : '–'}" aria-label="Winning margin guess" data-pkc-mg-in${mine ? '' : ' disabled'}><small>pts</small><button type="button" data-pkc-step="1" aria-label="Higher"${mine ? '' : ' disabled'}>+</button></span></div>
      <span class="pkc-mg__msg" data-pkc-mg-msg aria-live="polite">${mine ? (saved == null ? 'Optional · tap − or + to set it' : '✓ Saved · change it until picks close') : ''}</span>
    </div>`;
}

// Stakes: where you stand and where this pick alone would put you (server.js pickStakes). The
// only place points show before the final. data-dog: the side whose right pick pays the
// Beat the Odds bonus line, shown once that's your pick.
function stakesHtml(o) {
  const st = o.stakes;
  if (!st) return '';
  const odds = o.odds, dog = odds && odds.pctA !== odds.pctB ? (odds.pctA < 50 ? 'a' : 'b') : '';
  const mine = o.myPick;
  return `<div class="pkc-stake" data-pkc-stake data-dog="${dog}" data-bto="${dog && st.bto ? st.bto[dog] : ''}" title="Where this pick alone would move you in the Pickmaster race">
      <span>You're <b>${escHtml(st.now)}</b> on <b>${escHtml(st.net)}</b></span>
      <span class="pkc-stake__up"><span data-pkc-stake-r>${mine ? 'Right' : 'Call it'}</span> → ${escHtml(st.right)}</span>
      <span class="pkc-stake__dn"><span data-pkc-stake-w>${mine ? 'Wrong' : 'Miss'}</span> → ${escHtml(st.wrong)}</span>
      <span class="pkc-stake__bonus" data-pkc-bonus${mine && mine === dog && st.bto ? '' : ' hidden'}>Underdog call: <b>+${dog && st.bto ? st.bto[dog] : ''}</b> on Beat the Odds if right</span>
    </div>`;
}

// Before picks open (or a game with no pick card): the same rows, not tappable, with the odds
// pills and a note in place of the countdown. Same look as the live card.
export function pickTeaser(g, { note = '' } = {}) {
  const odds = g.odds || null;
  const row = s => {
    const team = s === 'a' ? g.a : g.b, p = odds ? (s === 'a' ? odds.pctA : odds.pctB) : null;
    const pill = p == null ? '' : `<span class="pkc-pill${p > 50 ? ' is-fav' : ''}"><em>${p > 50 ? 'FAV' : p < 50 ? 'DOG' : 'EVEN'}</em>${p}%</span>`;
    return `<div class="pkc-r is-teaser" style="--c:${lineOf(team)};--tint:${tintOf(team)}"><span class="pkc-r__radio"></span><span class="pkc-r__name">${dot(team, 9)}${escHtml(tc(team))}</span>${pill}</div>`;
  };
  return `<article class="pkc pkc--inline is-closed" aria-label="${escHtml(tc(g.a))} vs ${escHtml(tc(g.b))}">
    <div class="pkc__body">
      <div class="pkc-q"><b>Who wins this one?</b>${note ? `<span class="pkc-cd">${escHtml(note)}</span>` : ''}</div>
      <div class="pkc-rows">${row('a')}${row('b')}</div>
    </div>
  </article>`;
}

// Remind me: one bell + email the evening before game day (server.js pickRemindState).
const BELL = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';
function remindHtml(o) {
  const r = o.remind;
  return `<button type="button" class="pkc-remind${r.on ? ' is-on' : ''}" data-pkc-remind data-ymd="${escHtml(o.ymd)}" data-label="${escHtml(r.label)}" aria-pressed="${r.on}"${o.myPick ? ' hidden' : ''}>${remindInner(r.on, r.label)}</button>`;
}
function remindInner(on, label) {
  return on
    ? `${CHECK}<span>We'll remind you <b>${escHtml(label)}</b> if you haven't picked</span><span class="pkc-remind__x">Undo</span>`
    : `${BELL}<span>Not sure yet? <b>Remind me</b> ${escHtml(label)}</span>`;
}

// /picks: Go-to scorers (default) | Form check. Either one alone shows without the switch.
function insightHtml(o) {
  const duel = o.duel && (o.duel[0] || o.duel[1]) ? duelHtml(o) : '';
  const form = o.formCheck ? formCheck(o.formCheck) : '';
  if (!duel && !form) return '';
  if (!duel || !form) return `<div class="pkc-ins">${duel || form}</div>`;
  return `<div class="pkc-ins" data-pkc-tabs>
      <div class="pkc-tabs" role="tablist" aria-label="Matchup insight">
        <button type="button" role="tab" class="is-on" aria-selected="true" data-pkc-tab="duel">Go-to scorers</button>
        <button type="button" role="tab" aria-selected="false" data-pkc-tab="form">Form check</button>
      </div>
      <div class="pkc-panel is-in" data-pkc-panel="duel">${duel}</div>
      <div class="pkc-panel" data-pkc-panel="form" hidden>${form}</div>
    </div>`;
}
// Each side's go-to scorer in this matchup (server.js duelScorers): PPG against the other
// team and a bar per game (last 5), their best in amber. No meetings yet: their season instead.
function duelHtml(o) {
  const [pa, pb] = o.duel;
  const max = Math.max(1, ...[pa, pb].filter(Boolean).flatMap(p => (p.series || []).slice(-5)));
  const side = (p, k) => {
    if (!p) return `<div class="pkc-pl pkc-pl--${k} is-empty">No box scores yet</div>`;
    const { first, last } = scorerName(p);
    const series = (p.series || []).slice(-5), best = Math.max(...series), bi = series.lastIndexOf(best);
    const team = k === 'a' ? o.a : o.b;
    return `<a class="pkc-pl pkc-pl--${k}" href="/players/${encodeURIComponent(p.id)}">
        <span class="pkc-pl__top"><span class="av-stack__av" style="--team:${teamColor(team)};--av:40px;--av-cut:var(--surface-2)"><span aria-hidden="true">${escHtml(((first || '')[0] || '') + ((last || '')[0] || ''))}</span><img src="${playerPhotoUrl(p.id, 96)}" alt="" loading="lazy" onerror="this.remove()"></span>
          <span class="pkc-pl__nm"><span>${escHtml(first)}</span><b>${escHtml(last)}</b></span></span>
        <span class="pkc-pl__ppg"><b class="font-condensed">${Number(p.ppg).toFixed(1)}</b><span>PPG ${p.basis === 'season' ? 'this season' : `vs ${escHtml(tc(k === 'a' ? o.b : o.a))}`}</span></span>
        <span class="pkc-pl__bars" aria-label="Points, last ${series.length} games: ${series.join(', ')}">${series.map((v, i) => `<span class="pkc-pl__bar" style="--i:${i}"><em>${v}</em><i class="${i === bi ? 'is-best' : ''}" style="--h:${Math.round(v / max * 42)}px;--c:${lineOf(team)}"></i></span>`).join('')}</span>
      </a>`;
  };
  const basis = pa?.basis === 'season' || pb?.basis === 'season' ? 'Top scorer this season (no meetings with box scores yet)' : 'Top scorer in their meetings · points per game, oldest first';
  return `<div class="pkc-duel">${side(pa, 'a')}<span class="pkc-duel__vs" aria-hidden="true">VS</span>${side(pb, 'b')}</div><p class="pkc-duel__note">${basis}; amber is the best.</p>`;
}

// ── pickResultCard: the same game once the final is in (replaces "Who called it?") ─────────
//   variant 'card'   homepage results, /picks game days: header with the final score
//   variant 'inline' the finished game page rail: the page hero has the score
// r comes from server.js pickResultOf(). Everyone's pick is public once the game is final.
export function pickResultCard(r, { variant = 'card', isPlayer = false } = {}) {
  const head = variant === 'card';
  const total = r.total || 0;
  const pct = s => (total ? Math.round(r.counts[s] / total * 100) : 0);
  const odds = r.odds || null;
  const names = JSON.stringify({ a: r.a, b: r.b });
  const day = r.ymd ? new Date(`${r.ymd}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
  const header = !head ? '' : `<div class="pkc__head" style="--ca:${teamColor(r.a)};--cb:${teamColor(r.b)}">
      <div class="pkc__teams">
        <span class="pkc__t"><b>${dot(r.a, 10)}${escHtml(r.a)}</b><span class="pkc__score${r.winner === 'a' ? '' : ' is-lose'} font-condensed">${r.sa}</span></span>
        <span class="pkc__h2h">${r.upset ? '<span class="pkc-upset">UPSET</span>' : '<small>Final</small>'}<b class="font-condensed pkc__day">${escHtml(day)}</b></span>
        <span class="pkc__t pkc__t--b"><b>${escHtml(r.b)}${dot(r.b, 10)}</b><span class="pkc__score${r.winner === 'b' ? '' : ' is-lose'} font-condensed">${r.sb}</span></span>
      </div>
      ${odds ? `<div class="pkc__edge" role="img" aria-label="Pre-game odds: ${escHtml(tc(r.a))} ${odds.pctA}%, ${escHtml(tc(r.b))} ${odds.pctB}%"><i class="${odds.fav === 'a' ? 'is-fav' : ''}" style="--c:${lineOf(r.a)};flex-basis:${odds.pctA}%"></i><i class="${odds.fav === 'b' ? 'is-fav' : ''}" style="--c:${lineOf(r.b)}"></i></div>` : ''}
    </div>`;
  const row = s => {
    const team = s === 'a' ? r.a : r.b, win = r.winner === s, isMine = r.myPick === s;
    const p = odds ? (s === 'a' ? odds.pctA : odds.pctB) : null;
    const oddsPill = p == null ? '' : `<span class="pkc-pill${p > 50 ? ' is-fav' : ''}"><em>${p > 50 ? 'FAV' : p < 50 ? 'DOG' : 'EVEN'}</em>${p}%</span>`;
    return `<div class="pkc-r pkc-r--res${isMine ? ' is-mine' : ''}${win ? ' is-win' : ' is-loss'}" style="--c:${lineOf(team)};--tint:${tintOf(team)}">
        ${total ? `<span class="pkc-r__fill" style="width:${pct(s)}%"></span>` : ''}
        ${isMine ? `<span class="pkc-r__radio">${CHECK}</span>` : '<span class="pkc-r__radio"></span>'}
        <span class="pkc-r__name">${dot(team, 9)}${escHtml(tc(team))}</span>${oddsPill}
        <span class="pkc-r__right">${total ? `<span class="pkc-pill pkc-pill--pk${isMine ? ' is-mine' : ''}"><em>PICKS</em>${pct(s)}%</span>` : ''}</span>
      </div>`;
  };
  const winTeam = escHtml(tc(r.winner === 'a' ? r.a : r.b));
  const pts = r.points;
  const fmt = n => `${n > 0 ? '+' : '−'}${Math.abs(n).toFixed(2).replace(/\.00$/, '')}`;
  const you = !isPlayer ? '' : !r.myPick ? '<p class="pkc-hint">You didn\'t pick this one.</p>'
    : r.myPick === r.winner
      ? `<div class="pkc-called is-ok"><span class="pkc-called__ic">${CHECK}</span><p><b>You called it.</b> ${winTeam} won${r.upset ? ' as the underdog' : ''}.</p><span class="pkc-called__pts"><b>${fmt(pts.net)}${pts.bto != null ? ` · ${fmt(pts.bto)}` : ''}</b><small>Pickmaster${pts.bto != null ? ' · Beat the Odds' : ''}</small></span></div>`
      : `<div class="pkc-called is-miss"><span class="pkc-called__ic">✕</span><p><b>Missed this one.</b> You picked ${escHtml(tc(r.myPick === 'a' ? r.a : r.b))}.</p><span class="pkc-called__pts"><b>${fmt(pts.net)}${pts.bto != null ? ` · ${fmt(pts.bto)}` : ''}</b><small>Pickmaster${pts.bto != null ? ' · Beat the Odds' : ''}</small></span></div>`;
  const margin = r.margin ? `<div class="pkc-mg-res"><div><span>Your guess</span><b>${escHtml(tc(r.margin.side === 'a' ? r.a : r.b))} by ${r.margin.guess}</b></div><div><span>Actual</span><b>${winTeam} by ${r.margin.actual}</b></div><div><span>${r.margin.side === r.winner ? 'Off by' : 'Tiebreaker'}</span><b class="${r.margin.side === r.winner ? 'is-good' : ''}">${r.margin.side === r.winner ? Math.abs(r.margin.guess - r.margin.actual) : 'wrong side'}</b></div></div>` : '';
  const proj = variant === 'inline' && odds?.fav && odds.margin != null
    ? `<p class="pkc-hint">Odds said <b>${escHtml(tc(odds.fav === 'a' ? r.a : r.b))} by ${Math.max(1, Math.round(Math.abs(odds.margin)))}</b> · ${winTeam} won by <b>${Math.abs(r.sa - r.sb)}</b></p>` : '';
  const callers = (r.faces || []).filter(f => f.right);
  const stack = avatarStack(callers.map(f => ({ id: f.id, name: f.name, color: f.color, me: f.me })), { size: 26, max: 6, total: callers.length });
  const facesText = !total ? 'Nobody picked this game' : !callers.length ? `Nobody called it · ${total} pick${total === 1 ? '' : 's'}` : `<b>${callers.length} of ${total} called it</b>`;
  const faces = `<button type="button" class="pkc-who" data-pkc-who${total ? '' : ' disabled'}>${stack}<span class="pkc-who__t">${facesText}</span>${total ? '<span class="pkc-who__go">See all →</span>' : ''}</button>`;
  const talk = r.talk ? `<a class="pkc-btn pkc-btn--talk" href="${escHtml(r.href)}#talk">${CHAT}Talk about it${r.talkCount ? ` <small>${r.talkCount}</small>` : ''}</a>` : '';
  const recap = head ? `<a class="pkc-btn" href="${escHtml(r.href)}">Full recap <span class="pkc-arr">→</span></a>` : '';
  const acts = talk || recap ? `<div class="pkc-acts${talk && recap ? ' is-two' : ''}">${talk}${recap}</div>` : '';
  return `<article class="pkc pkc--result pkc--${variant} is-closed" data-pkc="${escHtml(r.id)}" data-names="${escHtml(names)}" data-faces="${escHtml(JSON.stringify(r.faces || []))}" data-player="${isPlayer ? '1' : ''}" data-href="${escHtml(r.href)}" data-final="1" aria-label="${escHtml(tc(r.a))} ${r.sa}, ${escHtml(tc(r.b))} ${r.sb}, final">
    ${header}
    <div class="pkc__body">
      <div class="pkc-rows is-split">${row('a')}${row('b')}</div>
      ${you}${proj}${margin}${faces}${acts}
    </div>
  </article>`;
}

// One script for every pick card on the page. Safe to include more than once.
export function pickCardScript() {
  return `<script>
(function () {
  if (window.__wkndPkc) return; window.__wkndPkc = true;
  var MAX = ${MARGIN_MAX};
  var CHECK = ${JSON.stringify(CHECK)}, CHAT = ${JSON.stringify(CHAT)}, BELL = ${JSON.stringify(BELL)};
  ${closeText.toString()}
  function tc(s) { s = String(s || ''); return s.charAt(0) + s.slice(1).toLowerCase(); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Countdowns
  function tick() {
    document.querySelectorAll('[data-pkc-cd]').forEach(function (el) {
      var c = closeText(Date.parse(el.dataset.pkcCd) - Date.now());
      if (el.innerHTML !== c.html) el.innerHTML = c.html;
      el.classList.toggle('is-soon', c.soon);
    });
  }
  setInterval(tick, 1000);

  // Split bars grow in the first time a card scrolls into view: a CSS scale animation on the
  // fills (.is-grow), so the bars keep their real width whether or not it runs.
  function growIn() {
    if (reduce || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        e.target.classList.add('is-grow', 'is-sweep');
      });
    }, { threshold: 0.4 });
    document.querySelectorAll('[data-pkc] .pkc-rows.is-split').forEach(function (c) { io.observe(c); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', growIn); else growIn();

  function countUp(el, to) {
    if (reduce) { el.textContent = to + '%'; return; }
    var t0 = performance.now();
    (function step(now) { var k = Math.min(1, (now - t0) / 800), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e) + '%'; if (k < 1) requestAnimationFrame(step); })(t0);
  }

  // Redraw one card after a pick / switch / remove.
  function render(card, counts, mine, faces, facesHtml, kind) {
    var names = JSON.parse(card.dataset.names), player = !!card.dataset.player, closed = card.classList.contains('is-closed');
    var t = counts.a + counts.b, split = (closed || (player && !!mine)) && t > 0;
    card.dataset.a = counts.a; card.dataset.b = counts.b; card.dataset.mine = mine || '';
    if (faces) card.dataset.faces = JSON.stringify(faces);
    card.classList.toggle('has-pick', !!mine);
    var rows = card.querySelector('.pkc-rows');
    rows.classList.toggle('is-split', split);
    if (kind === 'pick' || kind === 'switch') { rows.classList.remove('is-sweep'); void rows.offsetWidth; rows.classList.add('is-sweep'); }
    ['a', 'b'].forEach(function (s) {
      var r = card.querySelector('[data-pkc-side="' + s + '"]'); if (!r) return;
      var on = mine === s, p = t ? Math.round(counts[s] / t * 100) : 0;
      r.classList.toggle('is-mine', on);
      r.setAttribute('aria-checked', on ? 'true' : 'false');
      r.setAttribute('aria-label', on ? tc(names[s]) + ' · your pick' : 'Pick ' + tc(names[s]));
      r.querySelector('[data-pkc-fill]').style.width = (split ? p : 0) + '%';
      var pk = r.querySelector('[data-pkc-pk]');
      if (pk) {
        var was = pk.hidden; pk.hidden = !split; pk.classList.toggle('is-mine', on);
        var n = pk.querySelector('[data-pkc-pct]');
        if (split && (was || kind)) countUp(n, p); else n.textContent = p + '%';
      }
    });
    var q = card.querySelector('[data-pkc-q]'); if (q) q.textContent = mine ? 'Your pick is in' : 'Who wins this one?';
    var hint = card.querySelector('[data-pkc-hint]');
    if (hint && player && !closed) hint.innerHTML = mine ? 'You picked <b>' + esc(tc(names[mine])) + '</b>. Tap the other team to switch. <button type="button" class="pkc-link" data-pkc-remove>Remove pick</button>' : '';
    var who = card.querySelector('[data-pkc-who]');
    if (who && facesHtml != null) { who.innerHTML = facesHtml; who.disabled = !(faces && faces.length); var me = who.querySelector('.av-stack__av--me'); if (me && (kind === 'pick' || kind === 'face') && !reduce) me.classList.add('is-new'); }
    var talk = card.querySelector('[data-pkc-talk]'); if (talk) talk.hidden = !mine;
    var acts = card.querySelector('[data-pkc-acts]'); if (acts) acts.classList.toggle('is-two', !!(talk && !talk.hidden && acts.children.length > 1));
    var foot = card.querySelector('[data-pkc-foot]');
    if (foot) {
      var href = card.dataset.href, n = faces ? faces.length : JSON.parse(card.dataset.faces || '[]').length;
      var right = mine && foot.dataset.talk === '1'
        ? '<a class="pkc-foot__talk" href="' + esc(href) + '#talk">' + CHAT + 'Talk trash' + (foot.dataset.talkN ? ' · ' + esc(foot.dataset.talkN) : '') + '</a>'
        : '<a href="' + esc(href) + '">Preview →</a>';
      foot.innerHTML = '<span>' + (mine ? 'You picked <b>' + esc(tc(names[mine])) + '</b> · <button type="button" class="pkc-link" data-pkc-remove>Remove</button>' : n + ' picked') + '</span>' + right;
    }
    marginFollow(card, mine, names);
    var st = card.querySelector('[data-pkc-stake]');
    if (st) {
      var r1 = st.querySelector('[data-pkc-stake-r]'), w1 = st.querySelector('[data-pkc-stake-w]'), bonus = st.querySelector('[data-pkc-bonus]');
      if (r1) r1.textContent = mine ? 'Right' : 'Call it';
      if (w1) w1.textContent = mine ? 'Wrong' : 'Miss';
      if (bonus) bonus.hidden = !(mine && mine === st.dataset.dog && st.dataset.bto);
    }
    var rem = card.querySelector('[data-pkc-remind]'); if (rem) rem.hidden = !!mine;
    document.dispatchEvent(new CustomEvent('wknd:pick', { detail: { gameId: card.dataset.pkc, side: mine || null } }));
  }

  // Margin guess: follows the pick; −/+ steps from the saved value or the seed; one save
  // after you stop tapping (or leave the field).
  function marginFollow(card, mine, names) {
    var mg = card.querySelector('[data-pkc-margin]'); if (!mg) return;
    var inp = mg.querySelector('[data-pkc-mg-in]'), q = mg.querySelector('[data-pkc-mg-q]'), msg = mg.querySelector('[data-pkc-mg-msg]');
    mg.classList.toggle('is-off', !mine);
    mg.querySelectorAll('button, input').forEach(function (b) { b.disabled = !mine; });
    inp.placeholder = mine ? mg.dataset.seed : '–';
    q.innerHTML = mine ? 'How much does <b>' + esc(tc(names[mine])) + '</b> win by?' : 'Pick a side first, then guess the winning margin.';
    if (!mine) { inp.value = ''; mg.dataset.saved = ''; msg.textContent = ''; }
    else if (!msg.textContent) msg.textContent = 'Optional · tap − or + to set it';
  }
  function saveMargin(card) {
    var mg = card.querySelector('[data-pkc-margin]'); if (!mg) return;
    var inp = mg.querySelector('[data-pkc-mg-in]'), msg = mg.querySelector('[data-pkc-mg-msg]');
    var v = inp.value.trim(), n = v === '' ? null : Number(v);
    if (n !== null && !(n % 1 === 0 && n >= 1 && n <= MAX)) { msg.textContent = 'Whole number, 1 to ' + MAX; return; }
    if (String(n == null ? '' : n) === (mg.dataset.saved || '')) return;
    msg.textContent = 'Saving…';
    var seq = (mg._seq || 0) + 1; mg._seq = seq;
    fetch('/games/' + encodeURIComponent(card.dataset.pkc) + '/pick/margin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ margin: n }) })
      .then(function (r) { if (r.status === 401) { toLogin(card, null); return null; } return r.json().catch(function () { return {}; }); })
      .then(function (d) {
        if (!d || seq !== mg._seq) return;
        if (d.ok) { mg.dataset.saved = d.margin == null ? '' : String(d.margin); msg.textContent = d.margin == null ? 'Guess cleared' : '✓ Saved · change it until picks close'; }
        else msg.textContent = d.error || "Couldn't save your guess.";
      })
      .catch(function () { if (seq === mg._seq) msg.textContent = "Couldn't save. Check your connection."; });
  }
  function queueMargin(card) {
    var mg = card.querySelector('[data-pkc-margin]'); if (!mg) return;
    clearTimeout(mg._t); mg._t = setTimeout(function () { if (card.dataset.busy) queueMargin(card); else saveMargin(card); }, 700);
  }

  // A problem saving: the hint line says so for a few seconds.
  function flashError(card, msg) {
    var hint = card.querySelector('[data-pkc-hint]') || card.querySelector('[data-pkc-foot] > span'); if (!hint) return;
    hint.classList.add('is-error'); hint.textContent = msg;
    clearTimeout(hint._t);
    hint._t = setTimeout(function () { hint.classList.remove('is-error'); render(card, { a: +card.dataset.a, b: +card.dataset.b }, card.dataset.mine || null, null, null, null); }, 5000);
  }
  function toLogin(card, side) {
    var next = card.dataset.next || '/picks';
    if (side) {
      var hash = '', h = next.indexOf('#');
      if (h >= 0) { hash = next.slice(h); next = next.slice(0, h); }
      next += (next.indexOf('?') < 0 ? '?' : '&') + 'pick=' + side + ':' + encodeURIComponent(card.dataset.pkc) + hash;
    }
    window.location.href = '/login?next=' + encodeURIComponent(next);
  }
  // The rows change the moment you tap; if saving fails they go back.
  function send(card, side) {
    if (card.dataset.busy) return;
    card.dataset.busy = '1';
    var prev = { a: +card.dataset.a, b: +card.dataset.b }, prevMine = card.dataset.mine || null;
    var c = { a: prev.a, b: prev.b };
    if (prevMine) c[prevMine] = Math.max(0, c[prevMine] - 1);
    if (side) c[side]++;
    var kind = side ? (prevMine ? 'switch' : 'pick') : 'clear';
    render(card, c, side, null, null, kind);
    if (side && navigator.vibrate) { try { navigator.vibrate(12); } catch (err) {} }
    fetch('/games/' + encodeURIComponent(card.dataset.pkc) + '/pick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ side: side }) })
      .then(function (r) { if (r.status === 401) { toLogin(card, side); return null; } return r.json().catch(function () { return {}; }); })
      .then(function (d) {
        delete card.dataset.busy;
        if (!d) return;
        if (d.ok) {
          document.querySelectorAll('[data-pkc="' + CSS.escape(card.dataset.pkc) + '"]').forEach(function (o) {
            if (!o.classList.contains('is-closed')) render(o, d.counts, d.side, d.faces, d.facesHtml, o === card ? (kind === 'pick' ? 'face' : null) : kind);
          });
        } else { render(card, prev, prevMine, null, null, null); flashError(card, d.error || "Couldn't save your pick. Try again."); }
      })
      .catch(function () { delete card.dataset.busy; render(card, prev, prevMine, null, null, null); flashError(card, "Couldn't save your pick. Check your connection and try again."); });
  }

  // Remind me: the button flips at once; if saving fails it flips back.
  function remindToggle(card, btn) {
    if (btn.dataset.busy) return;
    var on = !btn.classList.contains('is-on'), label = btn.dataset.label;
    // One reminder per game day, so every card for that day flips together.
    var draw = function (v) {
      document.querySelectorAll('[data-pkc-remind][data-ymd="' + CSS.escape(btn.dataset.ymd) + '"]').forEach(function (b) {
        b.classList.toggle('is-on', v); b.setAttribute('aria-pressed', v ? 'true' : 'false');
        b.innerHTML = v ? CHECK + '<span>We&rsquo;ll remind you <b>' + esc(label) + '</b> if you haven&rsquo;t picked</span><span class="pkc-remind__x">Undo</span>'
          : BELL + '<span>Not sure yet? <b>Remind me</b> ' + esc(label) + '</span>';
      });
    };
    draw(on); btn.dataset.busy = '1';
    fetch('/picks/remind', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ymd: btn.dataset.ymd, on: on }) })
      .then(function (r) { if (r.status === 401) { toLogin(card, null); return null; } return r.json().catch(function () { return {}; }); })
      .then(function (d) { delete btn.dataset.busy; if (d && !d.ok) { draw(!on); flashError(card, d.error || "Couldn't set the reminder."); } })
      .catch(function () { delete btn.dataset.busy; draw(!on); flashError(card, "Couldn't set the reminder. Check your connection."); });
  }

  // "Who picked": everyone, one list. Logged-in players see each person's pick; guests don't.
  var dlg;
  function openList(card) {
    var faces = JSON.parse(card.dataset.faces || '[]'); if (!faces.length) return;
    var names = JSON.parse(card.dataset.names), player = !!card.dataset.player;
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.className = 'pkc-dlg'; dlg.setAttribute('aria-labelledby', 'pkc-dlg-h');
      dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('[data-pkc-close]')) dlg.close(); });
      document.body.appendChild(dlg);
    }
    var list = faces.slice().sort(function (x, y) { return (y.me ? 1 : 0) - (x.me ? 1 : 0) || String(x.name).localeCompare(String(y.name)); });
    var counts = { a: 0, b: 0 }; list.forEach(function (p) { if (p.side) counts[p.side]++; });
    var sides = list.some(function (p) { return p.side; }), final = !!card.dataset.final;
    var sub = sides ? list.length + ' pick' + (list.length === 1 ? '' : 's') + ' · ' + tc(names.a) + ' ' + counts.a + ', ' + tc(names.b) + ' ' + counts.b
      : list.length + ' picked. Log in to see who picked what.';
    if (final) list.sort(function (x, y) { return (y.me ? 1 : 0) - (x.me ? 1 : 0) || (y.right ? 1 : 0) - (x.right ? 1 : 0) || String(x.name).localeCompare(String(y.name)); });
    dlg.innerHTML = '<div class="pkc-dlg__head"><div><h2 id="pkc-dlg-h">' + (final ? 'Who called it · ' : 'Who picked · ') + esc(tc(names.a)) + ' vs ' + esc(tc(names.b)) + '</h2><p>' + esc(sub) + '</p></div><button type="button" class="pkc-dlg__x" aria-label="Close" data-pkc-close>✕</button></div>'
      + '<ul class="pkc-dlg__list">' + list.map(function (p, i) {
        var chip = p.side ? '<span class="pkc-dlg__chip' + (final ? (p.right ? ' is-ok' : ' is-miss') : '') + '">' + (final ? (p.right ? '✓ ' : '✕ ') : '') + '<span class="team-dot" style="background:' + esc(p.sideColor || '#888') + ';width:8px;height:8px"></span>' + esc(tc(names[p.side])) + '</span>' : '';
        return '<li style="--i:' + i + '"' + (p.me ? ' class="is-me"' : '') + '><a href="/players/' + encodeURIComponent(p.id) + '"><span class="av-stack__av' + (p.me ? ' av-stack__av--me' : '') + '" style="--team:' + esc(p.color) + ';--av:32px"><span aria-hidden="true">' + esc(p.ini) + '</span><img src="/api/player/' + encodeURIComponent(p.id) + '/photo?w=96" alt="" loading="lazy" onerror="this.remove()"></span><span class="pkc-dlg__nm">' + esc(p.me ? p.name + ' · You' : p.name) + '</span></a>' + chip + '</li>';
      }).join('') + '</ul>';
    dlg.showModal();
  }

  document.addEventListener('click', function (e) {
    var card = e.target.closest('[data-pkc]'); if (!card) return;
    var player = !!card.dataset.player, closed = card.classList.contains('is-closed');
    if (e.target.closest('[data-pkc-who]')) { openList(card); return; }
    var tab = e.target.closest('[data-pkc-tab]');
    if (tab) {
      var box = tab.closest('[data-pkc-tabs]');
      box.querySelectorAll('[data-pkc-tab]').forEach(function (b) { var on = b === tab; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
      box.querySelectorAll('[data-pkc-panel]').forEach(function (p) { var on = p.dataset.pkcPanel === tab.dataset.pkcTab; p.hidden = !on; p.classList.remove('is-in'); if (on) { void p.offsetWidth; p.classList.add('is-in'); } });
      var fk = box.querySelector('[data-pkc-panel="form"] .fck'); if (fk && tab.dataset.pkcTab === 'form') { fk.classList.remove('is-in'); void fk.offsetWidth; fk.classList.add('is-in'); }
      return;
    }
    var rb = e.target.closest('[data-pkc-remind]');
    if (rb) { remindToggle(card, rb); return; }
    var step = e.target.closest('[data-pkc-step]');
    if (step) {
      var mg = card.querySelector('[data-pkc-margin]'), inp = mg.querySelector('[data-pkc-mg-in]');
      var cur = inp.value.trim() === '' ? Number(mg.dataset.seed) - Number(step.dataset.pkcStep) : Number(inp.value);
      inp.value = Math.min(MAX, Math.max(1, cur + Number(step.dataset.pkcStep)));
      queueMargin(card); return;
    }
    if (closed) return;
    if (e.target.closest('[data-pkc-remove]')) { if (card.dataset.mine) send(card, null); return; }
    var row = e.target.closest('[data-pkc-side]'); if (!row) return;
    var s = row.dataset.pkcSide;
    if (!player) { toLogin(card, s); return; }
    if (card.dataset.mine === s) return;
    send(card, s);
  });
  document.addEventListener('input', function (e) { if (e.target.matches('[data-pkc-mg-in]')) queueMargin(e.target.closest('[data-pkc]')); });
  document.addEventListener('change', function (e) { if (e.target.matches('[data-pkc-mg-in]')) saveMargin(e.target.closest('[data-pkc]')); });

  // Back from logging in with ?pick=a:<id>: make that pick, then tidy the address bar.
  function pickFromLogin() {
    var q = new URLSearchParams(location.search), v = q.get('pick');
    if (!v) return;
    q.delete('pick');
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    var side = v.charAt(0), id = v.slice(2);
    if ((side !== 'a' && side !== 'b') || !id) return;
    var card = document.querySelector('[data-pkc="' + CSS.escape(id) + '"]');
    if (!card || !card.dataset.player || card.classList.contains('is-closed') || card.dataset.mine === side) return;
    card.scrollIntoView({ block: 'center' });
    send(card, side);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pickFromLogin); else pickFromLogin();

  // "You've picked N of M" counters (/picks, profile).
  document.addEventListener('wknd:pick', function () {
    document.querySelectorAll('[data-pick-progress]').forEach(function (p) {
      var cards = document.querySelectorAll(p.dataset.pickProgress + ' [data-pkc]:not(.is-closed)');
      var ids = {}, done = {};
      cards.forEach(function (b) { ids[b.dataset.pkc] = 1; if (b.dataset.mine) done[b.dataset.pkc] = 1; });
      var n = Object.keys(done).length, m = Object.keys(ids).length;
      var c = p.querySelector('[data-progress-n]'); if (c) c.textContent = n + ' of ' + m;
      var bar = p.querySelector('[data-progress-bar]'); if (bar) bar.style.width = (m ? Math.round(n / m * 100) : 0) + '%';
      p.classList.toggle('is-done', m > 0 && n === m);
    });
  });
})();
</script>`;
}
