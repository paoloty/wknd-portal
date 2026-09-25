import { escHtml, pageHeader } from './layout.js';

function peso(n) { return '₱' + Number(n || 0).toLocaleString(); }

// Public reference version of the fine schedule an admin manages at /admin/fines — read-only,
// no login required. Sourced live from fine_categories so it can never drift out of sync with
// the amounts an admin actually charges (see server.js's GET /rules/fines).
// Fixed reference ranges matching lib/portal-db.js's getSuspensionTierForPoints — shown here
// as ranges (not per-point rows) since that's how the league states the policy publicly.
const ACTIVE_POINTS_TIERS = [
  { range: '1–3', suspension: 'None' },
  { range: '4–5', suspension: '1 game' },
  { range: '6–7', suspension: '2 games' },
  { range: '8–9', suspension: '3 games' },
  { range: '10+', suspension: 'League review' },
];

export function fineSchedulePage({ categories = [] } = {}) {
  const tiers = categories.map(c => `
    <div class="card fine-tier">
      <div class="fine-tier__amount">${peso(c.amount)}</div>
      <div class="fine-tier__body">
        <div class="fine-tier__name">${escHtml(c.label)}</div>
        ${c.description ? `<p class="fine-tier__desc">${escHtml(c.description)}</p>` : ''}
        ${c.examples?.length ? `<div class="fine-tier__examples">${c.examples.map(e => `<span class="fine-chip">${escHtml(e)}</span>`).join('')}</div>` : ''}
        <div class="fine-tier__meta">
          ${c.points ? `<span class="fine-tier__points">${c.points} pt${c.points === 1 ? '' : 's'}</span>` : ''}
          <span class="fine-tier__susp">${c.min_suspension_games > 0 ? `Minimum ${c.min_suspension_games} game${c.min_suspension_games === 1 ? '' : 's'}` : 'No mandatory suspension'}</span>
        </div>
      </div>
    </div>`).join('');

  const pointsTable = `
    <table class="fine-points-table">
      <thead><tr><th>Active Points</th><th>Suspension</th></tr></thead>
      <tbody>${ACTIVE_POINTS_TIERS.map(t => `<tr><td>${escHtml(t.range)}</td><td>${escHtml(t.suspension)}</td></tr>`).join('')}</tbody>
    </table>`;

  return `<div class="container"><div class="page-content">
  ${pageHeader({
    title: 'League Fines',
    description: 'Every fine below is confirmed by admin review after a report or an official’s call — never automatic, and never assessed sight-unseen.',
  })}
  <div class="fine-tiers">${tiers}</div>

  <div class="section-header"><h2>Conduct Points &amp; Suspensions</h2></div>
  <p class="fine-footnote" style="margin-top:0">Each approved fine also adds points toward a season total. Points reset at the start of every season. A violation with its own mandatory minimum (see above) applies regardless of your point total.</p>
  ${pointsTable}

  <p class="fine-footnote">Anything else — off-court incidents, disputes, or anything not listed here — is reviewed case-by-case, not left unaddressed. See <a href="/rules">League Rules</a> for the on-court foul that goes with each of these off the court.</p>

  <style>
    .fine-tier__meta { display: flex; align-items: center; gap: 10px; margin-top: 10px; font-size: 12px; color: var(--text-muted); }
    .fine-tier__points { font-family: 'Saira Condensed'; font-weight: 700; color: var(--amber); background: var(--amber-dim); padding: 2px 8px; border-radius: 999px; }
    .fine-points-table { width: 100%; border-collapse: collapse; margin: 16px 0 28px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    .fine-points-table th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--text-muted); padding: 10px 16px; border-bottom: 1px solid var(--border); }
    .fine-points-table td { padding: 10px 16px; font-size: 14px; color: var(--text); border-bottom: 1px solid var(--border); }
    .fine-points-table tr:last-child td { border-bottom: none; }
  </style>
</div></div>`;
}
