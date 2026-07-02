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
// Currently converts "LASTNAME, Firstname" → "Firstname LASTNAME".
export function displayPlayerName(raw) {
  const str = String(raw || '').trim();
  const comma = str.indexOf(',');
  if (comma === -1) return str;
  const last  = str.slice(0, comma).trim();
  const first = str.slice(comma + 1).trim();
  return `${first} ${last}`;
}

// Alias kept so callers can be migrated gradually.
export const formatPlayerName = displayPlayerName;

export function formatDate(raw) {
  try {
    return new Date(raw).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  } catch {
    return String(raw || '');
  }
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
