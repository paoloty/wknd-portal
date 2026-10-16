import { escHtml } from './layout.js';
import { playerLink, playerAvatar, avatarStack, teamColor, formatTimeRange, manilaTodayStr, papawisSignupOpensAtMs, isPapawisSignupOpenNow, initials, shareIcon } from './utils.js';

// /papawis — rebuilt 2026-10-11 from the "WKND Marketplace + Papawis Redesign" canvas (variant J).
// Every UPCOMING run gets the full block (countdown bar, photo banner, who's in, details +
// action). Runs that are over (price pending, played, cancelled) are photo cards in "Past
// runs". Phone: the run becomes one container (banner → countdown → faces → action →
// details), re-ordered in CSS. Styles: public/papawis.css (pwx- prefix; pw- for the roster dialog).

export const CUTOFF_DAYS = 3;

// Status colours (StatusColors board) — only ever on the status pill, card top edges and
// the countdown, always with an icon + label.
const ST = {
  wait:      { c: '#8fb0e0', icon: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z' },
  open:      { c: '#f59332', icon: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z' },
  full:      { c: '#c9854f', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8' },
  today:     { c: '#f59332', icon: 'M12 22c4.4 0 7-2.9 7-6.8 0-3.4-2.2-5.9-4-7.7-.4 1.9-1.5 3.1-2.6 3.6C12.7 7.9 11 4.5 8.5 2 8.6 5.6 5 8.7 5 14.7 5 19.1 7.6 22 12 22z' },
  pending:   { c: '#c7d0da', icon: 'M6 2h12M6 22h12M7 2c0 5 5 6 5 10s-5 5-5 10M17 2c0 5-5 6-5 10s5 5 5 10' },
  played:    { c: '#5cc68e', icon: 'M5 12.5l4.5 4.5L19 7.5' },
  cancelled: { c: '#f07070', icon: 'M6 6l12 12M18 6L6 18' },
};

const svg = (d, size = 12, sw = 2.4) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"></path></svg>`;
const ICON = {
  pin: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59332" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"></path><circle cx="12" cy="9.5" r="2.5"></circle></svg>`,
  pinMuted: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"></path><circle cx="12" cy="9.5" r="2.5"></circle></svg>`,
  nav: svg('M3 11l18-8-8 18-2-8-8-2z', 13, 2.2),
  share: shareIcon(13),
  list: svg('M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01', 13, 2.2),
  bell: svg('M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0', 13, 2.2),
  lock: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>`,
  check: svg('M5 12.5l4.5 4.5L19 7.5', 12, 3),
};
const lbl = t => `<span class="pwx-lbl">${t}</span>`;

// ── dates ───────────────────────────────────────────────────────────────────
function daysUntil(dateStr) {
  const today = new Date(manilaTodayStr() + 'T00:00:00');
  const game  = new Date(dateStr + 'T00:00:00');
  return Math.round((game - today) / 86400000);
}
function addDays(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
const fmtDay   = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });   // Sat, Oct 10
const fmtChip  = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }) + ' · ' + new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); // Sat · Oct 10
const fmtWeekday = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
const timeOf   = g => formatTimeRange(g.start_time, g.end_time) || g.time_label || '';
const startClock = g => (g.start_time ? formatTimeRange(g.start_time, null) : '');
// Tip-off instant (Manila). No start time on file → start of the game day.
const tipoffMs = g => new Date(`${g.date}T${g.start_time || '00:00'}:00+08:00`).getTime();
const peso = n => `₱${Number(n).toLocaleString('en-US')}`;

function googleMapsUrl(q) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`; }

// "LASTNAME, Firstname Middle" → "Firstname"
function firstWordOf(raw) {
  const str = String(raw || '').trim();
  const comma = str.indexOf(',');
  const first = comma === -1 ? str : str.slice(comma + 1).trim();
  return first.split(/\s+/)[0] || first;
}
function firstNameOf(raw) {
  const str = String(raw || '').trim();
  const comma = str.indexOf(',');
  return comma === -1 ? (str.split(' ')[0] || str) : str.slice(comma + 1).trim();
}

// The run's own uploaded cover, else the court photo, else the cached dark map, else
// nothing (the card shows its own fallback).
function courtImg(g, cls = '') {
  if (g.cover_ver) return `<img class="${cls}" src="/api/papawis-cover/${encodeURIComponent(g.id)}?v=${encodeURIComponent(g.cover_ver)}" alt="" loading="lazy">`;
  if (g.court_image_id) return `<img class="${cls}" src="/api/papawis-court/${escHtml(g.court_image_id)}/photo" alt="" loading="lazy">`;
  if (g.has_map) return `<img class="${cls} pwx-map" src="/api/papawis-map/photo?loc=${encodeURIComponent(g.map_query || g.location)}" alt="" loading="lazy">`;
  return '';
}

// ── roster dialog (kept from the old page: flat list, or Light/Dark once teams are out) ──
function rosterAvatarHtml(s) {
  return s.guest_name
    ? `<div class="pw-roster-avatar pw-roster-avatar--guest">${escHtml(initials(s.guest_name))}</div>`
    : playerAvatar(s.player_id, s.player_name, teamColor(s.team_name), { className: 'pw-roster-avatar', link: true });
}
function rosterNameHtml(s) {
  return s.guest_name
    ? `${escHtml(s.guest_name)} <span class="pw-roster-guest-tag">guest of ${escHtml(firstNameOf(s.player_name))}</span>`
    : playerLink(s.player_id, s.player_name, { className: 'pw-roster-link' });
}
function rosterShortNameHtml(s) {
  const word = firstWordOf(s.guest_name || s.player_name);
  return s.guest_name ? escHtml(word) : playerLink(s.player_id, word, { className: 'pw-roster-link' });
}
const rosterRow = (s, i) => `<tr>
    <td class="pw-roster-table__num">${i + 1}</td>
    <td class="pw-roster-table__avatar">${rosterAvatarHtml(s)}</td>
    <td class="pw-roster-table__name">${rosterNameHtml(s)}</td>
  </tr>`;
const rosterTable = rows => `<div class="pw-roster-table-wrap"><table class="pw-roster-table"><tbody>${rows.map(rosterRow).join('')}</tbody></table></div>`;
function teamMatchNameCell(row) {
  if (!row) return '';
  return `<span class="pw-team-row__name-full">${rosterNameHtml(row)}</span><span class="pw-team-row__name-short">${rosterShortNameHtml(row)}</span>`;
}
const teamMatchRow = (l, d) => `<tr>
    <td class="pw-team-row__name pw-team-row__name--light">${teamMatchNameCell(l)}</td>
    <td class="pw-team-row__avatar pw-team-row__avatar--light">${l ? rosterAvatarHtml(l) : ''}</td>
    <td class="pw-team-row__avatar pw-team-row__avatar--dark">${d ? rosterAvatarHtml(d) : ''}</td>
    <td class="pw-team-row__name pw-team-row__name--dark">${teamMatchNameCell(d)}</td>
  </tr>`;
function teamMatchTable(light, dark) {
  const rows = [];
  for (let i = 0; i < Math.max(light.length, dark.length); i++) rows.push(teamMatchRow(light[i] || null, dark[i] || null));
  return `<p class="pw-team-note">Bring the right color: Light wears a light shirt, Dark wears a dark one.</p>
  <div class="pw-team-table-wrap"><table class="pw-team-table">
    <thead><tr>
      <th class="pw-team-header pw-team-header--light pw-team-row__name--light">Light</th>
      <th class="pw-team-header pw-team-row__avatar pw-team-row__avatar--light"></th>
      <th class="pw-team-header pw-team-row__avatar pw-team-row__avatar--dark"></th>
      <th class="pw-team-header pw-team-header--dark pw-team-row__name--dark">Dark</th>
    </tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table></div>`;
}
function rosterModalBody(signups, { showTeams = false } = {}) {
  const confirmed = signups.filter(s => s.status === 'confirmed');
  const waitlist  = signups.filter(s => s.status === 'waitlist' || s.status === 'pending');
  const hasTeams  = showTeams && confirmed.some(s => s.team === 'light' || s.team === 'dark');
  const confirmedHtml = !confirmed.length
    ? `<p class="pw-roster-empty">No one's listed yet. Be the first.</p>`
    : hasTeams ? teamMatchTable(confirmed.filter(s => s.team === 'light'), confirmed.filter(s => s.team === 'dark')) : rosterTable(confirmed);
  const wlName = s => s.guest_name ? escHtml(s.guest_name) : playerLink(s.player_id, s.player_name, { className: 'pw-roster-link' });
  const waitlistHtml = !waitlist.length ? ''
    : hasTeams ? `<p class="pw-waitlist-text">Waitlist: ${waitlist.map(wlName).join(', ')}</p>`
    : `<div class="pw-waitlist"><span class="pw-waitlist-label">Waitlist</span>${rosterTable(waitlist)}</div>`;
  return confirmedHtml + waitlistHtml;
}
const rosterTemplate = (g, signups, opts) =>
  `<template data-roster-tpl="${escHtml(g.id)}" data-title="${escHtml(g.title || 'Papawis')}">${rosterModalBody(signups, opts)}</template>`;

// ── faces ───────────────────────────────────────────────────────────────────
// Guests have no player record — dashed initials, never the sponsor's photo.
function faceAvatar(s, { link, cls = 'pwx-av' }) {
  return s.guest_name
    ? `<span class="${cls} pwx-av--guest">${escHtml(initials(s.guest_name))}</span>`
    : playerAvatar(s.player_id, s.player_name, teamColor(s.team_name), { className: cls, link });
}
const faceName = s => escHtml(s.guest_name ? firstWordOf(s.guest_name) : firstNameOf(s.player_name));

// Desktop: a grid of every slot (face + first name, then open circles).
function faceGrid(confirmed, maxSlots, { isLoggedIn, viewerPlayerId, kind }) {
  const cells = confirmed.map(s => {
    const me = !s.guest_name && s.player_id === viewerPlayerId;
    return `<div class="pwx-face${me ? ' is-me' : ''}" title="${escHtml(s.guest_name ? `${s.guest_name} (guest)` : firstNameOf(s.player_name))}">
      ${faceAvatar(s, { link: isLoggedIn })}
      <span class="pwx-face__name">${me ? 'You' : faceName(s)}</span>
    </div>`;
  });
  for (let i = confirmed.length; i < maxSlots; i++) {
    cells.push(`<div class="pwx-face is-open" data-open-slot><span class="pwx-av pwx-av--open${kind === 'wait' ? ' is-wait' : ''}" aria-hidden="true">+</span><span class="pwx-face__name">Open</span></div>`);
  }
  return `<div class="pwx-faces">${cells.join('')}</div>`;
}
// Phone: one overlapping row — 7 faces, "+N", then up to 3 open circles.
function faceStack(confirmed, maxSlots, { kind }) {
  const faces = confirmed.map(s => s.guest_name
    ? { guest: true, name: s.guest_name }
    : { id: s.player_id, name: s.player_name, team: s.team_name });
  return avatarStack(faces, {
    size: 38, max: 7, open: Math.min(3, Math.max(0, maxSlots - confirmed.length)),
    className: `pwx-stack${kind === 'wait' ? ' is-wait' : ''}`, label: `${confirmed.length} of ${maxSlots} slots taken`,
  });
}

// ── one upcoming run (the full block) ───────────────────────────────────────
function runBlock(g, signups, ctx, { first, summary, isAdmin }) {
  const { isLoggedIn, viewerPlayerId, hasBalance, alertsOn } = ctx;
  const dLeft = daysUntil(g.date);
  const scheduled = !isPapawisSignupOpenNow(g);
  const pub = scheduled ? [] : signups;                       // held-back rosters stay private
  const confirmed = pub.filter(s => s.status === 'confirmed');
  const waitlist  = pub.filter(s => s.status === 'waitlist' || s.status === 'pending');
  const filled = confirmed.length, max = g.max_slots || 0, open = Math.max(0, max - filled);
  const isToday = dLeft === 0;
  const full = !scheduled && filled >= max;
  const cancellable = dLeft >= CUTOFF_DAYS;
  const cutoffDate = addDays(g.date, -CUTOFF_DAYS);
  const mySignup = scheduled ? null : pub.find(s => !s.guest_name && s.player_id === viewerPlayerId);
  const mySlot = mySignup ? confirmed.indexOf(mySignup) + 1 : 0;
  const kind = scheduled ? 'wait' : full ? 'full' : isToday ? 'today' : 'open';
  const st = ST[kind];
  const opensAt = papawisSignupOpensAtMs(g);
  const t = timeOf(g);
  const court = g.location || 'Court to be announced';
  const mapsQ = g.map_query || g.location || '';

  // status pill + capsule
  const pillText = scheduled ? `Opens ${new Date(opensAt + 8 * 3600e3).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}` : full ? 'Full' : `${open} open`;
  const capsule = `<span class="pwx-capsule">
      <span class="pwx-capsule__count">${lbl(`${filled} of ${max} in`)}</span>
      <span class="pwx-pill" style="--c:${st.c}">${svg(st.icon, 11, 2.6)}${lbl(escHtml(pillText))}</span>
    </span>`;

  // countdown
  const cdTarget = scheduled ? opensAt : tipoffMs(g);
  const cdLabel = scheduled ? 'Sign-ups open in' : isToday ? 'Today · tip-off in' : 'Tip-off in';
  const opensDay = scheduled ? new Date(opensAt + 8 * 3600e3).toISOString().slice(0, 10) : '';
  const cdSub = scheduled
    ? `${fmtDay(opensDay)} · 8:00 AM, ${g.open_days_before} day${g.open_days_before === 1 ? '' : 's'} before tip-off`
    : `${fmtDay(g.date)}${startClock(g) ? ` · ${startClock(g)}` : ''} at ${escHtml(court)}`;
  const countdown = `<div class="pwx-cd${isToday && !scheduled ? ' is-today' : ''}" style="--c:${st.c}" data-cd-target="${cdTarget}" data-cd-kind="${scheduled ? 'open' : 'tipoff'}" aria-live="polite">
      <div class="pwx-cd__l">
        <span class="pwx-cd__k">${isToday && !scheduled ? '<span class="pwx-pulse" aria-hidden="true"></span>' : ''}${cdLabel}</span>
        <span class="pwx-cd__sub">${cdSub}</span>
      </div>
      <div class="pwx-cd__t">
        <span class="pwx-plate"><b data-u="d">00</b><i>Days</i></span><span class="pwx-colon">:</span>
        <span class="pwx-plate"><b data-u="h">00</b><i>Hours</i></span><span class="pwx-colon">:</span>
        <span class="pwx-plate"><b data-u="m">00</b><i>Min</i></span><span class="pwx-colon">:</span>
        <span class="pwx-plate"><b data-u="s">00</b><i>Sec</i></span>
      </div>
    </div>`;

  // banner copy: the AI write-up leads the first run; any later run shows its own title
  const headline = first && summary
    ? escHtml(summary.headline).replace(/\*\*(.+?)\*\*/g, '<em>$1</em>')
    : escHtml(g.title || `${fmtWeekday(g.date)} run`);
  const body = first && summary?.body ? escHtml(String(summary.body).replace(/\*\*/g, '')) : '';
  const kicker = first && summary ? escHtml(summary.kicker || 'Papawis this week') : (first ? 'Papawis this week' : 'Also coming up');
  const regen = first && isAdmin ? `<button type="button" class="pwx-regen" data-pwx-act="regen">${lbl('Regenerate')}</button>` : '';
  // The court's saved address often starts with the court's own name — don't say it twice.
  const address = g.map_query && g.map_query !== g.location
    ? g.map_query.replace(new RegExp(`^${String(g.location || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,\\s*`, 'i'), '')
    : '';
  const placeLine = `<span class="pwx-place">${ICON.pin}<span><b>${escHtml(court)}</b>${address ? ` · ${escHtml(address)}` : ''}</span></span>`;
  const placeBtns = `<span class="pwx-btnrow">
      ${mapsQ ? `<a class="pwx-sbtn" href="${googleMapsUrl(mapsQ)}" target="_blank" rel="noopener">${ICON.nav}${lbl('Directions')}</a>` : ''}
      <button class="pwx-sbtn" type="button" data-pwx-act="share" data-url="/papawis#pw-game-${escHtml(g.id)}" data-title="${escHtml(g.title || 'Papawis')}">${ICON.share}${lbl('Share')}</button>
    </span>`;

  const banner = `<div class="pwx-banner${courtImg(g) ? ' has-photo' : ''}">
      ${courtImg(g, 'pwx-banner__img')}
      <div class="pwx-banner__top">
        <span class="pwx-date">${lbl(`${escHtml(fmtChip(g.date))}${t ? ` · ${escHtml(t)}` : ''}`)}</span>
        ${capsule}
      </div>
      <div class="pwx-banner__body">
        <span class="pwx-kick-row"><span class="pwx-kicker">${kicker}</span>${regen}</span>
        <h3 class="pwx-headline">${headline}</h3>
        <div class="pwx-desk-only">
          ${body ? `<p class="pwx-body">${body}</p>` : ''}
          <span class="pwx-place-row">${placeLine}${placeBtns}</span>
        </div>
      </div>
    </div>`;

  // who's in
  const whoBtn = scheduled
    ? (isLoggedIn ? `<button class="pwx-sbtn" type="button" data-pwx-act="alerts" data-on="${alertsOn ? '1' : '0'}" aria-pressed="${alertsOn ? 'true' : 'false'}">${ICON.bell}${lbl(alertsOn ? 'Alerts on' : 'Alert me')}</button>` : `<a class="pwx-sbtn" href="/login?next=/papawis&amp;ref=papawis">${ICON.bell}${lbl('Alert me')}</a>`)
    : (isLoggedIn ? `<button class="pwx-sbtn" type="button" data-pwx-act="see-all" data-game="${escHtml(g.id)}">${ICON.list}${lbl('See the full list')}</button>` : `<a class="pwx-sbtn" href="/login?next=/papawis&amp;ref=papawis">${ICON.list}${lbl('See the full list')}</a>`);
  const who = `<div class="pwx-who">
      <div class="pwx-who__head"><span class="pwx-k">Who's in<span class="pwx-mob-only"> · <b>${filled}</b> of ${max}</span></span>${whoBtn}</div>
      ${faceGrid(confirmed, max, { isLoggedIn, viewerPlayerId, kind })}
      ${faceStack(confirmed, max, { kind })}
    </div>`;

  // details
  const price = g.price_per_head ? peso(g.price_per_head) : '—';
  const cancelK = isToday || !cancellable ? 'Cancellations' : 'Cancel by';
  const cancelV = cancellable ? fmtDay(cutoffDate) : 'Closed · message an admin';
  const cancelNote = cancellable
    ? `Drop out yourself, free, until ${CUTOFF_DAYS} days before tip-off. After that only an admin can take you off the list.`
    : `The window closed ${fmtDay(cutoffDate)}. Can't make it? Message an admin so your slot goes to the next person in line.`;
  const waitV = scheduled ? 'Opens with the list' : waitlist.length ? `${waitlist.length} waiting` : full ? 'Empty' : `Empty · ${open} slot${open === 1 ? '' : 's'} still open`;
  const details = `<div class="pwx-details">
      <div class="pwx-mob-only pwx-mob-more">
        ${body ? `<p class="pwx-body">${body}</p>` : ''}
        ${placeLine}${placeBtns}
      </div>
      <div class="pwx-row"><span class="pwx-k">Per head</span><span class="pwx-num pwx-price">${price}</span><span class="pwx-note">Estimate with ${Math.max(filled, max)} players · court + ref split after the game</span></div>
      <div class="pwx-row"><span class="pwx-k">${cancelK}</span><span class="pwx-v">${cancelV}</span><span class="pwx-note">${cancelNote}</span></div>
      <div class="pwx-row"><span class="pwx-k">Waitlist</span><span class="pwx-v">${waitV}</span><span class="pwx-note">Moves up on its own if someone drops</span></div>
    </div>`;

  // action: one same-size button + a small note under it
  const gid = escHtml(g.id);
  const loginHref = '/login?next=/papawis&amp;ref=papawis';
  let btn = '', note = '';
  const noteHtml = (lead, rest = '', check = false) => `<span class="pwx-note-line">${check ? ICON.check : ''}<b>${lead}</b>${rest}</span>`;
  if (scheduled) {
    btn = `<button class="pwx-btn" type="button" disabled>${ICON.lock}${lbl('Claim a slot')}</button>`;
    note = noteHtml(`Opens ${fmtDay(opensDay)} · 8:00 AM`);
  } else if (mySignup?.status === 'confirmed') {
    btn = cancellable
      ? `<button class="pwx-btn pwx-btn--outline" type="button" data-pwx-act="cancel" data-game="${gid}">${lbl('Cancel my spot')}</button>`
      : `<button class="pwx-btn" type="button" disabled>${ICON.lock}${lbl('Cancel my spot')}</button>`;
    note = noteHtml(`You're in · slot ${mySlot}`, cancellable ? ` · free to cancel until ${fmtDay(cutoffDate)}` : ' · cancellation closed', true);
  } else if (mySignup?.status === 'pending') {
    btn = `<a class="pwx-btn" href="/settle-balance?category=${encodeURIComponent('Papawis Deposit')}">${lbl('Submit deposit &rarr;')}</a>
      <button class="pwx-btn pwx-btn--outline" type="button" data-pwx-act="cancel" data-game="${gid}">${lbl('Leave the list')}</button>`;
    note = noteHtml("You're listed", ' · held until an admin confirms your deposit');
  } else if (mySignup?.status === 'waitlist') {
    const pos = waitlist.indexOf(mySignup) + 1;
    btn = `<button class="pwx-btn pwx-btn--outline" type="button" data-pwx-act="cancel" data-game="${gid}">${lbl('Leave the waitlist')}</button>`;
    note = noteHtml(`You're #${pos} on the waitlist`, ' · you move up on your own if someone drops', true);
  } else if (!isLoggedIn) {
    btn = `<a class="pwx-btn" href="${loginHref}">${lbl(full ? 'Join the waitlist &rarr;' : 'Claim a slot &rarr;')}</a>`;
    note = noteHtml(full ? `${waitlist.length} waiting` : `${open} slot${open === 1 ? '' : 's'} left`, ' · log in to claim');
  } else if (hasBalance) {
    btn = `<a class="pwx-btn" href="/settle-balance">${lbl('Settle my balance &rarr;')}</a>`;
    note = noteHtml('You have an unpaid Papawis game', ' · settle it to join');
  } else if (full) {
    btn = `<button class="pwx-btn" type="button" data-pwx-act="join" data-game="${gid}">${lbl('Join the waitlist &rarr;')}</button>`;
    note = noteHtml(`${waitlist.length} waiting`, ' · join and you move up if a slot opens');
  } else {
    const label = isToday ? 'Grab a last slot &rarr;' : 'Claim a slot &rarr;';
    // Inside the cutoff a claim can't be cancelled later → confirm first (dialog below).
    btn = `<button class="pwx-btn" type="button" data-pwx-act="join" data-game="${gid}"${cancellable ? '' : ` data-confirm="1" data-slot="${filled + 1}" data-max="${max}" data-when="${escHtml(isToday ? `Today${startClock(g) ? ` · ${startClock(g)}` : ''}` : `${fmtDay(g.date)}${startClock(g) ? ` · ${startClock(g)}` : ''}`)}" data-court="${escHtml(court)}" data-price="${escHtml(price)}"`}>${lbl(label)}</button>`;
    note = noteHtml(`${open} slot${open === 1 ? '' : 's'} left`, cancellable ? ` · cancel free until ${fmtDay(cutoffDate)}` : " · claims inside 3 days can't be cancelled");
  }
  const action = `<div class="pwx-action">${btn}${note}<div class="pwx-err" data-err-for="${gid}" hidden></div></div>`;

  const showTeams = full && dLeft <= CUTOFF_DAYS;
  return `<section id="pw-game-${gid}" class="pwx-run is-${kind === 'wait' ? 'wait' : 'live'}" style="--c:${st.c}" data-game-id="${gid}">
      ${countdown}
      ${banner}
      ${who}
      <div class="pwx-side">${details}${action}</div>
    </section>
    ${isLoggedIn && !scheduled ? rosterTemplate(g, pub, { showTeams }) : ''}`;
}

// ── nothing posted: the last run, quietly ───────────────────────────────────
function emptyBlock(last, signups, ctx) {
  if (!last) {
    return `<div class="pwx-empty-solo">
      <h3 class="pwx-headline">No run posted yet</h3>
      <p class="pwx-body">The next Papawis goes up a few days before. Keep game alerts on and you'll get an email the moment sign-ups open.</p>
    </div>`;
  }
  const confirmed = signups.filter(s => s.status === 'confirmed');
  const kind = pastKind(last);
  const st = ST[kind];
  const light = confirmed.filter(s => s.team === 'light').length, dark = confirmed.filter(s => s.team === 'dark').length;
  const priceTile = kind === 'played'
    ? `<span class="pwx-v">${last.price_per_player ? peso(last.price_per_player) : '—'}</span><span class="pwx-note">Charged to everyone who played</span>`
    : kind === 'cancelled'
      ? `<span class="pwx-v">Nobody charged</span><span class="pwx-note">The run was called off</span>`
      : `<span class="pwx-v pwx-v--silver">Being finalized</span><span class="pwx-note">${last.price_per_head ? `Estimate was ${peso(last.price_per_head)} · ` : ''}lands on balances when an admin closes it out</span>`;
  return `<div class="pwx-run pwx-run--empty" style="--c:${st.c}">
      <div class="pwx-banner has-photo pwx-banner--last">
        ${courtImg(last, 'pwx-banner__img')}
        <div class="pwx-banner__top">
          <span class="pwx-date">${lbl(`Last run · ${escHtml(fmtChip(last.date))}`)}</span>
          <span class="pwx-pill" style="--c:${st.c}">${svg(st.icon, 11, 2.6)}${lbl(PAST_LABEL[kind])}</span>
        </div>
        <div class="pwx-banner__body">
          <h3 class="pwx-headline">No run posted yet</h3>
          <p class="pwx-body">The next Papawis usually goes up a few days before. Keep game alerts on and you'll get an email the moment sign-ups open.</p>
          <span class="pwx-place-row"><span class="pwx-place">${ICON.pin}<span><b>${escHtml(last.location || '')}</b></span></span></span>
        </div>
      </div>
      <div class="pwx-who">
        <div class="pwx-who__head"><span class="pwx-k">${kind === 'cancelled' ? 'Who was listed' : 'Who played'} ${escHtml(fmtDay(last.date))}</span></div>
        ${faceGrid(confirmed, confirmed.length, { isLoggedIn: ctx.isLoggedIn, viewerPlayerId: ctx.viewerPlayerId, kind: 'open' })}
        ${faceStack(confirmed, confirmed.length, { kind: 'open' })}
      </div>
      <div class="pwx-side">
        <div class="pwx-details">
          <div class="pwx-row"><span class="pwx-k">Final price</span>${priceTile}</div>
          <div class="pwx-row"><span class="pwx-k">Turnout</span><span class="pwx-v">${confirmed.length} of ${last.max_slots}</span><span class="pwx-note">${(last.waitlist_count || 0) ? `Plus ${last.waitlist_count} on the waitlist` : 'No waitlist'}</span></div>
          ${light + dark ? `<div class="pwx-row"><span class="pwx-k">Teams</span><span class="pwx-v">Light ${light} · Dark ${dark}</span></div>` : ''}
        </div>
      </div>
    </div>`;
}

// ── past runs ───────────────────────────────────────────────────────────────
const PAST_LABEL = { pending: 'Price pending', played: 'Played', cancelled: 'Cancelled' };
function pastKind(g) { return g.status === 'cancelled' ? 'cancelled' : g.status === 'completed' ? 'played' : 'pending'; }

function pastCard(g, signups, { isLoggedIn, hidden }) {
  const kind = pastKind(g);
  const st = ST[kind];
  const confirmed = signups.filter(s => s.status === 'confirmed');
  const guests = confirmed.filter(s => s.guest_name).length;
  const img = courtImg(g, 'pwx-past__img');
  const kick = kind === 'cancelled' ? `${confirmed.length} were listed` : `${confirmed.length} of ${g.max_slots} played`;
  const meta = kind === 'cancelled' ? 'Called off · nobody was charged'
    : [guests ? `${guests} guest${guests === 1 ? '' : 's'}` : '', kind === 'played'
        ? (g.price_per_player ? `${peso(g.price_per_player)} a head` : '')
        : (g.price_per_head ? `est. ${peso(g.price_per_head)} a head` : 'price being set')].filter(Boolean).join(' · ');
  const cta = kind === 'cancelled' ? 'See who was listed' : 'See who played';
  return `<article id="pw-game-${escHtml(g.id)}" class="pwx-past is-${kind}${img ? ' has-photo' : ''}" style="--c:${st.c}" data-kind="${kind}"${hidden ? ' data-extra hidden' : ''}>
      ${img || `<span class="pwx-past__pin">${ICON.pinMuted}</span>`}
      <div class="pwx-past__top">
        <span class="pwx-date">${lbl(escHtml(fmtChip(g.date)))}</span>
        <span class="pwx-pill" style="--c:${st.c}">${svg(st.icon, 11, 2.8)}${lbl(PAST_LABEL[kind])}</span>
      </div>
      <div class="pwx-past__body">
        <span class="pwx-k">${escHtml(kick)}</span>
        <span class="pwx-place">${ICON.pin}<span class="pwx-past__court">${escHtml(g.location || 'Papawis')}</span></span>
        ${meta ? `<span class="pwx-past__meta">${escHtml(meta)}</span>` : ''}
        <span class="pwx-btnrow">
          ${isLoggedIn ? `<button class="pwx-sbtn" type="button" data-pwx-act="see-all" data-game="${escHtml(g.id)}">${ICON.list}${lbl(cta)}</button>` : `<a class="pwx-sbtn" href="/login?next=/papawis&amp;ref=papawis">${ICON.list}${lbl(cta)}</a>`}
          <button class="pwx-sbtn" type="button" data-pwx-act="share" data-url="/papawis#pw-game-${escHtml(g.id)}" data-title="${escHtml(g.title || 'Papawis')}">${ICON.share}${lbl('Share')}</button>
        </span>
      </div>
    </article>`;
}

const PAST_SHOWN = 8;

// ── page ────────────────────────────────────────────────────────────────────
export function papawisPage({ games = [], signupsByGame = {}, viewerPlayerId = null, viewer = null, isLoggedIn = false, hasBalance = false, summary = null, isAdmin = false, alertsOn = null } = {}) {
  const ctx = { isLoggedIn, viewerPlayerId, hasBalance, alertsOn };
  const key = g => `${g.date}T${g.start_time || '00:00'}`;
  const upcoming = games.filter(g => g.status === 'open' && daysUntil(g.date) >= 0).sort((a, b) => key(a) < key(b) ? -1 : 1);
  const past = games.filter(g => !upcoming.includes(g)).sort((a, b) => key(a) < key(b) ? 1 : -1);
  const sigs = g => signupsByGame[g.id] || [];

  const runs = upcoming.length
    ? upcoming.map((g, i) => runBlock(g, sigs(g), ctx, { first: i === 0, summary, isAdmin })).join('')
    : emptyBlock(past[0] || null, past[0] ? sigs(past[0]) : [], ctx);

  const played = past.filter(g => g.status === 'completed').length;
  const cancelled = past.filter(g => g.status === 'cancelled').length;
  const pastCards = past.map((g, i) => pastCard(g, sigs(g), { isLoggedIn, hidden: i >= PAST_SHOWN })).join('');
  const pastTemplates = isLoggedIn ? past.map(g => rosterTemplate(g, sigs(g), { showTeams: false })).join('') : '';

  const alertsBtn = alertsOn === null ? ''
    : `<button class="pwx-sbtn pwx-alerts" type="button" data-pwx-act="alerts" data-on="${alertsOn ? '1' : '0'}" aria-pressed="${alertsOn ? 'true' : 'false'}">${ICON.bell}${lbl(alertsOn ? 'Game alerts: on' : 'Game alerts: off')}</button>`;

  return `<div class="page-content pwx">
    <header class="pwx-head">
      <div class="pwx-head__title">
        <span class="pwx-kicker">Pickup games</span>
        <h1>Papawis</h1>
      </div>
      ${alertsBtn}
    </header>
    <p class="pwx-desc">Pickup runs in Makati, Mandaluyong and Pasig, with limited slots. First come, first served. Questions? <a href="https://m.me/wkndbasketball" target="_blank" rel="noopener" data-cta="papawis-messenger">Message us on Messenger</a>.</p>

    <div class="pwx-runs">${runs}</div>

    ${past.length ? `<section class="pwx-past-sec">
      <div class="section-header"><h2>Past runs<span class="section-header__sub">${played} played${cancelled ? ` · ${cancelled} cancelled` : ''}</span></h2></div>
      <p class="pwx-desc pwx-desc--sec">Every run so far, newest first. Open one to see who played, the teams and what everyone paid.</p>
      <div class="pwx-filters" role="group" aria-label="Filter past runs">
        <button class="pwx-fpill is-on" type="button" data-pwx-act="filter" data-f="all" aria-pressed="true">${lbl('All')}</button>
        <button class="pwx-fpill" type="button" data-pwx-act="filter" data-f="played" aria-pressed="false">${lbl('Played')}</button>
        ${cancelled ? `<button class="pwx-fpill" type="button" data-pwx-act="filter" data-f="cancelled" aria-pressed="false">${lbl('Cancelled')}</button>` : ''}
      </div>
      <div class="pwx-past-grid">${pastCards}</div>
      ${past.length > PAST_SHOWN ? `<button class="pwx-sbtn pwx-more" type="button" data-pwx-act="more">${lbl(`Show all ${past.length} runs`)}</button>` : ''}
    </section>` : ''}
  </div>
  ${pastTemplates}

  <div class="pw-modal-backdrop" id="pw-modal-backdrop" hidden>
    <div class="pw-modal" role="dialog" aria-modal="true" aria-labelledby="pw-modal-title">
      <div class="pw-modal-header"><span id="pw-modal-title">Players</span><button class="pw-modal-close" id="pw-modal-close" aria-label="Close">✕</button></div>
      <div class="pw-modal-body" id="pw-modal-body"></div>
    </div>
  </div>

  <div class="pwx-cf-back" id="pwx-cf" hidden>
    <div class="pwx-cf" role="dialog" aria-modal="true" aria-labelledby="pwx-cf-title">
      <span class="pwx-cf__icon">${ICON.lock}</span>
      <h3 id="pwx-cf-title">Grab this slot for good?</h3>
      <p>It's inside the ${CUTOFF_DAYS}-day window, so <b>you can't cancel once you claim</b>. Your share of the court and ref, about <b class="pwx-amber" id="pwx-cf-price"></b>, goes on your balance after the game.</p>
      <div class="pwx-cf__game">${ICON.pin}<span><b id="pwx-cf-when"></b> · <span id="pwx-cf-court"></span> · slot <span id="pwx-cf-slot"></span></span></div>
      <div class="pwx-cf__btns">
        <button class="pwx-btn pwx-btn--outline" type="button" id="pwx-cf-no">${lbl('Not now')}</button>
        <button class="pwx-btn" type="button" id="pwx-cf-yes">${lbl("Yes, I'm playing")}</button>
      </div>
    </div>
  </div>
  ${papawisScript(viewer)}`;
}

function papawisScript(viewer) {
  const me = viewer ? JSON.stringify({ id: viewer.id, ini: initials(viewer.name), color: teamColor(viewer.teamName) }) : 'null';
  return `<script>
(function () {
  var ME = ${me.replace(/</g, '\\u003c')};
  var pad = function (n) { return String(n).padStart(2, '0'); };

  // countdowns
  var cds = document.querySelectorAll('[data-cd-target]');
  function tick() {
    var now = Date.now();
    cds.forEach(function (el) {
      var left = Number(el.dataset.cdTarget) - now;
      if (left <= 0) {
        if (el.dataset.cdKind === 'open' && !el.dataset.done) { el.dataset.done = '1'; location.reload(); }
        left = 0;
      }
      var t = Math.floor(left / 1000);
      var v = { d: Math.floor(t / 86400), h: Math.floor(t % 86400 / 3600), m: Math.floor(t % 3600 / 60), s: t % 60 };
      el.querySelectorAll('[data-u]').forEach(function (b) { b.textContent = pad(v[b.dataset.u]); });
    });
  }
  if (cds.length) { tick(); setInterval(tick, 1000); }

  function post(url, body) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong.'); return j; }); });
  }
  function showErr(gid, msg) { var e = document.querySelector('.pwx-err[data-err-for="' + gid + '"]'); if (e) { e.textContent = msg; e.hidden = false; } }
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Claim: your face pops into the next open slot, then the page reloads with the real state.
  function popIn(gid) {
    if (!ME) return;
    var run = document.getElementById('pw-game-' + gid);
    if (!run) return;
    var cell = run.querySelector('.pwx-faces [data-open-slot]');
    if (cell) {
      cell.className = 'pwx-face is-me';
      cell.removeAttribute('data-open-slot');
      cell.innerHTML = '<div class="pwx-av pwx-pop-in" style="border-color:' + ME.color + '"><span class="font-condensed">' + ME.ini + '</span><img src="/api/player/' + encodeURIComponent(ME.id) + '/photo?w=96" alt="" onerror="this.style.display=\\'none\\'"></div><span class="pwx-face__name pwx-pop-in">You</span>';
    }
    var s = run.querySelector('.pwx-stack [data-open-slot]');
    if (s) { s.className = 'av-stack__av av-stack__av--me pwx-pop-in'; s.textContent = ME.ini; s.removeAttribute('data-open-slot'); }
  }
  function popOut(gid) {
    var run = document.getElementById('pw-game-' + gid);
    if (!run) return;
    run.querySelectorAll('.pwx-face.is-me .pwx-av, .pwx-face.is-me .pwx-face__name').forEach(function (n) { n.classList.add('pwx-pop-out'); });
  }
  function join(btn) {
    var gid = btn.dataset.game;
    btn.disabled = true;
    post('/papawis/' + encodeURIComponent(gid) + '/join')
      .then(function () { popIn(gid); setTimeout(function () { location.reload(); }, reduce ? 0 : 750); })
      .catch(function (e) { btn.disabled = false; showErr(gid, e.message); });
  }

  // can't-cancel confirmation
  var cf = document.getElementById('pwx-cf'), cfBtn = null;
  function openCf(btn) {
    cfBtn = btn;
    document.getElementById('pwx-cf-price').textContent = btn.dataset.price;
    document.getElementById('pwx-cf-when').textContent = btn.dataset.when;
    document.getElementById('pwx-cf-court').textContent = btn.dataset.court;
    document.getElementById('pwx-cf-slot').textContent = btn.dataset.slot + ' of ' + btn.dataset.max;
    cf.hidden = false;
    document.getElementById('pwx-cf-no').focus();
  }
  function closeCf() { cf.hidden = true; if (cfBtn) cfBtn.focus(); cfBtn = null; }
  document.getElementById('pwx-cf-no').addEventListener('click', closeCf);
  document.getElementById('pwx-cf-yes').addEventListener('click', function () { var b = cfBtn; cf.hidden = true; cfBtn = null; if (b) join(b); });
  cf.addEventListener('click', function (e) { if (e.target === cf) closeCf(); });

  // roster dialog
  var mb = document.getElementById('pw-modal-backdrop');
  function closeModal() { mb.hidden = true; }
  document.getElementById('pw-modal-close').addEventListener('click', closeModal);
  mb.addEventListener('click', function (e) { if (e.target === mb) closeModal(); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!mb.hidden) closeModal();
    if (!cf.hidden) closeCf();
  });

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-pwx-act]');
    if (!btn) return;
    var act = btn.dataset.pwxAct, gid = btn.dataset.game;
    if (act === 'join') {
      if (btn.dataset.confirm) openCf(btn); else join(btn);
    } else if (act === 'cancel') {
      if (!confirm('Cancel your spot for this run?')) return;
      btn.disabled = true;
      post('/papawis/' + encodeURIComponent(gid) + '/cancel')
        .then(function () { popOut(gid); setTimeout(function () { location.reload(); }, reduce ? 0 : 400); })
        .catch(function (err) { btn.disabled = false; showErr(gid, err.message); });
    } else if (act === 'see-all') {
      var tpl = document.querySelector('template[data-roster-tpl="' + gid + '"]');
      if (!tpl) return;
      document.getElementById('pw-modal-title').textContent = tpl.dataset.title;
      var body = document.getElementById('pw-modal-body');
      body.innerHTML = '';
      body.appendChild(tpl.content.cloneNode(true));
      mb.hidden = false;
      fetch('/papawis/' + encodeURIComponent(gid) + '/viewed', { method: 'POST' }).catch(function () {});
    } else if (act === 'share') {
      var url = location.origin + btn.dataset.url;
      if (navigator.share) { navigator.share({ title: btn.dataset.title, url: url }).catch(function () {}); }
      else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () { window.wkndCopied(btn); });
      }
    } else if (act === 'alerts') {
      var on = btn.dataset.on !== '1';
      btn.disabled = true;
      post('/me/papawis-emails', { on: on })
        .then(function () {
          document.querySelectorAll('[data-pwx-act="alerts"]').forEach(function (b) {
            b.dataset.on = on ? '1' : '0';
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
            var l = b.querySelector('.pwx-lbl');
            if (b.classList.contains('pwx-alerts')) l.textContent = on ? 'Game alerts: on' : 'Game alerts: off';
            else l.textContent = on ? 'Alerts on' : 'Alert me';
          });
        })
        .catch(function (err) { alert(err.message); })
        .then(function () { btn.disabled = false; });
    } else if (act === 'regen') {
      btn.disabled = true; btn.querySelector('.pwx-lbl').textContent = 'Writing…';
      post('/admin/papawis-summary/regenerate')
        .then(function () { location.reload(); })
        .catch(function (err) { alert(err.message); btn.disabled = false; btn.querySelector('.pwx-lbl').textContent = 'Regenerate'; });
    } else if (act === 'filter') {
      var f = btn.dataset.f;
      document.querySelectorAll('.pwx-fpill').forEach(function (p) { var on = p === btn; p.classList.toggle('is-on', on); p.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      var showAll = document.querySelector('.pwx-past-grid').dataset.all === '1';
      document.querySelectorAll('.pwx-past').forEach(function (c) {
        var match = f === 'all' || (f === 'cancelled' ? c.dataset.kind === 'cancelled' : c.dataset.kind !== 'cancelled');
        c.hidden = !match || (f === 'all' && !showAll && c.hasAttribute('data-extra'));
      });
    } else if (act === 'more') {
      document.querySelector('.pwx-past-grid').dataset.all = '1';
      document.querySelectorAll('.pwx-past[data-extra]').forEach(function (c) { c.hidden = false; });
      btn.remove();
    }
  });
})();
</script>`;
}
