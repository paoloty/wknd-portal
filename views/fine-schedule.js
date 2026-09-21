import { escHtml, pageHeader } from './layout.js';

function peso(n) { return '₱' + Number(n || 0).toLocaleString(); }

// Public reference version of the fine schedule an admin manages at /admin/fines — read-only,
// no login required. Sourced live from fine_categories so it can never drift out of sync with
// the amounts an admin actually charges (see server.js's GET /rules/fines).
export function fineSchedulePage({ categories = [] } = {}) {
  const tiers = categories.map(c => `
    <div class="card fine-tier">
      <div class="fine-tier__amount">${peso(c.amount)}</div>
      <div class="fine-tier__body">
        <div class="fine-tier__name">${escHtml(c.label)}</div>
        ${c.description ? `<p class="fine-tier__desc">${escHtml(c.description)}</p>` : ''}
        ${c.examples?.length ? `<div class="fine-tier__examples">${c.examples.map(e => `<span class="fine-chip">${escHtml(e)}</span>`).join('')}</div>` : ''}
      </div>
    </div>`).join('');

  return `<div class="container"><div class="page-content">
  ${pageHeader({
    title: 'League Fines',
    description: 'Every fine below is confirmed by admin review after a report or an official’s call — never automatic, and never assessed sight-unseen.',
  })}
  <div class="fine-tiers">${tiers}</div>
  <p class="fine-footnote">Anything else — off-court incidents, disputes, or anything not listed here — is reviewed case-by-case, not left unaddressed. See <a href="/rules">League Rules</a> for the on-court foul that goes with each of these off the court.</p>
</div></div>`;
}
