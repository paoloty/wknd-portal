// /admin/season/liveness: every liveness photo, to compare and clean up (rewrite, 2026-11). Super
// admin only. Deleting is permanent, which is the point: these photos shouldn't sit around forever
// once a registration has been reviewed.
import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';
import { LIVENESS_SOURCE_LABEL } from './liveness-review.js';
import { pageHeader, breadcrumb, emptyState, button } from './ui.js';

const fmtDate = ts => (ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }) : '');

export function adminLivenessListBody({ captures = [] } = {}) {
  const card = c => {
    const name = c.signupName ? displayPlayerName(c.signupName) : (c.player_id || 'Unlinked');
    const id = escHtml(c.id);
    // The player page has a photo and stats to compare with; otherwise the registration.
    const profile = c.player_id ? `/admin/players/${escHtml(c.player_id)}` : `/admin/users/${escHtml(c.reg_id)}`;
    return `<div class="alv-card">
      <a class="alv-card__photo" href="/admin/season/liveness/${id}"><img src="/admin/season/liveness/${id}/photo" alt="Liveness photo of ${escHtml(name)}" loading="lazy"></a>
      <div class="alv-card__body">
        <a class="alv-card__name" href="${profile}" title="${escHtml(name)}">${escHtml(name)}</a>
        <div class="alv-card__sub">${escHtml(LIVENESS_SOURCE_LABEL[c.via] || c.via || '')} · Season ${escHtml(String(c.season))} · ${escHtml(fmtDate(c.captured_at))}</div>
        <div class="alv-card__actions">
          ${button('Compare', { size: 'sm', href: `/admin/season/liveness/${c.id}` })}
          ${button('Delete', { size: 'sm', kind: 'ghost', attrs: `data-post-json="/admin/season/liveness/${id}" data-method="DELETE" data-confirm data-confirm-title="Delete ${escHtml(name)}'s photo?" data-confirm-body="The stored image goes for good. This can't be undone." data-confirm-send="Delete" data-done="Photo deleted."` })}
        </div>
      </div>
    </div>`;
  };

  return `<div class="aui-page">
    ${breadcrumb([{ label: 'Sign-ups', href: '/admin/season/waitlist' }, { label: 'Liveness photos' }])}
    ${pageHeader({ title: 'Liveness photos', sub: `${captures.length} on file. Only super admins can see these. Deleting one removes the stored image for good.` })}
    ${captures.length ? `<div class="alv-grid">${captures.map(card).join('')}</div>` : emptyState({ title: 'No liveness photos on file' })}
  </div>`;
}
