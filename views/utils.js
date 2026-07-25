import { escHtml } from './layout.js';
import { parseWriteup } from '../lib/writeup.js';

export const TEAM_COLORS = {
  WHITE:  '#d7dce5',
  BLACK:  '#4a5263',
  BLUE:   '#4a90e2',
  MAROON: '#b0455a',
};

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

// Today's calendar date in Manila (Asia/Manila, UTC+8), as "YYYY-MM-DD" — independent of
// whatever timezone the server process itself happens to be running in. All "days until
// game day" / "is it past midnight yet" comparisons in the league should key off this
// rather than the server's local `new Date()`, since the server may be hosted in UTC.
export function manilaTodayStr() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
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
