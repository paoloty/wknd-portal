// The six premium "Share my stats" templates (mockups: claude.ai/artifact/FnsXJbwUphJo1876kSMoFj,
// picked by Paolo 2026-10-19): Vs your usual, Receipt, Magazine cover, Poster, Corner bug, Jersey.
// Same contract as the older generators in server.js: a 1080×1920 see-through overlay the
// player puts on their own photo, so each one carries its own scrim for contrast instead of a
// baked-in background.
//
// One file for the server and the phone: each template builds its SVG here. The server makes
// the PNG with sharp (lib/share-card-templates.js); the players app draws it on the phone
// (phoneDrawer below, public/app.js initShare), so trying templates and colours costs no
// request. Plain JS, no imports: Node imports it, the app loads it as a module script.
//
// Premium = locked while the player owes (current_balance > 0), admins excepted. A locked
// card is always made on the server (the lock is stamped into the image there, lockOverlay),
// so the phone only ever draws cards for a player who isn't locked.

export const SHARE_PREMIUM_KEYS = ['usual', 'receipt', 'cover', 'poster', 'bug', 'jersey'];
// What the phone draws. Not Receipt: it's set in a monospace font the phones don't share.
export const PHONE_KEYS = ['usual', 'cover', 'poster', 'bug', 'jersey'];
export const SHARE_ACCENTS = {
  amber:  { bg: '#f59332', text: '#0a0e16' },
  red:    { bg: '#ef4444', text: '#ffffff' },
  blue:   { bg: '#3b82f6', text: '#ffffff' },
  green:  { bg: '#22c55e', text: '#0a0e16' },
  purple: { bg: '#a78bfa', text: '#0a0e16' },
  pink:   { bg: '#f472b6', text: '#0a0e16' },
  cyan:   { bg: '#22d3ee', text: '#0a0e16' },
};

export const W = 1080, H = 1920;
const BASE = 'Noto Sans, DejaVu Sans, Liberation Sans, Arial, sans-serif';
// Saira Condensed ships as Black only (assets/fonts), so numbers are always weight 900.
export const NUM = `'Saira Condensed', ${BASE}`;
export const BODY = `'Archivo', ${BASE}`;
const MONO = `'DejaVu Sans Mono', 'Liberation Mono', 'Courier New', monospace`;
const MUTED = '#8a93a4', SOFT = '#c3cbd8', WHITE = '#ffffff';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = v => Number(v) || 0;
const CAT = { pts: 'PTS', reb: 'REB', ast: 'AST', stl: 'STL', blk: 'BLK' };
const WORD = { pts: ['POINT', 'POINTS'], reb: ['BOARD', 'BOARDS'], ast: ['DIME', 'DIMES'], stl: ['STEAL', 'STEALS'], blk: ['BLOCK', 'BLOCKS'] };
const LONG = { pts: 'Points', reb: 'Rebounds', ast: 'Assists', stl: 'Steals', blk: 'Blocks' };

// Count stats, biggest first; the first one is the card's hero. PTS wins a tie.
function ranked(stat) {
  return Object.keys(CAT).map(k => ({ k, v: n(stat[k]) }))
    .sort((a, b) => b.v - a.v || (a.k === 'pts' ? -1 : b.k === 'pts' ? 1 : 0));
}
function shooting(stat) {
  const fgm = n(stat.fg2m) + n(stat.fg3m) + n(stat.fg4m);
  const fga = fgm + n(stat.fg2m_miss) + n(stat.fg3m_miss) + n(stat.fg4m_miss);
  const tpm = n(stat.fg3m), tpa = tpm + n(stat.fg3m_miss);
  const ftm = n(stat.ftm), fta = ftm + n(stat.ft_miss);
  const pct = (m, a) => (a ? Math.round((m / a) * 100) : null);
  return [
    { label: 'FG', m: fgm, a: fga, pct: pct(fgm, fga) },
    { label: 'FT', m: ftm, a: fta, pct: pct(ftm, fta) },
    { label: '3PT', m: tpm, a: tpa, pct: pct(tpm, tpa) },
  ];
}
function result(d) { return `${d.won ? 'W' : 'L'} ${d.myScore}–${d.oppScore}`; }
function footer(d, y, { x0 = 66, x1 = W - 66, color = SOFT, size = 30 } = {}) {
  return `<text x="${x0}" y="${y}" font-family="${BODY}" font-size="${size}" font-weight="700" letter-spacing="3" fill="${color}">vs ${esc(d.oppName)} · ${esc(result(d))} · ${esc(d.dateShort.toUpperCase())}</text>
  <text x="${x1}" y="${y}" text-anchor="end" font-family="${BODY}" font-size="${size}" font-weight="700" letter-spacing="3" fill="${MUTED}">@WKNDBASKETBALL</text>`;
}
const DEFS = `<filter id="txt" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="8" flood-color="#000" flood-opacity="0.5"/></filter>`;
// Bottom-up dark scrim: transparent at `from`, near-solid navy at the bottom edge.
function scrim(from, to = 0.94) {
  return `<linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0a0e16" stop-opacity="0"/>
      <stop offset="0.35" stop-color="#0a0e16" stop-opacity="${(to * 0.75).toFixed(2)}"/>
      <stop offset="1" stop-color="#0a0e16" stop-opacity="${to}"/>
    </linearGradient>`;
}
// Largest font size (≤ size) that keeps text within maxW, from its real rendered width.
async function fit(measure, text, { font, size, weight = 900, ls = 0, maxW }) {
  const w = await measure(String(text), { fontFamily: font, fontSize: size, fontWeight: weight, letterSpacing: ls });
  return w > maxW ? Math.floor(size * maxW / w) : size;
}
const widthOf = (measure, text, font, size, weight = 900, ls = 0) =>
  measure(String(text), { fontFamily: font, fontSize: size, fontWeight: weight, letterSpacing: ls });

// ── A · Vs your usual ─────────────────────────────────────────────────────────────────────
// Each count stat as a bar against this player's own season average (other games this season,
// not this one), with the +/− gap. No earlier games this season: bars without a tick, and the
// header says so instead of inventing an average.
async function usual(d, measure) {
  const { accent } = d;
  let rows = ranked(d.stat).map(({ k, v }) => ({ k, v, avg: d.season.avg ? d.season.avg[k] : null }));
  if (d.hideZeros) rows = rows.filter((r, i) => i === 0 || r.v > 0);
  const hasAvg = d.season.games > 0;
  const x0 = 66, labelW = 102, valR = x0 + labelW + 168, barX0 = valR + 30, barX1 = W - 66 - 186, deltaR = W - 66;
  const pitchHero = 156, pitch = 108;
  // Built upward from the footer.
  const footY = H - 66, ruleY = footY - 54, legendY = ruleY - 42;
  let y = legendY - 66;
  const ys = [];
  for (let i = rows.length - 1; i >= 0; i--) { ys[i] = y; y -= i === 1 ? pitchHero : pitch; }
  const nameY = ys[0] - 150, headY = nameY - 96;
  const cardName = d.cardName.toUpperCase();
  const nameSize = await fit(measure, cardName, { font: NUM, size: 96, ls: 1, maxW: W - 132 });
  const rowSvg = (await Promise.all(rows.map(async (r, i) => {
    const hero = i === 0, cy = ys[i];
    const max = Math.max(r.v, r.avg ?? 0, 1) * 1.15;
    const up = r.avg == null || r.v >= r.avg;
    const fillW = Math.max(0, (barX1 - barX0) * (r.v / max));
    const tickX = r.avg == null ? null : barX0 + (barX1 - barX0) * (r.avg / max);
    const gap = r.avg == null ? null : Math.round((r.v - r.avg) * 10) / 10;
    const delta = gap == null ? '' : gap === 0 ? '= 0.0' : `${gap > 0 ? '+' : '−'}${Math.abs(gap).toFixed(1)}`;
    const deltaFill = gap > 0 ? accent.bg : MUTED;
    // The ▲/▼ is drawn, not typed: neither brand font has the glyph, and each phone's fallback differs.
    let arrow = '';
    if (gap) {
      const ar = deltaR - Math.round(await widthOf(measure, delta, NUM, 46, 900)) - 14, al = ar - 28;
      arrow = `<polygon points="${gap > 0 ? `${al},${cy + 14} ${ar},${cy + 14} ${al + 14},${cy - 12}` : `${al},${cy - 12} ${ar},${cy - 12} ${al + 14},${cy + 14}`}" fill="${deltaFill}"/>`;
    }
    return `<text x="${x0}" y="${cy + 11}" font-family="${BODY}" font-size="33" font-weight="800" letter-spacing="4" fill="${MUTED}">${CAT[r.k]}</text>
    <text x="${valR}" y="${cy + (hero ? 42 : 27)}" text-anchor="end" font-family="${NUM}" font-size="${hero ? 126 : 80}" font-weight="900" fill="${hero ? accent.bg : WHITE}" filter="url(#txt)">${r.v}</text>
    <rect x="${barX0}" y="${cy - 12}" width="${barX1 - barX0}" height="24" rx="12" fill="#ffffff" fill-opacity="0.1"/>
    ${fillW > 0 ? `<rect x="${barX0}" y="${cy - 12}" width="${fillW.toFixed(1)}" height="24" rx="12" fill="${up ? accent.bg : '#ffffff'}" fill-opacity="${up ? 1 : 0.35}"/>` : ''}
    ${tickX != null ? `<rect x="${(tickX - 3).toFixed(1)}" y="${cy - 24}" width="6" height="48" rx="3" fill="#e7eaf0"/>` : ''}
    ${arrow}
    ${delta ? `<text x="${deltaR}" y="${cy + 16}" text-anchor="end" font-family="${NUM}" font-size="46" font-weight="900" fill="${deltaFill}">${delta}</text>` : ''}`;
  }))).join('\n');
  const high = d.season.high;
  const kicker = hasAvg ? `VS SEASON AVERAGE · ${d.season.games} GAME${d.season.games === 1 ? '' : 'S'}` : 'FIRST GAME OF THE SEASON';
  const chipW = Math.round(await widthOf(measure, 'SEASON HIGH', NUM, 38, 900, 4)) + 48;
  const kickX = high ? x0 + chipW + 24 : x0;
  const kickSize = await fit(measure, kicker, { font: BODY, size: 31, weight: 700, ls: 4, maxW: W - 66 - kickX });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>${DEFS}${scrim()}</defs>
  <rect x="0" y="${headY - 260}" width="${W}" height="${H - headY + 260}" fill="url(#scrim)"/>
  ${high ? `<rect x="${x0}" y="${headY - 40}" width="${chipW}" height="56" rx="12" fill="${accent.bg}"/>
  <text x="${x0 + chipW / 2}" y="${headY - 12}" text-anchor="middle" dominant-baseline="central" font-family="${NUM}" font-size="38" font-weight="900" letter-spacing="4" fill="${accent.text}">SEASON HIGH</text>` : ''}
  <text x="${kickX}" y="${headY}" font-family="${BODY}" font-size="${kickSize}" font-weight="700" letter-spacing="4" fill="${MUTED}">${kicker}</text>
  <text x="${x0}" y="${nameY}" font-family="${NUM}" font-size="${nameSize}" font-weight="900" letter-spacing="1" fill="${WHITE}" filter="url(#txt)">${esc(cardName)}</text>
  <circle cx="${x0 + 12}" cy="${nameY + 52}" r="12" fill="${esc(d.teamColor)}"/>
  <text x="${x0 + 36}" y="${nameY + 64}" font-family="${BODY}" font-size="33" font-weight="700" fill="${MUTED}">${esc(d.teamName)} · #${esc(d.number)}</text>
  ${rowSvg}
  ${hasAvg ? `<rect x="${x0}" y="${legendY - 26}" width="6" height="30" fill="#e7eaf0"/>
  <text x="${x0 + 22}" y="${legendY}" font-family="${BODY}" font-size="28" fill="${MUTED}">season average</text>` : ''}
  <rect x="${x0}" y="${ruleY}" width="${W - 132}" height="3" fill="#ffffff" fill-opacity="0.12"/>
  ${footer(d, footY)}
</svg>`;
  return { svg };
}

// ── B · Receipt ───────────────────────────────────────────────────────────────────────────
async function receipt(d) {
  const { accent, stat } = d;
  const pw = 660, px = W - 60 - pw, pad = 48, fs = 33, lh = 50;
  const lines = [];
  let y = 0;
  const T = (txt, o = {}) => lines.push({ y, txt, ...o });
  y += 96; T('WKND', { center: true, font: NUM, size: 96, weight: 900, ls: 8 });
  y += 48; T(`GAME RECEIPT · S${d.season.label}`, { center: true, size: 27, weight: 700, ls: 5 });
  y += 38; T(`${d.dateLong.toUpperCase()}${stat.minutes ? ` · ${stat.minutes} MIN` : ''}`, { center: true, size: 26, color: '#5b6475' });
  y += 34; lines.push({ y, rule: true });
  y += 58; T('CUSTOMER', { weight: 700, right: d.shortName.toUpperCase() });
  y += lh; T('ORDER', { right: `vs ${d.oppName}` });
  y += 30; lines.push({ y, rule: true });
  y += 30;
  for (const { k, v } of ranked(stat).filter(r => r.k !== 'pts' && (!d.hideZeros || r.v > 0))) { y += lh; T(LONG[k].toUpperCase(), { right: String(v) }); }
  for (const s of shooting(stat)) if (s.a && (!d.hideZeros || s.pct > 0)) { y += lh; T(`${s.label} ${s.m}/${s.a}`, { right: `${s.pct}%` }); }
  y += 30; lines.push({ y, rule: true });
  y += 120; T('TOTAL PTS', { weight: 700, size: 38, big: String(n(stat.pts)) });
  y += 52; T('RESULT', { size: 27, color: '#5b6475', right: result(d) });
  y += 40; T('TURNOVERS', { size: 27, color: '#5b6475', right: `${n(stat.turnover)} (NO REFUNDS)` });
  y += 40; const barY = y; y += 96;
  y += 46; T('THANK YOU, COME AGAIN', { center: true, size: 24, ls: 3 });
  y += 36; T('@WKNDBASKETBALL', { center: true, size: 24, ls: 3 });
  const ph = y + 40;
  const py = H - 150 - ph;
  // Barcode from the game id, so the same game always prints the same code.
  let seed = [...String(d.gameId)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
  let bx = pad, bars = '';
  while (bx < pw - pad - 6) { const w = 3 + Math.floor(rnd() * 3) * 3; if (rnd() > 0.35) bars += `<rect x="${bx}" y="${barY}" width="${w}" height="96" fill="#15171c"/>`; bx += w + 3 + Math.floor(rnd() * 2) * 3; }
  const teeth = Array.from({ length: Math.ceil(pw / 30) }, (_, i) => `${i * 30},${ph} ${i * 30 + 15},${ph + 24}`).join(' ');
  const body = lines.map(l => {
    if (l.rule) return `<line x1="${pad}" y1="${l.y}" x2="${pw - pad}" y2="${l.y}" stroke="#15171c" stroke-width="4" stroke-dasharray="12 9"/>`;
    const font = l.font || MONO, size = l.size || fs, weight = l.weight || 500, color = l.color || '#15171c', ls = l.ls || 0;
    if (l.center) return `<text x="${pw / 2}" y="${l.y}" text-anchor="middle" font-family="${font}" font-size="${size}" font-weight="${weight}" letter-spacing="${ls}" fill="${color}">${esc(l.txt)}</text>`;
    return `<text x="${pad}" y="${l.y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${color}">${esc(l.txt)}</text>
      ${l.right != null ? `<text x="${pw - pad}" y="${l.y}" text-anchor="end" font-family="${MONO}" font-size="${size}" font-weight="700" fill="${color}">${esc(l.right)}</text>` : ''}
      ${l.big != null ? `<text x="${pw - pad}" y="${l.y + 8}" text-anchor="end" font-family="${NUM}" font-size="132" font-weight="900" fill="${accent.bg === '#ffffff' ? '#15171c' : accent.bg}">${esc(l.big)}</text>` : ''}`;
  }).join('\n');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><filter id="drop" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="40" stdDeviation="34" flood-color="#000" flood-opacity="0.55"/></filter></defs>
  <g transform="translate(${px} ${py}) rotate(-3 ${pw / 2} ${ph / 2})" filter="url(#drop)">
    <polygon points="0,0 ${pw},0 ${pw},${ph} ${teeth} 0,${ph}" fill="#f4f1ea"/>
    ${body}
    ${bars}
  </g>
</svg>`;
  return { svg };
}

// ── C · Magazine cover ────────────────────────────────────────────────────────────────────
// Cover lines are the box score's own facts (stat + plain label), never invented copy.
async function cover(d, measure) {
  const { accent, stat } = d;
  const [hero, ...rest] = ranked(stat);
  const lines = rest.filter(r => r.v > 0).slice(0, 2).map(r => ({ big: `${r.v} ${CAT[r.k]}`, small: '' }));
  const shot = shooting(stat).filter(s => s.a >= 2 && (!d.hideZeros || s.pct > 0)).sort((a, b) => b.pct - a.pct)[0];
  if (shot) lines.push({ big: `${shot.m}/${shot.a}`, small: shot.label === 'FT' ? 'From the line' : shot.label === '3PT' ? 'From three' : 'From the field' });
  const coverLines = lines.map((l, i) => {
    const y = 560 + i * 170;
    return `<text x="${W - 54}" y="${y}" text-anchor="end" font-family="${NUM}" font-size="84" font-weight="900" fill="${WHITE}" filter="url(#txt)">${esc(l.big)}</text>
    ${l.small ? `<text x="${W - 54}" y="${y + 46}" text-anchor="end" font-family="${BODY}" font-size="32" font-weight="700" fill="${WHITE}" filter="url(#txt)">${esc(l.small)}</text>` : ''}`;
  }).join('\n');
  const heroWord = WORD[hero.k][hero.v === 1 ? 0 : 1];
  const mastSize = await fit(measure, 'WKND', { font: NUM, size: 400, ls: -6, maxW: W - 108 });
  const heroNumW = await widthOf(measure, hero.v, NUM, 340, 900);
  const wordX = Math.round(40 + heroNumW + 30);
  const wordSize = await fit(measure, heroWord, { font: NUM, size: 78, maxW: W - 54 - wordX });
  const byline = `${d.cardName.toUpperCase()} · #${d.number} ${d.teamName}`;
  const bylineSize = await fit(measure, byline, { font: BODY, size: 33, weight: 700, maxW: W - 54 - wordX });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>${DEFS}
    <linearGradient id="top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0e16" stop-opacity="0.6"/><stop offset="1" stop-color="#0a0e16" stop-opacity="0"/></linearGradient>
    ${scrim()}
  </defs>
  <rect x="0" y="0" width="${W}" height="520" fill="url(#top)"/>
  <rect x="0" y="1060" width="${W}" height="860" fill="url(#scrim)"/>
  <text x="54" y="74" font-family="${BODY}" font-size="27" font-weight="800" letter-spacing="6" fill="${WHITE}">SEASON ${esc(d.season.label)} · vs ${esc(d.oppName)}</text>
  <text x="${W - 54}" y="74" text-anchor="end" font-family="${BODY}" font-size="27" font-weight="800" letter-spacing="6" fill="${WHITE}">${esc(d.dateLong.toUpperCase())}</text>
  <text x="${W / 2}" y="${Math.round(110 + mastSize * 0.72)}" text-anchor="middle" font-family="${NUM}" font-size="${mastSize}" font-weight="900" letter-spacing="-6" fill="${accent.bg}">WKND</text>
  ${coverLines}
  ${d.season.high ? `<rect x="54" y="1446" width="290" height="54" fill="${accent.bg}"/>
  <text x="199" y="1473" text-anchor="middle" dominant-baseline="central" font-family="${BODY}" font-size="30" font-weight="800" letter-spacing="4" fill="${accent.text}">SEASON HIGH</text>` : ''}
  <text x="40" y="1770" font-family="${NUM}" font-size="340" font-weight="900" fill="${WHITE}" filter="url(#txt)">${hero.v}</text>
  <text x="${wordX}" y="1690" font-family="${NUM}" font-size="${wordSize}" font-weight="900" fill="${WHITE}">${heroWord}</text>
  <text x="${wordX}" y="1748" font-family="${BODY}" font-size="${bylineSize}" font-weight="700" fill="${SOFT}">${esc(byline)}</text>
  <rect x="54" y="1806" width="${W - 108}" height="3" fill="#ffffff" fill-opacity="0.25"/>
  ${footer(d, 1862, { x0: 54, x1: W - 54 })}
</svg>`;
  return { svg };
}

// ── D · Poster ────────────────────────────────────────────────────────────────────────────
async function poster(d, measure) {
  const { accent } = d;
  const SIZES = [276, 210, 174, 150, 150];
  const rows = ranked(d.stat).filter(r => r.v > 0).slice(0, 5);
  const footY = H - 66;
  let y = footY - 72;
  const ys = [];
  for (let i = rows.length - 1; i >= 0; i--) { ys[i] = y; y -= Math.round(SIZES[i] * 0.86); }
  const nameY = (ys[0] ?? y) - Math.round(SIZES[0] * 0.86) - 6;
  // The number keeps its size; the outlined word shrinks to fit what's left of the line.
  const lineSvg = (await Promise.all(rows.map(async (r, i) => {
    const size = SIZES[i], hero = i === 0;
    const num = String(r.v), word = WORD[r.k][r.v === 1 ? 0 : 1];
    const numW = Math.round(await widthOf(measure, num, NUM, size, 900, -3));
    const wordX = 54 + numW + Math.round(size * 0.12);
    const wordSize = await fit(measure, word, { font: NUM, size, ls: -1, maxW: W - 54 - wordX });
    return `<text x="54" y="${ys[i]}" font-family="${NUM}" font-size="${size}" font-weight="900" letter-spacing="-3" fill="${hero ? accent.bg : WHITE}" filter="url(#txt)">${num}</text>
    <text x="${wordX}" y="${ys[i]}" font-family="${NUM}" font-size="${wordSize}" font-weight="900" letter-spacing="-1" fill="none" stroke="${hero ? accent.bg : WHITE}" stroke-opacity="${hero ? 1 : 0.85}" stroke-width="4.5">${word}</text>`;
  }))).join('\n');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>${DEFS}${scrim()}</defs>
  <rect x="0" y="${nameY - 380}" width="${W}" height="${H - nameY + 380}" fill="url(#scrim)"/>
  <text x="54" y="${nameY}" font-family="${BODY}" font-size="33" font-weight="800" letter-spacing="9" fill="${SOFT}">${esc(d.cardName.toUpperCase())} · #${esc(d.number)}</text>
  ${lineSvg}
  ${footer(d, footY, { x0: 54, x1: W - 54 })}
</svg>`;
  return { svg };
}

// ── E · Corner bug ────────────────────────────────────────────────────────────────────────
// A small broadcast bug top-left (hero stat block, avatar with a team-colour ring, name and
// line), the game strip under it, and a tiny WKND mark bottom-right. Everything else is photo.
// The photo: the server lays it over the PNG at photoBox; the phone passes it in as photoHref
// (a small data: URL), drawn here in a circle. hasPhoto drops the initials.
async function bug(d, measure, { photoHref = null, hasPhoto = !!photoHref } = {}) {
  const { accent } = d;
  const [hero, ...rest] = ranked(d.stat);
  const line = rest.filter(r => r.v > 0).map(r => `${r.v} ${CAT[r.k]}`).join(' · ');
  const name = d.cardName.toUpperCase();
  const x = 54, y = 54, heroW = 180, rowH = 168, av = 120;
  const textX = x + heroW + 30 + av + 30, maxText = W - 54 - 40 - textX;
  const nameSize = await fit(measure, `${name} #${d.number}`, { font: NUM, size: 51, ls: 1.5, maxW: maxText });
  const lineSize = await fit(measure, line || ' ', { font: NUM, size: 42, maxW: maxText });
  const nameW = await widthOf(measure, `${name} #${d.number}`, NUM, nameSize, 900, 1.5);
  const lineW = await widthOf(measure, line || ' ', NUM, lineSize, 900);
  const boxR = Math.min(W - 54, textX + Math.max(nameW, lineW, 400) + 40);
  const stripY = y + rowH, stripH = 60;
  const strip = `${d.teamName} ${d.mySideScore}–${d.otherSideScore} ${d.otherTeamName}`;
  const avCx = x + heroW + 30 + av / 2, avCy = y + rowH / 2;
  const photoBox = { left: Math.round(avCx - av / 2), top: Math.round(avCy - av / 2), size: av };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <filter id="sh" x="-10%" y="-20%" width="120%" height="160%"><feDropShadow dx="0" dy="24" stdDeviation="30" flood-color="#000" flood-opacity="0.5"/></filter>
    <clipPath id="bx"><rect x="${x}" y="${y}" width="${boxR - x}" height="${rowH + stripH}" rx="30"/></clipPath>
    ${photoHref ? `<clipPath id="av"><circle cx="${avCx}" cy="${avCy}" r="${av / 2}"/></clipPath>` : ''}
  </defs>
  <g filter="url(#sh)"><rect x="${x}" y="${y}" width="${boxR - x}" height="${rowH + stripH}" rx="30" fill="#0a0e16" fill-opacity="0.86"/></g>
  <g clip-path="url(#bx)">
    <rect x="${x}" y="${y}" width="${heroW}" height="${rowH}" fill="${accent.bg}"/>
    <rect x="${x}" y="${stripY}" width="${boxR - x}" height="${stripH}" fill="#0a0e16" fill-opacity="0.55"/>
  </g>
  <text x="${x + heroW / 2}" y="${y + 106}" text-anchor="middle" font-family="${NUM}" font-size="${hero.v >= 100 ? 84 : 108}" font-weight="900" fill="${accent.text}">${hero.v}</text>
  <text x="${x + heroW / 2}" y="${y + 146}" text-anchor="middle" font-family="${BODY}" font-size="27" font-weight="800" letter-spacing="4" fill="${accent.text}">${CAT[hero.k]}</text>
  <circle cx="${avCx}" cy="${avCy}" r="${av / 2 + 6}" fill="${esc(d.teamColor)}"/>
  <circle cx="${avCx}" cy="${avCy}" r="${av / 2}" fill="#161c29"/>
  ${photoHref ? `<image href="${esc(photoHref)}" x="${photoBox.left}" y="${photoBox.top}" width="${av}" height="${av}" preserveAspectRatio="xMidYMin slice" clip-path="url(#av)"/>` : ''}
  ${hasPhoto ? '' : `<text x="${avCx}" y="${avCy + 15}" text-anchor="middle" font-family="${NUM}" font-size="48" font-weight="900" fill="${SOFT}">${esc(d.initials)}</text>`}
  <text x="${textX}" y="${y + 76}" font-family="${NUM}" font-size="${nameSize}" font-weight="900" letter-spacing="1.5" fill="${WHITE}">${esc(name)} <tspan fill="${MUTED}">#${esc(d.number)}</tspan></text>
  <text x="${textX}" y="${y + 128}" font-family="${NUM}" font-size="${lineSize}" font-weight="900" fill="${SOFT}">${esc(line)}</text>
  <circle cx="${x + 42}" cy="${stripY + stripH / 2}" r="9" fill="${esc(d.teamColor)}"/>
  <text x="${x + 64}" y="${stripY + 40}" font-family="${BODY}" font-size="27" font-weight="700" letter-spacing="3" fill="${SOFT}">${esc(strip)}</text>
  <text x="${boxR - 36}" y="${stripY + 40}" text-anchor="end" font-family="${BODY}" font-size="27" font-weight="700" letter-spacing="3" fill="${SOFT}">FINAL · ${esc(d.dateShort.toUpperCase())}</text>
  <text x="${W - 90}" y="${H - 60}" text-anchor="end" font-family="${NUM}" font-size="54" font-weight="900" letter-spacing="3" fill="${WHITE}" filter="url(#sh)">WKND</text>
  <circle cx="${W - 66}" cy="${H - 78}" r="11" fill="${accent.bg}"/>
</svg>`;
  return { svg, photoBox };
}

// ── F · Jersey ────────────────────────────────────────────────────────────────────────────
async function jersey(d, measure) {
  const { accent } = d;
  const parts = d.displayName.split(' ');
  const last = (parts.pop() || '').toUpperCase(), first = parts.join(' ').toUpperCase();
  let lastSize = 192;
  const lastW = await measure(last, { fontFamily: NUM, fontSize: lastSize, fontWeight: 900, letterSpacing: 3 });
  if (lastW > W - 108) lastSize = Math.floor(lastSize * (W - 108) / lastW);
  let stats = ranked(d.stat);
  if (d.hideZeros) stats = stats.filter((s, i) => i === 0 || s.v > 0);
  const cols = stats.length, colW = (W - 108) / cols, gridY = 1560, gridH = 186;
  const cells = stats.map((s, i) => {
    const cx = 54 + colW * i + colW / 2, hero = i === 0;
    return `<text x="${cx}" y="${gridY + 110}" text-anchor="middle" font-family="${NUM}" font-size="${hero ? 102 : 84}" font-weight="900" fill="${hero ? accent.bg : WHITE}">${s.v}</text>
    <text x="${cx}" y="${gridY + 156}" text-anchor="middle" font-family="${BODY}" font-size="27" font-weight="800" letter-spacing="4" fill="${MUTED}">${CAT[s.k]}</text>
    ${i < cols - 1 ? `<rect x="${54 + colW * (i + 1)}" y="${gridY + 24}" width="3" height="${gridH - 48}" fill="#ffffff" fill-opacity="0.12"/>` : ''}`;
  }).join('\n');
  const num = String(d.number ?? '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>${DEFS}${scrim()}</defs>
  <rect x="0" y="760" width="${W}" height="1160" fill="url(#scrim)"/>
  ${num ? `<text x="${W + 40}" y="1500" text-anchor="end" font-family="${NUM}" font-size="${num.length > 2 ? 640 : 900}" font-weight="900" letter-spacing="-20" fill="none" stroke="${accent.bg}" stroke-width="6" stroke-opacity="0.55">${esc(num)}</text>` : ''}
  ${first ? `<text x="54" y="${gridY - 40 - lastSize * 0.86}" font-family="${BODY}" font-size="36" font-weight="700" letter-spacing="9" fill="${SOFT}">${esc(first)}</text>` : ''}
  <text x="54" y="${gridY - 40}" font-family="${NUM}" font-size="${lastSize}" font-weight="900" letter-spacing="3" fill="${WHITE}" filter="url(#txt)">${esc(last)}</text>
  <rect x="54" y="${gridY}" width="${W - 108}" height="6" fill="${accent.bg}"/>
  <rect x="54" y="${gridY + gridH}" width="${W - 108}" height="3" fill="#ffffff" fill-opacity="0.18"/>
  ${cells}
  <circle cx="66" cy="${H - 76}" r="10" fill="${esc(d.teamColor)}"/>
  <text x="90" y="${H - 66}" font-family="${BODY}" font-size="30" font-weight="700" letter-spacing="3" fill="${SOFT}">${esc(d.teamName)} vs ${esc(d.oppName)} · ${esc(result(d))}</text>
  <text x="${W - 54}" y="${H - 66}" text-anchor="end" font-family="${BODY}" font-size="30" font-weight="700" letter-spacing="3" fill="${MUTED}">@WKNDBASKETBALL</text>
</svg>`;
  return { svg };
}

const RENDER = { usual, receipt, cover, poster, bug, jersey };

// d: { gameId, displayName, shortName, initials, number, teamName, teamColor, oppName,
//      cardName (first given name + surname), myScore, oppScore, won, mySideScore, otherSideScore, otherTeamName, dateShort, dateLong,
//      stat, season: { label, games, avg, high }, accent: {bg,text}, hideZeros }
// measure(text, { fontFamily, fontSize, fontWeight, letterSpacing }): the text's inked width.
// opts: { photoHref, hasPhoto } for the Corner bug. → { svg, photoBox? }
export function premiumSvg(key, d, measure, opts = {}) {
  const fn = RENDER[key];
  if (!fn) throw new Error(`unknown premium template ${key}`);
  return fn(d, measure, opts);
}

// ── On the phone ──────────────────────────────────────────────────────────────────────────
// data: the card's facts as the share screen sends them (no accent; hasPhoto). photoUrl: the
// player's photo, same origin (another site's picture would make the canvas unreadable).
// draw(key, accentKey) → a blob: URL of the SVG with the fonts inside it (an SVG shown as a
// picture can't reach the page's fonts), for the preview and the thumbnails.
// png(svgUrl) → the 1080×1920 PNG blob to save or share.
// The fonts load once: Saira Condensed Black (made for this from assets/fonts, latin only)
// and Archivo (the site's own variable file, every weight). Widths are measured on a canvas
// in the same fonts, as ink (what sharp's trim measures on the server), letter-spacing added.
const FONT_FILES = ['/fonts/sairacondensed-black-latin.woff2', '/fonts/archivo-k3kPo8UDI-1M0wlSV9XAw6lQkqWY8Q82sLydOxI.woff2'];
export function phoneDrawer(data, { photoUrl = null } = {}) {
  const get = u => fetch(u, { credentials: 'same-origin' }).then(r => { if (!r.ok) throw new Error(u); return r.blob(); });
  const asDataUrl = blob => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(blob); });
  const fonts = Promise.all(FONT_FILES.map(get)).then(async ([num, body]) => {
    const faces = [new FontFace('WkndCardNum', await num.arrayBuffer(), { weight: '900' }), new FontFace('WkndCardBody', await body.arrayBuffer(), { weight: '100 900' })];
    await Promise.all(faces.map(f => f.load()));
    faces.forEach(f => document.fonts.add(f));
    const [n64, b64] = (await Promise.all([asDataUrl(num), asDataUrl(body)])).map(u => u.replace(/^data:[^;,]*/, 'data:font/woff2'));
    return `<style>@font-face{font-family:'Saira Condensed';font-weight:900;src:url(${n64}) format('woff2')}@font-face{font-family:'Archivo';font-weight:100 900;src:url(${b64}) format('woff2')}</style>`;
  });
  // A square from the top of the photo (the server crops it the same way), drawn 120px wide.
  const photo = data.hasPhoto && photoUrl ? get(photoUrl).then(blob => new Promise(ok => {
    const u = URL.createObjectURL(blob), im = new Image();
    im.onload = () => {
      const s = 192, c = document.createElement('canvas'), w = im.naturalWidth || s, h = im.naturalHeight || s, k = Math.max(s / w, s / h);
      c.width = c.height = s;
      c.getContext('2d').drawImage(im, (s - w * k) / 2, 0, w * k, h * k);
      URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', 0.88));
    };
    im.onerror = () => { URL.revokeObjectURL(u); ok(null); };
    im.src = u;
  })).catch(() => null) : Promise.resolve(null);
  const ctx = document.createElement('canvas').getContext('2d');
  const measure = (text, { fontFamily, fontSize, fontWeight = 800, letterSpacing = 7 }) => {
    ctx.font = `${fontWeight} ${fontSize}px ${/Saira/.test(fontFamily) ? 'WkndCardNum' : 'WkndCardBody'}`;
    const s = String(text), m = ctx.measureText(s);
    const ink = m.actualBoundingBoxRight != null ? (m.actualBoundingBoxLeft || 0) + m.actualBoundingBoxRight : m.width;
    return ink + letterSpacing * Math.max(0, Array.from(s).length - 1);
  };
  return {
    async draw(key, accentKey) {
      const [css, photoHref] = await Promise.all([fonts, photo]);
      const d = { ...data, accent: SHARE_ACCENTS[accentKey] || SHARE_ACCENTS.amber };
      const { svg } = await premiumSvg(key, d, measure, { photoHref, hasPhoto: !!photoHref });
      return URL.createObjectURL(new Blob([svg.replace(/^(<svg[^>]*>)/, `$1${css}`)], { type: 'image/svg+xml' }));
    },
    png(svgUrl) {
      return new Promise((ok, no) => {
        const im = new Image(W, H);
        im.onload = () => {
          // WebKit can paint an SVG picture a moment before its own fonts are in: one frame's grace.
          (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => new Promise(r => setTimeout(r, 50))).then(() => {
            const c = document.createElement('canvas'); c.width = W; c.height = H;
            c.getContext('2d').drawImage(im, 0, 0, W, H);
            c.toBlob(b => (b ? ok(b) : no(new Error('toBlob'))), 'image/png');
          }, no);
        };
        im.onerror = () => no(new Error('svg'));
        im.src = svgUrl;
      });
    },
  };
}

// The players app loads this as a module script and finds it here.
if (typeof window !== 'undefined') window.wkndShareCards = { PHONE_KEYS, phoneDrawer };
