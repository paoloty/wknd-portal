// /admin/users/:id: one person's account (admin redesign, 2026-10-15; mockup: canvas
// "Members · User detail"). Rebuilt from scratch on views/admin/ui.js. Tabs (?tab=):
// Profile, Account, Admin access (super admin, approved members), Emails, Activity. The
// right column is the approval decision for a pending user (first on a phone), account
// actions for an approved one.
import { escHtml } from '../layout.js';
import { displayPlayerName } from '../utils.js';
import { maskEmail, maskPhone, maskName, maskBirthday } from '../../lib/sensitive-mask.js';
import { emailStatus } from './email-status.js';
import { LIVENESS_SOURCE_LABEL } from './liveness-review.js';
import { expandAdminSections } from './layout.js';
import { accountPasswordState } from './users.js';
import {
  personStrip, avatar, badge, banner, pageTabs, section, facts, timeline, dataGrid, drawer, field, playerPicker,
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

// Saved admin sections, with keys from before the 2026-10 menu reorganisation expanded.
function adminSectionKeys(reg) {
  let raw = [];
  try { raw = JSON.parse(reg.admin_sections || '[]') || []; } catch {}
  return expandAdminSections(Array.isArray(raw) ? raw : []) || [];
}

// A fact row only when there's something to show (no rows of "—").
const fact = (label, raw, html) => (raw == null || raw === '' ? null : [label, html ?? escHtml(raw)]);
const factPanel = (title, rows) => (rows.some(Boolean) ? section({ title, bodyHtml: `<div class="aui-panel">${facts(rows)}</div>` }) : '');

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
        <input class="aui-input aud-date" type="date" name="birthday" value="${attr(reg.birthday || '')}" aria-label="Birthday">
        ${button('Save', { kind: 'secondary', size: 'sm', type: 'submit' })}
      </form>`
    : reg.birthday ? `${escHtml(maskBirthday(reg.birthday))} <span class="aui-muted">· restricted</span>` : '';
  return `
    ${factPanel('Personal', [
      fact('Full name', reg.full_name), fact('Email', show(reg.email, maskEmail)), fact('Phone', show(reg.phone, maskPhone)),
      fact('Birthday', birthdayHtml, birthdayHtml), fact('Gender', reg.gender),
    ])}
    ${factPanel('Their game', [
      positions.length ? ['Positions', `<span class="aui-cell__badges">${positions.map(p => badge(p, 'gray')).join('')}</span>`] : null,
      fact('Height', reg.height ? `${reg.height} cm` : ''), fact('Weight', reg.weight ? `${reg.weight} kg` : ''),
      fact('Dominant hand', reg.dominant_hand), fact('Experience', reg.experience), fact('Jersey preference', reg.jersey_pref),
    ])}
    ${factPanel('More', [
      fact('Referred by', reg.referred_by), fact('Emergency contact', show(reg.emergency_name, maskName)), fact('Emergency phone', show(reg.emergency_phone, maskPhone)),
      fact('Social', reg.social_handle), fact('Admin notes', reg.notes),
    ])}
    ${reg.motto ? section({ title: 'Quick bio', bodyHtml: `<blockquote class="aui-quote">“${escHtml(reg.motto)}”</blockquote>` }) : ''}`;
}

function accountTab(reg, linkedName, linkedTeam, inSync, isSuperAdmin) {
  const pw = accountPasswordState(reg);
  const pwBadge = { set: badge('Set', 'green'), waiting: badge('Awaiting password', 'amber'), expired: badge('Link expired', 'red'), none: badge('No link sent', 'gray') }[pw];
  const seen = Math.max(reg.last_seen_at || 0, reg.last_login_at || 0);
  const rows = [
    ['Logs in with', reg.facebook_id ? `Facebook ${badge('Connected', 'green')}` : reg.password_hash ? 'Password' : 'Not set up yet'],
    ['Password', `<span class="aui-cell__badges">${pwBadge}${pw === 'waiting' ? `<span class="aui-muted">link expires ${escHtml(fmtDateTime(reg.pw_token_exp))}</span>` : ''}</span>`],
    ['Last login', escHtml(fmtDateTime(reg.last_login_at) || 'Never')],
    fact('Last seen', fmtDateTime(seen || 0)),
    fact('Submitted', fmtDate(reg.created_at)),
    fact('Approved', fmtDate(reg.approved_at)),
    ['Emails', escHtml(`Picks ${reg.picks_email_optout ? 'off' : 'on'} · Papawis ${reg.papawis_email_optout ? 'off' : 'on'}`)],
  ];
  const linked = reg.player_id
    ? `<div class="aui-panel aui-row-between">
        <div class="aud-min0"><div class="aui-cell__title">${escHtml(linkedName || 'Unknown player')}</div><div class="aui-cell__sub">${escHtml(linkedTeam || 'No team')}${isSuperAdmin ? ` · ${inSync ? 'details match this account' : 'details differ from this account'}` : ''}</div></div>
        <div class="aui-row">${button('Open player', { kind: 'secondary', size: 'sm', href: `/admin/players/${reg.player_id}` })}
        ${isSuperAdmin ? button(inSync ? 'Sync details to player' : 'Re-sync to player', { kind: inSync ? 'ghost' : 'primary', size: 'sm', attrs: `data-post-json="/admin/users/${attr(reg.id)}/sync" data-done="Player details updated from this account." data-confirm data-confirm-title="Copy this account’s details onto the player?" data-confirm-body="Fills the player record from the registration; blank fields are skipped." data-confirm-send="Sync"` }) : ''}</div>
      </div>`
    : `<div class="aui-panel aui-muted">Not linked to a player yet.</div>`;
  return `${section({ title: 'Sign-in', bodyHtml: `<div class="aui-panel">${facts(rows)}</div>` })}
    ${section({ title: 'Linked player', bodyHtml: linked })}`;
}

function accessTab(reg, sectionsList, name) {
  const allowed = adminSectionKeys(reg);
  const isAdmin = !!reg.is_admin;
  // Granting admin asks first (the switch's data-confirm, public/admin-ui.js); taking it away doesn't.
  const adminSwitch = toggleRow({ label: 'Admin access', help: 'Can open the admin with their own login.', name: 'admin', on: isAdmin, post: `/admin/users/${reg.id}/toggle-admin`, reload: true })
    .replace('data-switch="admin"', `data-switch="admin" data-confirm data-confirm-when="on" data-confirm-title="Give ${attr(name)} admin access?" data-confirm-body="They will be able to open the admin." data-confirm-send="Give access"`);
  const switches = `<div class="aui-panel">
    ${adminSwitch}
    ${isAdmin ? toggleRow({ label: 'Can see private details', help: 'Phones, birthdays and emergency contacts unmasked.', name: 'sensitive', on: !!reg.can_view_sensitive, post: `/admin/users/${reg.id}/toggle-sensitive`, reload: true }) : ''}
    ${isAdmin ? toggleRow({ label: 'Can charge marketplace', help: 'Can charge players for marketplace orders.', name: 'marketplace', on: !!reg.can_charge_marketplace, post: `/admin/users/${reg.id}/toggle-marketplace-charge`, reload: true }) : ''}
  </div>`;
  const sections = isAdmin ? section({
    title: 'Sections they can open', note: '· none ticked = every section',
    bodyHtml: `<form class="aui-panel" data-json-action="/admin/users/${attr(reg.id)}/sections" data-done="Sections saved.">
      <div class="aui-checks aui-checks--rows">${sectionsList.map(s => `<label class="aui-check"><input type="checkbox" name="sections[]" value="${attr(s.key)}"${allowed.includes(s.key) ? ' checked' : ''}><span>${escHtml(s.label)}</span></label>`).join('')}</div>
      <div class="aui-row aud-sections__save">${button('Save sections', { kind: 'primary', size: 'sm', type: 'submit' })}<span class="aui-muted">The sidebar only shows what they can open.</span></div>
    </form>`,
  }) : '';
  return `${banner('info', 'Super admin only. Switches save as you flip them.', `<a class="aui-link aud-tap" href="/admin/privileges">Every admin →</a>`)}
    ${section({ title: 'Access', bodyHtml: switches })}${sections}`;
}

// "set_password" → "Set password"
const kindLabel = k => { const s = String(k || '').replace(/[_-]+/g, ' ').trim(); return s ? s[0].toUpperCase() + s.slice(1) : 'Email'; };

function emailsTab(emails, query, regId) {
  return dataGrid({
    id: 'emails', baseUrl: `/admin/users/${regId}`, query: { ...query, view: '' },
    keep: { tab: 'emails' },
    rows: emails.map(e => ({ ...e, st: emailStatus(e) })), rowKey: e => e.id, noun: ['email', 'emails'],
    defaultSort: '-sent', perPage: 20,
    columns: [
      { key: 'subject', label: 'Email', primary: true, sort: e => String(e.subject || '').toLowerCase(), cell: e => `<span class="aui-cell__title">${escHtml(e.subject || kindLabel(e.kind))}</span>` },
      { key: 'status', label: 'Status', bare: true, cell: e => (e.st ? badge(e.st.label, EMAIL_TONE[e.st.key] || 'gray') : '') },
      { key: 'sent', label: 'Sent', num: true, sort: e => e.sent_at || 0, cell: e => escHtml(fmtDateTime(e.sent_at)) },
    ],
    empty: { title: 'No emails yet', sub: 'Approval, password and reminder emails show up here.' },
  });
}

// Admin log paths → tone: only the decisions that change an account get a colour.
const LOG_TONE = { approve: 'green', create: 'green', reject: 'red', reset: 'red' };

function activityTab(reg, logs, emails, actorLabel) {
  const items = [];
  if (reg.created_at) items.push({ at: reg.created_at, who: displayName(reg.full_name), what: 'registered', tone: 'gray' });
  // The approval, unless the action log already has it (with who did it).
  const loggedApproval = logs.some(l => /\/(approve|create)$/.test(String(l.path || '')));
  if (reg.approved_at && !loggedApproval) items.push({ at: reg.approved_at, who: 'Admin', what: 'approved the account', tone: 'green' });
  for (const e of emails.slice(0, 15)) {
    const st = emailStatus(e);
    items.push({ at: e.sent_at, who: 'WKND', what: `emailed “${e.subject || kindLabel(e.kind)}”${st && EMAIL_TONE[st.key] === 'red' ? ` (${st.label.toLowerCase()})` : ''}`, tone: st && EMAIL_TONE[st.key] === 'red' ? 'red' : 'gray' });
  }
  for (const l of logs) {
    const verb = String(l.path || '').split('/').pop() || '';
    items.push({ at: l.created_at, who: actorLabel(l), what: verb.replace(/-/g, ' '), tone: LOG_TONE[verb] || 'gray' });
  }
  items.sort((a, b) => b.at - a.at);
  if (!items.length) return emptyState({ title: 'Nothing yet' });
  return `<div class="aui-panel">${timeline(items.slice(0, 40).map(i => ({ ...i, when: fmtDateTime(i.at) })))}</div>`;
}

// The approve form, browser side: picking someone in "Search all players" selects "Someone
// else"; choosing any other option clears that pick; the confirm names who gets linked.
const approveScript = `<script>
(function () {
  if (window.__audApproveInit) return; window.__audApproveInit = true;
  function picked(f) { var h = f.querySelector('[data-picker-values] input'); return h ? h.value : ''; }
  function pickedName(f) {
    var pk = f.querySelector('[data-picker]'), id = picked(f), opts = [];
    try { opts = JSON.parse(pk.getAttribute('data-options') || '[]'); } catch (e) {}
    var o = opts.filter(function (x) { return x.id === id; })[0];
    return o ? o.name : '';
  }
  document.addEventListener('change', function (e) {
    var f = e.target.closest && e.target.closest('[data-approve-form]');
    if (!f) return;
    if (e.target.closest('[data-picker]')) {
      if (picked(f)) { var other = f.querySelector('input[name="player_id"][value="other"]'); if (other) other.checked = true; }
    } else if (e.target.name === 'player_id' && e.target.value !== 'other') {
      f.querySelectorAll('[data-picker-values], [data-picker-chips]').forEach(function (n) { n.innerHTML = ''; });
    }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f.matches || !f.matches('[data-approve-form]')) return;
    var r = f.querySelector('input[name="player_id"]:checked');
    var v = r ? r.value : (picked(f) ? 'other' : '');
    if (v === 'other' && !picked(f)) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (window.adminUi) window.adminUi.toast('Pick a player in the search, or choose “Don’t link a player”.', { tone: 'error' });
      var inp = f.querySelector('[data-picker-input]'); if (inp) inp.focus();
      return;
    }
    var who = v === 'other' ? pickedName(f) : v ? r.getAttribute('data-name') : '';
    f.setAttribute('data-confirm-body', who
      ? 'Links them to ' + who + ', then emails a link to set their password.'
      : 'Nobody gets linked: only the account is approved. They get an email with a link to set their password.');
  }, true);
})();
</script>`;

function approveCard(reg, players, teamColor, name) {
  const matches = suggestMatches(reg, players);
  const best = matches[0] && matches[0].score >= 90 ? matches[0].p.id : '';
  const opt = (value, inner, checked, label = '') => `<label class="aui-choice"><input type="radio" name="player_id" value="${attr(value)}"${label ? ` data-name="${attr(label)}"` : ''}${checked ? ' checked' : ''}><span class="aui-choice__body">${inner}</span></label>`;
  const rows = matches.map(m => opt(m.p.id, `
      ${avatarFor(m.p, teamColor)}
      <span class="aui-cell__stack"><span class="aui-cell__title">${escHtml(displayPlayerName(m.p.name))}</span><span class="aui-cell__sub">${escHtml([m.p.team_name, m.why.join(', ')].filter(Boolean).join(' · '))}</span></span>
      ${badge(m.score >= 90 ? 'Strong match' : m.score >= 60 ? 'Likely' : 'Possible', m.score >= 90 ? 'green' : 'gray')}`, m.p.id === best, displayPlayerName(m.p.name))).join('');
  return section({
    title: 'Approve',
    bodyHtml: `<form class="aui-panel aui-panel--accent" data-approve-form data-json-action="/admin/users/${attr(reg.id)}/approve" data-done="${attr(name)} approved. A set-password email is on its way."
        data-confirm data-confirm-title="Approve ${attr(name)}?" data-confirm-body="They get an email with a link to set their password." data-confirm-send="Approve">
      <p class="aui-muted aud-approve__lead">Link them to the player they already are, or create a new player.</p>
      <div class="aui-choices aui-choices--rows">
        ${rows}
        ${opt('other', `<span class="aui-cell__stack"><span class="aui-cell__title">Someone else</span><span class="aui-cell__sub">Search every player below</span></span>`, !best && !!matches.length)}
        ${opt('', `<span class="aui-cell__stack"><span class="aui-cell__title">Don’t link a player</span><span class="aui-cell__sub">Approve the account only</span></span>`, !matches.length)}
      </div>
      <div class="aud-approve__search">${playerPicker({ name: 'player_id_other', label: 'Search all players', multiple: false, placeholder: 'Type a name',
        options: players.map(p => ({ id: p.id, name: displayPlayerName(p.name), color: teamColor[p.team_id] || '', meta: p.team_name || '' })) })}</div>
      <div class="aui-stack aud-approve__actions">
        ${button('Approve', { kind: 'primary', type: 'submit' })}
        <div class="aui-row">
          ${button('Create new player', { kind: 'secondary', attrs: `data-post-json="/admin/users/${attr(reg.id)}/create" data-done="Player created and ${attr(name)} approved." data-confirm data-confirm-title="Create a new player for ${attr(name)}?" data-confirm-body="Makes a player record from this registration, approves the account and emails a set-password link." data-confirm-send="Create and approve"` })}
          ${button('Reject…', { kind: 'danger', attrs: 'data-drawer-open="reject"' })}
        </div>
      </div>
    </form>${approveScript}`,
  });
}

function avatarFor(p, teamColor) {
  return avatar(displayPlayerName(p.name), teamColor[p.team_id] || '', { size: 30, playerId: p.id });
}

function accountActions(reg, isSuperAdmin, name, emailShown) {
  const pw = accountPasswordState(reg);
  const a = (label, help, attrs, danger = false) => `<button type="button" class="aui-action${danger ? ' is-danger' : ''}" ${attrs}><span class="aui-cell__stack"><span class="aui-action__label">${escHtml(label)}</span><span class="aui-cell__sub">${escHtml(help)}</span></span><span class="aui-action__chev" aria-hidden="true">›</span></button>`;
  const id = attr(reg.id);
  const list = [];
  if (reg.status === 'approved' && reg.email) list.push(a(pw === 'set' ? 'Send password reset' : 'Resend set-password link', `Emails a fresh link to ${emailShown}`,
    `data-post-json="/admin/users/${id}/send-reset" data-done="Email sent to ${attr(name)}." data-confirm data-confirm-title="Email ${attr(name)} a new link?" data-confirm-body="It goes to ${attr(emailShown)} and works for 48 hours." data-confirm-send="Send email"`));
  if (isSuperAdmin && reg.status === 'approved' && reg.player_id) list.push(a('View as this player', 'Read-only, from their side of the site',
    `data-post-json="/admin/impersonate/${attr(reg.player_id)}" data-then="/me" data-done="Viewing as ${attr(name)}" data-confirm data-confirm-title="View the site as ${attr(name)}?" data-confirm-body="Read-only. Stop from the bar at the top of the site." data-confirm-send="View as"`));
  if (isSuperAdmin && reg.status === 'approved') list.push(a(reg.player_id ? 'Relink to a different player' : 'Link to a player', 'Doesn’t email them; just points the account at a player', 'data-drawer-open="relink"'));
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
  return section({ title: head, note: '· super admin', bodyHtml: `<div class="aui-panel aui-row aud-live">
    <a href="${href}" class="aui-photo"><img src="/admin/season/liveness/${attr(capture.id)}/photo" alt="Liveness capture" loading="lazy"></a>
    <div class="aui-stack aud-live__text">
      <span class="aui-cell__title">${escHtml(LIVENESS_SOURCE_LABEL[capture.via] || capture.via || '')}</span>
      <span class="aui-cell__sub">${escHtml(fmtDateTime(capture.captured_at))}</span>
      ${capture.prompt ? `<span class="aui-cell__sub">Asked to: ${escHtml(capture.prompt)}</span>` : ''}
      <a href="${href}" class="aui-link aud-tap">Compare with profile photo</a>
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
  const adminLabels = sectionsList.filter(s => adminSectionKeys(reg).includes(s.key)).map(s => s.label);
  const badges = [
    badge(statusLabel, statusTone),
    reg.is_admin ? badge(adminLabels.length > 1 ? `Admin · ${adminLabels.length} sections` : adminLabels.length ? `Admin · ${adminLabels[0]}` : 'Admin', 'amber') : '',
    bogusFlags.length ? badge('Flagged', 'red') : '',
  ].join('');
  const sub = [linkedTeam, linkedPlayer?.number ? `#${linkedPlayer.number}` : '', reg.status === 'pending' ? `registered ${fmtDate(reg.created_at)}` : reg.approved_at ? `member since ${fmtDate(reg.approved_at)}` : '',
    reg.last_seen_at || reg.last_login_at ? `last seen ${fmtDate(Math.max(reg.last_seen_at || 0, reg.last_login_at || 0))}` : ''].filter(Boolean).join(' · ');

  const publicHref = reg.player_id ? `/players/${encodeURIComponent(reg.player_id)}` : '';
  let strip = personStrip({
    name, color, sub, playerId: reg.player_id || '', badgeHtml: `<span class="aui-cell__badges">${badges}</span>`,
    links: [
      { label: 'User account', href: `/admin/users/${reg.id}`, active: true },
      reg.player_id ? { label: 'Player profile', href: `/admin/players/${reg.player_id}` } : null,
      publicHref ? { label: 'Public profile ↗', href: publicHref } : null,
      signup ? { label: `Season ${signup.season} signup`, href: `/admin/season/signups/${signup.id}` } : null,
      isSuperAdmin ? { label: 'Action log', href: `/admin/logs?user=${reg.id}` } : null,
    ],
  });
  if (publicHref) strip = strip.replace(`href="${attr(publicHref)}"`, `href="${attr(publicHref)}" target="_blank" rel="noopener"`);

  const showAccess = isSuperAdmin && reg.status === 'approved';
  const tabs = [
    ['profile', 'Profile'], ['account', 'Account'], showAccess ? ['access', 'Admin access'] : null, ['emails', 'Emails', emails.length || ''], ['activity', 'Activity'],
  ].filter(Boolean);
  const current = tabs.some(t => t[0] === tab) ? tab : 'profile';
  const tabsHtml = pageTabs(tabs.map(([k, label, count]) => ({ label, count, href: `/admin/users/${reg.id}${k === 'profile' ? '' : `?tab=${k}`}`, active: k === current })));

  const actorLabel = l => (l.actor_type === 'super' ? 'Super admin' : displayPlayerName(l.actor) || 'Admin');
  const main = {
    profile: () => profileTab(reg, positions, canViewSensitive, show),
    account: () => accountTab(reg, linkedName, linkedTeam, inSync, isSuperAdmin),
    access: () => accessTab(reg, sectionsList, name),
    emails: () => emailsTab(emails, query, reg.id),
    activity: () => activityTab(reg, logs, emails, actorLabel),
  }[current]();

  const pending = reg.status === 'pending';
  const side = [
    pending ? approveCard(reg, players, teamColor, name) : accountActions(reg, isSuperAdmin, name, emailShown),
    isSuperAdmin ? livenessCard(livenessCapture, reg) : '',
  ].join('');

  const relink = isSuperAdmin && reg.status === 'approved' ? drawer({
    id: 'relink', eyebrow: name, title: reg.player_id ? 'Relink to a different player' : 'Link to a player',
    bodyHtml: `<form id="relink-form" class="aui-stack" data-json-action="/admin/users/${attr(reg.id)}/relink" data-done="${reg.player_id ? 'Relinked' : 'Linked'}. No email was sent.">
      ${playerPicker({ name: 'player_id', label: 'Player', multiple: false, selected: reg.player_id ? [reg.player_id] : [],
        options: players.map(p => ({ id: p.id, name: displayPlayerName(p.name), color: teamColor[p.team_id] || '', meta: p.team_name || '' })) })}
      <p class="aui-field__help aud-help">Doesn’t email them. Copies this account’s details onto the player.</p>
    </form>`,
    footerHtml: `${button('Cancel', { kind: 'ghost', attrs: 'data-drawer-close' })}${button(reg.player_id ? 'Relink' : 'Link', { kind: 'primary', type: 'submit', attrs: 'form="relink-form"' })}`,
  }) : '';
  const reject = pending ? drawer({
    id: 'reject', eyebrow: name, title: 'Reject registration',
    bodyHtml: `<form id="reject-form" class="aui-stack" data-json-action="/admin/users/${attr(reg.id)}/reject" data-done="${attr(name)} rejected.">
      ${field({ label: 'Reason (optional, included in the email)', name: 'notes', type: 'textarea', rows: 4, placeholder: 'e.g. We couldn’t confirm who you are. Message us on Facebook.' })}
    </form>`,
    footerHtml: `${button('Cancel', { kind: 'ghost', attrs: 'data-drawer-close' })}${button('Reject and email', { kind: 'danger', type: 'submit', attrs: 'form="reject-form"' })}`,
  }) : '';

  return `<div class="aui-page aud">
    ${strip}
    ${bogusFlags.length ? banner('error', `Flagged for review: ${bogusFlags.join(' · ')}`) : ''}
    ${tabsHtml}
    <div class="aui-cols">
      <div class="aui-cols__main">${main}</div>
      ${side ? `<aside class="aui-cols__side${pending ? ' aud-side--first' : ''}">${side}</aside>` : ''}
    </div>
    ${relink}${reject}
  </div>`;
}
