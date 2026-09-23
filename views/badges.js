import { escHtml, pageHeader } from './layout.js';
import { BADGE_CATALOG, BADGE_ICONS } from '../lib/badges.js';

function badgeIconSvg(key) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${BADGE_ICONS[key] || BADGE_ICONS.basketball}</svg>`;
}

// Order matters here — this is the order sections render in, not just a lookup table.
const CATEGORY_META = {
  milestone:  { label: 'Season Milestones',   blurb: 'Cumulative totals across the season. Resets and can be re-earned every season.' },
  rate:       { label: 'Per-Game Averages',   blurb: 'A season average, gated on a minimum sample so one huge game doesn’t qualify by itself.' },
  feat:       { label: 'Single-Game Feats',   blurb: 'One great game is all it takes.' },
  durability: { label: 'Durability',          blurb: 'Suiting up, every time.' },
  legendary:  { label: 'Legendary',           blurb: 'Nobody league-wide has pulled these off yet.' },
};

function tierChips(b) {
  if (!b.thresholds) return '';
  return `<div class="bd-spec__tiers">
    <span class="bd-spec__tier bd-spec__tier--bronze">Bronze &middot; ${b.thresholds.bronze}+ ${escHtml(b.unit)}</span>
    <span class="bd-spec__tier bd-spec__tier--silver">Silver &middot; ${b.thresholds.silver}+ ${escHtml(b.unit)}</span>
    <span class="bd-spec__tier bd-spec__tier--gold">Gold &middot; ${b.thresholds.gold}+ ${escHtml(b.unit)}</span>
  </div>`;
}

function specCard(b) {
  const ringClass = b.category === 'legendary' ? 'badge-medal__ring--legendary' : (b.thresholds ? 'badge-medal__ring--gold' : 'badge-medal__ring--feat');
  return `<div class="card bd-spec-card">
    <div class="badge-medal__ring ${ringClass} bd-spec-card__ring"><div class="badge-medal__inner">${badgeIconSvg(b.icon)}</div></div>
    <div class="bd-spec-card__body">
      <h3 class="bd-spec-card__name">${escHtml(b.name)}</h3>
      <p class="bd-spec-card__desc">${escHtml(b.description)}</p>
      ${tierChips(b)}
    </div>
  </div>`;
}

function categorySection(category, badges) {
  const meta = CATEGORY_META[category];
  return `<div class="section-header"><h2>${escHtml(meta.label)}</h2><span class="bd-category-count">${badges.length} badge${badges.length > 1 ? 's' : ''}</span></div>
  <p class="bd-category-blurb">${escHtml(meta.blurb)}</p>
  <div class="bd-grid">${badges.map(specCard).join('')}</div>`;
}

export function badgesPage() {
  const byCategory = {};
  for (const b of BADGE_CATALOG) (byCategory[b.category] ??= []).push(b);

  const sections = Object.keys(CATEGORY_META)
    .filter(cat => byCategory[cat]?.length)
    .map(cat => categorySection(cat, byCategory[cat]))
    .join('\n');

  return `<div class="page-content">
${pageHeader({ title: 'Badges', description: 'Season-long achievements, computed automatically from the box score after every game. Shown on every player’s profile.' })}
${sections}
</div>`;
}
