import { escHtml, pageHeader } from './layout.js';
import { playerLink, playerAvatar, teamColor, formatTimeRange, manilaTodayStr, papawisSignupOpensAtMs, isPapawisSignupOpenNow, initials } from './utils.js';

// Capped low enough that avatars + the "+N" bubble always fit inside the card on a
// narrow phone width — MAX_AVATARS=12 used to run past the card's overflow:hidden edge
// on a full 16+ roster, clipping the bubble off-screen instead of showing it.
const MAX_AVATARS = 7;
const PAD_TO_COUNT = 5;

export const CUTOFF_DAYS = 3;

function fmtDate(d) {
  return d
    ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : '—';
}

function daysUntil(dateStr) {
  const today = new Date(manilaTodayStr() + 'T00:00:00');
  const game  = new Date(dateStr + 'T00:00:00');
  return Math.round((game - today) / 86400000);
}

// A game can be created far ahead of time with sign-ups deliberately held back — see
// open_days_before on papawis_games — so it's visible/informational but not joinable
// until 8AM Manila on that day. Unset = always open once status is 'open'.
const signupOpenNow = isPapawisSignupOpenNow;

const ICON_LOCK = `<svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6.5" width="8" height="6" rx="1"/><path d="M4.5 6.5V4.5a2.5 2.5 0 0 1 5 0v2"/></svg>`;

// Guests have no player record of their own — their signup's player_id is the sponsor
// who's paying, not who's actually playing, so showing that player's photo/team color
// on a guest's row would misrepresent whose avatar it is. A plain initials badge avoids
// that without needing a fake photo lookup.
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
// Just the very first word — "Mejari" not "Mejari GARGANTA", and no "guest of ..." tag —
// used on mobile for the LIGHT/DARK team table only, where 5 columns packed into a phone
// width leaves no room for a full name. firstNameOf() already strips the last name; this
// additionally drops any middle name so it's a single word either way. displayPlayerName
// (called inside playerLink) passes a comma-less string straight through unchanged, so
// handing it an already-shortened first name here is safe.
function rosterShortNameHtml(s) {
  const raw = s.guest_name ? s.guest_name : firstNameOf(s.player_name);
  const firstWord = String(raw).trim().split(/\s+/)[0] || raw;
  return s.guest_name ? escHtml(firstWord) : playerLink(s.player_id, firstWord, { className: 'pw-roster-link' });
}

// Detailed numbered breakdown (confirmed + waitlist) — used inside the "see all" modal,
// for the flat (non-team) case only. Number, Avatar, Name — the team table (light vs
// dark) has its own different column order, see teamMatchRow below.
function rosterRow(s, i) {
  return `<tr>
    <td class="pw-roster-table__num">${i + 1}</td>
    <td class="pw-roster-table__avatar">${rosterAvatarHtml(s)}</td>
    <td class="pw-roster-table__name">${rosterNameHtml(s)}</td>
  </tr>`;
}

function rosterTable(rows) {
  return `<div class="pw-roster-table-wrap"><table class="pw-roster-table"><tbody>${rows.map(rosterRow).join('')}</tbody></table></div>`;
}

// Single shared table once teams are revealed — one number in the middle per row, pairing
// the Nth Light player against the Nth Dark player: Name (light) · Avatar (light) · # ·
// Avatar (dark) · Name (dark). Squad sizes don't have to match (a manual drag/drop can
// leave them uneven), so a row with no counterpart on one side just renders blank cells
// there rather than misaligning everything below it.
function teamMatchNameCell(row) {
  if (!row) return '';
  return `<span class="pw-team-row__name-full">${rosterNameHtml(row)}</span><span class="pw-team-row__name-short">${rosterShortNameHtml(row)}</span>`;
}

function teamMatchRow(lightRow, darkRow) {
  return `<tr>
    <td class="pw-team-row__name pw-team-row__name--light">${teamMatchNameCell(lightRow)}</td>
    <td class="pw-team-row__avatar pw-team-row__avatar--light">${lightRow ? rosterAvatarHtml(lightRow) : ''}</td>
    <td class="pw-team-row__avatar pw-team-row__avatar--dark">${darkRow ? rosterAvatarHtml(darkRow) : ''}</td>
    <td class="pw-team-row__name pw-team-row__name--dark">${teamMatchNameCell(darkRow)}</td>
  </tr>`;
}

function teamMatchTable(lightRows, darkRows) {
  const max = Math.max(lightRows.length, darkRows.length);
  const rows = [];
  for (let i = 0; i < max; i++) rows.push(teamMatchRow(lightRows[i] || null, darkRows[i] || null));
  // No colspan here on purpose: table-layout:fixed takes its column widths from the FIRST
  // row alone, and a colspan="2" cell splits its width across two columns ambiguously
  // (browsers don't agree on how) — that's what was actually causing the widths to drift,
  // not the padding math. Four real header cells, one per body column, makes the mapping
  // exact — the empty ones just carry the width, no visible content needed.
  // Widths live on pw-team-row__name--light/--dark and pw-team-row__avatar — reused as-is
  // on these header cells (not a parallel set of pw-team-header--* width classes)
  // specifically so the header and body columns can never drift apart; pw-team-header
  // only carries the header's own text styling.
  return `<p class="pw-team-note">🎽 Bring the right color — Light wears a light shirt, Dark wears a dark one.</p>
  <div class="pw-team-table-wrap">
    <table class="pw-team-table">
      <thead><tr>
        <th class="pw-team-header pw-team-header--light pw-team-row__name--light">Light</th>
        <th class="pw-team-header pw-team-row__avatar pw-team-row__avatar--light"></th>
        <th class="pw-team-header pw-team-row__avatar pw-team-row__avatar--dark"></th>
        <th class="pw-team-header pw-team-header--dark pw-team-row__name--dark">Dark</th>
      </tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>
  </div>`;
}

function rosterModalBody(signups, { showTeams = false } = {}) {
  const confirmed = signups.filter(s => s.status === 'confirmed');
  // 'pending' (probationary, held for deposit confirmation) reads to the public as just
  // another kind of waiting — see joinPapawisGame() in lib/portal-db.js.
  const waitlist  = signups.filter(s => s.status === 'waitlist' || s.status === 'pending');
  const hasTeams  = showTeams && confirmed.some(s => s.team === 'light' || s.team === 'dark');

  const confirmedHtml = !confirmed.length
    ? `<p class="pw-roster-empty">No one's listed yet — be the first.</p>`
    : hasTeams
      ? teamMatchTable(confirmed.filter(s => s.team === 'light'), confirmed.filter(s => s.team === 'dark'))
      : rosterTable(confirmed);

  // Once teams are shown, the waitlist isn't on either side yet — a one-line "Waitlist:
  // A, B, C" reads better there than the full avatar table, which is really about who's
  // playing on which side. Plain names, no guest tag, to keep it a single flowing line.
  const waitlistName = (s) => s.guest_name ? escHtml(s.guest_name) : playerLink(s.player_id, s.player_name, { className: 'pw-roster-link' });
  const waitlistHtml = !waitlist.length
    ? ''
    : hasTeams
      ? `<p class="pw-waitlist-text">Waitlist: ${waitlist.map(waitlistName).join(', ')}</p>`
      : `<div class="pw-waitlist">
          <span class="pw-waitlist-label">Waitlist</span>
          ${rosterTable(waitlist)}
        </div>`;

  return confirmedHtml + waitlistHtml;
}

// "LASTNAME, Firstname Middlename" → "Firstname Middlename" (everything before the last name).
function firstNameOf(raw) {
  const str = String(raw || '').trim();
  const comma = str.indexOf(',');
  return comma === -1 ? (str.split(' ')[0] || str) : str.slice(comma + 1).trim();
}

// Overlapping avatar stack (confirmed players only), capped with a "+N" overflow bubble,
// plus a comma-separated first-name line underneath. Logged-out viewers get a short
// 3-name teaser (first names only, no links); logged-in viewers get the full list.
// Games with a thin roster get padded with blank placeholder slots (never a specific fake
// name/photo) so the card doesn't look dead/broken and lines up visually with fuller ones —
// for open games it's also a gentle "there's room" nudge; for cancelled ones it's purely
// layout consistency (real listed players still show for the record either way).
function rosterSummary(signups, game, { isLoggedIn }) {
  const confirmed = signups.filter(s => s.status === 'confirmed');
  const isOpen = game.status === 'open';
  const isCancelled = game.status === 'cancelled';

  const shown    = confirmed.slice(0, MAX_AVATARS);
  const overflow = confirmed.length - shown.length;

  // Guests don't have their own player record/photo — they show as another copy of the
  // sponsoring player's avatar (the person actually vouching for/paying for that slot).
  const realAvatars = shown.map(s =>
    playerAvatar(s.player_id, s.player_name, teamColor(s.team_name), { className: 'pw-avatar', link: isLoggedIn && !s.guest_name })
  ).join('');

  const padTarget = Math.min(PAD_TO_COUNT, game.max_slots);
  const padCount  = (isOpen || isCancelled) && confirmed.length < padTarget ? padTarget - confirmed.length : 0;
  const padAvatars = `<span class="pw-avatar pw-avatar--empty" aria-hidden="true"></span>`.repeat(padCount);

  const moreBubble = overflow > 0 ? `<span class="pw-avatar pw-avatar--more">+${overflow}</span>` : '';
  const avatarStack = `<div class="pw-avatar-stack">${realAvatars}${padAvatars}${moreBubble}</div>`;

  // Only reachable if max_slots is 0 — padding otherwise always covers open/cancelled+empty.
  const emptyText = isCancelled ? '' : `<p class="pw-roster-empty">No one's listed yet — be the first.</p>`;
  const seeAllLabel = game.status === 'completed' ? 'See who played'
    : isCancelled ? 'See who was listed'
    : 'See all players';
  const loginLabel = game.status === 'completed' ? "Log in to see who played"
    : isCancelled ? 'Log in to see who was listed'
    : "Log in to see who's playing";

  if (!isLoggedIn) {
    if (!confirmed.length && !padCount) return emptyText;
    // Teaser: first few first names only (no last names, no profile links) — enough to
    // feel like real people without giving away the full roster ahead of login.
    const previewCount = Math.min(3, confirmed.length);
    const previewNames = confirmed.slice(0, previewCount).map(s => firstNameOf(s.guest_name || s.player_name));
    const previewRest = confirmed.length - previewCount;
    const previewText = previewNames.length
      ? `${previewNames.join(', ')}${previewRest > 0 ? ` & ${previewRest} more` : ''}`
      : '';
    return `<div class="pw-roster-row">
        ${avatarStack}
        ${previewText ? `<p class="pw-names">${escHtml(previewText)}</p>` : ''}
      </div>
      <a href="/login?next=/papawis&ref=papawis" class="pw-btn pw-btn--ghost">${escHtml(loginLabel)}</a>`;
  }

  if (!confirmed.length && !padCount) {
    return emptyText;
  }
  // Padded-but-empty: the dashed placeholder slots already say "empty," no redundant text needed.
  if (!confirmed.length) {
    return `<div class="pw-roster-row">${avatarStack}</div>`;
  }

  const names = confirmed.map(s => s.guest_name ? `${firstNameOf(s.guest_name)} (guest)` : firstNameOf(s.player_name)).join(', ');

  return `<div class="pw-roster-row">
      ${avatarStack}
      <p class="pw-names">${escHtml(names)}</p>
    </div>
    <button class="pw-btn pw-btn--ghost" data-action="see-all" data-game="${escHtml(game.id)}">${escHtml(seeAllLabel)}</button>`;
}

function gameCard(game, signups, { viewerPlayerId, viewerSignup, hasBalance, isLoggedIn }) {
  const isOpen      = game.status === 'open';
  const isCompleted = game.status === 'completed';
  const isCancelled = game.status === 'cancelled';
  const dLeft        = daysUntil(game.date);
  const cancellable  = dLeft >= CUTOFF_DAYS;
  // Day-granularity, same as the cancel cutoff below — once the calendar date is behind
  // today's, sign-ups auto-close even if an admin never manually completed/cancelled it.
  // Mirrors isPapawisGamePassed() in lib/portal-db.js, the actual join-gate the join
  // endpoint enforces server-side; this is just the display-side version of that same rule.
  const hasPassed    = dLeft < 0;
  // Held-back sign-ups only hide the roster for an *upcoming* game still waiting on its
  // open date — never for a cancelled or completed one, where isOpen is already false and
  // the point is the opposite: logged-in users should still see who was/is listed for the
  // record. Admin can pre-load players/guests behind the scenes either way; the public
  // just doesn't see them (or the real slot count) until an upcoming game's window opens.
  const isScheduledClosed = isOpen && !signupOpenNow(game);
  // Opened on schedule, but the game date has since gone by and nobody closed it out —
  // distinct from isScheduledClosed (waiting to open) even though both mean "not joinable
  // right now," since the messaging/badge for each is opposite (not open yet vs. already over).
  const isPassedClosed = isOpen && !isScheduledClosed && hasPassed;
  const signupOpen   = isOpen && signupOpenNow(game) && !hasPassed;
  const publicSignups   = isScheduledClosed ? [] : signups;
  const confirmedCount  = isScheduledClosed ? 0 : (game.confirmed_count || 0);
  const waitlistCount   = isScheduledClosed ? 0 : (game.waitlist_count  || 0);
  const effectiveViewerSignup = isScheduledClosed ? null : viewerSignup;
  const isFull = confirmedCount >= game.max_slots;
  // Confirmed viewer gets the card itself colored instead of a "You're in" text line —
  // takes priority over the generic "open" amber treatment since it's more personally
  // relevant once you're actually in.
  const isJoined = isOpen && effectiveViewerSignup?.status === 'confirmed';
  // A cancelled game whose date hasn't happened yet needs to stand out — players might
  // still be expecting to show up. Once the date's passed it's just historical record.
  const cancelledUpcoming = isCancelled && dLeft >= 0;

  const statusBadge = isCancelled
    ? `<span class="pw-badge pw-badge--cancelled">Cancelled</span>`
    : isCompleted
      ? `<span class="pw-badge pw-badge--muted">Played</span>`
      : isScheduledClosed
        ? `<span class="pw-badge pw-badge--muted">Scheduled</span>`
        : isPassedClosed
          ? `<span class="pw-badge pw-badge--muted">Closed</span>`
          : isFull
            ? `<span class="pw-badge pw-badge--full">Full</span>`
            : `<span class="pw-badge pw-badge--open">Open</span>`;

  let actionHtml = '';
  if (isOpen) {
    if (effectiveViewerSignup) {
      if (effectiveViewerSignup.status === 'confirmed') {
        actionHtml = cancellable
          ? `<div class="pw-status-line">Cancel anytime until ${fmtDate(addDays(game.date, -CUTOFF_DAYS))}</div>
             <button class="pw-btn pw-btn--danger-ghost" data-action="cancel" data-game="${escHtml(game.id)}">Cancel my spot</button>`
          : `<button class="pw-btn pw-btn--disabled" disabled>Cancel my spot</button>
             <div class="pw-hint">${ICON_LOCK} Cancellation window closed ${CUTOFF_DAYS} days before game day — message an admin if you can't make it.</div>`;
      } else if (effectiveViewerSignup.status === 'pending') {
        actionHtml = `<div class="pw-hint pw-hint--warn">${ICON_LOCK} You're listed, but held until an admin confirms a deposit from you.</div>
          <a href="/settle-balance?category=${encodeURIComponent('Papawis Deposit')}" class="pw-btn pw-btn--primary">Submit deposit</a>
          <button class="pw-btn pw-btn--ghost" data-action="cancel" data-game="${escHtml(game.id)}">Leave list</button>`;
      } else {
        actionHtml = `<div class="pw-status-line"><span class="pw-dot"></span> You're on the waitlist — you'll be confirmed automatically if a spot opens</div>
          <button class="pw-btn pw-btn--ghost" data-action="cancel" data-game="${escHtml(game.id)}">Leave waitlist</button>`;
      }
    } else if (isScheduledClosed) {
      // Same instant (8AM Manila) that gates the actual join — see papawisSignupOpensAtMs
      // in utils.js — so the live countdown can never disagree with what the join button
      // is actually waiting for.
      const opensAtIso = new Date(papawisSignupOpensAtMs(game)).toISOString();
      actionHtml = `<button class="pw-btn pw-btn--placeholder" data-opens-at="${escHtml(opensAtIso)}" disabled>${ICON_LOCK} Opens in <span class="pw-countdown-value">…</span></button>`;
    } else if (isPassedClosed) {
      actionHtml = `<button class="pw-btn pw-btn--placeholder" disabled>Sign-ups closed</button>`;
    } else if (!isLoggedIn) {
      actionHtml = `<a href="/login?next=/papawis&ref=papawis" class="pw-btn pw-btn--primary">Log in to join</a>`;
    } else if (hasBalance) {
      actionHtml = `<div class="pw-hint pw-hint--warn">${ICON_LOCK} You have an unpaid Papawis game — clear it with an admin before joining.</div>`;
    } else {
      actionHtml = isFull
        ? `<button class="pw-btn pw-btn--ghost" data-action="join" data-game="${escHtml(game.id)}">Join waitlist</button>`
        : `<button class="pw-btn pw-btn--primary" data-action="join" data-game="${escHtml(game.id)}">Join</button>`;
    }
  } else if (isCancelled) {
    actionHtml = `<button class="pw-btn pw-btn--placeholder" disabled>Cancelled</button>`;
  } else if (isCompleted) {
    actionHtml = `<button class="pw-btn pw-btn--placeholder" disabled>Game completed</button>`;
  }

  const cardStateClass = isJoined ? ' pw-card--joined' : signupOpen ? ' pw-card--open' : '';
  // Court's photo, matched by (free-text) location name server-side — see the /papawis route.
  // No match, or a matched court with nothing uploaded yet, falls back to a dark map banner
  // centered on the location instead (also geocoded server-side, best-effort — a location
  // not geocoded yet just means no banner at all, same as the old behavior). Either way, once
  // there's a banner the status badge/location move into it rather than sitting in the
  // titlebar/meta line.
  const hasPhoto = !!game.court_image_id;
  const hasMap = !hasPhoto && !!game.has_map;
  const hasBanner = hasPhoto || hasMap;
  const bannerImg = hasPhoto
    ? `<img src="/api/papawis-court/${escHtml(game.court_image_id)}/photo" alt="" loading="lazy">`
    : hasMap
      ? `<img class="pw-photo-map-img" src="/api/papawis-map/photo?loc=${encodeURIComponent(game.location)}" alt="" loading="lazy">
        <span class="pw-photo-map-pin"><svg width="26" height="26" viewBox="0 0 14 14" fill="currentColor"><path d="M7 13S12 8.5 12 5.5A5 5 0 0 0 2 5.5C2 8.5 7 13 7 13Z"/><circle cx="7" cy="5.5" r="1.9" fill="#0c0f16"/></svg></span>`
      : '';
  const photoBanner = hasBanner
    ? `<div class="pw-photo${hasMap ? ' pw-photo--map' : ''}">
        ${bannerImg}
        <div class="pw-photo-scrim"></div>
        <span class="pw-photo-status">${statusBadge}</span>
        ${game.location ? `<div class="pw-photo-loc"><svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 13S12 8.5 12 5.5A5 5 0 0 0 2 5.5C2 8.5 7 13 7 13Z"/><circle cx="7" cy="5.5" r="1.7"/></svg><span class="pw-photo-loc-text">${escHtml(game.location)}</span></div>` : ''}
      </div>`
    : '';
  return `<article id="pw-game-${escHtml(game.id)}" class="pw-card${cardStateClass}${cancelledUpcoming ? ' pw-card--cancelled-alert' : ''}" data-game-id="${escHtml(game.id)}">
    ${photoBanner}
    <div class="pw-card-titlebar">
      <div class="pw-card-name">${escHtml(game.title || 'Papawis')}</div>
      ${hasBanner ? '' : statusBadge}
    </div>
    <div class="pw-card-body">
      <div class="pw-card-meta">${fmtDate(game.date)}${(() => { const t = formatTimeRange(game.start_time, game.end_time) || game.time_label; return t ? ` · ${escHtml(t)}` : ''; })()}${(!hasBanner && game.location) ? ` · ${escHtml(game.location)}` : ''}</div>

      <div class="pw-meter-row">
        <span class="pw-meter-label">SLOTS</span>
        <span class="pw-meter-count">${confirmedCount}<small>/${game.max_slots}</small>${waitlistCount ? `<span class="pw-meter-wl"> · ${waitlistCount} waiting</span>` : ''}</span>
      </div>
      <div class="pw-meter${isFull ? ' pw-meter--full' : ''}"><span style="width:${Math.min(100, Math.round(confirmedCount / game.max_slots * 100))}%"></span></div>

      <div class="pw-roster-wrap">${rosterSummary(publicSignups, game, { isLoggedIn })}</div>

      <div class="pw-foot">${actionHtml}</div>

      <div class="pw-err" data-err-for="${escHtml(game.id)}" hidden></div>
    </div>
  </article>
  ${isLoggedIn ? `<template data-roster-tpl="${escHtml(game.id)}" data-title="${escHtml(game.title || 'Papawis')}">${rosterModalBody(publicSignups, { showTeams: isFull && dLeft <= CUTOFF_DAYS })}</template>` : ''}`;
}

function addDays(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

// Four urgency tiers rather than pure chronology. A flat "everything else, newest-date-
// first" sort (the original version of this function) put Scheduled games further in the
// future ABOVE ones opening sooner, since future date strings sort lexicographically
// larger than nearer ones — backwards from what's actually useful. Tiers, each sorted
// within itself:
//   1. Joinable now (Open/Full badge) — soonest first. The thing a visitor can act on.
//   2. Cancelled but upcoming (the red-alert cards) — soonest first. Not actionable, but
//      urgent: players may still be expecting to show up, so this outranks Scheduled even
//      though Scheduled is otherwise "more upcoming."
//   3. Scheduled (signup window hasn't opened yet) — soonest first, so the next game to
//      open sits closest to the top.
//   4. Historical (Completed, past Cancelled, and the rare stale-Closed edge case where
//      signup was open but nobody closed it after the date passed) — newest first, same
//      direction as the original single "rest" bucket.
function sortGames(games) {
  const keyOf = (g) => `${g.date}T${g.start_time || '00:00'}`;
  const soonestFirst = (a, b) => { const ka = keyOf(a), kb = keyOf(b); return ka < kb ? -1 : ka > kb ? 1 : 0; };
  const newestFirst  = (a, b) => { const ka = keyOf(a), kb = keyOf(b); return ka < kb ? 1 : ka > kb ? -1 : 0; };

  const isJoinable          = (g) => g.status === 'open' && signupOpenNow(g) && daysUntil(g.date) >= 0;
  const isCancelledUpcoming = (g) => g.status === 'cancelled' && daysUntil(g.date) >= 0;
  const isScheduled         = (g) => g.status === 'open' && !signupOpenNow(g);

  const joinable          = games.filter(isJoinable).sort(soonestFirst);
  const cancelledUpcoming = games.filter(isCancelledUpcoming).sort(soonestFirst);
  const scheduled         = games.filter(isScheduled).sort(soonestFirst);
  const historical         = games
    .filter(g => !isJoinable(g) && !isCancelledUpcoming(g) && !isScheduled(g))
    .sort(newestFirst);

  return [...joinable, ...cancelledUpcoming, ...scheduled, ...historical];
}

export function papawisPage({ games = [], signupsByGame = {}, viewerPlayerId = null, isLoggedIn = false, hasBalance = false } = {}) {
  const cards = sortGames(games).map(g => {
    const signups = signupsByGame[g.id] || [];
    const viewerSignup = viewerPlayerId ? signups.find(s => s.player_id === viewerPlayerId && s.status !== 'cancelled') : null;
    return gameCard(g, signups, { viewerPlayerId, viewerSignup, hasBalance, isLoggedIn });
  }).join('');

  return `<div class="page-content">
    ${pageHeader({ title: 'Papawis', description: 'Pickup games with limited slots. First come, first served — everyone after the cap lands on the waitlist and gets bumped in automatically if a spot opens.' })}

    ${games.length ? `<div class="pw-grid">${cards}</div>` : ''}
  </div>

  <div class="pw-modal-backdrop" id="pw-modal-backdrop" hidden>
    <div class="pw-modal">
      <div class="pw-modal-header">
        <span id="pw-modal-title">Players</span>
        <button class="pw-modal-close" id="pw-modal-close" aria-label="Close">✕</button>
      </div>
      <div class="pw-modal-body" id="pw-modal-body"></div>
    </div>
  </div>

<style>
/* auto-fill (not auto-fit) keeps every column's width fixed across the whole grid, so a
   lone card on a trailing row sits at the same width as its siblings above instead of
   stretching to fill the leftover row space — the row just ends early instead. */
.pw-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-bottom: 32px; }
@media (max-width: 640px) {
  /* Force a single full-width column — auto-fill's 280px minimum can otherwise still
     fit 2 narrow columns on phablet-width screens, and max-width caps a lone column
     short of the full available width. */
  .pw-grid { grid-template-columns: 1fr; }
  .pw-card { max-width: none; }
}

.pw-card { display: flex; flex-direction: column; max-width: 420px; background: var(--surface); border: 1px solid var(--border); border-radius: 15px; overflow: hidden; }
.pw-card--open { border-color: rgba(245,147,50,.35); box-shadow: 0 0 0 1px rgba(245,147,50,.06), 0 12px 32px -12px rgba(245,147,50,.2); }
.pw-card--joined { border-color: rgba(52,211,153,.4); box-shadow: 0 0 0 1px rgba(52,211,153,.08), 0 12px 32px -12px rgba(52,211,153,.25); }
.pw-card--cancelled-alert { border-color: rgba(248,113,113,.4); box-shadow: 0 0 0 1px rgba(248,113,113,.08), 0 12px 32px -12px rgba(248,113,113,.25); }
.pw-photo { position: relative; height: 140px; flex-shrink: 0; overflow: hidden; background: linear-gradient(155deg, #2a3346 0%, #171d29 46%, #0c0f16 100%); }
.pw-photo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.pw-photo-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(6,9,16,0) 45%, rgba(6,9,16,.55) 100%); }
.pw-photo-status { position: absolute; top: 10px; right: 10px; filter: drop-shadow(0 1px 4px rgba(0,0,0,.5)); }
.pw-photo-loc { position: absolute; left: 14px; bottom: 10px; right: 14px; display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: #f4f6f9; text-shadow: 0 1px 3px rgba(0,0,0,.6); }
.pw-photo-loc svg { flex-shrink: 0; opacity: .95; }
/* Default banner when no court photo is on file — a plain (light) OSM map image, inverted
   to fake a dark theme since no keyed dark-tile provider is wired up. */
.pw-photo--map .pw-photo-map-img { filter: invert(1) hue-rotate(180deg) brightness(.92) contrast(.85) saturate(.85); }
.pw-photo-map-pin { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -100%); color: var(--amber); filter: drop-shadow(0 2px 5px rgba(0,0,0,.5)); }
.pw-photo-loc-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pw-card-titlebar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 13px 18px; background: rgba(255,255,255,.03); border-bottom: 1px solid var(--border); }
.pw-card--open .pw-card-titlebar { background: rgba(245,147,50,.05); border-bottom-color: rgba(245,147,50,.2); }
.pw-card--joined .pw-card-titlebar { background: rgba(52,211,153,.06); border-bottom-color: rgba(52,211,153,.22); }
.pw-card--cancelled-alert .pw-card-titlebar { background: rgba(248,113,113,.07); border-bottom-color: rgba(248,113,113,.25); }
.pw-card-name { font-size: 15px; font-weight: 700; letter-spacing: -.005em; color: var(--text-primary); }
.pw-card-body { display: flex; flex-direction: column; gap: 12px; padding: 16px 18px 18px; }
.pw-card-meta { font-size: 12.5px; color: var(--text-muted); margin-top: -6px; }

.pw-badge { font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; padding: 3px 9px; border-radius: 99px; white-space: nowrap; }
.pw-badge--open { background: rgba(245,147,50,.12); color: var(--amber); border: 1px solid rgba(245,147,50,.3); }
.pw-badge--full { background: rgba(148,163,184,.12); color: #94a3b8; border: 1px solid rgba(148,163,184,.3); }
.pw-badge--muted { background: var(--bg); color: var(--text-muted); border: 1px solid var(--border); }
.pw-badge--cancelled { background: rgba(248,113,113,.12); color: #f87171; border: 1px solid rgba(248,113,113,.3); }

.pw-meter-row { display: flex; align-items: baseline; justify-content: space-between; }
.pw-meter-label { font-size: 10.5px; color: var(--text-muted); font-weight: 700; letter-spacing: .04em; }
.pw-meter-count { font-size: 18px; font-weight: 700; color: var(--text-primary); }
.pw-meter-count small { font-size: 11px; color: var(--text-muted); font-weight: 600; }
.pw-meter-wl { font-size: 11px; color: var(--text-muted); font-weight: 600; }
.pw-meter { height: 6px; border-radius: 99px; background: var(--bg); border: 1px solid var(--border); overflow: hidden; }
.pw-meter > span { display: block; height: 100%; background: var(--amber); border-radius: 99px; }
.pw-meter--full > span { background: #94a3b8; }

.pw-roster-wrap { border-top: 1px solid var(--border); padding-top: 12px; display: flex; flex-direction: column; gap: 10px; }
.pw-roster-empty { font-size: 12.5px; color: var(--text-muted); font-style: italic; margin: 0; }

.pw-roster-row { display: flex; align-items: center; gap: 10px; min-width: 0; }
.pw-avatar-stack { display: flex; flex-shrink: 0; }
.pw-avatar { width: 34px; height: 34px; border-radius: 50%; border: 2px solid var(--surface); flex-shrink: 0; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: rgba(255,255,255,.7); background: var(--bg); margin-left: -12px; }
.pw-avatar:first-child { margin-left: 0; }
.pw-avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.pw-avatar--more { background: var(--border); color: var(--text-muted); font-size: 11px; }
.pw-avatar--empty { background: transparent; border-style: dashed; border-color: var(--border); opacity: .5; }
.pw-names { font-size: 12.5px; color: var(--text-muted); margin: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.pw-modal-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(2,8,23,.82); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 20px; }
.pw-modal-backdrop[hidden] { display: none; }
.pw-modal { background: var(--surface); border: 1px solid var(--border); border-radius: 15px; width: 100%; max-width: 380px; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden; }
/* Wide enough for two team columns side-by-side once teams are revealed — applies to
   every roster (not just the team view) since the extra breathing room around the
   avatar+name table doesn't hurt the flat single-column case either. */
@media (min-width: 640px) { .pw-modal { max-width: 640px; } }
.pw-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--border); font-size: 14px; font-weight: 700; color: var(--text-primary); }
.pw-modal-close { background: rgba(255,255,255,.06); border: none; color: var(--text-muted); width: 26px; height: 26px; border-radius: 50%; cursor: pointer; font-size: 12px; }
.pw-modal-close:hover { color: var(--text-primary); }
.pw-modal-body { padding: 18px; overflow-y: auto; }
.pw-modal-body .pw-roster-link { color: var(--text-primary); text-decoration: none; }
.pw-modal-body .pw-roster-link:hover { color: var(--amber); }
.pw-modal-body .pw-waitlist { margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--border); }
.pw-modal-body .pw-waitlist-label { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 8px; }
.pw-waitlist-text { margin: 14px 0 0; padding-top: 12px; border-top: 1px dashed var(--border); font-size: 12px; font-style: italic; text-align: center; color: var(--text-muted); line-height: 1.5; }
.pw-roster-guest-tag { font-size: 11px; color: var(--text-muted); font-style: italic; }

/* Wrapper (not the <table> itself) owns the rounded corners + outer border — clipping a
   collapsed border-grid to a radius via the table element is unreliable across browsers,
   overflow:hidden on a plain div isn't. */
.pw-roster-table-wrap { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.pw-roster-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
/* No horizontal padding at the table level — the avatar column needs to be exactly the
   avatar's own width with nothing added around it, so horizontal spacing is opted into
   per-column below instead of inherited from a blanket rule here. */
.pw-roster-table td { padding: 7px 3.75px; vertical-align: middle; border: 1px solid var(--border); }
.pw-roster-table tr:first-child td { border-top: none; }
.pw-roster-table tr td:first-child { border-left: none; }
.pw-roster-table tr:last-child td { border-bottom: none; }
.pw-roster-table tr td:last-child { border-right: none; }
.pw-roster-table__num { width: 20px; font-size: 12px; color: var(--text-muted); text-align: right; font-variant-numeric: tabular-nums; }
.pw-roster-table__avatar { width: 30px; text-align: center; }
/* td-prefixed everywhere here to match (not lose to) the general .pw-roster-table td
   rule's specificity — a bare class alone silently loses that fight and the padding/
   border below would never actually apply, same trap the team table hit earlier. */
td.pw-roster-table__num { padding-left: 4px; padding-right: 8px; }
td.pw-roster-table__name { padding-left: 7px; padding-right: 7px; }
/* No border between the avatar and its name — the number/avatar border stays. Both sides
   of the shared edge set to none since border-collapse otherwise picks one side to win. */
td.pw-roster-table__avatar { border-right: none; }
td.pw-roster-table__name { border-left: none; }
/* line-height:1 on the container is what actually keeps the initials centered — without
   it the text inherits the page's 1.6 line-height, and flex centers that taller line box
   rather than the glyph itself, so the letters read as sitting above-center in the circle. */
.pw-roster-avatar { width: 30px; height: 30px; border-radius: 50%; border: 2px solid var(--border); flex-shrink: 0; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 10.5px; font-weight: 700; line-height: 1; color: rgba(255,255,255,.7); background: var(--bg); }
.pw-roster-avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.pw-roster-avatar--guest { border-style: dashed; }

/* One shared table once teams are revealed: Name(light) · Avatar(light) · # · Avatar(dark)
   · Name(dark). Top-to-bottom wash across the whole table — light tint at the top fading
   through the middle to a blue "dark team" tint at the bottom. */
.pw-team-table-wrap {
  border: 1px solid var(--border); border-radius: 10px; overflow: hidden;
  xbackground: linear-gradient(to bottom,
    rgba(248,250,252,.10) 0%, rgba(248,250,252,0) 42%,
    rgba(96,165,250,0) 58%, rgba(96,165,250,.10) 100%);
}
/* table-layout:fixed bases column widths on the FIRST row alone — the header row (see
   teamMatchTable) has five real cells matching the body 1:1, no colspan, so there's no
   ambiguity about which column a width belongs to. box-sizing:border-box on every cell
   means each column's declared width IS its total rendered size, padding included, so
   the row math below doesn't need to separately track padding on top of it. */
.pw-team-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 13.5px; }
/* Vertical padding matches .pw-roster-table's (7px) so row height is the same whether the
   modal is showing the flat roster or the light/dark team table — horizontal stays 7px,
   unchanged from what the width calc() below already assumes. */
.pw-team-table th, .pw-team-table td { box-sizing: border-box; padding: 7px; vertical-align: middle; border: 1px solid var(--border); }
.pw-team-table thead th { border-top: none; }
.pw-team-table tbody tr:last-child td { border-bottom: none; }
.pw-team-table tr > :first-child { border-left: none; }
.pw-team-table tr > :last-child { border-right: none; }
.pw-team-header { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted); }
/* Solid white/black header, same literal-pinnie-color idea as the admin team builder's
   title bars — the background itself now carries the Light/Dark identity, so the little
   color-swatch dot next to the label isn't needed anymore. thead-scoped (not just the
   bare class) since pw-team-row__avatar--light/--dark are shared with the body rows,
   which must stay on the gradient background, not solid white/black. */
.pw-team-header--light,
.pw-team-table thead th.pw-team-row__avatar--light { background: #f8fafc; color: #0f172a; }
.pw-team-header--dark,
.pw-team-table thead th.pw-team-row__avatar--dark { background: #0b1220; color: #e2e8f0; }
.pw-team-header--light { text-align: right; }
.pw-team-header--dark { text-align: left; }
.pw-team-note { font-size: 12px; color: var(--text-muted); text-align: center; margin: 0 0 10px; }
.pw-team-row__name { font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Columns 1 & 4 (name) are fluid but equal; 2 & 3 (avatar/avatar) are fixed — border-box
   means those two total exactly 44+44=88px regardless of internal padding, so each name
   column just gets half of whatever's left: (100% - 88px) / 2. */
.pw-team-row__name--light, .pw-team-row__name--dark { width: calc(50% - 44px); }
.pw-team-row__name--light { text-align: right; }
.pw-team-row__name--dark { text-align: left; }
.pw-team-row__avatar { width: 44px; text-align: center; }
/* Row order left-to-right: name-light, avatar-light, avatar-dark, name-dark. No border
   between a name and its own avatar (the name-light|avatar-light edge, and the
   avatar-dark|name-dark edge) — but the avatar-light|avatar-dark edge in the middle stays,
   it's now the only divider between the two sides with the number column gone. Each
   avatar cell therefore has ONE side removed (facing its own name) and the other side
   explicit 1px (facing the other avatar) — easy to invert these by mistake, so: light's
   avatar is to light-name's RIGHT, so light-name loses its right border and light-avatar
   loses its LEFT (matching left) border, keeping its right. Mirror for dark. Both sides of
   a removed edge have to agree it's "none" since border-collapse otherwise arbitrates
   which one wins; td/th-prefixed to match (not lose to) the general th/td border rule's
   specificity. */
td.pw-team-row__name--light, th.pw-team-row__name--light { border-right: none; }
td.pw-team-row__avatar--light, th.pw-team-row__avatar--light { border-left: none; border-right: 1px solid var(--border); }
td.pw-team-row__avatar--dark, th.pw-team-row__avatar--dark { border-right: none; border-left: 1px solid var(--border); }
td.pw-team-row__name--dark, th.pw-team-row__name--dark { border-left: none; }
/* Two names are always in the markup; only one shows at a time. Desktop shows the full
   name, mobile swaps to first-word-only (see the media query below) — CSS-only toggle
   rather than picking server-side, so no JS/resize listener is needed either way. */
.pw-team-row__name-short { display: none; }

/* The merged team table packs 4 columns (name/avatar/avatar/name) into one row — on a
   phone-width modal that's tight enough to wrap names awkwardly unless everything shrinks
   a step down from the desktop sizing used above. */
@media (max-width: 640px) {
  .pw-roster-table, .pw-team-table { font-size: 12px; }
  .pw-roster-table td, .pw-team-table th, .pw-team-table td { padding: 6px 5px; }
  .pw-roster-avatar { width: 26px; height: 26px; font-size: 9.5px; }
  .pw-roster-table__avatar { width: 26px; }
  /* border-box again: 26px avatar + 5px×2 padding = 36px; (36+36)/2 = 36. */
  .pw-team-row__avatar { width: 36px; }
  .pw-team-row__name--light, .pw-team-row__name--dark { width: calc(50% - 36px); }
  .pw-team-header { font-size: 9px; }
  .pw-team-note { font-size: 11px; }
  .pw-roster-guest-tag { font-size: 10px; }
  .pw-team-row__name-full { display: none; }
  .pw-team-row__name-short { display: inline; }
}

.pw-foot { display: flex; flex-direction: column; gap: 8px; margin-top: auto; }
.pw-status-line { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--text-muted); }
.pw-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); flex-shrink: 0; }
.pw-hint { font-size: 11.5px; color: #94a3b8; display: flex; gap: 5px; align-items: flex-start; line-height: 1.4; }
.pw-hint--warn { color: #f2b263; }

.pw-btn { font-family: inherit; font-size: 13.5px; font-weight: 700; border-radius: 9px; padding: 10px 14px; border: 1px solid transparent; cursor: pointer; text-align: center; text-decoration: none; display: block; transition: opacity .12s, background .12s, border-color .12s; }
.pw-btn--primary { background: var(--amber); color: #020817; }
.pw-btn--primary:hover { opacity: .9; }
.pw-btn--ghost { background: transparent; border-color: var(--border); color: var(--text-primary); }
.pw-btn--ghost:hover { border-color: var(--text-muted); }
.pw-btn--disabled { background: var(--bg); border-color: var(--border); color: var(--text-muted); cursor: not-allowed; }
.pw-btn--placeholder { display: flex; align-items: center; justify-content: center; gap: 6px; background: transparent; border-style: dashed; border-color: var(--border); color: var(--text-muted); opacity: .6; cursor: default; }

.pw-countdown-value { color: var(--amber); font-weight: 700; font-variant-numeric: tabular-nums; }
.pw-btn--danger-ghost { background: transparent; border-color: rgba(248,113,113,.35); color: #f2a5a5; }
.pw-btn--danger-ghost:hover { background: rgba(248,113,113,.08); }
.pw-err { font-size: 12px; color: #f87171; }
</style>

<script>
(function() {
  function setBusy(btn, busy, label) {
    btn.disabled = busy;
    if (label) btn.textContent = label;
  }
  document.querySelectorAll('[data-action="join"]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var gid = btn.dataset.game;
      var errEl = document.querySelector('.pw-err[data-err-for="' + gid + '"]');
      errEl.hidden = true;
      var orig = btn.textContent;
      setBusy(btn, true, 'Joining…');
      fetch('/papawis/' + encodeURIComponent(gid) + '/join', { method: 'POST' })
        .then(function(r) { return r.json().then(function(j) { return { ok: r.ok, j: j }; }); })
        .then(function(res) {
          if (!res.ok) throw new Error(res.j.error || 'Could not join.');
          location.reload();
        })
        .catch(function(e) {
          errEl.textContent = e.message; errEl.hidden = false;
          setBusy(btn, false, orig);
        });
    });
  });
  document.querySelectorAll('[data-action="cancel"]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (!confirm('Cancel your spot for this papawis?')) return;
      var gid = btn.dataset.game;
      var errEl = document.querySelector('.pw-err[data-err-for="' + gid + '"]');
      errEl.hidden = true;
      var orig = btn.textContent;
      setBusy(btn, true, 'Cancelling…');
      fetch('/papawis/' + encodeURIComponent(gid) + '/cancel', { method: 'POST' })
        .then(function(r) { return r.json().then(function(j) { return { ok: r.ok, j: j }; }); })
        .then(function(res) {
          if (!res.ok) throw new Error(res.j.error || 'Could not cancel.');
          location.reload();
        })
        .catch(function(e) {
          errEl.textContent = e.message; errEl.hidden = false;
          setBusy(btn, false, orig);
        });
    });
  });

  var modalBackdrop = document.getElementById('pw-modal-backdrop');
  var modalTitle    = document.getElementById('pw-modal-title');
  var modalBody      = document.getElementById('pw-modal-body');
  function closeModal() { modalBackdrop.hidden = true; }
  document.querySelectorAll('[data-action="see-all"]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var gid = btn.dataset.game;
      var tpl = document.querySelector('template[data-roster-tpl="' + gid + '"]');
      if (!tpl) return;
      modalTitle.textContent = tpl.dataset.title;
      modalBody.innerHTML = '';
      modalBody.appendChild(tpl.content.cloneNode(true));
      modalBackdrop.hidden = false;
      // Fire-and-forget — logs it for the admin activity log, doesn't block the UI.
      fetch('/papawis/' + encodeURIComponent(gid) + '/viewed', { method: 'POST' }).catch(function() {});
    });
  });
  document.getElementById('pw-modal-close').addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', function(e) { if (e.target === modalBackdrop) closeModal(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && !modalBackdrop.hidden) closeModal(); });

  var countdowns = document.querySelectorAll('[data-opens-at]');
  if (countdowns.length) {
    // Colon-separated, like a normal timer — drops leading zero segments instead of
    // always showing d:h:m:s, e.g. "21:16:04" once under a day left, "16:04" once under
    // an hour, rather than a fixed-width "0:21:16:04".
    var formatCountdown = function(ms) {
      var total = Math.max(0, Math.floor(ms / 1000));
      var d = Math.floor(total / 86400);
      var h = Math.floor(total % 86400 / 3600);
      var m = Math.floor(total % 3600 / 60);
      var s = total % 60;
      var pad = function(n) { return String(n).padStart(2, '0'); };
      if (d > 0) return d + ':' + pad(h) + ':' + pad(m) + ':' + pad(s);
      if (h > 0) return h + ':' + pad(m) + ':' + pad(s);
      return m + ':' + pad(s);
    };
    var tick = function() {
      var now = Date.now();
      countdowns.forEach(function(el) {
        var target = new Date(el.dataset.opensAt).getTime();
        var diff = target - now;
        if (diff <= 0 && !el.dataset.done) { el.dataset.done = '1'; location.reload(); }
        el.querySelector('.pw-countdown-value').textContent = formatCountdown(diff);
      });
    };
    tick();
    setInterval(tick, 1000);
  }
})();
</script>`;
}
