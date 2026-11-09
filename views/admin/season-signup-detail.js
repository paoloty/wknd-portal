// /admin/season/signups/:id: one member's sign-up, layout 3 of the 2026-11-09 mockups
// (claude.ai/artifact/KeBVKqbVgpuDfLEpJeUqaS): their answers on the left (role, what a teammate
// would say, self-rating, comments), the decision on the right (status, plan, availability,
// money, team, "rather not" both ways), then kit, game face and help, contact. Stacks on a phone.
// form: server.js signupFormForAdmin. Season 4's assessment review and shuffle vote are gone.
// Styles: "Sign-up page" block in public/admin.css (asd-).
import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';
import { emailStatus, fmtAgo } from './email-status.js';
import { pageHeader, breadcrumb, section, banner, badge, button, formCard, formSection, field } from './ui.js';

const STATUS = { waitlisted: ['Waitlisted', 'amber'], confirmed: ['Confirmed', 'green'], rejected: ['Rejected', 'gray'], withdrawn: ['Withdrawn', 'red'] };
const EMAIL_TONE = { complained: 'red', bounced: 'red', failed: 'red', delayed: 'amber', clicked: 'green', opened: 'green' };
const esc = escHtml;
const none = '<span class="asd-none">None</span>';
const peso = n => `₱${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
const panel = h => `<div class="aui-panel">${h}</div>`;
const lines = rows => `<div class="asd-lines">${rows.filter(Boolean).map(([k, v]) => `<div><span>${esc(k)}</span><span>${v}</span></div>`).join('')}</div>`;

function fmtDate(ts) {
  return ts ? new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }) : '';
}
const who = p => `<a href="/admin/players/${esc(p.playerId)}">${esc(p.name)}</a>`;

// The role answers, risky ones marked, under the Playing-time risk line when there is one.
function roleBlock(f) {
  if (!f.role.length) return '';
  const risk = f.risk?.level ? banner(f.risk.level === 'red' ? 'error' : 'warn', `Playing-time risk: ${f.risk.triggers.join(', ')}.`) : '';
  return section({
    title: 'Their role',
    bodyHtml: `${risk}${panel(`<div class="asd-qa">${f.role.map(r => `<div class="asd-qa__row"><div class="asd-qa__q">${esc(r.q)}</div><div class="asd-qa__a"><span>${esc(r.a)}</span>${r.flag ? badge(r.flag === 'red' ? 'Red flag' : 'Risky', r.flag) : r.note ? `<span class="asd-none">${esc(r.note)}</span>` : ''}</div></div>`).join('')}</div>`)}`,
  });
}

function selfBlock(f) {
  if (!f.self.length) return '';
  return section({
    title: 'How they rate themselves',
    bodyHtml: panel(`<table class="asd-rate"><thead><tr><th></th><th>They say</th><th class="asd-num">Rating</th></tr></thead><tbody>${f.self.map(x => `<tr><td>${esc(x.label)}</td><td>${esc(x.says)}${x.gap ? ` ${badge('Well above their rating', 'amber')}` : ''}</td><td class="asd-num">${x.rating ?? '–'}</td></tr>`).join('')}</tbody></table>`),
  });
}

// "Rather not play with": who they named, and who named them (names hidden from an admin who
// is the one named, like the Season page; red from the flag count, mutual pairs apart).
function namedByValue(nb) {
  if (!nb) return 'No one';
  const n = nb.count + (nb.mutual.length ? ` + ${nb.mutual.length} mutual` : '');
  const tone = nb.flagged ? 'red' : 'gray';
  if (nb.hidden) return `${badge(`${nb.total} ${nb.total === 1 ? 'member' : 'members'}`, tone)} <span class="asd-none">(you can’t see who)</span>`;
  return `<span class="asd-names">${badge(n, tone)} ${[...nb.names.map(who), ...nb.mutual.map(p => `↔ ${who(p)}`)].join(', ')}</span>`;
}

function decisionBlock(s, f, seasonEmail) {
  const st = emailStatus(seasonEmail);
  return section({
    title: 'Decision',
    bodyHtml: panel(lines([
      ['Status', badge(...(STATUS[s.status] || [s.status, 'gray']))],
      f.plan && ['Plan', esc(f.plan)],
      f.gamesMiss && ['Will miss', esc(f.gamesMiss === 'Not sure yet' ? 'Not sure yet' : `${f.gamesMiss} ${f.gamesMiss === '1' ? 'game' : 'games'}`)],
      (f.away.length || f.awayNote) && ['Away', `${esc(f.away.join(', ') || '')}${f.awayNote ? `<span class="asd-sub">${esc(f.awayNote)}</span>` : ''}`],
      ['Team', s.team_pref === 'stick' ? `Stay with ${esc(s.prev_team_name || 'their team')}` : s.team_pref === 'reshuffle' ? 'Shuffle' : '<span class="asd-none">New player</span>'],
      ['Balance', s.has_balance ? badge(`Owes ${peso(s.balance_amt)}`, 'red') : '<span class="asd-none">Nothing owed</span>'],
      ['Rather not play with', f.named.length ? f.named.map(who).join(', ') : 'No one'],
      ['Named by', namedByValue(f.namedBy)],
      st && ['Season email', `${badge(`${seasonEmail.kind === 'season_confirmed' ? 'You’re in' : 'Not selected'}: ${st.label}`, EMAIL_TONE[st.key] || 'gray')} <span class="asd-none">${esc(fmtAgo(st.at))}</span>`],
    ])),
  });
}

function kitBlock(f, s) {
  if (!f.kit) return section({ title: 'Kit', bodyHtml: panel(lines([['Jersey top', s.jersey_top ? esc(s.jersey_top) : none], ['Shorts', s.jersey_shorts ? esc(s.jersey_shorts) : none]])) });
  const k = f.kit;
  return section({
    title: 'Kit',
    bodyHtml: panel(`<div class="asd-lines">${k.topLabel ? `<div><span>${esc(k.topLabel)}</span><span class="asd-num">${peso(k.top)}</span></div>` : ''}${k.shortsLabel ? `<div><span>${esc(k.shortsLabel)}</span><span class="asd-num">${peso(k.shorts)}</span></div>` : '<div><span>No shorts</span><span></span></div>'}<div class="is-tot"><span>Jersey, paid first</span><span class="asd-num">${peso(k.total)}</span></div></div>`),
  });
}

function gameFaceBlock(f, isSuperAdmin) {
  const g = f.gameFace;
  const photo = g.photo
    ? (isSuperAdmin && g.photoId ? `<a class="asd-gf__ph is-on" href="/admin/season/liveness/${esc(g.photoId)}">View photo</a>` : '<span class="asd-gf__ph is-on">Photo on file</span>')
    : '<span class="asd-gf__ph">No photo yet</span>';
  const pose = g.pose ? `<div class="aui-cell__title">${esc(g.pose)}</div><div class="aui-cell__sub">${g.inContest ? 'In the contest' : 'Not in the contest'}</div>` : '<div class="aui-cell__sub">No contest pose</div>';
  const help = f.help.length ? `<div class="asd-chips">${f.help.map(h => `<span class="asd-chip">${esc(h)}</span>`).join('')}</div>` : '';
  return section({ title: f.help.length ? 'Game face and help' : 'Game face', bodyHtml: panel(`<div class="asd-gf">${photo}<div>${pose}</div></div>${help}`) });
}

// form: server.js signupFormForAdmin. seasonEmail: latest start-of-season email row, or null.
// started: the season has started, so a status change charges and emails nobody.
export function adminSignupDetailBody({ signup: s, form: f, isSuperAdmin = false, seasonEmail = null, started = false } = {}) {
  const name = displayPlayerName(s.full_name || '—');
  const post = (action, label, opts, extra = '') => button(label, { ...opts, attrs: `data-post-json="/admin/season/signups/${esc(s.id)}/${action}" ${extra}` });
  const lateNote = started ? ' The season has already started: this charges, refunds and emails nobody. Handle those in the Ledger.' : '';
  const actions = [
    s.status !== 'confirmed' ? post('confirm', 'Confirm', { kind: 'primary' }, `data-done="Confirmed."${started ? ` data-confirm data-confirm-title="Confirm ${esc(name)}?" data-confirm-body="${esc(lateNote.trim())}" data-confirm-send="Confirm"` : ''}`) : '',
    s.status === 'confirmed' ? post('withdraw', 'Withdraw', { kind: 'danger' }, `data-done="Withdrawn." data-confirm data-confirm-title="Withdraw ${esc(name)}?" data-confirm-body="${esc(`This frees their spot and promotes the earliest waitlisted sign-up.${lateNote}`)}" data-confirm-send="Withdraw"`) : '',
    s.status !== 'rejected' ? post('reject', 'Reject', {}, `data-done="Rejected."${s.status === 'confirmed' ? ` data-confirm data-confirm-title="Reject ${esc(name)}?" data-confirm-body="${esc(`This takes them off their team.${lateNote}`)}" data-confirm-send="Reject"` : ''}`) : '',
  ].join('');

  const answers = [
    roleBlock(f),
    f.workOn ? section({ title: 'What a teammate would say', bodyHtml: panel(`<p class="asd-quote">${esc(f.workOn)}</p>`) }) : '',
    selfBlock(f),
    s.comments ? section({ title: 'Comments', bodyHtml: panel(`<p class="asd-quote">${esc(s.comments)}</p>`) }) : '',
  ].filter(Boolean).join('');

  return `<div class="aui-page">
    ${breadcrumb([{ label: 'Sign-ups', href: '/admin/season/waitlist' }, { label: name }])}
    ${pageHeader({ title: name, sub: [s.email, s.phone, s.created_at ? `signed up ${fmtDate(s.created_at)}` : ''].filter(Boolean).join(' · '), actionsHtml: actions })}
    ${s.contact_changed_at ? banner('warn', `Emergency contact or birthday differs from what was on file.${s.contact_change_note ? ` ${s.contact_change_note}` : ''}`) : ''}
    <div class="asd-split">
      <div class="asd-stack">${answers || section({ title: 'Their answers', bodyHtml: panel('<p class="asd-none">This sign-up came in before the Season 5 form, so there are no answers to show.</p>') })}</div>
      <aside class="asd-stack asd-side" aria-label="Decision">
        ${decisionBlock(s, f, seasonEmail)}
        ${kitBlock(f, s)}
        ${gameFaceBlock(f, isSuperAdmin)}
        ${f.emergency || f.birthday ? section({ title: 'Contact', bodyHtml: panel(lines([['Emergency', f.emergency ? esc(f.emergency) : none], ['Birthday', f.birthday ? esc(f.birthday) : none]])) }) : ''}
      </aside>
    </div>
    ${isSuperAdmin ? `<form data-json-action="/admin/season/signups/${esc(s.id)}/team-pref" data-done="Saved.">${formCard(formSection({
      title: 'Fix their team answer',
      sub: 'If they picked the wrong one.',
      bodyHtml: `${field({ label: 'Stay or shuffle', name: 'team_pref', type: 'select', value: s.team_pref || '', options: [['', 'No answer'], ['stick', `Stay${s.prev_team_name ? ` with ${s.prev_team_name}` : ''}`], ['reshuffle', 'Shuffle']] })}<div class="aui-row">${button('Save', { kind: 'primary', type: 'submit' })}</div>`,
    }))}</form>` : ''}
  </div>`;
}
