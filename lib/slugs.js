import { createHash } from 'crypto';

export function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// "TORRES, Lance" → "lance-torres"
export function playerSlug(player) {
  const raw   = String(player.name || '');
  const comma = raw.indexOf(',');
  const last  = (comma >= 0 ? raw.slice(0, comma) : raw).trim();
  const first = (comma >= 0 ? raw.slice(comma + 1) : '').trim();
  return slugify(first ? `${first} ${last}` : last);
}

// "BLUE" → "blue"
export function teamSlug(team) {
  return slugify(team.name);
}

const TEAM_ABBR = { BLUE: 'blue', MAROON: 'mar', WHITE: 'wht', BLACK: 'blk' };
function teamAbbr(name) {
  return TEAM_ABBR[String(name || '').toUpperCase()] || slugify(name).slice(0, 4);
}

function shortHash(id) {
  return createHash('sha1').update(String(id)).digest('hex').slice(0, 8);
}

// → "a3f7c912-wht-blk"
export function gameSlug(game) {
  return `${shortHash(game.id)}-${teamAbbr(game.team_a_name)}-${teamAbbr(game.team_b_name)}`;
}
