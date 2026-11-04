// /admin/season/signups/:id: one member's sign-up (rewrite, 2026-11). Everything the Sign-ups list
// leaves out, and the Confirm / Reject / Withdraw buttons.
import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';
import { emailStatus, fmtAgo } from './email-status.js';
import { REVIEW_TAG_LABELS } from '../../lib/assessment-scoring.js';
import { namedByText } from '../../lib/season-nominations.js';
import { pageHeader, breadcrumb, section, banner, badge, button, facts, field, formCard, formSection } from './ui.js';

const STATUS = { waitlisted: ['Waitlisted', 'amber'], confirmed: ['Confirmed', 'green'], rejected: ['Rejected', 'gray'], withdrawn: ['Withdrawn', 'red'] };
const TAG_TONE = { no_concerns: 'green', worth_conversation: 'amber', discuss_admin: 'red' };
const ALIGNMENT = { optimistic: ['Optimistic', 'amber'], gap: ['Self-rating gap', 'red'] };
const EMAIL_TONE = { complained: 'red', bounced: 'red', failed: 'red', delayed: 'amber', clicked: 'green', opened: 'green' };
const none = '<span class="asr-none">None</span>';

function fmtDate(ts) {
  return ts ? new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }) : '—';
}

function emailFact(row) {
  const st = emailStatus(row);
  if (!st) return null;
  return ['Season email', `<span class="aui-cell__badges">${badge(`${row.kind === 'season_confirmed' ? "You're in" : 'Not selected'}: ${st.label}`, EMAIL_TONE[st.key] || 'gray')}<span class="asr-none">${escHtml(fmtAgo(st.at))}</span></span>`];
}

function assessmentFact(s) {
  if (!s.assessment) return ['Assessment', none];
  const r = s.reviewSummary;
  const flag = ALIGNMENT[s.alignmentFlag];
  return ['Assessment', `<a class="aui-cell__badges" href="/admin/season/assessments/${escHtml(s.assessment.id)}">${badge(REVIEW_TAG_LABELS[r?.tag ?? ''] || 'Not reviewed', TAG_TONE[r?.tag] || 'gray')}${flag ? badge(...flag) : ''}${r?.count ? `<span class="asr-none">${r.yes} yes, ${r.no} no</span>` : ''}</a>`];
}

function livenessFact(s, isSuperAdmin) {
  if (s.liveness) return ['Liveness photo', isSuperAdmin ? `<a href="/admin/season/liveness/${escHtml(s.liveness.id)}">View photo</a>` : '<span class="asr-none">On file, super admin only</span>'];
  return ['Liveness photo', s.liveness_skipped_at ? '<span class="asr-none">Skipped</span>' : none];
}

const pref = s => (s.team_pref === 'stick' ? `Stick${s.prev_team_name ? ` (${escHtml(s.prev_team_name)})` : ''}` : s.team_pref === 'reshuffle' ? 'Shuffle' : none);

// seasonEmail: latest email_log row for this sign-up's start-of-season email, or null.
// started: the season has started, so a status change here charges and emails nobody.
// named: this player's entry from summarizeNominations, or undefined.
export function adminSignupDetailBody({ signup: s, isSuperAdmin = false, seasonEmail = null, started = false, named } = {}) {
  const name = displayPlayerName(s.full_name || '—');
  const post = (action, label, opts, extra = '') => button(label, { ...opts, attrs: `data-post-json="/admin/season/signups/${escHtml(s.id)}/${action}" ${extra}` });
  const lateNote = started ? ' The season has already started: this charges, refunds and emails nobody. Handle those in the Ledger.' : '';
  const actions = [
    s.status !== 'confirmed' ? post('confirm', 'Confirm', { kind: 'primary' }, `data-done="Confirmed."${started ? ` data-confirm data-confirm-title="Confirm ${escHtml(name)}?" data-confirm-body="${escHtml(lateNote.trim())}" data-confirm-send="Confirm"` : ''}`) : '',
    s.status === 'confirmed' ? post('withdraw', 'Withdraw', { kind: 'danger' }, `data-done="Withdrawn." data-confirm data-confirm-title="Withdraw ${escHtml(name)}?" data-confirm-body="${escHtml(`This frees their spot and promotes the earliest waitlisted sign-up.${lateNote}`)}" data-confirm-send="Withdraw"`) : '',
    s.status !== 'rejected' ? post('reject', 'Reject', {}, `data-done="Rejected."${s.status === 'confirmed' ? ` data-confirm data-confirm-title="Reject ${escHtml(name)}?" data-confirm-body="${escHtml(`This takes them off their team.${lateNote}`)}" data-confirm-send="Reject"` : ''}`) : '',
  ].join('');

  const rows = [
    ['Status', badge(...(STATUS[s.status] || [s.status, 'gray']))],
    ['Season', escHtml(String(s.season))],
    ['Signed up', escHtml(fmtDate(s.created_at))],
    ['Jersey top', s.jersey_top ? escHtml(s.jersey_top) : none],
    ['Jersey shorts', s.jersey_shorts ? escHtml(s.jersey_shorts) : none],
    !isSuperAdmin && ['Team preference', pref(s)],
    ['League shuffle vote', s.reshuffle_vote === 'yes' ? 'Yes' : s.reshuffle_vote === 'no' ? 'No' : none],
    ['Balance', s.has_balance ? badge(`₱${Number(s.balance_amt).toLocaleString()}`, 'amber') : none],
    assessmentFact(s),
    livenessFact(s, isSuperAdmin),
    ["Wouldn't play with them again", named ? escHtml(namedByText(named)) : 'No one'],
    emailFact(seasonEmail),
  ];

  return `<div class="aui-page">
    ${breadcrumb([{ label: 'Sign-ups', href: '/admin/season/waitlist' }, { label: name }])}
    ${pageHeader({ title: name, sub: [s.email, s.phone].filter(Boolean).join(' · '), actionsHtml: actions })}
    ${s.contact_changed_at ? banner('warn', `Emergency contact or birthday differs from what's on file.${s.contact_change_note ? ` ${s.contact_change_note}` : ''}`) : ''}
    ${section({ title: 'Sign-up', bodyHtml: `<div class="aui-panel">${facts(rows)}</div>` })}
    ${s.comments ? section({ title: 'Comments', bodyHtml: `<div class="aui-panel"><span class="asu-comment">${escHtml(s.comments)}</span></div>` }) : ''}
    ${isSuperAdmin ? `<form data-json-action="/admin/season/signups/${escHtml(s.id)}/team-pref" data-done="Saved.">${formCard(formSection({
      title: 'Team preference',
      sub: 'Correct their answer if they picked the wrong one.',
      bodyHtml: `${field({ label: 'Stick or shuffle', name: 'team_pref', type: 'select', value: s.team_pref || '', options: [['', 'No answer'], ['stick', `Stick${s.prev_team_name ? ` (${s.prev_team_name})` : ''}`], ['reshuffle', 'Shuffle']] })}<div class="aui-row">${button('Save', { kind: 'primary', type: 'submit' })}</div>`,
    }))}</form>` : ''}
  </div>`;
}
