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
// Papawis-only templates (Paolo, 2026-10-31; mockup claude.ai/artifact/6n8kUsVYSdQqHDFEmPjbiD):
// offered only on a run's card. Run sheet, Light vs Dark and the base Card are free; the rest
// are premium, locked while the player owes for the run like the six above.
export const PAPAWIS_KEYS = ['pwsheet', 'pwsides', 'pwcard', 'pwholo', 'pwback', 'pwticket', 'pwpotd'];
export const PAPAWIS_PREMIUM_KEYS = ['pwholo', 'pwback', 'pwticket', 'pwpotd'];
// What the phone draws. Not Receipt: it's set in a monospace font the phones don't share.
export const PHONE_KEYS = ['usual', 'cover', 'poster', 'bug', 'jersey', ...PAPAWIS_KEYS];
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
const CAT = { pts: 'PTS', reb: 'REB', ast: 'AST', stl: 'STL', blk: 'BLK', fg3m: '3PM' };
const WORD = { pts: ['POINT', 'POINTS'], reb: ['BOARD', 'BOARDS'], ast: ['DIME', 'DIMES'], stl: ['STEAL', 'STEALS'], blk: ['BLOCK', 'BLOCKS'], fg3m: ['THREE', 'THREES'] };
const LONG = { pts: 'Points', reb: 'Rebounds', ast: 'Assists', stl: 'Steals', blk: 'Blocks', fg3m: 'Threes' };
// A Papawis run scored in Basic (server.js pwShareFacts d.pw.basic) records makes, rebounds and
// assists only: its cards show PTS, REB, AST and threes made, never percentages, misses,
// steals, blocks or turnovers, which would read as made-up 100s and 0s (Paolo, 2026-10-31).
const basic = d => !!(d.pw && d.pw.basic);
const statKeys = d => (basic(d) ? ['pts', 'reb', 'ast', 'fg3m'] : ['pts', 'reb', 'ast', 'stl', 'blk']);

// Count stats, biggest first; the first one is the card's hero. PTS wins a tie.
function ranked(stat, keys = ['pts', 'reb', 'ast', 'stl', 'blk']) {
  return keys.map(k => ({ k, v: n(stat[k]) }))
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
function result(d) { return d.resultText ? d.resultText.replace('-', '–') : `${d.won ? 'W' : 'L'} ${d.myScore}–${d.oppScore}`; }
// A Papawis run's card (server.js pwShareFacts) says PAPAWIS once (Paolo, 2026-10-31): in the
// footer, masthead, receipt header or corner mark, whichever the template has. Elsewhere a run is
// a RUN where a game's card says SEASON.
const scope = d => (d.papawis ? 'RUN' : 'SEASON');
// mark: false when the card already says PAPAWIS elsewhere (Cover's masthead).
function footer(d, y, { x0 = 66, x1 = W - 66, color = SOFT, size = 30, mark = true } = {}) {
  return `<text x="${x0}" y="${y}" font-family="${BODY}" font-size="${size}" font-weight="700" letter-spacing="3" fill="${color}">${d.papawis && mark ? 'PAPAWIS' : `vs ${esc(d.oppName)}`} · ${esc(result(d))} · ${esc(d.dateShort.toUpperCase())}</text>
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
  let rows = ranked(d.stat, statKeys(d)).map(({ k, v }) => ({ k, v, avg: d.season.avg ? d.season.avg[k] ?? null : null }));
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
  const unit = d.papawis ? 'RUN' : 'GAME';
  const kicker = hasAvg ? `VS ${scope(d)} AVERAGE · ${d.season.games} ${unit}${d.season.games === 1 ? '' : 'S'}` : d.papawis ? 'FIRST SCORED RUN' : 'FIRST GAME OF THE SEASON';
  const chipW = Math.round(await widthOf(measure, `${scope(d)} HIGH`, NUM, 38, 900, 4)) + 48;
  const kickX = high ? x0 + chipW + 24 : x0;
  const kickSize = await fit(measure, kicker, { font: BODY, size: 31, weight: 700, ls: 4, maxW: W - 66 - kickX });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>${DEFS}${scrim()}</defs>
  <rect x="0" y="${headY - 260}" width="${W}" height="${H - headY + 260}" fill="url(#scrim)"/>
  ${high ? `<rect x="${x0}" y="${headY - 40}" width="${chipW}" height="56" rx="12" fill="${accent.bg}"/>
  <text x="${x0 + chipW / 2}" y="${headY - 12}" text-anchor="middle" dominant-baseline="central" font-family="${NUM}" font-size="38" font-weight="900" letter-spacing="4" fill="${accent.text}">${scope(d)} HIGH</text>` : ''}
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
  y += 96; T(d.papawis ? 'PAPAWIS' : 'WKND', { center: true, font: NUM, size: 96, weight: 900, ls: 8 });
  y += 48; T(d.papawis ? 'WKND · RUN RECEIPT' : `GAME RECEIPT · S${d.season.label}`, { center: true, size: 27, weight: 700, ls: 5 });
  y += 38; T(`${d.dateLong.toUpperCase()}${stat.minutes ? ` · ${stat.minutes} MIN` : ''}`, { center: true, size: 26, color: '#5b6475' });
  y += 34; lines.push({ y, rule: true });
  y += 58; T('CUSTOMER', { weight: 700, right: d.shortName.toUpperCase() });
  y += lh; T('ORDER', { right: `vs ${d.oppName}` });
  y += 30; lines.push({ y, rule: true });
  y += 30;
  for (const { k, v } of ranked(stat, statKeys(d)).filter(r => r.k !== 'pts' && (!d.hideZeros || r.v > 0))) { y += lh; T(LONG[k].toUpperCase(), { right: String(v) }); }
  if (!basic(d)) for (const s of shooting(stat)) if (s.a && (!d.hideZeros || s.pct > 0)) { y += lh; T(`${s.label} ${s.m}/${s.a}`, { right: `${s.pct}%` }); }
  y += 30; lines.push({ y, rule: true });
  y += 120; T('TOTAL PTS', { weight: 700, size: 38, big: String(n(stat.pts)) });
  y += 52; T('RESULT', { size: 27, color: '#5b6475', right: result(d) });
  if (basic(d)) { y += 40; T('GAMES', { size: 27, color: '#5b6475', right: String(d.pw.games.length) }); }
  else { y += 40; T('TURNOVERS', { size: 27, color: '#5b6475', right: `${n(stat.turnover)} (NO REFUNDS)` }); }
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
  const [hero, ...rest] = ranked(stat, statKeys(d));
  const lines = rest.filter(r => r.v > 0).slice(0, 2).map(r => ({ big: `${r.v} ${CAT[r.k]}`, small: '' }));
  const shot = basic(d) ? null : shooting(stat).filter(s => s.a >= 2 && (!d.hideZeros || s.pct > 0)).sort((a, b) => b.pct - a.pct)[0];
  if (shot) lines.push({ big: `${shot.m}/${shot.a}`, small: shot.label === 'FT' ? 'From the line' : shot.label === '3PT' ? 'From three' : 'From the field' });
  const coverLines = lines.map((l, i) => {
    const y = 560 + i * 170;
    return `<text x="${W - 54}" y="${y}" text-anchor="end" font-family="${NUM}" font-size="84" font-weight="900" fill="${WHITE}" filter="url(#txt)">${esc(l.big)}</text>
    ${l.small ? `<text x="${W - 54}" y="${y + 46}" text-anchor="end" font-family="${BODY}" font-size="32" font-weight="700" fill="${WHITE}" filter="url(#txt)">${esc(l.small)}</text>` : ''}`;
  }).join('\n');
  const heroWord = WORD[hero.k][hero.v === 1 ? 0 : 1];
  const mast = d.papawis ? 'PAPAWIS' : 'WKND';
  const mastSize = await fit(measure, mast, { font: NUM, size: 400, ls: -6, maxW: W - 108 });
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
  <text x="54" y="74" font-family="${BODY}" font-size="27" font-weight="800" letter-spacing="6" fill="${WHITE}">${d.papawis ? `${esc(d.teamName)} · vs ${esc(d.oppName)}` : `SEASON ${esc(d.season.label)} · vs ${esc(d.oppName)}`}</text>
  <text x="${W - 54}" y="74" text-anchor="end" font-family="${BODY}" font-size="27" font-weight="800" letter-spacing="6" fill="${WHITE}">${esc(d.dateLong.toUpperCase())}</text>
  <text x="${W / 2}" y="${Math.round(110 + mastSize * 0.72)}" text-anchor="middle" font-family="${NUM}" font-size="${mastSize}" font-weight="900" letter-spacing="-6" fill="${accent.bg}">${mast}</text>
  ${coverLines}
  ${d.season.high ? `<rect x="54" y="1446" width="290" height="54" fill="${accent.bg}"/>
  <text x="199" y="1473" text-anchor="middle" dominant-baseline="central" font-family="${BODY}" font-size="30" font-weight="800" letter-spacing="4" fill="${accent.text}">${scope(d)} HIGH</text>` : ''}
  <text x="40" y="1770" font-family="${NUM}" font-size="340" font-weight="900" fill="${WHITE}" filter="url(#txt)">${hero.v}</text>
  <text x="${wordX}" y="1690" font-family="${NUM}" font-size="${wordSize}" font-weight="900" fill="${WHITE}">${heroWord}</text>
  <text x="${wordX}" y="1748" font-family="${BODY}" font-size="${bylineSize}" font-weight="700" fill="${SOFT}">${esc(byline)}</text>
  <rect x="54" y="1806" width="${W - 108}" height="3" fill="#ffffff" fill-opacity="0.25"/>
  ${footer(d, 1862, { x0: 54, x1: W - 54, mark: false })}
</svg>`;
  return { svg };
}

// ── D · Poster ────────────────────────────────────────────────────────────────────────────
async function poster(d, measure) {
  const { accent } = d;
  const SIZES = [276, 210, 174, 150, 150];
  const rows = ranked(d.stat, statKeys(d)).filter(r => r.v > 0).slice(0, 5);
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
  const [hero, ...rest] = ranked(d.stat, statKeys(d));
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
  <text x="${W - 90}" y="${H - 60}" text-anchor="end" font-family="${NUM}" font-size="54" font-weight="900" letter-spacing="3" fill="${WHITE}" filter="url(#sh)">${d.papawis ? 'PAPAWIS' : 'WKND'}</text>
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
  let stats = ranked(d.stat, statKeys(d));
  if (d.hideZeros) stats = stats.filter((s, i) => i === 0 || s.v > 0);
  const cols = stats.length, colW = (W - 108) / cols, gridY = 1560, gridH = 186;
  const cells = stats.map((s, i) => {
    const cx = 54 + colW * i + colW / 2, hero = i === 0;
    return `<text x="${cx}" y="${gridY + 110}" text-anchor="middle" font-family="${NUM}" font-size="${hero ? 102 : 84}" font-weight="900" fill="${hero ? accent.bg : WHITE}">${s.v}</text>
    <text x="${cx}" y="${gridY + 156}" text-anchor="middle" font-family="${BODY}" font-size="27" font-weight="800" letter-spacing="4" fill="${MUTED}">${CAT[s.k]}</text>
    ${i < cols - 1 ? `<rect x="${54 + colW * (i + 1)}" y="${gridY + 24}" width="3" height="${gridH - 48}" fill="#ffffff" fill-opacity="0.12"/>` : ''}`;
  }).join('\n');
  const num = String(d.number ?? '');
  // The footer fits beside the handle (a Papawis side, "PAPAWIS · LIGHT", runs longer).
  const foot = `${d.papawis ? 'PAPAWIS · ' : ''}${d.teamName} vs ${d.oppName} · ${result(d)}`;
  const footSize = await fit(measure, foot, { font: BODY, size: 30, weight: 700, ls: 3, maxW: W - 54 - 90 - 40 - Math.round(await widthOf(measure, '@WKNDBASKETBALL', BODY, 30, 700, 3)) });
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
  <text x="90" y="${H - 66}" font-family="${BODY}" font-size="${footSize}" font-weight="700" letter-spacing="3" fill="${SOFT}">${esc(foot)}</text>
  <text x="${W - 54}" y="${H - 66}" text-anchor="end" font-family="${BODY}" font-size="30" font-weight="700" letter-spacing="3" fill="${MUTED}">@WKNDBASKETBALL</text>
</svg>`;
  return { svg };
}

// ── Papawis-only templates ─────────────────────────────────────────────────────────────────
// Offered only on a run's card (d.pw, server.js pwShareFacts): the day's games, the Light and
// Dark shirts, the player's slot, Player of the Day, and a trading card. Overlays like the rest:
// the photo stays clear at the top, the numbers sit on a fade at the bottom (the Ticket and the
// card back float on the photo with a shadow, the card fronts frame it).
const SIDE_WORD = { light: 'LIGHT', dark: 'DARK' };
const SHIRT = { light: '#eef1f6', dark: '#1b2130' };
const wl = g => (g.my > g.opp ? 'W' : g.my < g.opp ? 'L' : 'T');
const dash = s => String(s).replace('-', '–');
// "06:00" → "6:00 AM"
function tipText(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ''));
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}
// "Jose Paolo TY" → { first: 'JOSE PAOLO', last: 'TY' }
function nameParts(d) {
  const parts = String(d.displayName || '').trim().split(/\s+/);
  const last = (parts.pop() || '').toUpperCase();
  return { first: parts.join(' ').toUpperCase(), last };
}
// Words into lines no wider than maxW at this size.
async function wrap(measure, text, { font, size, weight = 600, maxW }) {
  const lines = [];
  let cur = '';
  for (const w of String(text).split(/\s+/)) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && await widthOf(measure, next, font, size, weight, 0) > maxW) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}
const handleText = (x, y, anchor = 'end', fill = MUTED) => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${BODY}" font-size="28" font-weight="700" letter-spacing="3" fill="${fill}" filter="url(#txt)">@WKNDBASKETBALL</text>`;
const kicker = (x, y, text, accent, anchor = 'start') => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${BODY}" font-size="30" font-weight="800" letter-spacing="8" fill="${accent.bg}" filter="url(#txt)">${esc(text)}</text>`;
const topFade = `<linearGradient id="top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0e16" stop-opacity="0.55"/><stop offset="1" stop-color="#0a0e16" stop-opacity="0"/></linearGradient>`;

// ── Run sheet: each game, then the day's totals ──────────────────────────────────────────────
async function pwsheet(d, measure) {
  const { accent, stat, pw } = d;
  const x0 = 66, x1 = W - 66;
  const games = pw.games.length > 1 ? pw.games.slice(0, 5) : [];
  const rowH = games.length > 3 ? 104 : 124;
  const footY = H - 66;
  const totLabelY = footY - 76, totNumY = totLabelY - 44, ruleY = totNumY - 112;
  const rowsTop = ruleY - 24 - games.length * rowH;
  const subY = rowsTop - 40, nameY = subY - 58;
  const { first, last } = nameParts(d);
  const name = `${first} ${last}`.trim();
  const nameSize = await fit(measure, name, { font: NUM, size: 120, ls: 1, maxW: x1 - x0 });
  const sub = [`#${d.number}`, SIDE_WORD[pw.side], d.dateShort.toUpperCase(), pw.court.toUpperCase()].filter(Boolean).join(' · ');
  const subSize = await fit(measure, sub, { font: BODY, size: 30, weight: 700, ls: 4, maxW: x1 - x0 });
  const rows = games.map((g, i) => {
    const top = rowsTop + i * rowH, mid = top + rowH / 2, r = wl(g);
    const badge = r === 'W' ? accent.bg : r === 'L' ? '#2a3142' : '#3a4256';
    return `<rect x="${x0}" y="${top}" width="${x1 - x0}" height="2" fill="#ffffff" fill-opacity="0.16"/>
    <text x="${x0}" y="${mid + 11}" font-family="${BODY}" font-size="30" font-weight="800" letter-spacing="4" fill="${MUTED}">G${g.n}</text>
    <rect x="${x0 + 84}" y="${mid - 30}" width="60" height="60" rx="10" fill="${badge}"/>
    <text x="${x0 + 114}" y="${mid}" text-anchor="middle" dominant-baseline="central" font-family="${NUM}" font-size="40" font-weight="900" fill="${r === 'W' ? accent.text : SOFT}">${r}</text>
    <text x="${x0 + 168}" y="${mid + 30}" font-family="${NUM}" font-size="84" font-weight="900" fill="${WHITE}" filter="url(#txt)">${g.my}–${g.opp}</text>
    <text x="${x1}" y="${mid + 8}" text-anchor="end" font-family="${NUM}" font-size="60" font-weight="900" fill="${WHITE}">${g.line.pts} · ${g.line.reb} · ${g.line.ast}</text>
    <text x="${x1}" y="${mid + 40}" text-anchor="end" font-family="${BODY}" font-size="21" font-weight="700" letter-spacing="4" fill="${MUTED}">PTS REB AST</text>`;
  }).join('\n');
  const tot = [['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST'], ['fg3m', '3PM']];
  const colW = (x1 - x0) / tot.length;
  const totals = tot.map(([k, l], i) => {
    const cx = x0 + colW * i + colW / 2;
    return `<text x="${cx}" y="${totNumY}" text-anchor="middle" font-family="${NUM}" font-size="112" font-weight="900" fill="${i === 0 ? accent.bg : WHITE}" filter="url(#txt)">${n(stat[k])}</text>
    <text x="${cx}" y="${totLabelY}" text-anchor="middle" font-family="${BODY}" font-size="26" font-weight="800" letter-spacing="5" fill="${MUTED}">${l}</text>`;
  }).join('\n');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>${DEFS}${scrim()}${topFade}</defs>
  <rect x="0" y="0" width="${W}" height="300" fill="url(#top)"/>
  <rect x="0" y="${nameY - 420}" width="${W}" height="${H - nameY + 420}" fill="url(#scrim)"/>
  ${kicker(x0, 110, 'PAPAWIS · RUN SHEET', accent)}
  <text x="${x0}" y="${nameY}" font-family="${NUM}" font-size="${nameSize}" font-weight="900" letter-spacing="1" fill="${WHITE}" filter="url(#txt)">${esc(name)}</text>
  <text x="${x0}" y="${subY}" font-family="${BODY}" font-size="${subSize}" font-weight="700" letter-spacing="4" fill="${SOFT}">${esc(sub)}</text>
  ${rows}
  <rect x="${x0}" y="${ruleY}" width="${x1 - x0}" height="6" fill="${accent.bg}"/>
  ${totals}
  <text x="${x0}" y="${footY}" font-family="${BODY}" font-size="28" font-weight="700" letter-spacing="3" fill="${SOFT}">${esc(result(d))}</text>
  ${handleText(x1, footY)}
</svg>`;
  return { svg };
}

// ── Light vs Dark: a two-shirt scoreboard, game by game ──────────────────────────────────────
async function pwsides(d, measure) {
  const { accent, stat, pw } = d;
  const x0 = 66, x1 = W - 66;
  const games = pw.games.slice(0, 5);
  const colW = Math.min(150, 620 / Math.max(1, games.length));
  const footY = H - 66, rowH = 124, gap = 14;
  const darkTop = footY - 70 - rowH, lightTop = darkTop - gap - rowH, headY = lightTop - 24;
  const lineY = headY - 56, nameY = lineY - 84;
  const mine = pw.side;
  const name = `${nameParts(d).first} ${nameParts(d).last}`.trim();
  const nameSize = await fit(measure, name, { font: NUM, size: 112, ls: 1, maxW: x1 - x0 });
  const line = `${n(stat.pts)} PTS · ${n(stat.reb)} REB · ${n(stat.ast)} AST`;
  const colX = i => x1 - 28 - colW * (games.length - 1 - i) - colW / 2;
  const youX = {};
  for (const sd of ['light', 'dark']) youX[sd] = x0 + 34 + Math.round(await widthOf(measure, SIDE_WORD[sd], BODY, 60, 900, 2)) + 24;
  const row = (side, top) => {
    const me = side === mine, light = side === 'light';
    const ink = light ? '#0d121c' : WHITE;
    const scores = games.map((g, i) => {
      // Each game's score for this row's side: mine is g.my when I played this side.
      const v = side === mine ? g.my : g.opp, other = side === mine ? g.opp : g.my;
      return `<text x="${colX(i)}" y="${top + rowH / 2 + 30}" text-anchor="middle" font-family="${NUM}" font-size="84" font-weight="900" fill="${ink}" fill-opacity="${v >= other ? 1 : 0.42}">${v}</text>`;
    }).join('');
    const youW = 104;
    return `<rect x="${x0}" y="${top}" width="${x1 - x0}" height="${rowH}" rx="20" fill="${SHIRT[side]}" fill-opacity="${light ? 1 : 0.94}" ${me ? `stroke="${accent.bg}" stroke-width="8"` : light ? '' : 'stroke="#ffffff" stroke-opacity="0.14" stroke-width="3"'}/>
    <text x="${x0 + 34}" y="${top + rowH / 2 + 22}" font-family="${BODY}" font-size="60" font-weight="900" letter-spacing="2" fill="${ink}">${SIDE_WORD[side]}</text>
    ${me ? `<rect x="${youX[side]}" y="${top + rowH / 2 - 22}" width="${youW}" height="44" rx="22" fill="${accent.bg}"/>
    <text x="${youX[side] + youW / 2}" y="${top + rowH / 2}" text-anchor="middle" dominant-baseline="central" font-family="${BODY}" font-size="24" font-weight="800" letter-spacing="4" fill="${accent.text}">YOU</text>` : ''}
    ${scores}`;
  };
  const heads = games.map((g, i) => `<text x="${colX(i)}" y="${headY}" text-anchor="middle" font-family="${BODY}" font-size="24" font-weight="800" letter-spacing="4" fill="${MUTED}">G${g.n}</text>`).join('');
  const foot = [result(d), pw.court.toUpperCase()].filter(Boolean).join(' · ');
  const footSize = await fit(measure, foot, { font: BODY, size: 28, weight: 700, ls: 3, maxW: x1 - x0 - 380 });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>${DEFS}${scrim()}${topFade}</defs>
  <rect x="0" y="0" width="${W}" height="300" fill="url(#top)"/>
  <rect x="0" y="${nameY - 420}" width="${W}" height="${H - nameY + 420}" fill="url(#scrim)"/>
  ${kicker(x0, 110, `PAPAWIS · ${d.dateShort.toUpperCase()}`, accent)}
  <text x="${x0}" y="${nameY}" font-family="${NUM}" font-size="${nameSize}" font-weight="900" letter-spacing="1" fill="${WHITE}" filter="url(#txt)">${esc(name)}</text>
  <text x="${x0}" y="${lineY}" font-family="${NUM}" font-size="60" font-weight="900" fill="${WHITE}">${esc(line)} <tspan fill="${MUTED}" font-family="${BODY}" font-size="28" font-weight="700">#${esc(d.number)}</tspan></text>
  ${heads}
  ${row('light', lightTop)}
  ${row('dark', darkTop)}
  <text x="${x0}" y="${footY}" font-family="${BODY}" font-size="${footSize}" font-weight="700" letter-spacing="3" fill="${SOFT}">${esc(foot)}</text>
  ${handleText(x1, footY)}
</svg>`;
  return { svg };
}

// ── Ticket: the player's slot as a used ticket, stuck on the photo ───────────────────────────
async function pwticket(d, measure) {
  const { accent, stat, pw } = d;
  const tw = 720, pad = 56, band = 230;
  const ink = '#1a1d24', grey = '#6b6f78', paper = '#f3eee4';
  const kv = [['PLAYER', d.shortName.toUpperCase()], ['SHIRT', SIDE_WORD[pw.side]], ['COURT', pw.court.toUpperCase() || 'PAPAWIS'], ['TIP-OFF', [d.dateShort.toUpperCase(), tipText(pw.tip)].filter(Boolean).join(' · ')]];
  const colW = (tw - pad * 2) / 2;
  const kvSvg = (await Promise.all(kv.map(async ([k, v], i) => {
    const x = pad + (i % 2) * colW, y = band + 76 + Math.floor(i / 2) * 112;
    const size = await fit(measure, v, { font: BODY, size: 36, weight: 800, maxW: colW - 24 });
    return `<text x="${x}" y="${y}" font-family="${BODY}" font-size="22" font-weight="700" letter-spacing="5" fill="${grey}">${k}</text>
      <text x="${x}" y="${y + 46}" font-family="${BODY}" font-size="${size}" font-weight="800" fill="${ink}">${esc(v)}</text>`;
  }))).join('');
  const perfY = band + 76 + 224 + 20;
  const stats = [[n(stat.pts), 'PTS'], [n(stat.reb), 'REB'], [n(stat.ast), 'AST'], [`${pw.wl.w}–${pw.wl.l}`, 'W–L']];
  const sw = (tw - pad * 2) / 4;
  const statSvg = stats.map(([v, l], i) => `<text x="${pad + sw * i + sw / 2}" y="${perfY + 132}" text-anchor="middle" font-family="${NUM}" font-size="96" font-weight="900" fill="${i === 0 ? '#d06f12' : ink}">${v}</text>
    <text x="${pad + sw * i + sw / 2}" y="${perfY + 172}" text-anchor="middle" font-family="${BODY}" font-size="22" font-weight="800" letter-spacing="5" fill="${grey}">${l}</text>`).join('');
  const stubY = perfY + 250, th = stubY + 70;
  const tx = W - 60 - tw, ty = H - 230 - th;
  const games = `${pw.games.length} GAME${pw.games.length === 1 ? '' : 'S'} PLAYED`;
  const titleSize = await fit(measure, 'PAPAWIS', { font: NUM, size: 150, ls: 2, maxW: tw - pad * 2 });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>${DEFS}
    <filter id="drop" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="36" stdDeviation="34" flood-color="#000" flood-opacity="0.55"/></filter>
    <mask id="notch"><rect x="0" y="0" width="${tw}" height="${th}" fill="#fff"/><circle cx="0" cy="${perfY}" r="30" fill="#000"/><circle cx="${tw}" cy="${perfY}" r="30" fill="#000"/></mask>
    <clipPath id="tk"><rect x="0" y="0" width="${tw}" height="${th}" rx="34"/></clipPath>
  </defs>
  <g transform="translate(${tx} ${ty}) rotate(-4 ${tw / 2} ${th / 2})" filter="url(#drop)">
    <g mask="url(#notch)" clip-path="url(#tk)">
      <rect x="0" y="0" width="${tw}" height="${th}" fill="${paper}"/>
      <rect x="0" y="0" width="${tw}" height="${band}" fill="${accent.bg}"/>
    </g>
    <text x="${pad}" y="72" font-family="${BODY}" font-size="26" font-weight="800" letter-spacing="9" fill="${accent.text}">ADMIT ONE · RUN #${pw.runNo}</text>
    <text x="${pad - 4}" y="196" font-family="${NUM}" font-size="${titleSize}" font-weight="900" letter-spacing="2" fill="${accent.text}">PAPAWIS</text>
    ${kvSvg}
    <line x1="40" y1="${perfY}" x2="${tw - 40}" y2="${perfY}" stroke="#b9b2a3" stroke-width="5" stroke-dasharray="16 12"/>
    ${statSvg}
    <line x1="${pad}" y1="${stubY - 40}" x2="${tw - pad}" y2="${stubY - 40}" stroke="#d8d1c2" stroke-width="3"/>
    <text x="${pad}" y="${stubY + 10}" font-family="${BODY}" font-size="26" font-weight="800" letter-spacing="5" fill="${ink}">${games}</text>
    <rect x="${tw - pad - 124}" y="${stubY - 26}" width="124" height="50" rx="10" fill="${ink}"/>
    <text x="${tw - pad - 62}" y="${stubY - 1}" text-anchor="middle" dominant-baseline="central" font-family="${BODY}" font-size="24" font-weight="800" letter-spacing="5" fill="${paper}">USED</text>
  </g>
  ${handleText(66, H - 80, 'start', WHITE)}
</svg>`;
  return { svg };
}

// ── Player of the Day: the photo is the player; crown up top, the title over the fade ────────
async function pwpotd(d, measure) {
  const { accent, stat, pw } = d;
  const x0 = 66, x1 = W - 66;
  const footY = H - 66, statLabelY = footY - 70, statNumY = statLabelY - 42;
  const subY = statNumY - 140, nameY = subY - 52;
  const titleSize = 230, lh = Math.round(titleSize * 0.84);
  const t3 = nameY - 64, t2 = t3 - lh, t1 = t2 - lh;
  const name = `${nameParts(d).first} ${nameParts(d).last} · #${d.number}`.trim();
  const nameSize = await fit(measure, name, { font: BODY, size: 46, weight: 800, ls: 4, maxW: x1 - x0 });
  const sub = [SIDE_WORD[pw.side], result(d), pw.court.toUpperCase()].filter(Boolean).join(' · ');
  const subSize = await fit(measure, sub, { font: BODY, size: 30, weight: 700, ls: 4, maxW: x1 - x0 });
  const sizeOf = w => fit(measure, w, { font: NUM, size: titleSize, ls: -2, maxW: x1 - x0 });
  const [s1, s2, s3] = await Promise.all(['PLAYER', 'OF THE', 'DAY'].map(sizeOf));
  const cols = [[n(stat.pts), 'PTS'], [n(stat.reb), 'REB'], [n(stat.ast), 'AST']];
  const statSvg = cols.map(([v, l], i) => `<text x="${x0 + i * 250}" y="${statNumY}" font-family="${NUM}" font-size="120" font-weight="900" fill="${i === 0 ? accent.bg : WHITE}" filter="url(#txt)">${v}</text>
    <text x="${x0 + i * 250 + 4}" y="${statLabelY}" font-family="${BODY}" font-size="26" font-weight="800" letter-spacing="5" fill="${MUTED}">${l}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>${DEFS}${scrim()}${topFade}</defs>
  <rect x="0" y="0" width="${W}" height="320" fill="url(#top)"/>
  <rect x="0" y="${t1 - titleSize - 260}" width="${W}" height="${H - t1 + titleSize + 260}" fill="url(#scrim)"/>
  <path transform="translate(${x0} 62) scale(3.4)" d="M2 18 0 4l9 6 7-10 7 10 9-6-2 14z" fill="${accent.bg}" filter="url(#txt)"/>
  ${kicker(x1, 110, `PAPAWIS · ${d.dateShort.toUpperCase()}`, accent, 'end')}
  <text x="${x0 - 6}" y="${t1}" font-family="${NUM}" font-size="${s1}" font-weight="900" letter-spacing="-2" fill="${WHITE}" filter="url(#txt)">PLAYER</text>
  <text x="${x0 - 6}" y="${t2}" font-family="${NUM}" font-size="${s2}" font-weight="900" letter-spacing="-2" fill="${WHITE}" filter="url(#txt)">OF THE</text>
  <text x="${x0 - 6}" y="${t3}" font-family="${NUM}" font-size="${s3}" font-weight="900" letter-spacing="-2" fill="${accent.bg}" filter="url(#txt)">DAY</text>
  <text x="${x0}" y="${nameY}" font-family="${BODY}" font-size="${nameSize}" font-weight="800" letter-spacing="4" fill="${WHITE}">${esc(name)}</text>
  <text x="${x0}" y="${subY}" font-family="${BODY}" font-size="${subSize}" font-weight="700" letter-spacing="4" fill="${SOFT}">${esc(sub)}</text>
  ${statSvg}
  ${handleText(x1, footY)}
</svg>`;
  return { svg };
}

// ── Trading card, front: a frame with a clear window, so the photo is the card ──────────────
// Base: dark frame with an accent rule. Holo: rainbow foil, offered to the day's top 3 by
// rating, with its serial stamp: the player's rank out of everyone who played.
const CARD = { side: 54, top: 162, winBottom: 1400 };
async function cardFront(d, measure, holo) {
  const { accent, stat, pw } = d;
  const { side: sx, top, winBottom } = CARD;
  const ink = holo ? '#111111' : WHITE;
  const { first, last } = nameParts(d);
  const bannerTop = winBottom - 120, bannerH = 300, bx0 = sx, bx1 = W - sx;
  const lastSize = await fit(measure, last, { font: NUM, size: 176, ls: 1, maxW: bx1 - bx0 - 140 });
  const firstSize = await fit(measure, first || ' ', { font: BODY, size: 38, weight: 800, ls: 8, maxW: bx1 - bx0 - 140 });
  const chips = [`#${d.number}`, (pw.positions || []).join(' · '), `${SIDE_WORD[pw.side]}`].filter(Boolean);
  const chipInk = holo ? WHITE : accent.text;
  let cx = bx0 + 44;
  const chipSvg = (await Promise.all(chips.map(async (c, i) => {
    const dot = i === chips.length - 1;
    const w = Math.round(await widthOf(measure, c, BODY, 26, 800, 4)) + 36 + (dot ? 30 : 0);
    const x = cx; cx += w + 14;
    return `<rect x="${x}" y="${bannerTop + 222}" width="${w}" height="50" rx="10" fill="none" stroke="${chipInk}" stroke-width="3"/>
    ${dot ? `<circle cx="${x + 26}" cy="${bannerTop + 247}" r="10" fill="${SHIRT[pw.side]}" stroke="${chipInk}" stroke-width="2"/>` : ''}
    <text x="${x + 18 + (dot ? 30 : 0)}" y="${bannerTop + 256}" font-family="${BODY}" font-size="26" font-weight="800" letter-spacing="4" fill="${chipInk}">${esc(c)}</text>`;
  }))).join('');
  const stats = [[n(stat.pts), 'PTS'], [n(stat.reb), 'REB'], [n(stat.ast), 'AST'], [`${pw.wl.w}–${pw.wl.l}`, 'W–L']];
  const sw = (bx1 - bx0) / 4, statY = bannerTop + bannerH + 140;
  const statSvg = stats.map(([v, l], i) => `<text x="${bx0 + sw * i + sw / 2}" y="${statY}" text-anchor="middle" font-family="${NUM}" font-size="104" font-weight="900" fill="${i === 0 && !holo ? accent.bg : ink}">${v}</text>
    <text x="${bx0 + sw * i + sw / 2}" y="${statY + 42}" text-anchor="middle" font-family="${BODY}" font-size="24" font-weight="800" letter-spacing="5" fill="${ink}" fill-opacity="0.7">${l}</text>`).join('');
  const frame = `M0 0H${W}V${H}H0Z M${sx} ${top}V${winBottom}H${W - sx}V${top}Z`;
  const tagW = Math.round(await widthOf(measure, `RUN ${pw.runNo}`, BODY, 24, 800, 6)) + 36;
  const where = [d.dateShort.toUpperCase(), pw.court.toUpperCase()].filter(Boolean).join(' · ');
  const whereSize = await fit(measure, where, { font: BODY, size: 24, weight: 700, ls: 4, maxW: bx1 - bx0 - 24 - Math.round(await widthOf(measure, '@WKNDBASKETBALL', BODY, 24, 700, 4)) - 40 });
  const setW = Math.round(await widthOf(measure, 'PAPAWIS', NUM, 84, 900, 3));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>${DEFS}
    <linearGradient id="foil" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${accent.bg}"/><stop offset="0.22" stop-color="#ffd36e"/><stop offset="0.45" stop-color="#7de3ff"/>
      <stop offset="0.65" stop-color="#b18cff"/><stop offset="0.85" stop-color="#ff8ac2"/><stop offset="1" stop-color="${accent.bg}"/>
    </linearGradient>
    <pattern id="shine" width="150" height="150" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
      <rect x="0" y="0" width="22" height="150" fill="#ffffff" fill-opacity="0.32"/><rect x="34" y="0" width="6" height="150" fill="#ffffff" fill-opacity="0.22"/>
    </pattern>
  </defs>
  <path d="${frame}" fill-rule="evenodd" fill="${holo ? 'url(#foil)' : '#0e1320'}"/>
  ${holo ? `<path d="${frame}" fill-rule="evenodd" fill="url(#shine)"/>` : ''}
  <rect x="${sx}" y="${top}" width="${W - sx * 2}" height="${winBottom - top}" fill="none" stroke="${holo ? '#ffffff' : accent.bg}" stroke-opacity="${holo ? 0.7 : 1}" stroke-width="8"/>
  <text x="${sx + 12}" y="112" font-family="${NUM}" font-size="84" font-weight="900" letter-spacing="3" fill="${ink}">PAPAWIS</text>
  <rect x="${sx + 12 + setW + 24}" y="64" width="${tagW}" height="48" rx="10" fill="none" stroke="${holo ? '#111111' : accent.bg}" stroke-width="3"/>
  <text x="${sx + 12 + setW + 24 + tagW / 2}" y="88" text-anchor="middle" dominant-baseline="central" font-family="${BODY}" font-size="24" font-weight="800" letter-spacing="6" fill="${holo ? '#111111' : accent.bg}">RUN ${pw.runNo}</text>
  <text x="${W - sx - 12}" y="104" text-anchor="end" font-family="${BODY}" font-size="30" font-weight="800" letter-spacing="5" fill="${holo ? '#111111' : SOFT}">${esc(d.dateShort.toUpperCase())}</text>
  ${holo ? `<rect x="${W - sx - 36 - 196}" y="${top + 36}" width="196" height="108" rx="14" fill="#0a0e16" fill-opacity="0.86" stroke="#ffd36e" stroke-width="4"/>
  <text x="${W - sx - 36 - 98}" y="${top + 74}" text-anchor="middle" font-family="${BODY}" font-size="20" font-weight="800" letter-spacing="6" fill="#ffd36e">RANK</text>
  <text x="${W - sx - 36 - 98}" y="${top + 128}" text-anchor="middle" font-family="${NUM}" font-size="56" font-weight="900" letter-spacing="2" fill="${WHITE}">${String(pw.rank).padStart(2, '0')}/${pw.of}</text>` : ''}
  <polygon points="${bx0},${bannerTop} ${bx1},${bannerTop} ${bx1 - 40},${bannerTop + bannerH} ${bx0},${bannerTop + bannerH}" fill="${holo ? '#0e1320' : accent.bg}"/>
  ${first ? `<text x="${bx0 + 44}" y="${bannerTop + 62}" font-family="${BODY}" font-size="${firstSize}" font-weight="800" letter-spacing="8" fill="${chipInk}">${esc(first)}</text>` : ''}
  <text x="${bx0 + 38}" y="${bannerTop + 196}" font-family="${NUM}" font-size="${lastSize}" font-weight="900" letter-spacing="1" fill="${chipInk}">${esc(last)}</text>
  ${chipSvg}
  ${statSvg}
  <text x="${bx0 + 12}" y="${H - 44}" font-family="${BODY}" font-size="${whereSize}" font-weight="700" letter-spacing="4" fill="${ink}" fill-opacity="0.7">${esc(where)}</text>
  <text x="${bx1 - 12}" y="${H - 44}" text-anchor="end" font-family="${BODY}" font-size="24" font-weight="700" letter-spacing="4" fill="${ink}" fill-opacity="0.7">@WKNDBASKETBALL</text>
</svg>`;
  return { svg };
}
const pwcard = (d, measure) => cardFront(d, measure, false);
const pwholo = (d, measure) => cardFront(d, measure, true);

// ── Trading card, back: the stats side, floating on the photo ─────────────────────────────────
async function pwback(d, measure) {
  const { accent, stat, pw } = d;
  const cw = 880, frame = 26, ink = '#141923', grey = '#5b6475';
  const games = pw.games.slice(0, 5);
  const ix = frame + 40, iw = cw - frame * 2 - 80;
  const topH = 170, bioH = 120;
  const tableY = frame + topH + bioH + 120, rowH = 66;
  const rowsEnd = tableY + 40 + (games.length + 1) * rowH;
  const factLines = await wrap(measure, pw.fact, { font: BODY, size: 32, weight: 600, maxW: iw - 40 });
  const factY = rowsEnd + 70;
  const ch = factY + factLines.length * 46 + 150;
  const cxp = (W - cw) / 2, cyp = Math.round((H - ch) / 2) - 40;
  const { first, last } = nameParts(d);
  const name = `${first} ${last}`.trim();
  const nameSize = await fit(measure, name, { font: NUM, size: 72, ls: 1, maxW: cw - frame * 2 - 220 });
  const bio = [['POS', (pw.positions || []).join(' · ') || '—'], ['SHIRT', SIDE_WORD[pw.side]], ['RUNS', String(pw.runNo)]];
  const bw = (cw - frame * 2) / 3;
  const bioSvg = (await Promise.all(bio.map(async ([k, v], i) => {
    const x = frame + 40 + bw * i;
    const size = await fit(measure, v, { font: NUM, size: 48, maxW: bw - 50 });
    return `<text x="${x}" y="${frame + topH + 42}" font-family="${BODY}" font-size="22" font-weight="800" letter-spacing="5" fill="${accent.text}" fill-opacity="0.75">${k}</text>
    <text x="${x}" y="${frame + topH + 96}" font-family="${NUM}" font-size="${size}" font-weight="900" fill="${accent.text}">${esc(v)}</text>`;
  }))).join('');
  // Game and score sit left; the numbers align right on their column's edge.
  const colsX = [ix, ix + 150, ix + 470, ix + 570, ix + 670, ix + iw];
  const head = ['GAME', 'SCORE', 'PTS', 'REB', 'AST', '3PM'];
  const cell = (i, y, v, o = {}) => `<text x="${colsX[i]}" y="${y}" ${i >= 2 ? 'text-anchor="end"' : ''} font-family="${o.font || NUM}" font-size="${o.size || 44}" font-weight="900" fill="${o.fill || ink}">${esc(v)}</text>`;
  const rows = [...games.map(g => [`G${g.n}`, `${wl(g)} ${g.my}–${g.opp}`, g.line.pts, g.line.reb, g.line.ast, g.line.fg3m]),
    ['DAY', `${pw.wl.w}–${pw.wl.l}`, n(stat.pts), n(stat.reb), n(stat.ast), n(stat.fg3m)]];
  const table = `${head.map((h, i) => `<text x="${colsX[i]}" y="${tableY}" ${i >= 2 ? 'text-anchor="end"' : ''} font-family="${BODY}" font-size="22" font-weight="800" letter-spacing="4" fill="${grey}">${h}</text>`).join('')}
    <rect x="${ix}" y="${tableY + 16}" width="${iw}" height="4" fill="${ink}"/>
    ${rows.map((r, j) => {
      const y = tableY + 40 + j * rowH, tot = j === rows.length - 1;
      return `${tot ? `<rect x="${ix - 12}" y="${y}" width="${iw + 24}" height="${rowH}" fill="#e1e5ec"/>` : `<rect x="${ix}" y="${y + rowH - 2}" width="${iw}" height="2" fill="#cfd4dd"/>`}
      ${r.map((v, i) => cell(i, y + 48, v, i === 0 ? { font: BODY, size: 28 } : {})).join('')}`;
    }).join('')}`;
  const fact = factLines.map((l, i) => `<text x="${ix + 28}" y="${factY + i * 46}" font-family="${BODY}" font-size="32" font-weight="600" fill="#2c3340">${esc(l)}</text>`).join('');
  const place = (pw.place || pw.court).toUpperCase();
  const placeSize = await fit(measure, place || ' ', { font: BODY, size: 24, weight: 700, ls: 4, maxW: iw - 200 });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>${DEFS}
    <filter id="drop" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="40" stdDeviation="40" flood-color="#000" flood-opacity="0.55"/></filter>
    <clipPath id="cb"><rect x="0" y="0" width="${cw}" height="${ch}" rx="36"/></clipPath>
  </defs>
  <g transform="translate(${cxp} ${cyp}) rotate(2 ${cw / 2} ${ch / 2})">
    <rect x="0" y="0" width="${cw}" height="${ch}" rx="36" fill="#0e1320" filter="url(#drop)"/>
    <g clip-path="url(#cb)">
      <rect x="${frame}" y="${frame}" width="${cw - frame * 2}" height="${ch - frame * 2}" rx="14" fill="#eef0f4"/>
      <rect x="${frame}" y="${frame}" width="${cw - frame * 2}" height="${topH}" fill="#0e1320"/>
      <rect x="${frame}" y="${frame + topH}" width="${cw - frame * 2}" height="${bioH}" fill="${accent.bg}"/>
    </g>
    <circle cx="${frame + 96}" cy="${frame + topH / 2}" r="58" fill="${accent.bg}"/>
    <text x="${frame + 96}" y="${frame + topH / 2}" text-anchor="middle" dominant-baseline="central" font-family="${NUM}" font-size="${String(d.number).length > 2 ? 48 : 66}" font-weight="900" fill="${accent.text}">${esc(d.number)}</text>
    <text x="${frame + 184}" y="${frame + topH / 2 + 4}" font-family="${NUM}" font-size="${nameSize}" font-weight="900" letter-spacing="1" fill="${WHITE}">${esc(name)}</text>
    <text x="${frame + 186}" y="${frame + topH / 2 + 48}" font-family="${BODY}" font-size="22" font-weight="700" letter-spacing="5" fill="${MUTED}">PAPAWIS · RUN ${pw.runNo} · ${esc(d.dateShort.toUpperCase())}</text>
    ${bioSvg}
    <text x="${ix}" y="${tableY - 46}" font-family="${BODY}" font-size="24" font-weight="800" letter-spacing="6" fill="${grey}">GAME BY GAME</text>
    ${table}
    <rect x="${ix}" y="${factY - 34}" width="8" height="${factLines.length * 46 + 6}" fill="${accent.bg}"/>
    ${fact}
    <line x1="${frame}" y1="${ch - frame - 84}" x2="${cw - frame}" y2="${ch - frame - 84}" stroke="#b6bcc8" stroke-width="3" stroke-dasharray="12 9"/>
    <text x="${ix}" y="${ch - frame - 34}" font-family="${BODY}" font-size="${placeSize}" font-weight="700" letter-spacing="4" fill="${grey}">${esc(place)}</text>
    <text x="${ix + iw}" y="${ch - frame - 30}" text-anchor="end" font-family="${NUM}" font-size="40" font-weight="900" letter-spacing="3" fill="${ink}">WKND</text>
  </g>
  ${handleText(W / 2, H - 80, 'middle', WHITE)}
</svg>`;
  return { svg };
}

const RENDER = { usual, receipt, cover, poster, bug, jersey, pwsheet, pwsides, pwcard, pwholo, pwback, pwticket, pwpotd };

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
