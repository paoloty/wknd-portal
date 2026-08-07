import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';

const ICON_TRASH = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3.5h10M5.5 3.5V2.5h3v1M12 3.5l-.9 8a1 1 0 0 1-1 .9H3.9a1 1 0 0 1-1-.9L2 3.5"/></svg>`;

function fmtDate(ts) {
  return ts ? new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
}

// Super-admin-only tool for reviewing and purging liveness_captures — separate from the
// per-registration compare view (liveness-review.js), this is the "see and clean up
// everything at once" surface. Deletion here is permanent (no soft-delete/undo): the row
// is gone and photo_data with it, which is the point — this exists so sensitive capture
// photos don't have to sit around forever once a registration's been reviewed.
export function adminLivenessListBody({ captures = [] } = {}) {
  const rows = captures.length === 0
    ? `<div class="p-12 text-center text-sm text-slate-500">No liveness captures on file.</div>`
    : `
<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-5">
  ${captures.map(c => {
    const name = c.signupName ? displayPlayerName(c.signupName) : (c.player_id || 'Unlinked');
    return `
  <div class="bg-admin-surface border border-admin-border rounded-lg overflow-hidden" data-capture-row="${escHtml(c.id)}">
    <a href="/admin/season/liveness/${escHtml(c.id)}" style="display:block;aspect-ratio:3/4;background:#0d1424">
      <img src="/admin/season/liveness/${escHtml(c.id)}/photo" alt="Liveness capture" style="width:100%;height:100%;object-fit:cover">
    </a>
    <div class="p-3">
      <div class="text-xs font-semibold text-slate-200 truncate" title="${escHtml(name)}">${escHtml(name)}</div>
      <div class="text-[10px] text-slate-500 mt-0.5">Season ${escHtml(String(c.season))} &middot; ${fmtDate(c.captured_at)}</div>
      <div class="flex items-center justify-between mt-2.5">
        <a href="/admin/season/liveness/${escHtml(c.id)}" class="text-[11px] font-semibold text-sky-400 hover:text-sky-300 no-underline">Compare</a>
        <button onclick="lvDelete('${escHtml(c.id)}', ${escHtml(JSON.stringify(name))})" class="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 hover:text-rose-300">${ICON_TRASH} Delete</button>
      </div>
    </div>
  </div>`;
  }).join('')}
</div>`;

  return `
<div style="max-width:1080px">
  <a href="/admin/season/waitlist" class="text-xs text-slate-500 hover:text-slate-300 no-underline">&larr; Back to Waitlist</a>
  <div class="flex items-center justify-between mb-1 mt-2 gap-4 flex-wrap">
    <h1 class="text-xl font-bold text-slate-100">Liveness Check Photos</h1>
    <span class="text-[10px] font-bold uppercase tracking-widest text-rose-400 bg-rose-400/10 border border-rose-400/30 rounded-full px-2.5 py-1">Super admin only</span>
  </div>
  <p class="text-xs text-slate-500 mb-5">${captures.length} capture${captures.length === 1 ? '' : 's'} on file. Deleting a photo here is permanent — it removes the stored image entirely, not just from view.</p>
  <div class="bg-admin-surface border border-admin-border rounded-lg">
    ${rows}
  </div>
</div>
<script>
async function lvDelete(id, name) {
  if (!confirm('Permanently delete the liveness photo for ' + name + '? This cannot be undone.')) return;
  const row = document.querySelector('[data-capture-row="' + id + '"]');
  try {
    const r = await fetch('/admin/season/liveness/' + encodeURIComponent(id), { method: 'DELETE' });
    if (!r.ok) { alert('Could not delete — try again.'); return; }
    if (row) row.remove();
  } catch (e) {
    alert('Network error — try again.');
  }
}
</script>`;
}
