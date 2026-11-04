// /admin/season/teams/review: Season → Start (rewrite, 2026-11). Before the start: every confirmed
// player's charges, each row saving itself (public/admin-season-start.js), and nothing billed until
// Start season. After it: what was charged and who got which email, with a resend for what failed.
import { escHtml } from '../layout.js';
import { billedTotal, startChecks } from '../../lib/season-start.js';
import { pageHeader, section, needsYou, statStrip, dataGrid, badge, button, avatar, drawer, field } from './ui.js';

const BASE = '/admin/season/teams/review';
const money = n => `₱${Number(n || 0).toLocaleString()}`;
const names = (list, max = 4) => {
  const shown = list.slice(0, max).map(r => r.name).join(', ');
  return list.length > max ? `${shown} and ${list.length - max} more` : shown;
};
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const who = r => `<span class="aui-who">${avatar(r.name || '?', r.teamColor || '', { size: 28, playerId: r.playerId || '' })}<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(r.name || '—')}</span><span class="aui-cell__sub">${escHtml(r.teamName || 'No team')}</span></span></span>`;

function itemCell(r, cls, size, full, excluded, extra = '') {
  if (!size) return '<span class="asr-none">None</span>';
  return `<label class="asr-item"><input type="checkbox" class="${cls}"${excluded ? '' : ' checked'}> ${escHtml(size)}${extra} <span class="asr-item__price">${money(full)}</span></label>`;
}

function reviewBody({ sigSeason, rows, notSelected, fee, query }) {
  const total = billedTotal(rows);
  const charged = rows.filter(r => r.playerId).length;
  const checks = startChecks({ rows, fee });
  const needs = needsYou([
    checks.noFee && { title: 'The season fee is not set', sub: 'Players would only be charged for jerseys.', href: '/admin/season', label: 'Set it' },
    checks.noAccount.length && { title: `${plural(checks.noAccount.length, 'player')} won't be charged`, sub: `No account yet: ${names(checks.noAccount)}.`, href: `${BASE}?view=noaccount`, label: 'See them' },
    checks.noTeam.length && { title: `${plural(checks.noTeam.length, 'player')} with no team`, sub: names(checks.noTeam), href: '/admin/season/teams', label: 'Team builder' },
    checks.teamNotLive.length && { title: `${plural(checks.teamNotLive.length, 'player')} on a team the site doesn't have`, sub: `Their team on the site won't be set: ${names(checks.teamNotLive)}.`, href: '/admin/season/teams', label: 'Team builder' },
  ]);

  const bodyTpl = `Charges {total} in total to the ${plural(charged, 'confirmed player')} with an account, and emails each of them what they owe.${notSelected.length ? ` Not selected (${notSelected.length}) get the "not this time" email.` : ''} Players move to their new teams, anyone not confirmed comes off their old team, and the rosters lock. This can't be undone.`;
  const startBtn = rows.length ? button('Start season', {
    kind: 'primary',
    attrs: `data-post-json="/admin/season/teams/start" data-asr-start data-body='${escHtml(JSON.stringify({ season: String(sigSeason) }))}' data-total="${total}" data-body-tpl="${escHtml(bodyTpl)}" data-confirm data-confirm-title="Start Season ${escHtml(String(sigSeason))}?" data-confirm-body="${escHtml(bodyTpl.replace('{total}', money(total)))}" data-confirm-type="${charged}" data-confirm-send="Start season" data-done="Season started."`,
  }) : '';

  const teams = [...new Set(rows.map(r => r.teamName || 'No team'))];
  const grid = dataGrid({
    id: 'charges', baseUrl: BASE, query, minimal: true, perPage: 200,
    rows, rowKey: r => r.signupId, noun: ['player', 'players'],
    views: [
      { key: 'all', label: 'All', test: () => true },
      { key: 'adjusted', label: 'Adjusted', test: r => r.topExcluded || r.shortsExcluded || r.extraAmount },
      { key: 'noaccount', label: 'Not charged', test: r => !r.playerId },
    ],
    search: { placeholder: 'Search player', text: r => r.name },
    filters: teams.length > 1 ? [{ key: 'team', label: 'Team', options: teams.map(t => [t, t]), test: (r, v) => (r.teamName || 'No team') === v }] : [],
    bulk: [{ label: 'Add charge or discount', attrs: 'data-drawer-open="asr-bulk"' }],
    columns: [
      { key: 'name', label: 'Player', primary: true, cell: r => `<span data-asr-row data-fee="${r.quotaAmount}" data-top="${r.topFull}" data-shorts="${r.shortsFull}" data-account="${r.playerId ? 1 : 0}" data-billed="${r.playerId && r.total > 0 ? r.total : 0}">${who(r)}</span>` },
      { key: 'fee', label: 'Season fee', num: true, phone: true, cell: r => money(r.quotaAmount) },
      { key: 'top', label: 'Top', phone: true, cell: r => itemCell(r, 'asr-top', r.jerseyTop, r.topFull, r.topExcluded) },
      { key: 'shorts', label: 'Shorts', phone: true, cell: r => itemCell(r, 'asr-shorts', r.jerseyShorts, r.shortsFull, r.shortsExcluded, r.pockets ? ' + pockets' : '') },
      { key: 'extra', label: 'Charge or discount', phone: true, cell: r => `<span class="asr-extra"><input class="aui-input asr-extra__label" type="text" maxlength="80" placeholder="Label" aria-label="Label for ${escHtml(r.name)}" value="${escHtml(r.extraLabel || '')}"><input class="aui-input asr-extra__amount" type="number" placeholder="0" aria-label="Amount for ${escHtml(r.name)}" value="${r.extraAmount || ''}"></span>` },
      { key: 'total', label: 'Total', num: true, phone: true, cell: r => `<span class="asr-total"><span data-asr-total>${money(r.total)}</span>${r.playerId ? '' : ` ${badge('Not charged', 'amber')}`}</span>` },
    ],
    empty: { title: 'No confirmed players yet', sub: 'Confirm players on Sign-ups or Candidates, then build the teams.' },
  });

  return `<div class="aui-page">
    ${pageHeader({
      title: 'Review and start',
      sub: `Season ${sigSeason}. Check the charges. Nothing is billed until you start the season.`,
      actionsHtml: `${button('Export CSV', { href: `/admin/season/teams/export-charges?season=${encodeURIComponent(sigSeason)}` })}${startBtn}`,
    })}
    ${needs}
    ${statStrip([
      { label: 'Confirmed', value: String(rows.length) },
      { label: 'Not selected', value: String(notSelected.length) },
      { label: 'Season fee', value: money(fee) },
      { label: 'Total to charge', value: money(total), key: 'total' },
    ])}
    ${grid}
    ${notSelected.length ? section({
      title: `Not selected (${notSelected.length})`,
      note: 'They get the "not this time" email when the season starts.',
      bodyHtml: `<p class="asr-names">${notSelected.map(p => escHtml(p.name || '—')).join(', ')}</p>`,
    }) : ''}
    ${drawer({
      id: 'asr-bulk', eyebrow: 'Selected players', title: 'Add charge or discount',
      bodyHtml: `${field({ label: 'Label', name: 'bulk_label', placeholder: 'Early bird discount' })}${field({ label: 'Amount', name: 'bulk_amount', type: 'number', placeholder: '-200', help: 'Negative for a discount. Replaces what those players have now.' })}`,
      footerHtml: button('Apply', { kind: 'primary', attrs: 'data-asr-bulk-apply' }),
    })}
  </div>
  <script src="/admin-season-start.js" defer></script>`;
}

function startedBody({ sigSeason, people, query }) {
  const confirmed = people.filter(p => p.status === 'confirmed');
  const total = confirmed.reduce((sum, p) => sum + p.charged, 0);
  const problems = people.filter(p => p.emailState.canResend);
  const grid = dataGrid({
    id: 'started', baseUrl: BASE, query, minimal: true, perPage: 200,
    rows: people, rowKey: p => p.signupId, noun: ['person', 'people'],
    views: [
      { key: 'all', label: 'Confirmed', test: p => p.status === 'confirmed' },
      { key: 'out', label: 'Not selected', test: p => p.status !== 'confirmed' },
      { key: 'email', label: 'Email problems', test: p => p.emailState.canResend },
      { key: 'uncharged', label: 'Not charged', test: p => p.status === 'confirmed' && !p.charged },
    ],
    search: { placeholder: 'Search player', text: p => p.name },
    columns: [
      { key: 'name', label: 'Player', primary: true, cell: who },
      { key: 'charged', label: 'Charged', num: true, phone: true, cell: p => (p.status !== 'confirmed' ? '<span class="asr-none">None</span>' : p.charged ? money(p.charged) : badge('Not charged', 'amber')) },
      { key: 'email', label: 'Email', bare: true, cell: p => badge(p.emailState.label, p.emailState.tone) },
      { key: 'resend', label: '', bare: true, cell: p => (p.emailState.canResend ? button('Resend', { size: 'sm', attrs: `data-post-json="/admin/season-signups/${escHtml(p.signupId)}/resend-season-email" data-confirm data-confirm-title="Send ${escHtml(p.name)} their email again?" data-confirm-body="To ${escHtml(p.email)}." data-confirm-send="Resend" data-done="Email sent."` }) : '') },
    ],
    rowHref: p => `/admin/season/signups/${p.signupId}`,
    empty: { title: `No sign-ups for Season ${sigSeason}` },
  });
  return `<div class="aui-page">
    ${pageHeader({
      title: `Season ${sigSeason} has started`,
      sub: 'Charges are on the ledger and the rosters are locked.',
      actionsHtml: button('Export CSV', { href: `/admin/season/teams/export-charges?season=${encodeURIComponent(sigSeason)}` }),
    })}
    ${needsYou([problems.length && { title: `${plural(problems.length, 'email')} didn't get through`, sub: names(problems), href: `${BASE}?view=email`, label: 'See them', hot: true }])}
    ${statStrip([
      { label: 'Confirmed', value: String(confirmed.length) },
      { label: 'Charged', value: money(total) },
      { label: 'Not selected', value: String(people.length - confirmed.length) },
    ])}
    ${grid}
  </div>`;
}

// Before the start: { sigSeason, rows, notSelected, fee, query }.
// After it: { sigSeason, started: true, people, query }, from the ledger and the email log, not the
// charge math: those are what actually happened.
export function adminSeasonReviewBody({ sigSeason = '', started = false, rows = [], notSelected = [], people = [], fee = 0, query = {} } = {}) {
  return started ? startedBody({ sigSeason, people, query }) : reviewBody({ sigSeason, rows, notSelected, fee, query });
}
