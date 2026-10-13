import { escHtml } from './layout.js';
import { teamColor } from './utils.js';
import { gameSlug } from '../lib/slugs.js';

// "Who wins?" helpers shared around the site. The pick control itself is views/pick-card.js
// (pickCard + pickCardScript, 2026-10-13); this file keeps the bits other pages still use:
// the preview link, the odds edge on photo banners, the close-time format and the
// "You've picked N of M" counter.

// The full matchup preview for a game — its own page, /games/<slug> (the old /picks/<slug>
// redirects there). Takes a pick-shaped game ({ id, a, b }) or a games row.
export function previewHref(g) {
  return `/games/${encodeURIComponent(gameSlug({ id: g.id, team_a_name: g.a ?? g.team_a_name, team_b_name: g.b ?? g.team_b_name }))}`;
}

const edgeColor = team => (String(team).toUpperCase() === 'BLACK' ? '#8a94a6' : teamColor(team));
const tcase = s => String(s || '').charAt(0) + String(s || '').slice(1).toLowerCase();

// The odds as a thin two-colour edge — each side as wide as its chance, the favourite glowing
// a little more. Sits on the bottom of a header (pick cards) or a photo banner (/games).
export function oddsEdge(a, b, odds) {
  if (!odds) return '';
  return `<div class="pkb-edge" role="img" aria-label="Odds: ${escHtml(tcase(a))} ${odds.pctA}%, ${escHtml(tcase(b))} ${odds.pctB}%"><i class="${odds.fav === 'a' ? 'is-fav' : ''}" style="width:${odds.pctA}%;--c:${edgeColor(a)}"></i><i class="${odds.fav === 'b' ? 'is-fav' : ''}" style="--c:${edgeColor(b)}"></i></div>`;
}

// "06:00" → "6:00 AM" for the cut-off line.
export function fmtCloseTime(hm) {
  const [h, m] = String(hm || '06:00').split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// "You've picked N of M" with a bar; pickCardScript keeps it live. scope = a CSS selector
// for the element holding the boxes it counts.
export function pickProgress(open, scope) {
  const live = open.filter(o => !o.closed);
  if (!live.length) return '';
  const done = live.filter(o => o.myPick).length;
  return `<div class="pkb-prog${done === live.length ? ' is-done' : ''}" data-pick-progress="${escHtml(scope)}">
      <span>You've picked <b data-progress-n>${done} of ${live.length}</b></span>
      <span class="pkb-prog__bar" aria-hidden="true"><i data-progress-bar style="width:${Math.round((done / live.length) * 100)}%"></i></span>
    </div>`;
}
