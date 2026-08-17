import { escHtml } from '../layout.js';
import { signupDisplayName } from '../utils.js';

const STATUS_DOT = {
  waitlisted: '#f59332',
  confirmed:  '#22c55e',
  rejected:   '#64748b',
  withdrawn:  '#f87171',
};

function fmtDate(ts) {
  return ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

// signups: season_signups rows (already filtered to those with non-empty .comments), newest first.
export function adminCommentsBody({ sigSeason = '', signups = [] } = {}) {
  const cards = signups.map(s => {
    const name = signupDisplayName(s) || '—';
    const initials = escHtml((name || '?').charAt(0).toUpperCase());
    const dot = STATUS_DOT[s.status] || '#64748b';
    return `
<div class="comment-card bg-admin-surface border border-admin-border rounded-lg p-4 mb-3">
  <div class="flex items-center justify-between gap-3 mb-2">
    <a href="/admin/season/signups/${escHtml(s.id)}" class="flex items-center gap-2 no-underline">
      <div class="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0" style="background:#1e293b">${initials}</div>
      <span class="text-sm font-semibold text-slate-200 hover:text-amber-400 transition-colors">${escHtml(name)}</span>
      <span class="inline-block w-1.5 h-1.5 rounded-full" style="background:${dot}" title="${escHtml(s.status)}"></span>
    </a>
    <span class="text-[10px] text-slate-600 whitespace-nowrap">${fmtDate(s.created_at)}</span>
  </div>
  <blockquote class="text-sm text-slate-300 leading-relaxed border-l-2 border-brand/40 pl-3" style="white-space:pre-line">${escHtml(s.comments)}</blockquote>
</div>`;
  }).join('');

  const body = signups.length === 0
    ? `<div class="bg-admin-surface border border-admin-border rounded-lg p-12 text-center text-sm text-slate-500">No comments or suggestions for Season ${escHtml(String(sigSeason))} yet.</div>`
    : `<div id="comments-list">${cards}</div>`;

  return `
<div class="w-full" style="max-width:700px">
  <a href="/admin/season" class="text-xs text-slate-500 hover:text-slate-300 no-underline inline-flex items-center gap-1 mb-1">&larr; Season Management</a>
  <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
    <div>
      <h1 class="text-xl font-bold text-slate-100">Signup Comments</h1>
      <p class="text-xs text-slate-500 mt-0.5">${signups.length} comment${signups.length === 1 ? '' : 's'} &middot; Season ${escHtml(String(sigSeason))}</p>
    </div>
    <input id="comments-search" type="text" placeholder="Search name or text…" class="admin-input text-xs" style="max-width:240px">
  </div>

  ${body}
</div>

<script>
(function() {
  var search = document.getElementById('comments-search');
  if (!search) return;
  search.addEventListener('input', function() {
    var q = search.value.toLowerCase().trim();
    document.querySelectorAll('.comment-card').forEach(function(card) {
      var text = card.textContent.toLowerCase();
      card.style.display = (!q || text.indexOf(q) !== -1) ? '' : 'none';
    });
  });
})();
</script>`;
}
