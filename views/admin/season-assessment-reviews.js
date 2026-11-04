// /admin/season/assessment-reviews: Season → Sign-ups → Assessment reviews (rewrite, 2026-11).
// Never-reviewed first, then the most concerning: the queue is at the top.
import { escHtml } from '../layout.js';
import { signupDisplayName } from '../utils.js';
import { REVIEW_TAG_LABELS } from '../../lib/assessment-scoring.js';
import { pageHeader, dataGrid, needsYou, badge } from './ui.js';

const TAG_TONE = { '': 'gray', no_concerns: 'green', worth_conversation: 'amber', discuss_admin: 'red' };
const TAG_SEVERITY = { '': 0, no_concerns: 1, worth_conversation: 2, discuss_admin: 3 };
const tagBadge = tag => badge(REVIEW_TAG_LABELS[tag] || 'Not reviewed', TAG_TONE[tag] || 'gray');

// rows: [{ assessmentId, playerId, signup, reviews, summary: { tag, yes, no, count } }]
export function adminAssessmentReviewsListBody({ sigSeason = '', rows = [], query = {} } = {}) {
  const list = rows.map(r => ({ ...r, name: (r.signup && signupDisplayName(r.signup)) || 'Unknown player' })).sort((a, b) =>
    (a.summary.count > 0 ? 1 : 0) - (b.summary.count > 0 ? 1 : 0)
    || TAG_SEVERITY[b.summary.tag] - TAG_SEVERITY[a.summary.tag]
    || a.name.localeCompare(b.name));
  const unreviewed = list.filter(r => r.summary.count === 0).length;
  const concerns = list.filter(r => r.summary.tag === 'discuss_admin' || r.summary.tag === 'worth_conversation').length;

  const grid = dataGrid({
    id: 'assessments', baseUrl: '/admin/season/assessment-reviews', query, minimal: true, perPage: 50,
    rows: list, rowKey: r => r.assessmentId, noun: ['assessment', 'assessments'],
    views: [
      { key: 'all', label: 'All', test: () => true },
      { key: 'todo', label: 'Not reviewed', test: r => r.summary.count === 0 },
      { key: 'concern', label: 'Concerns', test: r => r.summary.tag === 'discuss_admin' || r.summary.tag === 'worth_conversation' },
      { key: 'clear', label: 'No concerns', test: r => r.summary.tag === 'no_concerns' },
    ],
    search: { placeholder: 'Search player', text: r => r.name },
    columns: [
      { key: 'name', label: 'Player', primary: true, cell: r => `<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(r.name)}</span>${r.reviews.length ? `<span class="aui-cell__sub">Reviewed by ${escHtml(r.reviews.map(x => x.reviewer_name || 'Admin').join(', '))}</span>` : ''}</span>` },
      { key: 'votes', label: 'Votes', num: true, cell: r => (r.summary.count ? `${r.summary.yes} yes · ${r.summary.no} no` : '<span class="aui-muted">—</span>') },
      { key: 'tag', label: 'Result', bare: true, cell: r => tagBadge(r.summary.tag) },
    ],
    rowHref: r => `/admin/season/assessments/${r.assessmentId}`,
    empty: { title: `No self-assessments for Season ${sigSeason} yet`, sub: 'They show up here as members sign up.' },
  });

  const needs = [
    unreviewed ? { title: `${unreviewed} assessment${unreviewed === 1 ? '' : 's'} not reviewed yet`, href: '/admin/season/assessment-reviews?view=todo', label: 'Review', hot: true } : null,
    concerns ? { title: `${concerns} with concerns to talk through`, href: '/admin/season/assessment-reviews?view=concern', label: 'Open' } : null,
  ];
  return `<div class="aui-page">
    ${pageHeader({ title: 'Assessment reviews', sub: `${rows.length} ${rows.length === 1 ? 'player' : 'players'}, Season ${sigSeason}.` })}
    ${needsYou(needs)}
    ${grid}
  </div>`;
}
