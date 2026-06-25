export const TEAM_COLORS = {
  WHITE:  '#d7dce5',
  BLACK:  '#4a5263',
  BLUE:   '#4a90e2',
  MAROON: '#b0455a',
};

export function teamColor(name) {
  return TEAM_COLORS[String(name || '').toUpperCase()] || '#4a5263';
}

export function formatPlayerName(raw) {
  const str = String(raw || '').trim();
  const comma = str.indexOf(',');
  if (comma === -1) return str;
  const last = str.slice(0, comma).trim();
  const first = str.slice(comma + 1).trim();
  return `${first} ${last}`;
}

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

export function boldTitle(writeup) {
  const m = String(writeup || '').match(/\*\*(.+?)\*\*/);
  return m ? m[1].trim() : '';
}

export function excerpt(writeup) {
  const stripped = String(writeup || '').replace(/\*\*(.+?)\*\*/g, '$1').trim();
  const paras = stripped.split(/\n{2,}/);
  const first = paras[0]?.trim() || '';
  if (first.split('\n').length <= 1 && paras.length > 1) return paras[1]?.trim() || '';
  return first;
}
