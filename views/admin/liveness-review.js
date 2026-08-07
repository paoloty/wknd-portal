import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';

function fmtDate(ts) {
  return ts ? new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
}

const VIA_LABEL = { inline: 'Captured on the same device', qr: 'Captured via phone (QR bridge)' };

export function adminLivenessReviewBody({ capture, signup } = {}) {
  const name = signup?.full_name ? displayPlayerName(signup.full_name) : (capture.player_id || 'Unknown');

  return `
<div style="max-width:640px">
  <a href="/admin/season/waitlist" class="text-xs text-slate-500 hover:text-slate-300 no-underline">&larr; Back to Waitlist</a>
  <h1 class="text-xl font-bold text-slate-100 mt-2 mb-1">Liveness Check</h1>
  <div class="text-sm text-slate-400 mb-6">${escHtml(name)} &middot; Season ${escHtml(String(capture.season))}</div>

  <div class="bg-admin-surface border border-admin-border rounded-lg p-5 mb-4">
    <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Side-by-side — admin reference only, not automated matching</div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <div class="text-[11px] text-slate-500 mb-2">Liveness Capture</div>
        <div style="aspect-ratio:3/4;background:#0d1424;border:1px solid var(--admin-border);border-radius:8px;overflow:hidden">
          <img src="/admin/season/liveness/${escHtml(capture.id)}/photo" alt="Liveness capture" style="width:100%;height:100%;object-fit:cover">
        </div>
      </div>
      <div>
        <div class="text-[11px] text-slate-500 mb-2">Profile Photo</div>
        <div style="aspect-ratio:3/4;background:#0d1424;border:1px solid var(--admin-border);border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center">
          ${capture.player_id
            ? `<img src="/api/player/${escHtml(capture.player_id)}/photo" alt="Profile photo" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
               <span style="display:none;color:var(--text-muted, #64748b);font-size:12px">No profile photo</span>`
            : `<span style="color:#64748b;font-size:12px">No player linked yet</span>`}
        </div>
      </div>
    </div>
  </div>

  <div class="bg-admin-surface border border-admin-border rounded-lg p-5">
    <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Details</div>
    <dl class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
      <div><dt class="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Method</dt><dd class="text-slate-200">${escHtml(VIA_LABEL[capture.via] || capture.via)}</dd></div>
      <div><dt class="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Captured</dt><dd class="text-slate-200">${fmtDate(capture.captured_at)}</dd></div>
      <div><dt class="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Consent recorded</dt><dd class="text-slate-200">${fmtDate(capture.consent_at)}</dd></div>
      ${capture.prompt ? `<div class="col-span-2"><dt class="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">They were asked to</dt><dd class="text-slate-200">🎉 ${escHtml(capture.prompt)}</dd></div>` : ''}
    </dl>
    <p class="text-[11px] text-slate-600 mt-4 leading-relaxed">This photo is stored for admin reference only — it's never matched automatically, never shown publicly, and never leaves this system. Only the most recent capture per registration is kept; this one replaces any prior season's.</p>
  </div>
</div>`;
}
