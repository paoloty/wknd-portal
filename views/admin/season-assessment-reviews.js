import { escHtml } from '../layout.js';
import { signupDisplayName } from '../utils.js';
import { REVIEW_TAG_LABELS } from '../../lib/assessment-scoring.js';

const TAG_COLOR = { '': '#64748b', no_concerns: '#22c55e', worth_conversation: '#f59332', discuss_admin: '#f87171' };
const TAG_SEVERITY = { '': 0, no_concerns: 1, worth_conversation: 2, discuss_admin: 3 };

function tagPill(tag) {
  const color = TAG_COLOR[tag] || TAG_COLOR[''];
  return `<span style="background:${color}22;color:${color};border:1px solid ${color}44;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700;white-space:nowrap">${escHtml((REVIEW_TAG_LABELS[tag] || 'Not reviewed').toUpperCase())}</span>`;
}

// rows: [{ assessmentId, playerId, signup, reviews, summary: { tag, yes, no, count } }]
// Sorted with the never-reviewed rows first (that's the actionable queue), then by how
// concerning the most severe tag is — same "surface what needs attention" ordering as the
// Returning Players page's missing-signups-first sort.
export function adminAssessmentReviewsListBody({ sigSeason = '', rows = [] } = {}) {
  const sorted = rows.slice().sort((a, b) => {
    const reviewedDiff = (a.summary.count > 0 ? 1 : 0) - (b.summary.count > 0 ? 1 : 0);
    if (reviewedDiff !== 0) return reviewedDiff;
    const sevDiff = TAG_SEVERITY[b.summary.tag] - TAG_SEVERITY[a.summary.tag];
    if (sevDiff !== 0) return sevDiff;
    return signupDisplayName(a.signup || {}).localeCompare(signupDisplayName(b.signup || {}));
  });

  const unreviewedCount = rows.filter(r => r.summary.count === 0).length;

  const row = (r) => {
    const name = signupDisplayName(r.signup || {}) || r.playerId || 'Unknown player';
    const reviewerNames = r.reviews.map(rv => escHtml(rv.reviewer_name || 'Admin')).join(', ');
    return `
  <div class="flex items-center gap-3 px-4 py-2.5 border-b border-admin-border/40 last:border-0">
    <div class="min-w-0 flex-1">
      <a href="/admin/season/assessments/${escHtml(r.assessmentId)}" class="text-[13px] font-semibold text-slate-200 hover:text-amber-400 no-underline">${escHtml(name)}</a>
      ${reviewerNames ? `<div class="text-[11px] text-slate-600 truncate">Reviewed by ${reviewerNames}</div>` : ''}
    </div>
    <div class="flex items-center gap-3 shrink-0">
      ${r.summary.count > 0 ? `<span class="text-[11px] text-slate-500">${r.summary.yes}&#10003; &middot; ${r.summary.no}&#10007;</span>` : ''}
      <span class="text-[10px] text-slate-600 w-16 text-right">${r.summary.count} review${r.summary.count === 1 ? '' : 's'}</span>
      ${tagPill(r.summary.tag)}
    </div>
  </div>`;
  };

  const body = rows.length === 0
    ? `<div class="p-12 text-center text-sm text-slate-500">No self-assessments on file for Season ${escHtml(String(sigSeason))} yet.</div>`
    : `<div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden">${sorted.map(row).join('')}</div>`;

  return `
<div class="w-full" style="max-width:800px">
  <a href="/admin/season" class="text-xs text-slate-500 hover:text-slate-300 no-underline inline-flex items-center gap-1 mb-1">&larr; Season Management</a>
  <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
    <div>
      <h1 class="text-xl font-bold text-slate-100">Assessment Reviews</h1>
      <p class="text-xs text-slate-500 mt-0.5">${rows.length} player${rows.length === 1 ? '' : 's'} &middot; ${unreviewedCount} not yet reviewed &middot; Season ${escHtml(String(sigSeason))}</p>
    </div>
  </div>

  ${body}
</div>`;
}
