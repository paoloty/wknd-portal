import { escHtml } from './layout.js';
import { parseWriteup } from '../lib/writeup.js';

export const TEAM_COLORS = {
  WHITE:  '#d7dce5',
  BLACK:  '#4a5263',
  BLUE:   '#4a90e2',
  MAROON: '#b0455a',
};

// Shared between the admin ledger's manual-entry form and the player-facing settle-balance
// form, so a category picked by a player matches exactly what admin sees/filters by.
export const PAYMENT_CATEGORIES = ['Season Fee', 'Game Fee', 'Papawis', 'Penalty', 'Equipment', 'Other'];

export function teamColor(name) {
  return TEAM_COLORS[String(name || '').toUpperCase()] || '#4a5263';
}

// Canonical player name display — update this one function when DB format changes.
// Converts "LASTNAME, Firstname Middlename" → "Firstname LASTNAME" (first word of first name only, last name forced uppercase).
export function displayPlayerName(raw) {
  const str = String(raw || '').trim();
  const comma = str.indexOf(',');
  if (comma === -1) return str;
  const last  = str.slice(0, comma).trim().toUpperCase();
  const first = str.slice(comma + 1).trim();
  return `${first} ${last}`;
}

// Alias kept so callers can be migrated gradually.
export const formatPlayerName = displayPlayerName;

// Today's calendar date in Manila (Asia/Manila, UTC+8 — no DST, so this offset is always
// correct year-round), as "YYYY-MM-DD". Deliberately pure epoch math instead of
// Intl.DateTimeFormat({ timeZone: 'Asia/Manila' }): that relies on the Node build having
// full ICU/tzdata bundled, which isn't guaranteed on every host (confirmed broken on the
// Hetzner deploy, silently drifting a day near the UTC/Manila day boundary). Date.now()
// and the UTC getters below have no timezone-database dependency at all, so this is
// correct regardless of the server's own system timezone or Node's ICU build.
export function manilaTodayStr() {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// Absolute instant (ms since epoch) a papawis game's held-back sign-ups actually open —
// 8:00 AM Manila time on the day `open_days_before` days before game day. Returns null
// when sign-ups aren't held back at all (always open). Built from pure calendar-string
// arithmetic (UTC getters) plus an explicit "+08:00" offset on the final instant — no
// reliance on the server's local timezone or Intl/ICU tzdata, same reasoning as
// manilaTodayStr(). This is the single source of truth for both the join-gate check and
// the live countdown target, so they can never disagree with each other.
export function papawisSignupOpensAtMs(game) {
  if (!game?.open_days_before) return null;
  const [y, m, d] = game.date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - game.open_days_before);
  const openDateStr = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
  return new Date(`${openDateStr}T08:00:00+08:00`).getTime();
}

export function isPapawisSignupOpenNow(game) {
  const opensAt = papawisSignupOpensAtMs(game);
  return opensAt === null || Date.now() >= opensAt;
}

export function formatDate(raw) {
  try {
    return new Date(raw).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  } catch {
    return String(raw || '');
  }
}

// "18:00" -> "6:00 PM"
function formatClockTime(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

// Formats a start/end pair of "HH:MM" (24h) inputs into e.g. "6:00–8:00 PM" (shared AM/PM
// dropped from the start) or "11:00 AM–1:00 PM" (different periods, both shown in full).
export function formatTimeRange(start, end) {
  if (!start && !end) return '';
  if (start && !end) return formatClockTime(start);
  if (!start && end) return formatClockTime(end);
  const startPeriod = Number(start.split(':')[0]) >= 12 ? 'PM' : 'AM';
  const endPeriod   = Number(end.split(':')[0])   >= 12 ? 'PM' : 'AM';
  const startFull = formatClockTime(start);
  const endFull   = formatClockTime(end);
  return startPeriod === endPeriod
    ? `${startFull.replace(` ${startPeriod}`, '')}–${endFull}`
    : `${startFull}–${endFull}`;
}

export function initials(name) {
  const parts = String(name || '').replace(/,/g, ' ').trim().split(/\s+/);
  return parts.map(p => p[0] || '').join('').slice(0, 2).toUpperCase();
}

// Renders a player avatar circle (initials behind, photo on top).
// Pass link: true to wrap in an <a> pointing to /players/:id.
export function playerAvatar(id, name, color, { className = 'player-avatar', link = false } = {}) {
  const init  = initials(name);
  const inner = `<span class="font-condensed">${escHtml(init)}</span>
    <img src="/api/player/${encodeURIComponent(String(id || ''))}/photo" alt="" loading="lazy" onerror="this.style.display='none'">`;
  const style = `border-color:${escHtml(color)}`;
  if (link) {
    const href = `/players/${encodeURIComponent(String(id || ''))}`;
    return `<a href="${href}" class="${escHtml(className)}" style="${style}">${inner}</a>`;
  }
  return `<div class="${escHtml(className)}" style="${style}">${inner}</div>`;
}

// Renders a player name as a link to /players/:id.
// Applies displayPlayerName() formatting; pass upper: true for ALL-CAPS output.
export function playerLink(id, rawName, { className = 'player-link', upper = false } = {}) {
  const name      = displayPlayerName(rawName);
  const displayed = upper ? name.toUpperCase() : name;
  const clsAttr   = className ? ` class="${escHtml(className)}"` : '';
  return `<a href="/players/${encodeURIComponent(String(id || ''))}"${clsAttr}>${escHtml(displayed)}</a>`;
}

export function boldTitle(writeup) {
  return parseWriteup(writeup).title;
}

export function truncate(str, max = 90) {
  const s = String(str || '').trim();
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/\s\S*$/, '') + '…';
}

export function excerpt(writeup) {
  return parseWriteup(writeup).body;
}
