import { escHtml } from '../layout.js';
import { signupDisplayName } from '../utils.js';
import { TIER_LABELS, alignmentFlag, ALIGNMENT_LABELS, REVIEW_TAG_LABELS, summarizeReviews } from '../../lib/assessment-scoring.js';

const Q2_LABELS = { stay_engaged: 'Stay engaged', go_quiet: 'Go quiet', frustrated_vocal: 'Get frustrated and vocal', take_over: 'Try to take over' };
const Q3_LABELS = { let_it_go: 'Let it go', voice_briefly: 'Voice it briefly, then move on', argue_it: 'Argue it', carry_into_plays: 'Carry it into the next few plays' };
const Q5_LABELS = { direct: 'Direct, in the moment', private: 'Private, after the game', written: 'Written' };
const Q8_LABELS = { raise_with_group: 'Raise it right there with the group', private_after: 'Pull the coach or captain aside privately after', vent_no_address: 'Vent to teammates without addressing it directly', put_in_writing: "Put it in writing so there's a record", sit_on_it: 'Sit on it and let it build' };
const Q9_LABELS = { welcome_specifics: 'Welcome it and ask for specifics', listen_disagree: 'Listen but privately disagree', defensive_argue: 'Get defensive or argue', brush_off: 'Brush it off — I know my game' };

const ALIGNMENT_COLOR = { aligned: '#22c55e', optimistic: '#f59332', gap: '#f87171', not_ratable: '#64748b' };
const TAG_COLOR = { '': '#64748b', no_concerns: '#22c55e', worth_conversation: '#f59332', discuss_admin: '#f87171' };

function row(label, value) {
  return `<div class="py-3 border-b border-admin-border/40 last:border-0">
    <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">${escHtml(label)}</div>
    <div class="text-[13px] text-slate-200 leading-relaxed">${value}</div>
  </div>`;
}

function tierRow(label, selfTier, actualRating) {
  const flag = alignmentFlag(selfTier, actualRating);
  const color = ALIGNMENT_COLOR[flag];
  return `<div class="py-3 border-b border-admin-border/40 last:border-0 flex items-center justify-between gap-4">
    <div>
      <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">${escHtml(label)}</div>
      <div class="text-[13px] text-slate-200">Self-rated: <strong>${escHtml(TIER_LABELS[selfTier] || selfTier)}</strong>${actualRating != null ? ` · Actual: <strong>${actualRating}</strong>` : ''}</div>
    </div>
    <span style="background:${color}22;color:${color};border:1px solid ${color}44;border-radius:10px;padding:3px 10px;font-size:10px;font-weight:700;white-space:nowrap">${ALIGNMENT_LABELS[flag]}</span>
  </div>`;
}

function tagPill(tag) {
  const color = TAG_COLOR[tag] || TAG_COLOR[''];
  return `<span style="background:${color}22;color:${color};border:1px solid ${color}44;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700;white-space:nowrap">${escHtml(REVIEW_TAG_LABELS[tag] || 'Not reviewed')}</span>`;
}

function votePill(vote) {
  if (vote === 'yes') return `<span style="color:#22c55e;font-weight:700;font-size:11px">&#10003; Yes</span>`;
  if (vote === 'no')  return `<span style="color:#f87171;font-weight:700;font-size:11px">&#10007; No</span>`;
  return `<span style="color:#64748b;font-size:11px">Undecided</span>`;
}

function fmtDate(ts) {
  return ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

// reviews: assessment_admin_reviews rows for this assessment, oldest first.
// myReview: the logged-in admin's own row (or null if they haven't reviewed yet) — pre-fills
// the form so re-opening the page to edit shows what you already said, not a blank slate.
export function adminAssessmentReviewBody({ assessment: a, signup, rating, reviews = [], myReview = null, isSuperAdmin = false } = {}) {
  const name = (signup && signupDisplayName(signup)) || 'Unknown player';
  const summary = summarizeReviews(reviews);

  const sectionA = `
    ${row('Why are you playing this season?', escHtml(a.q1_why_playing))}
    ${row('Handling the team losing badly', escHtml(Q2_LABELS[a.q2_losing_badly] || a.q2_losing_badly))}
    ${row('Reaction to a bad ref call', escHtml(Q3_LABELS[a.q3_bad_ref_call] || a.q3_bad_ref_call))}
    ${row('Heated moment with a teammate', `${escHtml(String(a.q4_heated_teammate))} / 5`)}
    ${row('How they handle disagreeing with a team decision', escHtml(Q8_LABELS[a.q8_disagreement_style] || a.q8_disagreement_style))}
    ${row('Preferred feedback style', escHtml(Q5_LABELS[a.q5_feedback_style] || a.q5_feedback_style))}
    ${row('Reaction to being told a part of their game needs work', escHtml(Q9_LABELS[a.q9_reaction_to_criticism] || a.q9_reaction_to_criticism))}
    ${row('Comfort being benched', `${escHtml(String(a.q6_benched_comfort))} / 5`)}
    ${row('What a teammate would say you need to work on', escHtml(a.q7_work_on))}
  `;

  const sectionB = `
    ${tierRow('Scoring / Shooting vs. the league', a.self_scoring, rating?.scoring ?? null)}
    ${tierRow('Defense vs. the league', a.self_defense, rating?.defense ?? null)}
    ${tierRow('Overall game vs. the league', a.self_overall, rating?.overall ?? null)}
  `;

  const reviewsList = reviews.length === 0
    ? `<div class="text-[13px] text-slate-500 py-2">No admin has reviewed this yet.</div>`
    : reviews.map(r => `
    <div class="py-3 border-b border-admin-border/40 last:border-0 review-row" data-review-id="${escHtml(r.id)}">
      <div class="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
        <span class="text-[13px] font-semibold text-slate-200">${escHtml(r.reviewer_name || 'Admin')}</span>
        <div class="flex items-center gap-2">
          ${tagPill(r.tag)}
          ${votePill(r.vote)}
          <span class="text-[10px] text-slate-600">${fmtDate(r.updated_at)}</span>
          ${isSuperAdmin ? `<button class="review-remove-btn" data-id="${escHtml(r.id)}" title="Remove this review" style="background:none;border:none;color:#f87171;cursor:pointer;font-size:11px;padding:0 0 0 4px">&#10005;</button>` : ''}
        </div>
      </div>
      ${r.note ? `<div class="text-[12px] text-slate-400 leading-relaxed">${escHtml(r.note)}</div>` : ''}
    </div>`).join('');

  const tagOptions = [
    ['', 'Not reviewed'],
    ['no_concerns', 'No concerns'],
    ['worth_conversation', 'Worth a conversation'],
    ['discuss_admin', 'Discuss with admin team'],
  ].map(([val, label]) => `<option value="${val}" ${(myReview?.tag ?? '') === val ? 'selected' : ''}>${label}</option>`).join('');

  const voteOptions = [
    ['', 'Undecided'],
    ['yes', 'Yes, confirm'],
    ['no', 'No, hold off'],
  ].map(([val, label]) => `<label class="check check--radio" style="display:inline-flex;margin-right:16px"><input type="radio" name="my-vote" value="${val}" ${(myReview?.vote ?? '') === val ? 'checked' : ''}> ${label}</label>`).join('');

  return `
<div style="max-width:760px">
  <a href="/admin/season/waitlist" class="text-xs text-slate-500 hover:text-slate-300 no-underline inline-flex items-center gap-1 mb-1">← Waitlist</a>
  <h1 class="text-xl font-bold text-slate-100 mb-1">Mindset &amp; Self-Assessment</h1>
  <div class="text-sm text-slate-400 mb-6">${escHtml(name)} · Season ${escHtml(String(a.season))}</div>

  <div class="bg-admin-surface border border-admin-border rounded-lg p-5 mb-4">
    <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Mindset &amp; Team Fit</div>
    <div class="text-[11px] text-slate-500 mb-2 leading-relaxed">Admin-only, not a clinical instrument — a qualitative team-fit read, same weight as a coach's judgment call. No numeric score by design.</div>
    ${sectionA}
  </div>

  <div class="bg-admin-surface border border-admin-border rounded-lg p-5 mb-4">
    <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Self-Assessment <span class="normal-case font-normal text-slate-600">(delusion check)</span></div>
    <div class="text-[11px] text-slate-500 mb-2 leading-relaxed">${rating ? 'Compared against their current rating.' : "No rating on file yet — can't compute an alignment flag."}</div>
    ${sectionB}
  </div>

  <div class="bg-admin-surface border border-admin-border rounded-lg p-5 mb-4">
    <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
      <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Admin Reviews <span class="text-slate-600 font-normal normal-case">(${reviews.length})</span></div>
      <div class="flex items-center gap-3">
        ${tagPill(summary.tag)}
        <span class="text-[11px] text-slate-500">${summary.yes}&#10003; &middot; ${summary.no}&#10007;</span>
      </div>
    </div>
    ${reviewsList}
  </div>

  <div class="bg-admin-surface border border-admin-border rounded-lg p-5">
    <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">${myReview ? 'Edit Your Review' : 'Add Your Review'}</div>
    <div class="flex flex-col gap-3">
      <div>
        <label class="block text-[11px] font-semibold text-slate-400 mb-1.5">Tag</label>
        <select id="tag-select" class="admin-input w-full">${tagOptions}</select>
      </div>
      <div>
        <label class="block text-[11px] font-semibold text-slate-400 mb-1.5">Vote to confirm <span class="font-normal text-slate-600">(a guide for the group, not a gate — Confirm/Reject still works regardless)</span></label>
        <div>${voteOptions}</div>
      </div>
      <div>
        <label class="block text-[11px] font-semibold text-slate-400 mb-1.5">Private note <span class="font-normal text-slate-600">(never shown to the player)</span></label>
        <textarea id="tag-note" rows="3" class="admin-input w-full resize-none">${escHtml(myReview?.note || '')}</textarea>
      </div>
      <div class="flex items-center gap-3">
        <button id="tag-save-btn" class="agm-new-btn">Save Review</button>
        <span id="tag-save-msg" class="text-xs"></span>
      </div>
    </div>
  </div>
</div>

<script>
(function () {
  document.getElementById('tag-save-btn').addEventListener('click', async function () {
    var msg = document.getElementById('tag-save-msg');
    msg.textContent = 'Saving…'; msg.style.color = 'var(--text-muted)';
    var voteEl = document.querySelector('input[name="my-vote"]:checked');
    try {
      var r = await fetch('/admin/season/assessments/${escHtml(a.id)}/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag: document.getElementById('tag-select').value,
          vote: voteEl ? voteEl.value : '',
          note: document.getElementById('tag-note').value,
        })
      });
      if (!r.ok) throw new Error();
      msg.style.color = '#22c55e'; msg.textContent = 'Saved.';
      setTimeout(function () { location.reload(); }, 500);
    } catch (e) { msg.style.color = '#f87171'; msg.textContent = 'Error.'; }
  });

  document.querySelectorAll('.review-remove-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      if (!confirm('Remove this admin review? This cannot be undone.')) return;
      btn.disabled = true;
      try {
        var r = await fetch('/admin/season/assessments/${escHtml(a.id)}/review/' + btn.dataset.id, { method: 'DELETE' });
        if (!r.ok) throw new Error();
        location.reload();
      } catch (e) {
        btn.disabled = false;
        alert('Could not remove review.');
      }
    });
  });
})();
</script>`;
}
