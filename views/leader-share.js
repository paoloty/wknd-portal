import { escHtml } from './layout.js';
import { cardHtml } from './leaders.js';

// /leaders/share/:id — the shared card exactly as it looked on /leaders or /roast (the same
// snapshot the share images are drawn from), with a way back to the full boards.
export function leaderSharePage({ share, card }) {
  const isRoast = share.mode === 'roast' || share.mode === 'disaster';
  const scope = share.mode === 'disaster' || share.season === 'alltime' ? 'All seasons' : `Season ${share.season}`;
  const kind = share.mode === 'rec' ? 'Single-game record' : share.mode === 'disaster' ? 'Single-game disaster'
    : isRoast ? 'The Roast' : share.mode === 'tot' ? 'Season totals' : share.mode === 'po-pg' ? 'Playoffs · per game' : 'Per game';
  return `<div class="lsp">
  <div class="lsp-eyebrow">
    <span class="lsp-eyebrow__cat">${escHtml(kind.toUpperCase())}</span>
    <span class="lsp-eyebrow__sep">·</span>
    <span>${escHtml(scope.toUpperCase())}</span>
  </div>
  <div class="lsp-card">${cardHtml(card)}</div>
  <div class="lsp-nav">
    <a href="${isRoast ? '/roast' : '/leaders'}" class="lsp-nav__back">&larr; ${isRoast ? 'The Roast' : 'League leaders'}</a>
    <span class="lsp-nav__brand">WKND Basketball</span>
  </div>
</div>`;
}
