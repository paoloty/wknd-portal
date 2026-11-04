// /admin/season/waitlist: Season → Sign-ups (rewrite, 2026-11; mockup:
// claude.ai/artifact/Xv7BddznLYqJzLYUzPy9VS). Everyone who signed up on the shared grid, what's
// waiting on you first, and the two polls beside them.
import { escHtml } from '../layout.js';
import { signupDisplayName } from '../utils.js';
import { pageHeader, dataGrid, section, needsYou, badge, button } from './ui.js';

const attr = s => escHtml(String(s ?? ''));
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const STATUS = { waitlisted: ['Waitlisted', 'amber'], confirmed: ['Confirmed', 'green'], rejected: ['Rejected', 'gray'], withdrawn: ['Withdrawn', 'red'] };
const pesos = n => `₱${Number(n || 0).toLocaleString()}`;

function flags(s, isSuperAdmin) {
  const out = [];
  if (s.contact_changed_at) out.push(`<span title="${attr(s.contact_change_note || 'Emergency contact or birthday differs from what is on file')}">${badge('Changed details', 'amber')}</span>`);
  if (s.liveness) {
    out.push(isSuperAdmin
      ? `<a href="/admin/season/liveness/${attr(s.liveness.id)}" title="Compare their photo with their profile">${badge('Photo', 'blue')}</a>`
      : `<span title="Liveness photo on file. Super admin only.">${badge('Photo', 'blue')}</span>`);
  } else if (s.liveness_skipped_at) out.push(`<span title="They skipped the photo.">${badge('No photo', 'gray')}</span>`);
  return out.length ? `<span class="aui-cell__badges">${out.join('')}</span>` : '';
}

function prefCell(s) {
  if (s.team_pref === 'stick') return `<span class="aui-who"><span class="amny-dot" style="background:${attr(s.prev_team_color || 'var(--text-muted)')}" aria-hidden="true"></span>Stick${s.prev_team_name ? `, ${escHtml(s.prev_team_name)}` : ''}</span>`;
  if (s.team_pref === 'reshuffle') return 'Shuffle';
  return '<span class="aui-muted">—</span>';
}

function rowMenu(s) {
  const name = signupDisplayName(s) || 'this player';
  const post = action => `/admin/season/signups/${s.id}/${action}`;
  return [
    { label: 'Open sign-up', href: `/admin/season/signups/${s.id}` },
    s.status !== 'confirmed' ? { label: 'Confirm', post: post('confirm'), done: `Confirmed ${name}.` } : null,
    s.status !== 'rejected' ? { label: 'Reject', post: post('reject'), done: `Rejected ${name}.`, ...(s.status === 'confirmed' ? { confirm: { title: `Reject ${name}?`, body: 'They come off any team they’re on.', send: 'Reject' } } : {}) } : null,
    s.status === 'confirmed' ? 'sep' : null,
    s.status === 'confirmed' ? { label: 'Withdraw', danger: true, post: post('withdraw'), done: `Withdrew ${name}.`, confirm: { title: `Withdraw ${name}?`, body: 'This frees their spot, and the earliest waitlisted player moves up. If they’ve already been charged, any refund or credit is yours to handle.', send: 'Withdraw' } } : null,
  ].filter(Boolean);
}

// One poll: a row per answer with its count and share, and the split as a thin bar.
function pollPanel(options) {
  const total = options.reduce((t, o) => t + o.count, 0);
  const pct = o => (total ? Math.round((o.count / total) * 100) : 0);
  return `<div class="aui-panel asu-poll">
    ${options.map(o => `<div class="asu-poll__row"><span>${escHtml(o.label)}</span><span class="aui-num">${o.count} · ${pct(o)}%</span></div>`).join('')}
    <div class="asu-poll__bar" aria-hidden="true">${options.filter(o => o.count).map((o, i) => `<i class="${i ? 'is-b' : 'is-a'}" style="width:${pct(o)}%"></i>`).join('')}</div>
  </div>`;
}

function prefByTeam(signups) {
  const groups = new Map();
  for (const s of signups) {
    if (!s.prev_team_id || (s.team_pref !== 'stick' && s.team_pref !== 'reshuffle')) continue;
    if (!groups.has(s.prev_team_id)) groups.set(s.prev_team_id, { name: s.prev_team_name, color: s.prev_team_color || '', stick: 0, reshuffle: 0 });
    groups.get(s.prev_team_id)[s.team_pref]++;
  }
  const teams = [...groups.values()].sort((a, b) => (b.stick + b.reshuffle) - (a.stick + a.reshuffle));
  if (!teams.length) return '';
  return section({
    title: 'By team', note: '· returning players',
    bodyHtml: `<div class="aui-panel asu-poll">${teams.map(t => `<div class="asu-poll__row"><span class="aui-who"><span class="amny-dot" style="background:${attr(t.color || 'var(--text-muted)')}" aria-hidden="true"></span>${escHtml(t.name)}</span><span class="aui-num">${t.stick} stick · ${t.reshuffle} shuffle</span></div>`).join('')}</div>`,
  });
}

export function adminWaitlistBody({ sigSeason = '', signups = [], confirmedCount = 0, isSuperAdmin = false, query = {} } = {}) {
  const by = { waitlisted: 0, confirmed: 0, rejected: 0, withdrawn: 0 };
  for (const s of signups) by[s.status] = (by[s.status] || 0) + 1;
  const stick = signups.filter(s => s.team_pref === 'stick').length, shuffle = signups.filter(s => s.team_pref === 'reshuffle').length;
  const yes = signups.filter(s => s.reshuffle_vote === 'yes').length, no = signups.filter(s => s.reshuffle_vote === 'no').length;
  const owing = signups.filter(s => s.has_balance && s.status === 'waitlisted').length;

  const rows = signups.map(s => ({ ...s, name: signupDisplayName(s) || '—' }));
  const grid = dataGrid({
    id: 'signups', baseUrl: '/admin/season/waitlist', query, minimal: true, perPage: 50,
    rows, rowKey: s => s.id, noun: ['sign-up', 'sign-ups'],
    views: [
      { key: 'all', label: 'All', test: () => true },
      { key: 'waitlisted', label: 'Waitlisted', test: s => s.status === 'waitlisted' },
      { key: 'confirmed', label: 'Confirmed', test: s => s.status === 'confirmed' },
      { key: 'rejected', label: 'Rejected', test: s => s.status === 'rejected' },
      ...(by.withdrawn ? [{ key: 'withdrawn', label: 'Withdrawn', test: s => s.status === 'withdrawn' }] : []),
    ],
    search: { placeholder: 'Search name, email or phone', text: s => `${s.name} ${s.email || ''} ${s.phone || ''}` },
    filters: [
      { key: 'pref', label: 'Team', options: [['stick', 'Stick'], ['reshuffle', 'Shuffle']], test: (s, v) => s.team_pref === v },
      { key: 'vote', label: 'Shuffle poll', options: [['yes', 'Yes'], ['no', 'No']], test: (s, v) => s.reshuffle_vote === v },
      { key: 'owes', label: 'Balance', options: [['yes', 'Owes']], test: s => !!s.has_balance },
    ],
    columns: [
      { key: 'name', label: 'Member', primary: true, sort: s => s.name.toLowerCase(), cell: s => `<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(s.name)}</span><span class="aui-cell__sub">${escHtml(s.email || '')}${s.phone ? ` · ${escHtml(s.phone)}` : ''}</span></span>` },
      { key: 'flags', label: 'Flags', bare: true, cell: s => flags(s, isSuperAdmin) },
      { key: 'pref', label: 'Team', sort: s => s.team_pref || '', cell: prefCell },
      { key: 'vote', label: 'Shuffle poll', phone: false, sort: s => s.reshuffle_vote || '', cell: s => (s.reshuffle_vote === 'yes' ? 'Yes' : s.reshuffle_vote === 'no' ? 'No' : '<span class="aui-muted">—</span>') },
      { key: 'balance', label: 'Balance', num: true, sort: s => (s.has_balance ? Number(s.balance_amt) : 0), cell: s => (s.has_balance ? `<span class="aui-tone--amber">Owes ${pesos(s.balance_amt)}</span>` : '<span class="aui-muted">—</span>') },
      { key: 'status', label: 'Status', bare: true, sort: s => s.status, cell: s => badge(...(STATUS[s.status] || [s.status, 'gray'])) },
    ],
    rowHref: s => `/admin/season/signups/${s.id}`,
    rowMenu,
    bulk: [
      { label: 'Confirm', eachUrl: '/admin/season/signups/{id}/confirm', done: 'Confirmed {n} player{s}.', confirm: { title: 'Confirm {n} player{s}?', body: 'They get a spot for the season. Nobody is emailed or charged until you start it.' } },
      { label: 'Reject', eachUrl: '/admin/season/signups/{id}/reject', done: 'Rejected {n} player{s}.', confirm: { title: 'Reject {n} player{s}?', body: 'They come off any team they’re on.' } },
    ],
    empty: { title: `No sign-ups yet for Season ${sigSeason}`, sub: 'They show up here as members sign up.' },
  });

  const needs = [
    by.waitlisted ? { title: `${plural(by.waitlisted, 'player')} waiting for a decision`, sub: owing ? `${owing} of them still ${owing === 1 ? 'owes' : 'owe'} a balance.` : '', href: '/admin/season/waitlist?view=waitlisted', label: 'Review', hot: true } : null,
  ];
  const actions = [
    isSuperAdmin ? button('Liveness photos', { kind: 'ghost', href: '/admin/season/liveness' }) : '',
    confirmedCount ? button(`Build teams (${confirmedCount})`, { kind: 'primary', href: '/admin/season/teams' }) : '',
  ].join('');

  return `<div class="aui-page">
    ${pageHeader({ title: `Sign-ups, Season ${sigSeason}`, sub: `${by.confirmed + by.waitlisted} in: ${by.confirmed} confirmed, ${by.waitlisted} waiting.`, actionsHtml: actions })}
    ${needsYou(needs)}
    <div class="aui-cols">
      <div class="aui-cols__main">${grid}</div>
      ${stick + shuffle + yes + no ? `<aside class="aui-cols__side">
        ${stick + shuffle ? section({ title: 'Team preference', note: `· ${stick + shuffle} answered`, bodyHtml: pollPanel([{ label: 'Stick with their team', count: stick }, { label: 'Shuffle', count: shuffle }]) }) : ''}
        ${prefByTeam(signups)}
        ${yes + no ? section({ title: 'League shuffle poll', note: `· ${yes + no} answered`, bodyHtml: pollPanel([{ label: 'Yes', count: yes }, { label: 'No', count: no }]) }) : ''}
      </aside>` : ''}
    </div>
  </div>`;
}
