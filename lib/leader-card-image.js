// Server-drawn images of the /leaders + /roast cards, from the same snapshot the page renders
// (views/leaders.js cardSnapshot / cardHtml), so the shared and downloaded pictures match the
// card on the page:
//   renderLeaderCardPng — the card itself, portrait, at 2× (the Download button)
//   renderLeaderWidePng — the card laid out wide, 1200×630 (the share link's preview image)
// Geometry and colours mirror the .ld-card / .ld-tile rules in public/styles.css. Photos go in
// as embedded <image>s: the faded backdrop is pre-processed with sharp (greyscale, blur,
// team tint, fade to the left) because librsvg can't do CSS filters, masks or blend modes.
import sharp from 'sharp';

const TEAM = { WHITE: '#d7dce5', BLACK: '#4a5263', BLUE: '#4a90e2', MAROON: '#b0455a' };
const teamColor = t => TEAM[String(t || '').toUpperCase()] || '#4a5263';
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nameParts = raw => {
  const s = String(raw || '').trim();
  const i = s.indexOf(',');
  return i < 0 ? { first: '', last: s.toUpperCase() } : { first: s.slice(i + 1).trim(), last: s.slice(0, i).trim().toUpperCase() };
};
const jerseyNum = n => (n !== '' && n != null ? `#${n}` : '');
const metaOf = c => (c.kind === 'record'
  ? jerseyNum(c.lead.number)
  : [jerseyNum(c.lead.number), c.lead.gp ? `${c.lead.gp} GP` : ''].filter(Boolean).join(' · '));

// No text measuring in SVG: cut to an estimated width (em ≈ factor × font size per char).
function fit(text, size, maxW, factor = 0.56) {
  const s = String(text || '');
  const max = Math.floor(maxW / (size * factor));
  return s.length <= max ? s : `${s.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}
const textW = (text, size, factor = 0.56) => String(text || '').length * size * factor;

const dataUri = buf => `data:image/png;base64,${buf.toString('base64')}`;

// Faded photo behind the leader: cover-cropped (25% from the top, like object-position),
// greyscale, blurred, tinted in the team colour, fading out to the left.
async function backdrop(buf, w, h, color, { opacity = 0.2, blur = 1.5 } = {}) {
  if (!buf) return null;
  try {
    const meta = await sharp(buf).metadata();
    const k = Math.max(w / meta.width, h / meta.height);
    const rw = Math.ceil(meta.width * k), rh = Math.ceil(meta.height * k);
    const grey = await sharp(buf).rotate().resize(rw, rh)
      .extract({ left: Math.floor((rw - w) / 2), top: Math.floor((rh - h) * 0.25), width: w, height: h })
      .grayscale().blur(Math.max(0.3, blur)).png().toBuffer();
    const fade = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="f" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".65" stop-color="#fff" stop-opacity="${opacity}"/><stop offset="1" stop-color="#fff" stop-opacity="${opacity}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#f)"/></svg>`);
    return await sharp(grey).tint(color).ensureAlpha().composite([{ input: fade, blend: 'dest-in' }]).png().toBuffer();
  } catch { return null; }
}

async function circle(buf, size) {
  if (!buf) return null;
  try {
    return await sharp(buf).rotate().resize(size, size, { fit: 'cover' }).png().toBuffer();
  } catch { return null; }
}

// Card background: surface + the team-colour glow from the top-left corner + 1px border.
const glowDefs = (id, color) => `<radialGradient id="${id}" cx="0" cy="0" r="1" gradientUnits="objectBoundingBox" gradientTransform="scale(1.2 0.9)">
  <stop offset="0" stop-color="${color}" stop-opacity=".18"/><stop offset=".4" stop-color="${color}" stop-opacity=".06"/><stop offset=".72" stop-color="${color}" stop-opacity="0"/></radialGradient>`;

function avatarSvg(x, y, size, color, img, initials, fonts) {
  const r = size / 2;
  const id = `av${Math.round(x)}_${Math.round(y)}`;
  return `<clipPath id="${id}"><circle cx="${x + r}" cy="${y + r}" r="${r - 2}"/></clipPath>
  <circle cx="${x + r}" cy="${y + r}" r="${r - 1}" fill="#1f2633"/>
  ${img ? `<image href="${img}" x="${x + 2}" y="${y + 2}" width="${size - 4}" height="${size - 4}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>`
    : `<text x="${x + r}" y="${y + r + size * 0.12}" text-anchor="middle" font-family="${fonts.num}" font-size="${Math.round(size * 0.34)}" font-weight="800" fill="#c3c9d4">${esc(initials)}</text>`}
  <circle cx="${x + r}" cy="${y + r}" r="${r - 1}" fill="none" stroke="${color}" stroke-width="2"/>`;
}

// ── Portrait card (the download) ─────────────────────────────────────────────
// Same box model as the page: board cards 320 wide (lg/sm sizing from the snapshot), record
// tiles 360. Drawn in CSS px and output at `scale`× with the site address underneath.
export async function renderLeaderCardPng(c, { loadPhoto, fonts, footer = 'WKNDBASKETBALL.COM', scale = 2 }) {
  const isRec = c.kind === 'record';
  const lg = isRec || c.size === 'lg';
  const color = teamColor(c.lead.team);
  const W = isRec ? 360 : 320;
  const m = isRec
    ? { padX: 20, padT: 18, av: 44, f1: 12, f2: 15, val: 52 }
    : lg ? { padX: 20, padT: 16, av: 52, f1: 13, f2: 17, val: 44, rowH: 36, rowVal: 18 }
      : { padX: 18, padT: 16, av: 40, f1: 12, f2: 15, val: 34, rowH: 34, rowVal: 16 };

  // Vertical layout (top block → divider → rows / game line).
  const headH = isRec ? 26 : 16;
  let y = m.padT;
  const titleY = y + (isRec ? 17 : 12);
  y += headH;
  const hasSub = isRec ? !!c.sub : true;
  const subY = y + 6 + 11;
  if (hasSub) y += 6 + 15;
  y += isRec ? 14 : 12;
  const leadH = Math.max(m.av, Math.round(m.f1 * 1.25 + m.f2 * 1.15 + 4 + 14));
  const leadY = y;
  y += leadH;
  const topH = y + (isRec ? 16 : lg ? 18 : 16);
  let H;
  const rows = isRec ? [] : c.rest;
  if (isRec) H = topH + 1 + 12 + 16 + (c.foot ? 10 + 16 : 0) + 18;
  else H = topH + (rows.length ? 1 + (lg ? 4 : 2) + rows.length * m.rowH + (lg ? 8 : 6) : 0);

  const leadPhoto = await loadPhoto(c.lead.id);
  const [bg, av] = await Promise.all([
    backdrop(leadPhoto, Math.round(W * 0.62 * scale), Math.round(topH * scale), color, { opacity: 0.18, blur: 1.5 * scale }),
    circle(leadPhoto, m.av * scale),
  ]);

  const n = nameParts(c.lead.name);
  const valW = textW(c.lead.value, m.val, 0.5);
  const nameX = m.padX + m.av + 12;
  const nameMax = W - m.padX - valW - 12 - nameX;
  const cy = leadY + leadH / 2;
  const textTop = cy - (m.f1 * 1.25 + m.f2 * 1.15 + 4 + 14) / 2;
  const meta = metaOf(c);
  const badgeW = c.badge ? textW(c.badge.toUpperCase(), 10, 0.72) + 20 : 0;

  let body = '';
  // Head
  body += `<text x="${m.padX}" y="${titleY}" font-family="${fonts.text}" font-size="12" font-weight="800" letter-spacing="1.7" fill="#a3abb9">${esc(fit(c.title.toUpperCase(), 12, W - m.padX * 2 - badgeW - 10, 0.78))}</text>`;
  if (isRec && c.badge) {
    const bx = W - m.padX - badgeW;
    body += `<rect x="${bx}" y="${m.padT + 2}" width="${badgeW}" height="22" rx="11" fill="${c.badgeOn ? 'rgba(245,147,50,.15)' : 'rgba(255,255,255,.04)'}" stroke="${c.badgeOn ? 'rgba(245,147,50,.4)' : 'rgba(255,255,255,.08)'}"/>
    <text x="${bx + badgeW / 2}" y="${m.padT + 16.5}" text-anchor="middle" font-family="${fonts.text}" font-size="10" font-weight="800" letter-spacing="1" fill="${c.badgeOn ? '#f59332' : '#a3abb9'}">${esc(c.badge.toUpperCase())}</text>`;
  }
  // Description + qualifier line
  if (hasSub) {
    const keyW = isRec ? 0 : textW(c.key, 11, 0.62) + 10;
    if (c.sub) body += `<text x="${m.padX}" y="${subY}" font-family="${fonts.text}" font-size="12" font-weight="500" fill="#8a93a4">${esc(fit(c.sub, 12, W - m.padX * 2 - keyW))}</text>`;
    if (!isRec) body += `<text x="${W - m.padX}" y="${subY}" text-anchor="end" font-family="${fonts.text}" font-size="11" font-weight="700" letter-spacing=".66" fill="#5b6475">${esc(c.key)}</text>`;
  }
  // Player + value
  body += avatarSvg(m.padX, cy - m.av / 2, m.av, color, av && dataUri(av), (n.first[0] || '') + (n.last[0] || ''), fonts);
  let ty = textTop;
  if (n.first) { ty += m.f1; body += `<text x="${nameX}" y="${ty}" font-family="${fonts.text}" font-size="${m.f1}" font-weight="600" fill="#b4bbc8">${esc(fit(n.first, m.f1, nameMax))}</text>`; ty += m.f1 * 0.25; }
  ty += m.f2 * 1.0;
  body += `<text x="${nameX}" y="${ty}" font-family="${fonts.text}" font-size="${m.f2}" font-weight="800" fill="#e7eaf0">${esc(fit(n.last, m.f2, nameMax, 0.68))}</text>`;
  ty += m.f2 * 0.15 + 4 + 11;
  body += `<circle cx="${nameX + 3.5}" cy="${ty - 4}" r="3.5" fill="${color}"/>`;
  if (meta) body += `<text x="${nameX + 13}" y="${ty}" font-family="${fonts.text}" font-size="11" font-weight="700" letter-spacing="1.1" fill="#8a93a4">${esc(meta)}</text>`;
  body += `<text x="${W - m.padX}" y="${cy + m.val * 0.33}" text-anchor="end" font-family="${fonts.num}" font-size="${m.val}" font-weight="800" fill="#f59332">${esc(c.lead.value)}</text>`;

  // Below the divider
  let below = `<line x1="${isRec ? m.padX : 0}" y1="${topH + 0.5}" x2="${isRec ? W - m.padX : W}" y2="${topH + 0.5}" stroke="#fff" stroke-opacity="${isRec ? 0.06 : 0.06}"/>`;
  if (isRec) {
    const gy = topH + 1 + 12 + 12;
    below += `<text x="${m.padX}" y="${gy}" font-family="${fonts.text}" font-size="12.5"><tspan font-weight="600" fill="#c3c9d4">${esc(c.game.line)}</tspan><tspan dx="12" fill="#8a93a4">${esc(c.game.when)}</tspan></text>`;
    if (c.foot) below += `<text x="${m.padX}" y="${gy + 26}" font-family="${fonts.text}" font-size="12" fill="#8a93a4">${esc(fit(c.foot, 12, W - m.padX * 2))}</text>`;
  } else {
    rows.forEach((x, i) => {
      const ry = topH + 1 + (lg ? 4 : 2) + i * m.rowH + m.rowH / 2;
      const rn = nameParts(x.name);
      const valX = W - m.padX;
      const deltaX = valX - 40 - 9;
      const nameW = deltaX - 30 - 9 - (m.padX + 13 + 9 + 7 + 9);
      const lastW = textW(rn.last, 13, 0.66);
      const firstMax = Math.max(0, nameW - lastW - 5);
      const nx = m.padX + 13 + 9 + 7 + 9;
      // First name (cut to fit) then LAST NAME, flowing as one line like the page.
      const first = rn.first && firstMax > 20 ? fit(rn.first, 13, firstMax) : '';
      below += `<text x="${m.padX}" y="${ry + 5}" font-family="${fonts.num}" font-size="15" font-weight="800" fill="#5b6475">${i + 2}</text>
      <circle cx="${m.padX + 13 + 9 + 3.5}" cy="${ry}" r="3.5" fill="${teamColor(x.team)}"/>
      <text x="${nx}" y="${ry + 4.5}" font-family="${fonts.text}" font-size="13">${first ? `<tspan font-weight="500" fill="#8a93a4">${esc(first)}</tspan><tspan dx="5"` : '<tspan'} font-weight="700" fill="#c3c9d4">${esc(rn.last)}</tspan></text>
      <text x="${deltaX}" y="${ry + 4.5}" text-anchor="end" font-family="${fonts.num}" font-size="13" font-weight="600" fill="#5b6475">${esc(x.delta)}</text>
      <text x="${valX}" y="${ry + 5.5}" text-anchor="end" font-family="${fonts.num}" font-size="${m.rowVal}" font-weight="700" fill="#c3c9d4">${esc(x.value)}</text>`;
    });
  }

  const PAD = 32, FOOT = 56;
  const OW = W + PAD * 2, OH = H + PAD * 2 + FOOT;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OW * scale}" height="${OH * scale}" viewBox="0 0 ${OW} ${OH}">
<defs>${glowDefs('glow', color)}<clipPath id="card"><rect x="0" y="0" width="${W}" height="${H}" rx="14"/></clipPath><clipPath id="top"><rect x="0" y="0" width="${W}" height="${topH}"/></clipPath></defs>
<rect width="${OW}" height="${OH}" fill="#0a0e16"/>
<g transform="translate(${PAD} ${PAD})">
  <g clip-path="url(#card)">
    <rect width="${W}" height="${H}" fill="#10141d"/>
    <rect width="${W}" height="${H}" fill="url(#glow)"/>
    ${bg ? `<image href="${dataUri(bg)}" x="${W * 0.38}" y="0" width="${W * 0.62}" height="${topH}" clip-path="url(#top)" preserveAspectRatio="none"/>` : ''}
    ${body}
    ${below}
  </g>
  <rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="none" stroke="#fff" stroke-opacity=".06"/>
</g>
<text x="${OW / 2}" y="${H + PAD + (PAD + FOOT) / 2 + 4}" text-anchor="middle" font-family="${fonts.text}" font-size="11" font-weight="600" letter-spacing="2.2" fill="#475569">${esc(footer)}</text>
</svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

// ── Wide card (the share link preview, 1200×630) ─────────────────────────────
// The same card laid out landscape: title + description top-left, WKND logo top-right, the
// player and the big number in the middle over the faded photo, and along the bottom the
// #2–#5 rows (boards) or the game line + next best (record tiles).
export async function renderLeaderWidePng(c, { loadPhoto, fonts, scopeLine = '', logo = null }) {
  const W = 1200, H = 630, STRIP = 112, TOP = H - STRIP;
  const isRec = c.kind === 'record';
  const color = teamColor(c.lead.team);
  const leadPhoto = await loadPhoto(c.lead.id);
  const [bg, av] = await Promise.all([
    backdrop(leadPhoto, Math.round(W * 0.58), TOP, color, { opacity: 0.22, blur: 2 }),
    circle(leadPhoto, 150),
  ]);
  const n = nameParts(c.lead.name);
  const meta = metaOf(c);
  const sub = [c.sub, isRec ? '' : c.key, scopeLine].filter(Boolean).join(' · ');
  const valLen = String(c.lead.value).length;
  const valSize = valLen <= 3 ? 190 : valLen <= 4 ? 170 : valLen <= 5 ? 150 : 128;
  const valW = textW(c.lead.value, valSize, 0.5);
  const nameX = 52 + 150 + 30;
  const nameMax = W - 52 - valW - 30 - nameX;
  const cy = 120 + (TOP - 120) / 2;

  let strip = '';
  if (isRec) {
    strip = `<text x="52" y="${TOP + STRIP / 2 + 8}" font-family="${fonts.text}" font-size="22" font-weight="700" fill="#e7eaf0">${esc(c.game.line)}<tspan dx="22" font-weight="400" fill="#8a93a4">${esc(c.game.when)}</tspan></text>
    ${c.foot ? `<text x="${W - 52}" y="${TOP + STRIP / 2 + 8}" text-anchor="end" font-family="${fonts.text}" font-size="20" fill="#8a93a4">${esc(fit(c.foot, 20, 470))}</text>` : ''}`;
  } else {
    const colW = (W - 64) / 4;
    c.rest.slice(0, 4).forEach((x, i) => {
      const x0 = 32 + i * colW;
      const rn = nameParts(x.name);
      if (i) strip += `<line x1="${x0}" y1="${TOP + 28}" x2="${x0}" y2="${H - 28}" stroke="#fff" stroke-opacity=".06" stroke-width="2"/>`;
      strip += `<text x="${x0 + 20}" y="${TOP + STRIP / 2 + 10}" font-family="${fonts.num}" font-size="26" font-weight="800" fill="#5b6475">${i + 2}</text>
      ${rn.first ? `<text x="${x0 + 52}" y="${TOP + STRIP / 2 - 6}" font-family="${fonts.text}" font-size="17" fill="#8a93a4">${esc(fit(rn.first, 17, colW - 52 - 90))}</text>` : ''}
      <circle cx="${x0 + 57}" cy="${TOP + STRIP / 2 + 15}" r="5" fill="${teamColor(x.team)}"/>
      <text x="${x0 + 70}" y="${TOP + STRIP / 2 + 22}" font-family="${fonts.text}" font-size="21" font-weight="800" fill="#c3c9d4">${esc(fit(rn.last, 21, colW - 70 - 90, 0.68))}</text>
      <text x="${x0 + colW - 20}" y="${TOP + STRIP / 2 + 13}" text-anchor="end" font-family="${fonts.num}" font-size="34" font-weight="700" fill="#c3c9d4">${esc(x.value)}</text>`;
    });
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<defs>${glowDefs('glow', color)}</defs>
<rect width="${W}" height="${H}" fill="#10141d"/>
<rect width="${W}" height="${H}" fill="url(#glow)"/>
${bg ? `<image href="${dataUri(bg)}" x="${W * 0.42}" y="0" width="${W * 0.58}" height="${TOP}" preserveAspectRatio="none"/>` : ''}
<text x="52" y="72" font-family="${fonts.text}" font-size="24" font-weight="800" letter-spacing="3.4" fill="#a3abb9">${esc(fit(c.title.toUpperCase(), 24, 760, 0.8))}</text>
${sub ? `<text x="52" y="108" font-family="${fonts.text}" font-size="21" fill="#8a93a4">${esc(fit(sub, 21, 800))}</text>` : ''}
${isRec && c.badge ? `<text x="52" y="${TOP - 34}" font-family="${fonts.text}" font-size="16" font-weight="800" letter-spacing="1.6" fill="${c.badgeOn ? '#f59332' : '#a3abb9'}">${esc(c.badge.toUpperCase())}</text>` : ''}
${logo ? `<image href="${dataUri(logo)}" x="${W - 52 - 150}" y="44" width="150" height="40" preserveAspectRatio="xMaxYMid meet"/>` : ''}
${avatarSvg(52, cy - 75, 150, color, av && dataUri(av), (n.first[0] || '') + (n.last[0] || ''), fonts).replace('stroke-width="2"', 'stroke-width="5"')}
${n.first ? `<text x="${nameX}" y="${cy - 30}" font-family="${fonts.text}" font-size="30" font-weight="600" fill="#b4bbc8">${esc(fit(n.first, 30, nameMax))}</text>` : ''}
<text x="${nameX}" y="${cy + 30}" font-family="${fonts.text}" font-size="64" font-weight="800" fill="#ffffff">${esc(fit(n.last, 64, nameMax, 0.68))}</text>
<circle cx="${nameX + 7}" cy="${cy + 64}" r="7" fill="${color}"/>
${meta ? `<text x="${nameX + 26}" y="${cy + 72}" font-family="${fonts.text}" font-size="22" font-weight="700" letter-spacing="2.2" fill="#8a93a4">${esc(meta)}</text>` : ''}
<text x="${W - 52}" y="${cy + valSize * 0.34}" text-anchor="end" font-family="${fonts.num}" font-size="${valSize}" font-weight="800" fill="#f59332">${esc(c.lead.value)}</text>
<line x1="0" y1="${TOP + 1}" x2="${W}" y2="${TOP + 1}" stroke="#fff" stroke-opacity=".08" stroke-width="2"/>
${strip}
</svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
