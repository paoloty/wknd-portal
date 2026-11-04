// /admin/season/assessments/:id: one member's mindset and self-assessment answers, and the admins'
// reviews of them (rewrite, 2026-11).
import { escHtml } from '../layout.js';
import { signupDisplayName } from '../utils.js';
import { TIER_LABELS, alignmentFlag, ALIGNMENT_LABELS, REVIEW_TAG_LABELS, summarizeReviews } from '../../lib/assessment-scoring.js';
import { pageHeader, breadcrumb, section, badge, button, field, segmented, formCard, formSection } from './ui.js';

const Q2_LABELS = { stay_engaged: 'Stay engaged', go_quiet: 'Go quiet', frustrated_vocal: 'Get frustrated and vocal', take_over: 'Try to take over' };
const Q3_LABELS = { let_it_go: 'Let it go', voice_briefly: 'Voice it briefly, then move on', argue_it: 'Argue it', carry_into_plays: 'Carry it into the next few plays' };
const Q5_LABELS = { direct: 'Direct, in the moment', private: 'Private, after the game', written: 'Written' };
const Q8_LABELS = { raise_with_group: 'Raise it right there with the group', private_after: 'Pull the coach or captain aside privately after', vent_no_address: 'Vent to teammates without addressing it directly', put_in_writing: "Put it in writing so there's a record", sit_on_it: 'Sit on it and let it build' };
const Q9_LABELS = { welcome_specifics: 'Welcome it and ask for specifics', listen_disagree: 'Listen but privately disagree', defensive_argue: 'Get defensive or argue', brush_off: 'Brush it off — I know my game' };

const ALIGNMENT_TONE = { aligned: 'green', optimistic: 'amber', gap: 'red', not_ratable: 'gray' };
const TAG_TONE = { no_concerns: 'green', worth_conversation: 'amber', discuss_admin: 'red' };
const VOTE = { yes: ['Yes', 'green'], no: ['No', 'red'] };

const tagBadge = tag => badge(REVIEW_TAG_LABELS[tag] || 'Not reviewed', TAG_TONE[tag] || 'gray');
const fmtDate = ts => (ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }) : '');

const qa = (label, answer, asideHtml = '') => `<div class="aas-qa"><div class="aas-qa__text"><div class="aas-qa__q">${escHtml(label)}</div><div class="aas-qa__a">${answer}</div></div>${asideHtml}</div>`;
const list = rows => `<div class="aui-panel aas-list">${rows.join('')}</div>`;

function tierRow(label, selfTier, actual) {
  const flag = alignmentFlag(selfTier, actual);
  return qa(label, `Self-rated <b>${escHtml(TIER_LABELS[selfTier] || selfTier || '—')}</b>${actual != null ? `, actual <b>${escHtml(String(actual))}</b>` : ''}`, badge(ALIGNMENT_LABELS[flag], ALIGNMENT_TONE[flag]));
}

// reviews: assessment_admin_reviews rows, oldest first. myReview: this admin's own row or null,
// so reopening the page shows what they already said.
export function adminAssessmentReviewBody({ assessment: a, signup, rating, reviews = [], myReview = null, isSuperAdmin = false } = {}) {
  const name = (signup && signupDisplayName(signup)) || 'Unknown player';
  const summary = summarizeReviews(reviews);
  const text = (labels, v) => escHtml(labels[v] || v || '—');

  const removeBtn = r => (isSuperAdmin ? button('Remove', { size: 'sm', kind: 'ghost', attrs: `data-post-json="/admin/season/assessments/${escHtml(a.id)}/review/${escHtml(r.id)}" data-method="DELETE" data-confirm data-confirm-title="Remove this review?" data-confirm-body="${escHtml(`${r.reviewer_name || 'This admin'}'s review goes for good.`)}" data-confirm-send="Remove" data-done="Review removed."` }) : '');
  const reviewRows = reviews.map(r => qa(
    `${r.reviewer_name || 'Admin'}${fmtDate(r.updated_at) ? ` · ${fmtDate(r.updated_at)}` : ''}`,
    r.note ? `<span class="asu-comment">${escHtml(r.note)}</span>` : '<span class="asr-none">No note</span>',
    `<span class="aui-cell__badges">${tagBadge(r.tag)}${VOTE[r.vote] ? badge(`Vote: ${VOTE[r.vote][0]}`, VOTE[r.vote][1]) : badge('Undecided', 'gray')}${removeBtn(r)}</span>`,
  ));

  return `<div class="aui-page">
    ${breadcrumb([{ label: 'Assessment reviews', href: '/admin/season/assessment-reviews' }, { label: name }])}
    ${pageHeader({
      title: name,
      sub: `Mindset and self-assessment, Season ${a.season}.`,
      actionsHtml: signup ? button('Sign-up', { href: `/admin/season/signups/${signup.id}` }) : '',
    })}
    ${section({
      title: 'Mindset and team fit',
      note: "A team-fit read, not a clinical test. There's no score by design.",
      bodyHtml: list([
        qa('Why are you playing this season?', escHtml(a.q1_why_playing || '—')),
        qa('Handling the team losing badly', text(Q2_LABELS, a.q2_losing_badly)),
        qa('Reaction to a bad ref call', text(Q3_LABELS, a.q3_bad_ref_call)),
        qa('Heated moment with a teammate', `${escHtml(String(a.q4_heated_teammate ?? '—'))} / 5`),
        qa('Disagreeing with a team decision', text(Q8_LABELS, a.q8_disagreement_style)),
        qa('Preferred feedback style', text(Q5_LABELS, a.q5_feedback_style)),
        qa('Being told a part of their game needs work', text(Q9_LABELS, a.q9_reaction_to_criticism)),
        qa('Comfort being benched', `${escHtml(String(a.q6_benched_comfort ?? '—'))} / 5`),
        qa('What a teammate would say they need to work on', escHtml(a.q7_work_on || '—')),
      ]),
    })}
    ${section({
      title: 'Self-assessment',
      note: rating ? 'Compared with their current rating.' : 'No rating on file yet, so there is nothing to compare with.',
      bodyHtml: list([
        tierRow('Scoring and shooting', a.self_scoring, rating?.scoring ?? null),
        tierRow('Defense', a.self_defense, rating?.defense ?? null),
        tierRow('Overall game', a.self_overall, rating?.overall ?? null),
      ]),
    })}
    ${section({
      title: `Admin reviews (${reviews.length})`,
      asideHtml: `<span class="aui-cell__badges">${tagBadge(summary.tag)}<span class="asr-none">${summary.yes} yes, ${summary.no} no</span></span>`,
      bodyHtml: reviewRows.length ? list(reviewRows) : '<div class="aui-panel asr-none">No admin has reviewed this yet.</div>',
    })}
    <form data-json-action="/admin/season/assessments/${escHtml(a.id)}/review" data-done="Review saved.">${formCard(formSection({
      title: myReview ? 'Your review' : 'Add your review',
      sub: 'Only admins see this, never the player.',
      bodyHtml: `${field({ label: 'Tag', name: 'tag', type: 'select', value: myReview?.tag ?? '', options: Object.entries({ '': 'Not reviewed', no_concerns: 'No concerns', worth_conversation: 'Worth a conversation', discuss_admin: 'Discuss with admin team' }) })}
        <div class="aui-field"><span class="aui-field__label">Vote to confirm</span>${segmented({ name: 'vote', value: myReview?.vote ?? '', label: 'Vote to confirm', options: [['', 'Undecided'], ['yes', 'Yes, confirm'], ['no', 'No, hold off']] })}<span class="aui-field__help">A guide for the group. Confirm and Reject still work either way.</span></div>
        ${field({ label: 'Private note', name: 'note', type: 'textarea', value: myReview?.note || '' })}
        <div class="aui-row">${button('Save review', { kind: 'primary', type: 'submit' })}</div>`,
    }))}</form>
  </div>`;
}
