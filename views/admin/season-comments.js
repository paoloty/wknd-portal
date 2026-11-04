// /admin/season/comments: Season → Sign-ups → Comments (rewrite, 2026-11). What members wrote when
// they signed up, newest first.
import { escHtml } from '../layout.js';
import { signupDisplayName } from '../utils.js';
import { pageHeader, dataGrid, badge } from './ui.js';

const STATUS = { waitlisted: ['Waitlisted', 'amber'], confirmed: ['Confirmed', 'green'], rejected: ['Rejected', 'gray'], withdrawn: ['Withdrawn', 'red'] };
const fmtDate = ts => (ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }) : '');

// signups: season_signups rows that have comments, newest first.
export function adminCommentsBody({ sigSeason = '', signups = [], query = {} } = {}) {
  const rows = signups.map(s => ({ ...s, name: signupDisplayName(s) || '—' }));
  const grid = dataGrid({
    id: 'comments', baseUrl: '/admin/season/comments', query, minimal: true, perPage: 50,
    rows, rowKey: s => s.id, noun: ['comment', 'comments'],
    search: { placeholder: 'Search name or text', text: s => `${s.name} ${s.comments}` },
    columns: [
      { key: 'name', label: 'Member', primary: true, cell: s => `<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(s.name)}</span><span class="aui-cell__sub">${escHtml(fmtDate(s.created_at))}</span></span>` },
      { key: 'comment', label: 'Comment', bare: true, cell: s => `<span class="asu-comment">${escHtml(s.comments)}</span>` },
      { key: 'status', label: 'Status', bare: true, cell: s => badge(...(STATUS[s.status] || [s.status, 'gray'])) },
    ],
    rowHref: s => `/admin/season/signups/${s.id}`,
    empty: { title: `No comments for Season ${sigSeason} yet`, sub: 'What members write when they sign up shows here.' },
  });
  return `<div class="aui-page">
    ${pageHeader({ title: 'Comments', sub: `${signups.length} ${signups.length === 1 ? 'comment' : 'comments'} from Season ${sigSeason} sign-ups.` })}
    ${grid}
  </div>`;
}
