// Player of the Game video: everything the editor and the renderer need from the DB, the
// photo upload step, and turning a saved editor form into media jobs (one per player:
// a co-POTG game makes two videos). The look/animation is assets/media/potg/template.html;
// the render runs in the background (lib/media-jobs.js, scripts/render-potg.js).
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import sharp from 'sharp';
import { db } from './portal-db.js';
import { createMediaJob, kickMediaWorker, jobDir, UPLOAD_DIR } from './media-jobs.js';

export const PHOTO_COUNT = 6;

// Stat categories the big numbers can show. weight = how much one unit says about a game,
// used to pick the 2-3 that best describe this performance (always overridable).
export const STAT_CATS = [
  { key: 'pts', label: 'PTS', weight: 1,   min: 6 },
  { key: 'reb', label: 'REB', weight: 1.2, min: 4 },
  { key: 'ast', label: 'AST', weight: 1.5, min: 3 },
  { key: 'stl', label: 'STL', weight: 3,   min: 2 },
  { key: 'blk', label: 'BLK', weight: 3,   min: 2 },
  { key: 'fg3m', label: '3PM', weight: 2,  min: 4 },
];

const TEXT_ON_DARK = { BLACK: '#9aa5b8', MAROON: '#d0485c', BLUE: '#4d8ff0', WHITE: '#e8edf3' };

function hexToRgb(h) { const m = String(h || '').replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i); return m ? m.slice(1).map(x => parseInt(x, 16)) : [136, 136, 136]; }
// Team colours are tuned for UI dots; some are too dark for big text on a dark video.
function readableOnDark(teamName, hex) {
  if (TEXT_ON_DARK[String(teamName).toUpperCase()]) return TEXT_ON_DARK[String(teamName).toUpperCase()];
  const [r, g, b] = hexToRgb(hex); const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum >= 0.4) return hex;
  const k = 0.45; return `rgb(${Math.round(r + (255 - r) * k)},${Math.round(g + (255 - g) * k)},${Math.round(b + (255 - b) * k)})`;
}

function splitName(raw) {
  const s = String(raw || '').trim(); const c = s.indexOf(',');
  if (c === -1) { const parts = s.split(/\s+/); return { first: (parts[0] || '').toUpperCase(), last: parts.slice(1).join(' ').toUpperCase() }; }
  return { first: s.slice(c + 1).trim().split(/\s+/)[0].toUpperCase(), last: s.slice(0, c).trim().toUpperCase() };
}

function fmtDate(d) {
  const dt = new Date(String(d).slice(0, 10) + 'T12:00:00Z');
  return isNaN(dt) ? '' : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// Best 2-3 categories for this line, in the standard order.
export function suggestStats(line) {
  const scored = STAT_CATS.map(c => ({ ...c, v: Number(line[c.key] || 0) }))
    .filter(c => c.v >= c.min)
    .map(c => ({ ...c, score: c.v * c.weight }))
    .sort((a, b) => b.score - a.score).slice(0, 3);
  const keys = new Set(scored.map(c => c.key));
  if (!keys.size) keys.add('pts');
  return STAT_CATS.filter(c => keys.has(c.key)).map(c => c.key);
}

// A chip that's true for this line, or '' (the editor can always type one).
export function suggestChip(line, playerId, gameId) {
  const tens = ['pts', 'reb', 'ast', 'stl', 'blk'].filter(k => Number(line[k] || 0) >= 10).length;
  if (tens >= 3) return 'TRIPLE-DOUBLE';
  if (tens === 2) return 'DOUBLE-DOUBLE';
  const prev = db.prepare(`SELECT MAX(s.pts) AS pts, COUNT(*) AS n FROM game_player_stats s JOIN games g ON g.id = s.game_id
                           WHERE s.player_id = ? AND s.game_id <> ? AND g.date <= (SELECT date FROM games WHERE id = ?)`).get(playerId, gameId, gameId);
  if (prev && prev.n >= 3 && Number(line.pts || 0) > Number(prev.pts || 0)) return 'CAREER HIGH';
  if (Number(line.fg3m || 0) >= 6) return `${line.fg3m} THREES`;
  return '';
}

// The game's POTG (and co-POTG) with everything the editor needs.
export function potgVideoContext(gameId) {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
  if (!game) return null;
  const ids = [game.manual_potg_player_id, game.co_potg_player_id].filter(Boolean);
  const unique = [...new Set(ids)];
  const co = unique.length > 1;
  const teams = Object.fromEntries(db.prepare('SELECT id, name, color FROM teams').all().map(t => [t.id, t]));
  const a = Number(game.team_a_score || 0), b = Number(game.team_b_score || 0);
  const players = unique.map(pid => {
    const p = db.prepare('SELECT id, name, number, team_id, picture_url FROM players WHERE id = ?').get(pid);
    const line = db.prepare('SELECT * FROM game_player_stats WHERE game_id = ? AND player_id = ?').get(gameId, pid);
    if (!p || !line) return null;
    const team = teams[line.team_id] || teams[p.team_id] || { name: '', color: '#888' };
    const isA = String(team.name).toUpperCase() === String(game.team_a_name).toUpperCase();
    const own = isA ? a : b, opp = isA ? b : a, oppName = isA ? game.team_b_name : game.team_a_name;
    const result = own === opp ? `T ${own}–${opp}` : `${own > opp ? 'W' : 'L'} ${own}–${opp}`;
    return {
      playerId: pid, ...splitName(p.name), number: String(p.number || ''), teamName: String(team.name || ''),
      teamTitle: String(team.name || '').charAt(0) + String(team.name || '').slice(1).toLowerCase(),
      teamColor: team.color || '#888', lastColor: readableOnDark(team.name, team.color),
      oppTitle: String(oppName || '').charAt(0) + String(oppName || '').slice(1).toLowerCase(),
      result, date: fmtDate(game.date), hasPhoto: !!p.picture_url,
      line: Object.fromEntries(STAT_CATS.map(c => [c.key, Number(line[c.key] || 0)])),
      suggestedStats: suggestStats(line), suggestedChip: suggestChip(line, pid, gameId),
      role: co ? (pid === game.manual_potg_player_id ? 'POTG' : 'CO-POTG') : 'POTG',
    };
  }).filter(Boolean);
  return { game, co, players };
}

// ── Photo upload ─────────────────────────────────────────────────────────────────────────
// The browser sends a (pre-shrunk) JPEG data URL. We fix rotation, cap the size and guess where
// the player is so the framing starts centred on him. Colour is left alone here: at render time
// the 6 photos are matched to each other and graded together (lib/photo-match.js).
const UPLOAD_ID = /^[a-z0-9]{6,40}$/;
export const uploadPath = id => (UPLOAD_ID.test(id) ? path.join(UPLOAD_DIR, id + '.jpg') : null);

export async function savePotgPhoto(dataUrl) {
  const m = String(dataUrl || '').match(/^data:image\/[a-z+]+;base64,(.+)$/i);
  if (!m) throw new Error('Not an image');
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const id = Date.now().toString(36) + randomBytes(5).toString('hex');
  const buf = await sharp(Buffer.from(m[1], 'base64')).rotate()
    .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  fs.writeFileSync(uploadPath(id), buf);
  const meta = await sharp(buf).metadata();
  const { fx, fy } = await guessFocus(buf);
  return { id, w: meta.width, h: meta.height, fx, fy };
}

// Rough "where's the player": the centre of skin-tone pixels in the top 75% of the photo
// (the hardwood floor is skin-coloured too, so the bottom is ignored), nudged up toward the
// face. It's only a starting point; the editor drags from there.
async function guessFocus(buf) {
  const W = 96;
  const { data, info } = await sharp(buf).resize(W, null).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const H = info.height, lim = Math.floor(H * 0.75);
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < lim; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3, r = data[i], g = data[i + 1], b = data[i + 2];
    const Y = 0.299 * r + 0.587 * g + 0.114 * b, cb = 128 - 0.1687 * r - 0.3313 * g + 0.5 * b, cr = 128 + 0.5 * r - 0.4187 * g - 0.0813 * b;
    if (Y > 60 && cb > 77 && cb < 127 && cr > 133 && cr < 173) { sx += x; sy += y; n++; }
  }
  if (n < W * H * 0.004) return { fx: 0.5, fy: 0.4 };
  return { fx: +(sx / n / W).toFixed(3), fy: +Math.max(0.15, sy / n / H - 0.05).toFixed(3) };
}

// ── Saving the editor → jobs ─────────────────────────────────────────────────────────────
// body.players: [{ playerId, number, stats: ['pts','reb','blk'], chip, photos: [{ id, fx, fy, zoom } x6] }]
export function queuePotgVideos(gameId, body, createdBy) {
  const ctx = potgVideoContext(gameId);
  if (!ctx) throw new Error('Game not found');
  const jobs = [];
  // A player panel left completely empty is skipped (e.g. only re-doing the co-POTG);
  // a half-filled one is an error.
  const wanted = (Array.isArray(body.players) ? body.players : []).filter(w => (w.photos || []).length);
  if (!wanted.length) throw new Error(`Add ${PHOTO_COUNT} photos first.`);
  for (const w of wanted) {
    const p = ctx.players.find(x => x.playerId === w.playerId);
    if (!p) throw new Error('That player isn’t this game’s POTG.');
    const photos = (w.photos || []).slice(0, PHOTO_COUNT);
    if (photos.length !== PHOTO_COUNT || photos.some(ph => !uploadPath(String(ph.id)) || !fs.existsSync(uploadPath(String(ph.id)))))
      throw new Error(`${p.first} ${p.last} needs all ${PHOTO_COUNT} photos.`);
    // Co-POTG game: each video can still be titled plain "Player of the Game" (w.title = 'potg').
    const co = ctx.co && w.title !== 'potg';
    const keys = (Array.isArray(w.stats) ? w.stats : p.suggestedStats).filter(k => STAT_CATS.some(c => c.key === k)).slice(0, 3);
    if (!keys.length) throw new Error('Pick at least one stat.');
    const number = String(w.number ?? p.number).replace(/[^0-9]/g, '').slice(0, 3);
    const chip = String(w.chip ?? '').trim().toUpperCase().slice(0, 32);
    const stats = STAT_CATS.filter(c => keys.includes(c.key)).map(c => ({ v: p.line[c.key], l: c.label }));
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const teamLine = `${esc(p.teamTitle)}${number ? ` #${number}` : ''} · <b>${esc(p.result)}</b> vs ${esc(p.oppTitle)} · ${esc(p.date)}`;
    const [r, g, b] = hexToRgb(p.teamColor);
    const config = {
      data: {
        co, first: p.first, last: p.last, lastColor: p.lastColor, ring: p.teamColor,
        ringA: `rgba(${r},${g},${b},.5)`, initials: (p.first[0] || '') + (p.last[0] || ''),
        teamLine, stats, chip,
      },
      statKeys: keys, number, title: co ? 'co' : 'potg',
      photos: [],
      photosRaw: true, // ungraded: the renderer colour-matches and grades the set
      avatar: '',
    };
    const id = createMediaJob({
      kind: 'potg_video', title: `${co ? 'Co-POTG' : 'POTG'} · ${p.first} ${p.last} · ${p.date}`,
      gameId, playerId: p.playerId, config, createdBy, quality: 'preview',
    });
    const dir = jobDir(id); fs.mkdirSync(dir, { recursive: true });
    photos.forEach((ph, i) => {
      const file = `photo-${i + 1}.jpg`;
      fs.copyFileSync(uploadPath(String(ph.id)), path.join(dir, file));
      config.photos.push({ file, fx: clamp01(ph.fx, 0.5), fy: clamp01(ph.fy, 0.4), zoom: Math.min(3, Math.max(1, Number(ph.zoom) || 1)), rot: Math.min(30, Math.max(-30, Number(ph.rot) || 0)) });
    });
    const pic = db.prepare('SELECT picture_url FROM players WHERE id = ?').get(p.playerId)?.picture_url || '';
    const pm = pic.match(/^data:image\/[a-z+]+;base64,(.+)$/i);
    if (pm) { const f = path.join(dir, 'avatar.jpg'); fs.writeFileSync(f, Buffer.from(pm[1], 'base64')); config.avatar = f; }
    db.prepare('UPDATE media_jobs SET config_json = ? WHERE id = ?').run(JSON.stringify(config), id);
    jobs.push(id);
  }
  kickMediaWorker();
  return jobs;
}

function clamp01(v, d) { const n = Number(v); return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : d; }

// "Edit" from the Processing page: reopen the editor with a job's photos, framing, stats and
// chip. The photos are copied back into uploads (new ids) so the editor treats them like
// fresh uploads; the original job is left alone.
export async function potgPrefill(job) {
  if (!job || job.kind !== 'potg_video') return null;
  const c = job.config || {}, dir = jobDir(job.id);
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const photos = [];
  for (const ph of c.photos || []) {
    const src = path.join(dir, ph.file);
    if (!fs.existsSync(src)) return null; // expired: files are gone
    const id = Date.now().toString(36) + randomBytes(5).toString('hex');
    fs.copyFileSync(src, uploadPath(id));
    const meta = await sharp(src).metadata();
    photos.push({ id, w: meta.width, h: meta.height, fx: ph.fx, fy: ph.fy, zoom: ph.zoom, rot: ph.rot || 0, url: `/admin/media/upload/${id}.jpg` });
  }
  const keyOf = l => STAT_CATS.find(x => x.label === l)?.key;
  return {
    playerId: job.player_id,
    number: c.number ?? null,
    chip: c.data?.chip ?? '',
    title: c.title || (c.data?.co ? 'co' : 'potg'),
    statKeys: c.statKeys || (c.data?.stats || []).map(st => keyOf(st.l)).filter(Boolean),
    photos,
  };
}
