// The six premium "Share my stats" templates, server side: each template's SVG is built in
// public/share-cards.js (shared with the players app, which draws them on the phone) and made
// into the PNG here with sharp. The fonts come from fontconfig (assets/fonts, server.js).
//
// Premium = locked while the player owes (current_balance > 0), admins excepted (server.js
// /api/games/:id/my-stat-card.png). A locked card still renders and still saves — the lock is
// stamped into the image itself (lockOverlay) so it stays on whatever they post.
import sharp from 'sharp';
import { premiumSvg, W, H, NUM, BODY } from '../public/share-cards.js';

export { SHARE_PREMIUM_KEYS, SHARE_ACCENTS } from '../public/share-cards.js';

const toPng = (svg, composites = []) =>
  sharp(Buffer.from(svg), { density: 216 }).resize(W, H).composite(composites).png({ compressionLevel: 9 }).toBuffer();

async function circlePhoto(buf, size) {
  if (!buf) return null;
  try {
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
    return await sharp(buf).rotate().resize(size, size, { fit: 'cover', position: 'north' })
      .composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  } catch { return null; }
}

// d: as premiumSvg (public/share-cards.js), plus photo: Buffer|null for the Corner bug.
// measure: server.js measureTextWidth (real rendered width) for the layouts that size to text.
export async function renderPremiumShareCard(key, d, measure) {
  const photo = key === 'bug' ? await circlePhoto(d.photo, 120) : null;
  const { svg, photoBox } = await premiumSvg(key, d, measure, { hasPhoto: !!photo });
  return toPng(svg, photo && photoBox ? [{ input: photo, left: photoBox.left, top: photoBox.top }] : []);
}

// The lock stamped into a premium card for a player who owes, covering the WHOLE image (Paolo,
// 2026-10-19: a centre badge still left a usable card once copied). The card underneath is
// blurred so its numbers can't be read, then a near-solid veil covers the full 1080×1920 (the
// card is a transparent overlay, so the veil also hides whatever photo it's put on), a dense
// "LOCKED · WKND" pattern, and one big lock. The wording stays off money — these end up on
// public stories — the editor tells the player why it's locked.
export async function lockOverlay(png) {
  // Light blur + a see-through veil: the template still shows through (Paolo, 2026-10-19).
  const blurred = await sharp(png).blur(4).png().toBuffer();
  const cx = W / 2, cy = H / 2;
  const tile = Array.from({ length: 16 }, (_, r) => Array.from({ length: 4 }, (_, c) => {
    const x = c * 380 + (r % 2) * 190 - 120, y = r * 128 + 60;
    return `<text x="${x}" y="${y}" transform="rotate(-24 ${x} ${y})" font-family="${NUM}" font-size="46" font-weight="900" letter-spacing="8" fill="#ffffff" fill-opacity="0.09">LOCKED · WKND</text>`;
  }).join('')).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="shade" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#0a0e16" stop-opacity="0.6"/><stop offset="1" stop-color="#0a0e16" stop-opacity="0"/></radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="45%"><stop offset="0" stop-color="#f59332" stop-opacity="0.22"/><stop offset="1" stop-color="#f59332" stop-opacity="0"/></radialGradient>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="#0a0e16" fill-opacity="0.4"/>
  <ellipse cx="${cx}" cy="${cy - 20}" rx="520" ry="520" fill="url(#shade)"/>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#glow)"/>
  ${tile}
  <rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="36" fill="none" stroke="#f59332" stroke-opacity="0.5" stroke-width="4" stroke-dasharray="24 18"/>
  <g transform="translate(${cx - 150} ${cy - 420})" fill="none" stroke="#f59332" stroke-width="26" stroke-linecap="round" stroke-linejoin="round">
    <path d="M60 140 V90 a90 90 0 0 1 180 0 V140"/>
    <rect x="0" y="140" width="300" height="230" rx="40" fill="#f59332" fill-opacity="0.2"/>
    <circle cx="150" cy="240" r="24" fill="#f59332" stroke="none"/>
    <rect x="140" y="250" width="20" height="56" rx="10" fill="#f59332" stroke="none"/>
  </g>
  <text x="${cx}" y="${cy + 170}" text-anchor="middle" font-family="${NUM}" font-size="170" font-weight="900" letter-spacing="10" fill="#ffffff">LOCKED</text>
  <text x="${cx}" y="${cy + 250}" text-anchor="middle" font-family="${BODY}" font-size="42" font-weight="800" letter-spacing="10" fill="#f59332">PREMIUM CARD</text>
  <text x="${cx}" y="${cy + 320}" text-anchor="middle" font-family="${BODY}" font-size="34" font-weight="700" letter-spacing="3" fill="#8a93a4">wkndbasketball.com</text>
</svg>`;
  const over = await sharp(Buffer.from(svg), { density: 216 }).resize(W, H).png().toBuffer();
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: blurred }, { input: over }]).png({ compressionLevel: 9 }).toBuffer();
}
