import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';

const STATUS_BADGE = {
  waitlisted: `<span style="background:#f5933222;color:#f59332;border:1px solid #f5933244;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700">WAITLISTED</span>`,
  confirmed:  `<span style="background:#22c55e22;color:#22c55e;border:1px solid #22c55e44;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700">CONFIRMED</span>`,
  rejected:   `<span style="background:#64748b22;color:#64748b;border:1px solid #64748b44;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700">REJECTED</span>`,
  withdrawn:  `<span style="background:#f8717122;color:#f87171;border:1px solid #f8717144;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700">WITHDRAWN</span>`,
};

const ASSESSMENT_TAG_BADGE = {
  no_concerns:        `<span style="background:#22c55e22;color:#22c55e;border:1px solid #22c55e44;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700">NO CONCERNS</span>`,
  worth_conversation: `<span style="background:#f5933222;color:#f59332;border:1px solid #f5933244;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700">WORTH A CONVO</span>`,
  discuss_admin:      `<span style="background:#f8717122;color:#f87171;border:1px solid #f8717144;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700">DISCUSS W/ ADMIN</span>`,
};

const ALIGNMENT_FLAG_BADGE = {
  optimistic: `<span title="Self-rated a tier above their actual rating" style="background:#f5933222;color:#f59332;border:1px solid #f5933244;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700">OPTIMISTIC</span>`,
  gap:        `<span title="Self-rated two or more tiers above their actual rating" style="background:#f8717122;color:#f87171;border:1px solid #f8717144;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700">SELF-RATING GAP</span>`,
};

function fmtDate(ts) {
  return ts ? new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
}

function field(label, value) {
  return `<div><dt class="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">${escHtml(label)}</dt><dd class="text-slate-200 text-sm">${value}</dd></div>`;
}

// The detail counterpart to the trimmed waitlist table — Jersey, Signed Up, and Assessment
// dropped off the list view to keep it scannable, but nothing was actually removed from the
// app: it all lives here, one click away via the member's name.
export function adminSignupDetailBody({ signup, isSuperAdmin = false } = {}) {
  const s = signup;
  const name = displayPlayerName(s.full_name || '—');

  const teamPref = s.team_pref === 'stick'
    ? `<span class="inline-flex items-center gap-1.5"><span class="inline-block w-2 h-2 rounded-full" style="background:${escHtml(s.prev_team_color || '#64748b')}"></span><span class="text-sky-400 font-medium">Stick</span>${s.prev_team_name ? `<span class="text-slate-600">(${escHtml(s.prev_team_name)})</span>` : ''}</span>`
    : s.team_pref === 'reshuffle'
      ? `<span class="text-violet-400 font-medium">Shuffle</span>`
      : `<span class="text-slate-600">—</span>`;

  const reshuffleVote = s.reshuffle_vote === 'yes' ? '<span class="text-emerald-400 font-medium">Yes</span>'
    : s.reshuffle_vote === 'no' ? '<span class="text-rose-400 font-medium">No</span>'
    : '<span class="text-slate-600">—</span>';

  const balance = s.has_balance
    ? `<span class="text-amber-400 font-medium">⚠ ₱${Number(s.balance_amt).toLocaleString()}</span>`
    : '<span class="text-slate-600">—</span>';

  const assessment = s.assessment
    ? `<a href="/admin/season/assessments/${escHtml(s.assessment.id)}" class="no-underline hover:opacity-80 inline-flex flex-col items-start gap-1">${ASSESSMENT_TAG_BADGE[s.assessment.admin_tag] ?? '<span style="color:#64748b;font-size:11px">Not reviewed</span>'}${ALIGNMENT_FLAG_BADGE[s.alignmentFlag] || ''}</a>`
    : '<span class="text-slate-600 text-sm">—</span>';

  const liveness = s.liveness
    ? (isSuperAdmin
        ? `<a href="/admin/season/liveness/${escHtml(s.liveness.id)}" class="text-sky-400 hover:text-sky-300 text-sm no-underline">📷 View liveness capture</a>`
        : `<span class="text-slate-500 text-sm">📷 On file — super admin only</span>`)
    : s.liveness_skipped_at ? '<span class="text-slate-600 text-sm">📷 Skipped by registrant</span>' : '<span class="text-slate-600 text-sm">—</span>';

  const actions = `
  <div class="flex items-center gap-2">
    ${s.status === 'confirmed' ? `<button class="admin-btn admin-btn--sm admin-btn--danger signup-withdraw-btn" data-id="${escHtml(s.id)}">Withdraw</button>` : ''}
    ${s.status !== 'confirmed' ? `<button class="admin-btn admin-btn--sm admin-btn--success signup-confirm-btn" data-id="${escHtml(s.id)}">Confirm</button>` : ''}
    ${s.status !== 'rejected'  ? `<button class="admin-btn admin-btn--sm admin-btn--muted signup-reject-btn" data-id="${escHtml(s.id)}">Reject</button>` : ''}
  </div>`;

  return `
<div style="max-width:680px">
  <a href="/admin/season/waitlist" class="text-xs text-slate-500 hover:text-slate-300 no-underline">&larr; Back to Waitlist</a>
  <div class="flex items-center justify-between mb-1 mt-2 gap-4 flex-wrap">
    <h1 class="text-xl font-bold text-slate-100 flex items-center gap-2">${escHtml(name)} ${STATUS_BADGE[s.status] ?? ''}</h1>
  </div>
  <div class="text-sm text-slate-500 mb-1">${escHtml(s.email || '')}${s.phone ? ` &middot; ${escHtml(s.phone)}` : ''}</div>
  ${s.contact_changed_at ? `<div class="text-[11px] text-amber-400 mt-1" title="${escHtml(s.contact_change_note || '')}">⚠ Emergency contact or birthday differs from what is on file</div>` : ''}

  <div class="bg-admin-surface border border-admin-border rounded-lg p-5 mt-5">
    <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Signup Details</div>
    <dl class="grid grid-cols-2 gap-x-6 gap-y-4">
      ${field('Season', escHtml(String(s.season)))}
      ${field('Signed Up', escHtml(fmtDate(s.created_at)))}
      ${field('Jersey Top', s.jersey_top ? escHtml(s.jersey_top) : '<span class="text-slate-600">—</span>')}
      ${field('Jersey Shorts', s.jersey_shorts ? escHtml(s.jersey_shorts) : '<span class="text-slate-600">—</span>')}
      ${field('Team Preference', teamPref)}
      ${field('League Shuffle Vote', reshuffleVote)}
      ${field('Balance', balance)}
      ${field('Assessment', assessment)}
      ${field('Liveness Photo', liveness)}
    </dl>
    ${s.comments ? `<div class="mt-4 pt-4 border-t border-admin-border"><div class="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Comments</div><div class="text-sm text-slate-300 leading-relaxed">${escHtml(s.comments)}</div></div>` : ''}
  </div>

  <div class="bg-admin-surface border border-admin-border rounded-lg p-5 mt-5">
    <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Actions</div>
    ${actions}
  </div>
</div>
<script>
(function() {
  document.querySelectorAll('.signup-confirm-btn').forEach(function(b) {
    b.addEventListener('click', function() {
      this.textContent = '…'; this.disabled = true;
      fetch('/admin/season/signups/' + this.dataset.id + '/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(function() { location.reload(); });
    });
  });
  document.querySelectorAll('.signup-reject-btn').forEach(function(b) {
    b.addEventListener('click', function() {
      this.textContent = '…'; this.disabled = true;
      fetch('/admin/season/signups/' + this.dataset.id + '/reject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(function() { location.reload(); });
    });
  });
  document.querySelectorAll('.signup-withdraw-btn').forEach(function(b) {
    b.addEventListener('click', function() {
      if (!confirm('Withdraw this player and free their confirmed spot? The earliest waitlisted signup will be promoted automatically. If this player has already been charged (season started), you\\'ll need to handle any refund/credit manually in the Ledger — this does not touch it.')) return;
      this.textContent = '…'; this.disabled = true;
      fetch('/admin/season/signups/' + this.dataset.id + '/withdraw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
        .then(function(res) {
          if (!res.ok) { alert(res.d.error || 'Could not withdraw.'); location.reload(); return; }
          location.reload();
        });
    });
  });
})();
</script>`;
}
