import { escHtml } from './layout.js';
import { teamColor, initials, playerPhotoUrl } from './utils.js';

// ── The duel: two players head to head ──────────────────────────────────────────────────
// One look for every place two players face off:
//   duelCard — the shared player card (.pl-card): the game page's Players to watch (before
//              tip-off) and Top performers (the recap)
//   duelSide — the same pieces without the card, for inside another card: the "Who wins?"
//              pick card on the homepage and the team page's Up next
// Both draw the player's points in each game as bars on a scale shared with the other player
// (duelScale), with a dashed line at their average. Before the game the best game is amber;
// in the recap tonight is the last bar and the amber one.
//
// p (built by previewDuel below, or views/game.js for the recap):
//   id, first, last, team, number, meta    who, and the extra bit of the team line
//   big, bigKey, lead                       the big number (amber when lead)
//   tag, potg                               the tag above the player; potg = amber badge + glow
//   line: [{ k, v, win, tie }]              the stat line, the winner of each in amber
//   series, dates, avg, tonight             the bars (oldest first), the dashed line, tonight's points
//   barsKey, noBars                         the label over the bars; the note under them when < 3 games
//   foot, end                               footer html: text on the left, a button on the right

export const DUEL_BARS = 6;     // the last N games
const MIN_BARS = 3;             // fewer than this: a note under the chart instead of dates
const BAR_PX = 44;

const tc = s => String(s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const shortDay = ymd => (ymd ? new Date(`${ymd}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
const numDay = ymd => (ymd ? `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}` : '');
// Black is too dark for bars on the card: a lighter slate.
const barColor = team => (String(team).toUpperCase() === 'BLACK' ? '#8a94a6' : teamColor(team));

// First / LASTNAME from the raw "LASTNAME, Firstname". Previews frozen when picks closed only
// carry the display name ("Firstname LASTNAME"): its trailing all-caps words are the last name.
export function scorerName(p) {
  const raw = String(p.rawName || '');
  const comma = raw.indexOf(',');
  if (comma !== -1) return { first: raw.slice(comma + 1).trim(), last: raw.slice(0, comma).trim().toUpperCase() };
  const words = String(p.name || '').trim().split(/\s+/);
  let i = words.length;
  while (i > 1 && /\p{Lu}/u.test(words[i - 1]) && words[i - 1] === words[i - 1].toUpperCase()) i--;
  if (i === words.length) i--; // no all-caps word: the last word
  return { first: words.slice(0, i).join(' '), last: words.slice(i).join(' ') };
}

function shownBars(p) {
  const all = (p.series || []).map((v, i) => ({ v, ymd: p.dates?.[i] || '' }));
  if (p.tonight != null) all.push({ v: p.tonight, tonight: true });
  return all.slice(-DUEL_BARS);
}

// One scale for both players, so the same points are the same height on both sides.
export function duelScale(...ps) {
  return Math.max(1, ...ps.filter(Boolean).flatMap(p => shownBars(p).map(b => b.v)), ...ps.filter(Boolean).map(p => p.avg || 0));
}

// Empty slots: faint dashed placeholder bars at these heights (px), oldest side first.
const GHOST_PX = [16, 24, 19, 28, 21, 25];

// The bars. Always DUEL_BARS slots, so a bar is the same width however many games there are:
// the games fill the right-hand slots (newest last), placeholder bars the rest. Before the game
// every bar carries its points and date; in the recap only tonight does (hover shows the rest),
// and the earlier best keeps a thin white cap to measure against. Under MIN_BARS games, a short
// note (p.noBars) takes the date row's place.
function bars(p, max) {
  const list = shownBars(p);
  if (!list.length && !p.noBars) return '';
  const recap = p.tonight != null;
  const past = list.filter(b => !b.tonight).map(b => b.v);
  const best = past.length ? Math.max(...past) : 0;
  const ghosts = DUEL_BARS - list.length;
  const few = list.length < MIN_BARS;
  const px = v => Math.max(4, Math.round((v / max) * BAR_PX));
  const cls = b => (b.tonight ? ' is-tonight' : !recap && b.v === best ? ' is-best' : recap && b.v === best ? ' is-top' : '');
  const aria = list.length ? `Points in each game: ${past.join(', ')}${recap ? `${past.length ? ', and ' : ''}${p.tonight} tonight` : ''}` : p.noBars;
  const ghostCols = GHOST_PX.slice(0, ghosts).map(h => `<span class="dl-col dl-col--ghost"><span class="dl-bar dl-bar--ghost" style="height:${h}px"></span></span>`).join('');
  const cols = list.map((b, i) => `<span class="dl-col" style="--i:${i}" title="${b.tonight ? `${b.v} pts tonight` : `${b.v} pts${b.ymd ? ` · ${escHtml(shortDay(b.ymd))}` : ''}`}">${!recap || b.tonight ? `<em data-bar-lbl>${b.v}</em>` : ''}<span class="dl-bar${cls(b)}" data-bar style="height:${px(b.v)}px"></span></span>`).join('');
  const dates = few
    ? `<span class="dl-note">${escHtml(p.noBars || '')}</span>`
    : `<span class="dl-dates" aria-hidden="true">${'<small></small>'.repeat(ghosts)}${list.map(b => `<small>${b.tonight ? 'Tonight' : recap ? '' : `<span class="dl-d-long">${escHtml(shortDay(b.ymd))}</span><span class="dl-d-short">${escHtml(numDay(b.ymd))}</span>`}</small>`).join('')}</span>`;
  return `<span class="dl-chart" data-bars role="img" aria-label="${escHtml(aria)}">
      <span class="dl-bars">
        ${p.avg != null && past.length >= 2 ? `<i class="dl-avg" style="bottom:${px(p.avg)}px" aria-hidden="true"></i>` : ''}
        ${ghostCols}${cols}
      </span>
      ${dates}
    </span>`;
}

const avatar = (p, tagName = 'span', extra = '') => {
  const name = `${p.first} ${p.last}`.trim();
  return `<${tagName} class="pl-av${extra}"${tagName === 'a' ? ` href="/players/${encodeURIComponent(p.id)}" tabindex="-1" aria-hidden="true"` : ''}><span>${escHtml(initials(name))}</span><img src="${playerPhotoUrl(p.id, 192)}" alt="" loading="lazy" onerror="this.remove()"></${tagName}>`;
};
const teamLine = p => `<span class="pl-team"><i style="background:${teamColor(p.team)}"></i>${escHtml(String(p.team || '').toUpperCase())}${p.number !== '' && p.number != null ? ` · #${escHtml(String(p.number))}` : ''}${p.meta ? ` · ${escHtml(p.meta)}` : ''}</span>`;
const who = (p, tagName) => `<${tagName} class="pl-card__who"${tagName === 'a' ? ` href="/players/${encodeURIComponent(p.id)}"` : ''}>
          ${p.first ? `<span class="pl-card__first">${escHtml(p.first)}</span>` : ''}
          <span class="pl-card__last">${escHtml(p.last)}</span>
          <span class="pl-card__meta">${teamLine(p)}</span>
        </${tagName}>`;
const big = p => `<span class="dl-big"><b class="font-condensed${p.lead ? ' is-lead' : ''}">${escHtml(p.big)}</b><small>${escHtml(p.bigKey)}</small></span>`;
const style = p => `--team:${teamColor(p.team)};--bar:${barColor(p.team)}`;

// The full card. Not a link itself: the name and avatar are, and it can hold a button.
// p.writeup: the Player of the Game write-up, under the bars (game page Top performers).
export function duelCard(p, max) {
  if (!p) return '<div class="pl-card dl-card dl-card--empty">No box scores yet</div>';
  const tag = p.tag ? `<span class="dl-tag${p.potg ? '' : ' dl-tag--ghost'}">${escHtml(p.tag)}</span>` : '';
  const line = p.line?.length
    ? `<span class="pl-card__foot dl-line"><span class="pl-card__stats">${p.line.map(x => `<span class="pl-stat${x.win ? ' is-win' : x.tie ? ' is-tie' : ''}"${x.win ? ' title="Won this one"' : ''}><b class="font-condensed">${escHtml(String(x.v))}</b><small>${escHtml(x.k)}</small></span>`).join('')}</span></span>`
    : '';
  const chart = bars(p, max);
  return `<article class="pl-card pl-card--photo dl-card${p.potg ? ' is-potg' : ''}" style="${style(p)}">
    <img class="pl-card__bg" src="${playerPhotoUrl(p.id, 192)}" alt="" loading="lazy" onerror="this.remove()">
    ${tag}
    <span class="pl-card__top">
      ${avatar(p, 'a')}
      ${who(p, 'a')}
      ${big(p)}
    </span>
    ${line}
    ${chart ? `<span class="dl-hist">${p.barsKey ? `<span class="dl-k">${escHtml(p.barsKey)}</span>` : ''}${chart}</span>` : ''}
    ${p.writeup ? `<p class="dl-writeup">${escHtml(p.writeup)}</p>` : ''}
    ${p.foot || p.end ? `<span class="dl-end">${p.foot ? `<span class="dl-foot">${p.foot}</span>` : ''}${p.end || ''}</span>` : ''}
  </article>`;
}

// The card's pieces laid flat, for inside another card; side 'b' mirrors so the two face each
// other across the VS. The whole side links to the player.
export function duelSide(p, max, side = 'a') {
  if (!p) return `<div class="dl-side dl-side--${side} dl-side--empty">No box scores yet</div>`;
  return `<a href="/players/${encodeURIComponent(p.id)}" class="dl-side dl-side--${side}" style="${style(p)}">
      <span class="dl-side__head">
        ${avatar(p, 'span', ' pl-av--md')}
        ${who(p, 'span')}
      </span>
      ${big(p)}
      ${bars(p, max)}
    </a>`;
}

// ── Before tip-off: the go-to scorers (server.js matchupAsOf → scorers, or the season's top
// scorer when the teams haven't met: basis 'season') ────────────────────────────────────────
// The line compares the two on rebounds, assists and FG% (points are the big number).
function previewLine(p, o) {
  // Only stats both have, so the two lines match up.
  const defs = [['REB', p.rpg, o?.rpg], ['AST', p.apg, o?.apg], ['FG%', p.fg, o?.fg]].filter(([, x, y]) => x != null && (!o || y != null));
  return defs.map(([k, x, y]) => ({ k, v: x.toFixed(1), tie: y != null && x === y, win: y != null && x > y }));
}

function previewDuel(p, o, { card = true } = {}) {
  if (!p) return null;
  const { first, last } = scorerName(p);
  const season = p.basis === 'season';
  const opp = tc(p.opp);
  const n = p.series?.length || 0;
  return {
    id: p.id, first, last, team: p.team, number: p.number, meta: card ? `${p.games} ${p.games === 1 ? 'GAME' : 'GAMES'}` : '',
    big: p.ppg.toFixed(1), bigKey: season ? 'PPG this season' : `PPG vs ${String(p.opp || '').toUpperCase()}`, lead: !!o && p.ppg > o.ppg,
    line: card ? previewLine(p, o) : [],
    series: p.series || [], dates: p.dates || [], avg: p.ppg,
    barsKey: season ? 'Points each game · this season' : `Points vs ${opp} · each meeting`,
    noBars: season ? `Only ${n} game${n === 1 ? '' : 's'} this season so far` : `Only ${n} meeting${n === 1 ? '' : 's'} so far`,
    foot: p.best ? `Best ${season ? 'this season' : `vs ${escHtml(opp)}`} · <b>${p.best.pts} · ${escHtml(p.best.label)}</b>` : '',
  };
}

// Players to watch: two cards.
export function previewDuelCards(sa, sb) {
  const a = previewDuel(sa, sb), b = previewDuel(sb, sa);
  const max = duelScale(a, b);
  return `${duelCard(a, max)}${duelCard(b, max)}`;
}

// The pick card's face-off: two flat sides.
export function previewDuelSides(sa, sb) {
  const a = previewDuel(sa, sb, { card: false }), b = previewDuel(sb, sa, { card: false });
  const max = duelScale(a, b);
  return `${duelSide(a, max, 'a')}${duelSide(b, max, 'b')}`;
}
