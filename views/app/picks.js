// Who wins? in the app (/app/picks): one card per upcoming game, picked with one tap. Built
// from the same openPicks() objects as the site's pick cards (views/pick-card.js) and saved
// through the same POST /games/:id/pick, so the rules live in one place. Same reveal rule as
// the site: the pickers' split shows once you've picked (or picks are closed).
import { esc, backChev } from './layout.js';

const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);

function oddsRow(g) {
  if (!g.odds) return '';
  const { pctA, pctB } = g.odds;
  return `<div class="pick__odds" aria-label="Odds">
    <div class="pick__oddsbar"><span style="width:${pctA}%;--c:${esc(g.a.color)}"></span><span style="flex:1;--c:${esc(g.b.color)}"></span></div>
    <div class="pick__oddsl"><span>${pctA > pctB ? 'Favourite' : pctA < pctB ? 'Underdog' : 'Even'} ${pctA}%</span><span>${pctB > pctA ? 'Favourite' : pctB < pctA ? 'Underdog' : 'Even'} ${pctB}%</span></div>
  </div>`;
}

function option(g, side) {
  const t = g[side], total = g.counts.a + g.counts.b;
  const share = pct(g.counts[side], total);
  const mine = g.myPick === side;
  const reveal = (g.myPick || g.closed) && total > 0;
  const sub = !g.odds ? '' : (g.odds[side === 'a' ? 'pctA' : 'pctB'] < 50 ? 'Underdog' : g.odds[side === 'a' ? 'pctA' : 'pctB'] > 50 ? 'Favourite' : '');
  return `<button type="button" class="pick__opt${mine ? ' is-mine' : ''}" data-side="${side}" style="--c:${esc(t.color)}"${g.closed ? ' disabled' : ''} aria-pressed="${mine}">
    ${reveal && share > 0 ? `<span class="pick__fill" style="width:${share}%"></span>` : ''}
    <span class="pick__radio" aria-hidden="true"></span>
    <span class="dot" style="--c:${esc(t.color)}"></span>
    <span class="pick__name">${esc(t.name)}${mine ? ' <span class="pick__yours">· your pick</span>' : ''}</span>
    ${reveal ? `<span class="pick__pct">${share}%</span>` : sub ? `<span class="pick__sub">${sub}</span>` : ''}
  </button>`;
}

function faces(g) {
  const n = g.faces.length, me = g.faces.some(f => f.me);
  const text = !n ? (g.closed ? 'Nobody picked this one' : 'No picks yet · be the first') : `${me ? (n === 1 ? 'You' : `You + ${n - 1}`) : n} picked`;
  return `<div class="pick__who">${n ? `<span class="pick__stack">${g.faces.slice(0, 5).map(f => `<span style="--c:${esc(f.color)}"${f.me ? ' class="is-me"' : ''}>${esc(f.ini)}</span>`).join('')}</span>` : ''}<span>${text}</span></div>`;
}

function stakes(g) {
  const st = g.stakes;
  if (!st) return '';
  return `<div class="pick__stakes"><span>You're <b>${esc(st.now)}</b> on <b>${esc(st.net)}</b></span><span class="up">${g.myPick ? 'Right' : 'Call it'} → ${esc(st.right)}</span><span class="dn">${g.myPick ? 'Wrong' : 'Miss'} → ${esc(st.wrong)}</span></div>`;
}

function card(g) {
  return `<section class="card pick" id="g-${esc(g.id)}" data-pick-game="${esc(g.id)}" data-pick-a="${esc(g.a.name)}" data-pick-b="${esc(g.b.name)}" data-close-label="${esc(g.closeLabel)}">
    <div class="pick__top"><span class="kick">${esc(g.title)}</span>
      ${g.closed ? '<span class="pick__close is-closed">Picks closed</span>' : g.closeAt ? `<span class="pick__close" data-close-at="${g.closeAt}"></span>` : ''}</div>
    <div class="pick__day">${esc(g.dayLabel)}</div>
    <div class="pick__mu">
      <div class="pick__tm" style="--c:${esc(g.a.color)}"><span class="pick__ring">${esc(g.a.name.slice(0, 2))}</span><b>${esc(g.a.name)}</b><small>${esc(g.a.rec)}</small></div>
      <span class="pick__vs">VS</span>
      <div class="pick__tm" style="--c:${esc(g.b.color)}"><span class="pick__ring">${esc(g.b.name.slice(0, 2))}</span><b>${esc(g.b.name)}</b><small>${esc(g.b.rec)}</small></div>
    </div>
    ${oddsRow(g)}
    <div class="pick__q">${g.closed ? 'Picks are closed' : g.myPick ? 'Your pick is in. Tap the other side to change it.' : 'Who wins this one?'}</div>
    <div class="pick__opts">${option(g, 'a')}${option(g, 'b')}</div>
    ${faces(g)}
    ${stakes(g)}
    ${g.marginGuess ? '<p class="pick__note">Finals tiebreaker (guess the winning margin) <span class="tag-muted">Soon</span></p>' : ''}
    <p class="pick__msg" data-pick-msg hidden></p>
  </section>`;
}

// record: { wl, net, rank, tied } | null · games: see card()
export function appPicksPage({ record, games, off = false }) {
  const rec = record
    ? `<div class="card pick-rec"><div><div class="kick">Your record</div><b class="num">${esc(record.wl)}</b><small>${esc(record.net)} net</small></div>
        <div style="text-align:right"><div class="kick muted-kick">Pickmaster</div><b class="num pick-rec__rank">${record.rank ? `${record.tied ? 'T' : '#'}${record.rank}` : '—'}</b></div></div>`
    : `<div class="card pick-rec"><div><div class="kick">Your record</div><small>Make your first pick to get on the board.</small></div></div>`;
  return `
  <div class="navbar"><a class="navbar__back" href="/app">${backChev}Home</a><span class="navbar__title">Who wins?</span><span></span></div>
  ${off ? '<div class="empty" style="margin-top:8px">Picks are off right now.</div>' : `
  <div style="margin-top:4px">${rec}</div>
  ${games.length ? `<div class="sec">Open games</div><div class="stack" style="--gap:12px">${games.map(card).join('')}</div>`
    : '<div class="empty" style="margin-top:12px">No games to pick right now. They show up here once the next game day is on the schedule.</div>'}`}`;
}
