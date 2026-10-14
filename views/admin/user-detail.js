// /admin/users/:id: one person's account (admin redesign, 2026-10-15; mockup: canvas
// "Members · User detail"). Rebuilt from scratch on views/admin/ui.js. Tabs (?tab=):
// Profile, Account, Admin access (super admin), Emails, Activity. The right column is the
// approval decision for a pending user, account actions for an approved one.
import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';
import { maskEmail, maskPhone, maskName, maskBirthday } from '../../lib/sensitive-mask.js';
import { emailStatus } from './email-status.js';
import { LIVENESS_SOURCE_LABEL } from './liveness-review.js';
import {
  personStrip, badge, banner, pageTabs, section, facts, timeline, dataGrid, drawer, field, playerPicker,
  button, toggleRow, emptyState,
} from './ui.js';

const attr = s => escHtml(String(s ?? ''));
const fmtDate = ts => (ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const fmtDateTime = ts => (ts ? new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
const STATUS = { pending: ['Pending', 'blue'], approved: ['Approved', 'green'], rejected: ['Rejected', 'gray'] };
const EMAIL_TONE = { complained: 'red', bounced: 'red', failed: 'red', clicked: 'green', opened: 'green', delivered: 'gray', delayed: 'amber', sent: 'gray' };

// "LAST, First" → "First LAST"
function displayName(full) {
  const [last, first] = String(full || '').split(',').map(s => s.trim());
  return first ? `${first} ${last}` : (last || '');
}

function passwordState(reg) {
  if (reg.password_hash) return 'set';
  if (reg.pw_token && reg.pw_token_exp) return reg.pw_token_exp > Date.now() ? 'waiting' : 'expired';
  return 'none';
}

// Players this registration probably already is: same surname first, then first name and
// birthday. Strongest first, at most four.
function suggestMatches(reg, players) {
  const [rl = '', rf = ''] = String(reg.full_name || '').split(',').map(s => s.trim().toLowerCase());
  if (!rl) return [];
  return players.map(p => {
    const pl = String(p.last_name || '').toLowerCase(), pf = String(p.first_name || '').toLowerCase();
    let score = 0; const why = [];
    if (pl && pl === rl) { score += 60; why.push('same surname'); } else if (pl && (pl.includes(rl) || rl.includes(pl))) { score += 35; why.push('similar surname'); }
    if (!score) return null;
    if (pf && rf && pf === rf) { score += 30; why.push('same first name'); } else if (pf && rf && pf[0] === rf[0]) { score += 10; why.push('same initial'); }
    if (p.birthday && reg.birthday && p.birthday === reg.birthday) { score += 10; why.push('same birthday'); }
    return { p, score, why };
  }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 4);
}

function profileTab(reg, positions, canViewSensitive, show) {
  const birthdayHtml = canViewSensitive
    ? `<form class="aui-inline-form" data-json-action="/admin/users/${attr(reg.id)}/birthday" data-done="Birthday saved.">
        <input class="aui-input" type="date" name="birthday" value="${attr(reg.birthday || '')}" aria-label="Birthday" style="width:auto">
        ${button('Save', { kind: 'secondary', size: 'sm', type: 'submit' })}
      </form>`
    : `${escHtml(reg.birthday ? maskBirthday(reg.birthday) : '—')} <span class="aui-muted">· restricted</span>`;
  const v = x => escHtml(x || '—');
  return `
    ${section({ title: 'Personal', bodyHtml: `<div class="aui-panel">${facts([
      ['Full name', v(reg.full_name)], ['Email', v(show(reg.email, maskEmail))], ['Phone', v(show(reg.phone, maskPhone))],
      ['Birthday', birthdayHtml], reg.gender ? ['Gender', v(reg.gender)] : null,
    ])}</div>` })}
    ${section({ title: 'Their game', bodyHtml: `<div class="aui-panel">${facts([
      ['Positions', positions.length ? `<span class="aui-cell__badges">${positions.map(p => badge(p, 'gray')).join('')}</span>` : '—'],
      ['Height', v(reg.height ? `${reg.height} cm` : '')], ['Weight', v(reg.weight ? `${reg.weight} kg` : '')],
      ['Dominant hand', v(reg.dominant_hand)], ['Experience', v(reg.experience)], reg.jersey_pref ? ['Jersey preference', v(reg.jersey_pref)] : null,
    ])}</div>` })}
    ${section({ title: 'More', bodyHtml: `<div class="aui-panel">${facts([
      ['Referred by', v(reg.referred_by)], ['Emergency contact', v(show(reg.emergency_name, maskName))], ['Emergency phone', v(show(reg.emergency_phone, maskPhone))],
      reg.social_handle ? ['Social', v(reg.social_handle)] : null, reg.notes ? ['Admin notes', v(reg.notes)] : null,
    ])}</div>` })}
    ${reg.motto ? section({ title: 'Quick bio', bodyHtml: `<blockquote class="aui-quote">“${escHtml(reg.motto)}”</blockquote>` }) : ''}`;
}

function accountTab(reg, linkedName, linkedTeam, inSync, isSuperAdmin) {
  const pw = passwordState(reg);
  const pwBadge = { set: badge('Set', 'green'), waiting: badge('Awaiting password', 'amber'), expired: badge('Link expired', 'red'), none: badge('No link sent', 'gray') }[pw];
  const rows = [
    ['Logs in with', reg.facebook_id ? `Facebook ${badge('Connected', 'green')}` : reg.password_hash ? 'Password' : 'Not set up yet'],
    ['Password', `<span class="aui-cell__badges">${pwBadge}${pw === 'waiting' ? `<span class="aui-muted">link expires ${escHtml(fmtDateTime(reg.pw_token_exp))}</span>` : ''}</span>`],
    ['Last login', escHtml(fmtDateTime(reg.last_login_at) || 'Never')],
    ['Last seen', escHtml(fmtDateTime(reg.last_seen_at) || '—')],
    ['Submitted', escHtml(fmtDate(reg.created_at))],
    ['Approved', escHtml(fmtDate(reg.approved_at) || '—')],
    ['Emails', escHtml(`Picks ${reg.picks_email_optout ? 'off' : 'on'} · Papawis ${reg.papawis_email_optout ? 'off' : 'on'}`)],
  ];
  const linked = reg.player_id
    ? `<div class="aui-panel aui-row-between">
        <div><div class="aui-cell__title">${escHtml(linkedName || 'Unknown player')}</div><div class="aui-cell__sub">${escHtml(linkedTeam || 'No team')}${isSuperAdmin ? ` · ${inSync ? 'details match this account' : 'details differ from this account'}` : ''}</div></div>
        <div class="aui-row">${button('Open player', { kind: 'secondary', size: 'sm', href: `/admin/players/${reg.player_id}` })}
        ${isSuperAdmin ? button('Relink…', { kind: 'secondary', size: 'sm', attrs: 'data-drawer-open="relink"' }) : ''}
        ${isSuperAdmin ? button(inSync ? 'Sync details to player' : 'Re-sync to player', { kind: inSync ? 'ghost' : 'primary', size: 'sm', attrs: `data-post-json="/admin/users/${attr(reg.id)}/sync" data-done="Player details updated from this account." data-confirm data-confirm-title="Copy this account’s details onto the player?" data-confirm-body="Fills the player record from the registration; blank fields are skipped." data-confirm-send="Sync"` }) : ''}</div>
      </div>`
    : `<div class="aui-panel aui-muted">Not linked to a player yet.</div>`;
  return `${section({ title: 'Sign-in', bodyHtml: `<div class="aui-panel">${facts(rows)}</div>` })}
    ${section({ title: 'Linked player', bodyHtml: linked })}`;
}

function accessTab(reg, sectionsList) {
  if (reg.status !== 'approved') return emptyState({ title: 'Approve them first', sub: 'Admin access is only for approved members.' });
  let allowed = [];
  try { allowed = JSON.parse(reg.admin_sections || '[]') || []; } catch {}
  const isAdmin = !!reg.is_admin;
  const switches = `<div class="aui-panel">
    ${toggleRow({ label: 'Admin access', help: 'Can open the admin with their own login.', name: 'admin', on: isAdmin, post: `/admin/users/${reg.id}/toggle-admin`, reload: true })}
    ${isAdmin ? toggleRow({ label: 'Can see private details', help: 'Phones, birthdays and emergency contacts unmasked.', name: 'sensitive', on: !!reg.can_view_sensitive, post: `/admin/users/${reg.id}/toggle-sensitive`, reload: true }) : ''}
  </div>`;
  const sections = isAdmin ? section({
    title: 'Sections they can open', note: '· none ticked = every section',
    bodyHtml: `<form class="aui-panel" data-json-action="/admin/users/${attr(reg.id)}/sections" data-done="Sections saved.">
      <div class="aui-checks">${sectionsList.map(s => `<label class="aui-check"><input type="checkbox" name="sections[]" value="${attr(s.key)}"${allowed.includes(s.key) ? ' checked' : ''}><span>${escHtml(s.label)}</span></label>`).join('')}</div>
      <div class="aui-row" style="margin-top:14px">${button('Save sections', { kind: 'primary', size: 'sm', type: 'submit' })}<span class="aui-muted">The sidebar only shows what they can open.</span></div>
    </form>`,
  }) : '';
  return `${banner('info', 'Super admin only. Switches save as you flip them; the page reloads to show what changed.')}
    ${section({ title: 'Access', bodyHtml: switches })}${sections}`;
}

function emailsTab(emails, query, regId) {
  return dataGrid({
    id: 'emails', baseUrl: `/admin/users/${regId}`, query: { ...query, view: '' },
    keep: { tab: 'emails' },
    rows: emails.map(e => ({ ...e, st: emailStatus(e) })), rowKey: e => e.id, noun: ['email', 'emails'],
    defaultSort: '-sent', perPage: 20,
    columns: [
      { key: 'subject', label: 'Email', primary: true, sort: e => String(e.subject || '').toLowerCase(), cell: e => `<span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(e.subject || e.kind || 'Email')}</span><span class="aui-cell__sub">${escHtml(e.kind || '')}</span></span>` },
      { key: 'status', label: 'Status', bare: true, cell: e => (e.st ? badge(e.st.label, EMAIL_TONE[e.st.key] || 'gray') : '') },
      { key: 'sent', label: 'Sent', num: true, sort: e => e.sent_at || 0, cell: e => escHtml(fmtDateTime(e.sent_at)) },
    ],
    empty: { title: 'No emails yet', sub: 'Approval, password and reminder emails show up here.' },
  });
}

function activityTab(reg, logs, emails, actorLabel) {
  const items = [];
  if (reg.created_at) items.push({ at: reg.created_at, who: displayName(reg.full_name), what: 'registered', tone: 'gray' });
  if (reg.approved_at) items.push({ at: reg.approved_at, who: 'Admin', what: 'approved the account', tone: 'green' });
  if (reg.last_login_at) items.push({ at: reg.last_login_at, who: displayName(reg.full_name), what: 'last logged in', tone: 'gray' });
  for (const e of emails.slice(0, 15)) items.push({ at: e.sent_at, who: 'WKND', what: `emailed “${e.subject || e.kind}”`, tone: 'gray' });
  for (const l of logs) items.push({ at: l.created_at, who: actorLabel(l), what: (l.path.split('/').pop() || '').replace(/-/g, ' '), tone: 'amber' });
  items.sort((a, b) => b.at - a.at);
  if (!items.length) return emptyState({ title: 'Nothing yet' });
  return `<div class="aui-panel">${timeline(items.slice(0, 40).map(i => ({ ...i, when: fmtDateTime(i.at) })))}</div>`;
}

function approveCard(reg, players, teamColor, name) {
  const matches = suggestMatches(reg, players);
  const best = matches[0] && matches[0].score >= 90 ? matches[0].p.id : '';
  const opt = (value, inner, checked) => `<label class="aui-choice"><input type="radio" name="player_id" value="${attr(value)}"${checked ? ' checked' : ''}><span class="aui-choice__body">${inner}</span></label>`;
  const rows = matches.map(m => opt(m.p.id, `
      ${avatarFor(m.p, teamColor)}
      <span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(displayPlayerName(m.p.name))}</span><span class="aui-cell__sub">${escHtml([m.p.team_name, m.why.join(', ')].filter(Boolean).join(' · '))}</span></span>
      ${badge(m.score >= 90 ? 'Strong match' : m.score >= 60 ? 'Likely' : 'Possible', m.score >= 90 ? 'green' : 'gray')}`, m.p.id === best)).join('');
  return section({
    title: 'Approve',
    bodyHtml: `<form class="aui-panel aui-panel--accent" data-json-action="/admin/users/${attr(reg.id)}/approve" data-done="${attr(name)} approved. A set-password email is on its way."
        data-confirm data-confirm-title="Approve ${attr(name)}?" data-confirm-body="They get an email with a link to set their password." data-confirm-send="Approve">
      <p class="aui-muted" style="margin:0 0 12px">Link them to the player they already are, or create a new player.</p>
      <div class="aui-choices">
        ${rows}
        ${opt('other', `<span class="aui-cell__stack"><span class="aui-cell__title">Someone else</span><span class="aui-cell__sub">Search every player below</span></span>`, !best && !!matches.length)}
        ${opt('', `<span class="aui-cell__stack"><span class="aui-cell__title">Don’t link a player</span><span class="aui-cell__sub">Approve the account only</span></span>`, false)}
      </div>
      <div style="margin-top:10px">${playerPicker({ name: 'player_id_other', label: 'Search all players', multiple: false, placeholder: 'Type a name',
        options: players.map(p => ({ id: p.id, name: displayPlayerName(p.name), color: teamColor[p.team_id] || '', meta: p.team_name || '' })) })}</div>
      <div class="aui-stack" style="margin-top:14px">
        ${button('Approve', { kind: 'primary', type: 'submit', attrs: 'style="width:100%"' })}
        <div class="aui-row">
          ${button('Create new player', { kind: 'secondary', attrs: `style="flex:1" data-post-json="/admin/users/${attr(reg.id)}/create" data-done="Player created and ${attr(name)} approved." data-confirm data-confirm-title="Create a new player for ${attr(name)}?" data-confirm-body="Makes a player record from this registration, approves the account and emails a set-password link." data-confirm-send="Create and approve"` })}
          ${button('Reject…', { kind: 'danger', attrs: 'style="flex:1" data-drawer-open="reject"' })}
        </div>
      </div>
      <p class="aui-field__help" style="margin:12px 0 0">Reject asks for an optional reason and emails it to them.</p>
    </form>`,
  });
}

function avatarFor(p, teamColor) {
  const n = displayPlayerName(p.name);
  const initials = n.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const c = teamColor[p.team_id];
  return `<span class="aui-avatar" style="width:30px;height:30px;box-shadow:0 0 0 2px ${/^#[0-9a-f]{3,8}$/i.test(c || '') ? c : 'rgba(255,255,255,.18)'}" aria-hidden="true">${escHtml(initials)}</span>`;
}

function accountActions(reg, isSuperAdmin, name, emailShown) {
  const pw = passwordState(reg);
  const a = (label, help, attrs, danger = false) => `<button type="button" class="aui-action${danger ? ' is-danger' : ''}" ${attrs}><span class="aui-cell__stack"><span class="aui-action__label">${escHtml(label)}</span><span class="aui-cell__sub">${escHtml(help)}</span></span><span class="aui-action__chev" aria-hidden="true">›</span></button>`;
  const id = attr(reg.id);
  const list = [];
  if (reg.status === 'approved' && reg.email) list.push(a(pw === 'set' ? 'Send password reset' : 'Resend set-password link', `Emails a fresh link to ${emailShown}`,
    `data-post-json="/admin/users/${id}/send-reset" data-done="Email sent to ${attr(name)}." data-confirm data-confirm-title="Email ${attr(name)} a new link?" data-confirm-body="It goes to ${attr(emailShown)} and works for 48 hours." data-confirm-send="Send email"`));
  if (isSuperAdmin && reg.status === 'approved' && reg.player_id) list.push(a('View as this player', 'Read-only, from their side of the site',
    `data-post-json="/admin/impersonate/${attr(reg.player_id)}" data-then="/me" data-done="Viewing as ${attr(name)}" data-confirm data-confirm-title="View the site as ${attr(name)}?" data-confirm-body="Read-only. Stop from the bar at the top of the site." data-confirm-send="View as"`));
  if (isSuperAdmin && reg.status === 'approved') list.push(a('Relink to a different player', 'Doesn’t email them; just repoints the link', 'data-drawer-open="relink"'));
  if (isSuperAdmin && reg.status !== 'pending') list.push(a('Reset to pending', 'Back to the approval queue; the player record is untouched',
    `data-post-json="/admin/users/${id}/reset" data-done="${attr(name)} is back in the approval queue." data-confirm data-confirm-title="Reset ${attr(name)} to pending?" data-confirm-body="Unlinks the player and clears the approval. The player record is not changed." data-confirm-send="Reset"`, true));
  if (!list.length) return '';
  return section({ title: reg.status === 'rejected' ? 'Rejected' : 'Account actions', bodyHtml: `<div class="aui-panel aui-panel--flush">${list.join('')}</div>` });
}

function livenessCard(capture, reg) {
  const head = `Liveness photo`;
  if (!capture) {
    const why = reg.status !== 'approved' ? 'Taken after approval, when they set a password and activate.'
      : reg.password_hash ? 'Password set but no photo yet: they skipped or left the activation step.'
      : 'Not activated yet: it’s taken right after they set a password.';
    return section({ title: head, note: '· super admin', bodyHtml: `<div class="aui-panel aui-muted">No photo on file. ${escHtml(why)}</div>` });
  }
  const href = `/admin/season/liveness/${attr(capture.id)}?from=user`;
  return section({ title: head, note: '· super admin', bodyHtml: `<div class="aui-panel aui-row" style="align-items:flex-start">
    <a href="${href}" class="aui-photo"><img src="/admin/season/liveness/${attr(capture.id)}/photo" alt="Liveness capture" loading="lazy"></a>
    <div class="aui-stack" style="gap:6px">
      <span class="aui-cell__title">${escHtml(LIVENESS_SOURCE_LABEL[capture.via] || capture.via || '')}</span>
      <span class="aui-cell__sub">${escHtml(fmtDateTime(capture.captured_at))}</span>
      ${capture.prompt ? `<span class="aui-cell__sub">Asked to: ${escHtml(capture.prompt)}</span>` : ''}
      <a href="${href}" class="aui-link">Compare with profile photo</a>
    </div>
  </div>` });
}

export function adminUserDetailBody({
  reg, players = [], linkedPlayer = null, isSuperAdmin = false, inSync = true, bogusFlags = [], canViewSensitive = true,
  emails = [], livenessCapture = null, tab = 'profile', query = {}, teamColor = {}, signup = null, logs = [], sectionsList = [],
}) {
  if (!reg) return emptyState({ title: 'User not found', sub: 'They may have been removed. Go back to Users.' });
  let positions = [];
  try { positions = JSON.parse(reg.positions || '[]'); } catch {}
  const show = (value, maskFn) => (!value ? value : canViewSensitive ? value : maskFn(value));
  const name = displayName(reg.full_name) || reg.email;
  const emailShown = show(reg.email, maskEmail) || '';
  const linkedName = linkedPlayer ? displayPlayerName(linkedPlayer.name || `${linkedPlayer.last_name}, ${linkedPlayer.first_name}`) : '';
  const linkedTeam = linkedPlayer?.team_name || '';
  const color = linkedPlayer ? teamColor[linkedPlayer.team_id] || '' : '';

  const [statusLabel, statusTone] = STATUS[reg.status] || STATUS.pending;
  let adminSections = [];
  try { adminSections = JSON.parse(reg.admin_sections || '[]') || []; } catch {}
  const badges = [
    badge(statusLabel, statusTone),
    reg.is_admin ? badge(adminSections.length ? `Admin · ${sectionsList.filter(s => adminSections.includes(s.key)).map(s => s.label).join(', ')}` : 'Admin', 'amber') : '',
    bogusFlags.length ? badge('Flagged', 'red') : '',
  ].join('');
  const sub = [linkedTeam, linkedPlayer?.number ? `#${linkedPlayer.number}` : '', reg.status === 'pending' ? `registered ${fmtDate(reg.created_at)}` : reg.approved_at ? `member since ${fmtDate(reg.approved_at)}` : '',
    reg.last_seen_at || reg.last_login_at ? `last seen ${fmtDate(Math.max(reg.last_seen_at || 0, reg.last_login_at || 0))}` : ''].filter(Boolean).join(' · ');

  const strip = personStrip({
    name, color, sub, badgeHtml: `<span class="aui-cell__badges">${badges}</span>`,
    links: [
      { label: 'User account', href: `/admin/users/${reg.id}`, active: true },
      reg.player_id ? { label: 'Player profile', href: `/admin/players/${reg.player_id}` } : null,
      signup ? { label: `Season ${signup.season} signup`, href: `/admin/season/signups/${signup.id}` } : null,
      isSuperAdmin ? { label: 'Action log', href: `/admin/logs?user=${reg.id}` } : null,
    ],
  });

  const tabs = [
    ['profile', 'Profile'], ['account', 'Account'], isSuperAdmin ? ['access', 'Admin access'] : null, ['emails', 'Emails', emails.length || ''], ['activity', 'Activity'],
  ].filter(Boolean);
  const current = tabs.some(t => t[0] === tab) ? tab : 'profile';
  const tabsHtml = pageTabs(tabs.map(([k, label, count]) => ({ label, count, href: `/admin/users/${reg.id}${k === 'profile' ? '' : `?tab=${k}`}`, active: k === current })));

  const actorLabel = l => (l.actor_type === 'super' ? 'Super admin' : l.actor || 'Admin');
  const main = {
    profile: () => profileTab(reg, positions, canViewSensitive, show),
    account: () => accountTab(reg, linkedName, linkedTeam, inSync, isSuperAdmin),
    access: () => accessTab(reg, sectionsList),
    emails: () => emailsTab(emails, query, reg.id),
    activity: () => activityTab(reg, logs, emails, actorLabel),
  }[current]();

  const side = [
    reg.status === 'pending' ? approveCard(reg, players, teamColor, name) : accountActions(reg, isSuperAdmin, name, emailShown),
    isSuperAdmin ? livenessCard(livenessCapture, reg) : '',
  ].join('');

  const relink = isSuperAdmin && reg.status === 'approved' ? drawer({
    id: 'relink', eyebrow: name, title: 'Relink to a different player',
    bodyHtml: `<form id="relink-form" class="aui-stack" data-json-action="/admin/users/${attr(reg.id)}/relink" data-done="Relinked. No email was sent.">
      ${playerPicker({ name: 'player_id', label: 'Player', multiple: false, selected: reg.player_id ? [reg.player_id] : [],
        options: players.map(p => ({ id: p.id, name: displayPlayerName(p.name), color: teamColor[p.team_id] || '', meta: p.team_name || '' })) })}
      <p class="aui-field__help" style="margin:0">Doesn’t email them. Copies this account’s details onto the new player.</p>
    </form>`,
    footerHtml: `${button('Cancel', { kind: 'ghost', attrs: 'data-drawer-close' })}${button('Relink', { kind: 'primary', type: 'submit', attrs: 'form="relink-form"' })}`,
  }) : '';
  const reject = reg.status === 'pending' ? drawer({
    id: 'reject', eyebrow: name, title: 'Reject registration',
    bodyHtml: `<form id="reject-form" class="aui-stack" data-json-action="/admin/users/${attr(reg.id)}/reject" data-done="${attr(name)} rejected.">
      ${field({ label: 'Reason (optional, included in the email)', name: 'notes', type: 'textarea', rows: 4, placeholder: 'e.g. We couldn’t confirm who you are. Message us on Facebook.' })}
    </form>`,
    footerHtml: `${button('Cancel', { kind: 'ghost', attrs: 'data-drawer-close' })}${button('Reject and email', { kind: 'danger', type: 'submit', attrs: 'form="reject-form"' })}`,
  }) : '';

  return `<div class="aui-page">
    ${strip}
    ${bogusFlags.length ? banner('error', `Flagged for review: ${bogusFlags.join(' · ')}`) : ''}
    ${tabsHtml}
    <div class="aui-cols">
      <div class="aui-cols__main">${main}</div>
      ${side ? `<aside class="aui-cols__side">${side}</aside>` : ''}
    </div>
    ${relink}${reject}
  </div>`;
}
