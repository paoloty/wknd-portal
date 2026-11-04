// /admin/seasons: Season → Set up → All seasons (rewrite, 2026-11). One row per season that has
// games or sign-ups.
import { escHtml } from '../layout.js';
import { pageHeader, dataGrid, badge, button } from './ui.js';

export function adminSeasonsBody({ rows = [], currentSeason = null, signupSeason = '', signupOpen = false, query = {} } = {}) {
  const isCurrent = r => !!currentSeason && String(r.season) === String(currentSeason);
  const isSignup = r => !!signupSeason && String(r.season) === String(signupSeason);

  const grid = dataGrid({
    id: 'seasons', baseUrl: '/admin/seasons', query, minimal: true, perPage: 50,
    rows, rowKey: r => r.season, noun: ['season', 'seasons'],
    columns: [
      { key: 'season', label: 'Season', primary: true, cell: r => `<span class="aui-cell__title">Season ${escHtml(String(r.season))}</span>` },
      { key: 'state', label: 'Status', bare: true, cell: r => `<span class="aui-cell__badges">${isCurrent(r) ? badge('Current', 'amber') : ''}${isSignup(r) ? (signupOpen ? badge('Sign-ups open', 'green') : badge('Being set up', 'blue')) : ''}</span>` },
      { key: 'regular', label: 'Regular games', num: true, phone: true, cell: r => `${r.regular_games ?? 0}${r.scheduled_games ? ` <span class="asr-none">+${r.scheduled_games} scheduled</span>` : ''}` },
      { key: 'playoffs', label: 'Playoff games', num: true, phone: true, cell: r => String(r.playoff_games ?? 0) },
      { key: 'fee', label: 'Fee', num: true, phone: true, cell: r => (r.quota_amount ? `₱${Number(r.quota_amount).toLocaleString()}` : '<span class="asr-none">None</span>') },
      { key: 'signups', label: 'Confirmed', num: true, phone: true, cell: r => (r.signup_total ? `${r.signup_confirmed} <span class="asr-none">of ${r.signup_total}</span>` : '<span class="asr-none">None</span>') },
      { key: 'go', label: '', bare: true, cell: r => `<span class="aui-cell__badges">${isSignup(r) ? button('Manage', { size: 'sm', href: '/admin/season' }) : ''}${button('View site', { size: 'sm', kind: 'ghost', href: `/?season=${encodeURIComponent(r.season)}`, attrs: 'target="_blank" rel="noopener"' })}</span>` },
    ],
    empty: { title: 'No seasons yet', sub: 'A season shows here once it has games or sign-ups.' },
  });

  return `<div class="aui-page">
    ${pageHeader({ title: 'All seasons', sub: 'A season shows here once it has games or sign-ups.' })}
    ${grid}
  </div>`;
}
