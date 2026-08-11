import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';
import { RATING_CATEGORIES } from '../../lib/peer-ratings.js';

function fmtDate(ms) {
  return ms ? new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
}

function scoreCell(val) {
  const n = Number(val) || 0;
  return `<td class="px-3 py-2.5 text-center text-sm font-semibold text-slate-200">${n}</td>`;
}

// Real identity always — the is_anonymous flag only controls what other players/the
// ratee see (masked behind an alias); admin reads straight off the players table
// regardless, per the comment on the peer_ratings table in portal-db.js.
function ratingRow(r) {
  const rater = displayPlayerName(r.rater_name || 'Unknown');
  const ratee = displayPlayerName(r.ratee_name || 'Unknown');
  return `<tr class="border-b border-admin-border/50 last:border-b-0">
    <td class="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">${fmtDate(r.updated_at)}</td>
    <td class="px-4 py-2.5 text-sm text-slate-200">${escHtml(rater)}</td>
    <td class="px-4 py-2.5 text-sm text-slate-200">${escHtml(ratee)}</td>
    ${RATING_CATEGORIES.map(c => scoreCell(r[c.key])).join('')}
    <td class="px-4 py-2.5 text-center">
      ${r.is_anonymous ? `<span class="agm-badge agm-badge--gray" title="Shown to the ratee/other players under a masked alias — not hidden from admin">Anonymous</span>` : `<span class="agm-badge agm-badge--blue">Named</span>`}
    </td>
  </tr>`;
}

export function adminRatingsBody({ season, seasons = [], ratings = [] } = {}) {
  const seasonTabs = seasons.length > 1
    ? `<div class="flex gap-2 mb-5 flex-wrap">${seasons.map(s =>
        `<a href="/admin/ratings?season=${escHtml(String(s))}" class="agm-pill${String(s) === String(season) ? ' is-active' : ''}">Season ${escHtml(String(s))}</a>`
      ).join('')}</div>`
    : '';

  return `
<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
  <div>
    <h2 class="text-xl font-bold tracking-tight text-slate-100">Community Ratings</h2>
    <p class="text-sm text-slate-500 mt-0.5">Every peer rating submitted this season — rater and ratee are always shown by real name here, regardless of the "Anonymous" display setting players see.</p>
  </div>
  <span class="text-xs text-slate-500">${ratings.length} rating${ratings.length === 1 ? '' : 's'}</span>
</div>

${seasonTabs}

<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden overflow-x-auto">
  ${ratings.length === 0
    ? `<div class="p-8 text-center text-sm text-slate-500">No ratings yet for Season ${escHtml(String(season))}.</div>`
    : `<table class="w-full border-collapse">
        <thead><tr class="border-b border-admin-border">
          <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">Updated</th>
          <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Rater</th>
          <th class="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Ratee</th>
          ${RATING_CATEGORIES.map(c => `<th class="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500" title="${escHtml(c.label)} — ${escHtml(c.desc)}">${c.emoji}</th>`).join('')}
          <th class="px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">Display</th>
        </tr></thead>
        <tbody>${ratings.map(ratingRow).join('')}</tbody>
      </table>`}
</div>`;
}
