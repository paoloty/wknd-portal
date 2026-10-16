// Court pages (/courts/:slug): everything the page, its search metadata and its AI writeup
// need, computed from one court's Papawis runs, sign-ups and league games. Pure functions:
// server.js gathers the rows (lib/portal-db.js) and hands them in.
import { displayPlayerName, formatTimeRange } from '../views/utils.js';
import { playerSlug } from './slugs.js';

export const COURT_CITIES = ['Makati', 'Mandaluyong', 'Pasig', 'Taguig', 'San Juan', 'Quezon City', 'Manila', 'Pateros', 'Marikina', 'Parañaque', 'Pasay'];

// The "Good to know" fields an admin can fill in (views/admin/papawis-court.js). contact is
// admin-only unless contact_public is on.
export const COURT_INFO_FIELDS = [
  { key: 'setting', label: 'Indoor or outdoor', type: 'select', options: [['', 'Not set'], ['Indoor', 'Indoor'], ['Covered', 'Covered (outdoor with a roof)'], ['Outdoor', 'Outdoor']] },
  { key: 'floor', label: 'Floor', placeholder: 'Hardwood' },
  { key: 'aircon', label: 'Aircon', type: 'select', options: [['', 'Not set'], ['Yes', 'Yes'], ['No', 'No']] },
  { key: 'lights', label: 'Lights for night games', type: 'select', options: [['', 'Not set'], ['Yes', 'Yes'], ['No', 'No']] },
  { key: 'parking', label: 'Parking', placeholder: 'Free parking at the mall basement' },
  { key: 'restrooms', label: 'Restrooms / showers', placeholder: 'Restrooms, no showers' },
  { key: 'directions', label: 'How to get there', placeholder: 'Enter from Shaw Blvd, 3rd floor, elevator by the food court', wide: true },
  { key: 'nearby', label: 'Nearby', placeholder: 'Shaw Blvd MRT, 5-min walk' },
  { key: 'notes', label: 'Good to know', placeholder: 'Bring a white and a dark shirt', wide: true },
  { key: 'contact', label: 'Court contact / booking', placeholder: 'For your reference', adminOnly: true },
];

export function parseJson(s, fallback) { try { const v = JSON.parse(s || ''); return v ?? fallback; } catch { return fallback; } }
const tc = s => String(s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const hoursOf = r => {
  const t = x => { const [h, m] = String(x || '').split(':').map(Number); return Number.isFinite(h) ? h + (m || 0) / 60 : null; };
  const a = t(r.start_time), b = t(r.end_time);
  return a != null && b != null && b > a ? b - a : 0;
};
const ymdLabel = (ymd, opts) => new Date(`${ymd}T00:00:00`).toLocaleDateString('en-US', opts);

// City: the admin's choice, else the first known city named in the court's name or address.
export function courtCity(court) {
  if (court.city) return court.city;
  const hay = `${court.name} ${court.address}`.toLowerCase();
  return COURT_CITIES.find(c => hay.includes(c.toLowerCase())) || '';
}
// "Cloverleaf Basketball Court, Makati" → "Cloverleaf Basketball Court" (the city shows on its own).
export function courtDisplayName(court) {
  const city = courtCity(court);
  const name = String(court.name || '').replace(/\s+/g, ' ').trim();
  if (city && new RegExp(`,\\s*${city}( City)?$`, 'i').test(name)) return name.replace(/,[^,]*$/, '').trim();
  return name;
}
// Street part of the address, without the court's own name or the city/region tail.
export function courtStreet(court) {
  const parts = String(court.address || '').split(',').map(s => s.trim()).filter(Boolean);
  const name = courtDisplayName(court).toLowerCase();
  const rest = parts.filter(p => p.toLowerCase() !== name && !/metro manila|^\d{4}$/i.test(p) && !COURT_CITIES.some(c => p.toLowerCase().replace(/ city$/, '') === c.toLowerCase()));
  return rest.join(', ');
}

// runs: getPapawisRunsAtCourt rows; signups: getPapawisSignupsForRuns rows; firstRuns:
// getPapawisFirstRuns rows; coverVers: { runId: updated_at }; games: finished league games at
// this court (game rows); scoring: per-player points rows for those games; today: 'YYYY-MM-DD'.
export function buildCourtPage(court, { runs = [], signups = [], firstRuns = [], coverVers = {}, games = [], scoring = [], today = '' } = {}) {
  const name = courtDisplayName(court);
  const city = courtCity(court);
  const street = courtStreet(court);
  const info = parseJson(court.info_json, {});

  const played = runs.filter(r => r.status === 'completed');
  const playedIds = new Set(played.map(r => r.id));
  const cancelled = runs.filter(r => r.status === 'cancelled').length;
  const upcoming = runs.filter(r => r.status !== 'completed' && r.status !== 'cancelled' && String(r.date) >= today);
  const byRun = {};
  for (const s of signups) (byRun[s.game_id] ??= []).push(s);
  const confirmed = id => (byRun[id] || []).filter(s => s.status === 'confirmed');

  // ── Papawis numbers ──
  let checkins = 0, guests = 0, slots = 0, playerHours = 0, waitlist = 0;
  const perPlayer = {}, names = {}, seen = new Set();
  const perRun = [];
  for (const r of played) {
    const c = confirmed(r.id);
    const mem = c.filter(s => !s.guest_name && s.player_id);
    const h = hoursOf(r);
    checkins += c.length; guests += c.length - mem.length; slots += Number(r.max_slots) || 0; playerHours += c.length * h;
    waitlist += (byRun[r.id] || []).filter(s => s.status === 'waitlist').length;
    let fresh = 0, back = 0;
    for (const s of mem) { perPlayer[s.player_id] = (perPlayer[s.player_id] || 0) + 1; names[s.player_id] = s.player_name; if (seen.has(s.player_id)) back++; else { fresh++; seen.add(s.player_id); } }
    const times = c.map(s => Number(s.signed_up_at) || 0).filter(Boolean).sort((a, b) => a - b);
    const full = Number(r.max_slots) > 0 && times.length >= Number(r.max_slots);
    perRun.push({ id: r.id, ymd: String(r.date).slice(0, 10), checkins: c.length, fresh, back, hours: h,
      selloutH: full ? (times[Number(r.max_slots) - 1] - times[0]) / 3600000 : null,
      waitlist: (byRun[r.id] || []).filter(s => s.status === 'waitlist').length,
      price: Number(r.price_per_player) || Number(r.min_per_player) || 0 });
  }
  const players = Object.keys(perPlayer).length;
  const cameBack = Object.values(perPlayer).filter(n => n >= 2).length;
  const firstHere = firstRuns.filter(f => playedIds.has(f.first_game_id)).length;
  const sellouts = perRun.filter(r => r.selloutH != null);
  const fastest = sellouts.length ? sellouts.reduce((a, b) => (b.selloutH < a.selloutH ? b : a)) : null;
  const prices = perRun.map(r => r.price).filter(Boolean);
  const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
  const refereed = played.filter(r => r.has_referee).length;
  const hourCounts = {};
  played.forEach(r => { const h = hoursOf(r); if (h) hourCounts[h] = (hourCounts[h] || 0) + 1; });
  const usualHours = Number(Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0]) || 0;
  const dayCounts = {};
  played.forEach(r => { const d = ymdLabel(String(r.date).slice(0, 10), { weekday: 'long' }); dayCounts[d] = (dayCounts[d] || 0) + 1; });
  // Only a clear winner (2+ runs and no tie) counts as the court's usual day.
  const daySorted = Object.entries(dayCounts).sort((a, b) => b[1] - a[1]);
  const usualDay = daySorted[0] && daySorted[0][1] >= 2 && daySorted[0][1] !== daySorted[1]?.[1] ? daySorted[0] : null;
  const earliest = played.map(r => r.start_time).filter(Boolean).sort()[0] || '';

  // ── League numbers ──
  const finals = games.filter(g => Number(g.team_a_score) + Number(g.team_b_score) > 0);
  const points = finals.reduce((s, g) => s + Number(g.team_a_score) + Number(g.team_b_score), 0);
  let high = null, biggest = null;
  const records = {};
  for (const g of finals) {
    const a = Number(g.team_a_score), b = Number(g.team_b_score);
    for (const [team, pts] of [[g.team_a_name, a], [g.team_b_name, b]]) if (!high || pts > high.pts) high = { team: tc(team), pts };
    if (!biggest || Math.abs(a - b) > biggest.margin) biggest = { margin: Math.abs(a - b), winner: tc(a > b ? g.team_a_name : g.team_b_name) };
    const w = a > b ? g.team_a_name : g.team_b_name, l = a > b ? g.team_b_name : g.team_a_name;
    (records[tc(w)] ??= { w: 0, l: 0 }).w++; (records[tc(l)] ??= { w: 0, l: 0 }).l++;
  }
  const topScorer = [...scoring].sort((a, b) => b.pts - a.pts)[0] || null;
  const careerHigh = [...scoring].sort((a, b) => b.max_pts - a.max_pts)[0] || null;

  // ── Tabs for "Stats for nerds" (views/court.js; values animate client-side) ──
  const D = perRun.map(r => ymdLabel(r.ymd, { month: 'short', day: 'numeric' }).toUpperCase());
  const tabs = [];
  if (played.length) {
    tabs.push({ label: 'Runs', stats: [
      { n: played.length, f: 'int', label: 'Runs played', sub: cancelled ? `${cancelled} more ${cancelled === 1 ? 'was' : 'were'} cancelled` : 'none cancelled' },
      { n: Math.round(played.reduce((s, r) => s + hoursOf(r), 0) * 10) / 10, f: 'int', label: 'Hours on court', sub: usualHours ? `${usualHours} hours a run` : '' },
      { n: Math.round(playerHours), f: 'int', label: 'Player-hours', sub: 'check-ins × hours' }],
      chart: 'CHECK-INS PER RUN', bars: perRun.map((r, i) => ({ v: r.checkins, d: D[i] })), bf: 'int',
      line: slots && checkins >= slots ? `Every run at ${name} has had a full ${Math.round(checkins / played.length)} on the court.` : `${checkins} player check-ins across ${played.length} run${played.length === 1 ? '' : 's'}.` });
    tabs.push({ label: 'Players', stats: [
      { n: players, f: 'int', label: 'Different players', sub: 'members who ran here' },
      { n: players ? Math.round(cameBack / players * 100) : 0, f: 'pct', label: 'Came back', sub: `${cameBack} played here 2+ times` },
      { n: firstHere, f: 'int', label: 'First Papawis here', sub: 'started their run here' }],
      chart: 'NEW FACES PER RUN', bars: perRun.map((r, i) => ({ v: r.fresh, d: D[i] })), bf: 'int',
      line: firstHere ? `${firstHere} of ${players} players played their first-ever Papawis at ${name}.` : `${players} different players have run at ${name}.` });
    tabs.push({ label: 'Demand', stats: [
      { n: slots ? Math.round(checkins / slots * 100) : 0, f: 'pct', label: 'Slots filled', sub: slots && checkins >= slots ? 'every run sold out' : `${checkins} of ${slots} slots` },
      { n: fastest ? Math.round(fastest.selloutH) : null, f: 'dh', label: 'Fastest sell-out', sub: 'first sign-up to full' },
      { n: waitlist, f: 'int', label: 'Waitlist sign-ups', sub: 'people who wanted in' }],
      chart: 'HOURS TO SELL OUT', bars: perRun.map((r, i) => ({ v: r.selloutH == null ? 0 : Math.round(r.selloutH), d: D[i] })), bf: 'h',
      line: fastest ? `${ymdLabel(fastest.ymd, { month: 'short', day: 'numeric' })} went from first sign-up to full in ${Math.round(fastest.selloutH)} hours.` : 'No run here has sold out yet.' });
    tabs.push({ label: 'Price', stats: [
      { n: avgPrice || null, f: 'peso', label: 'Avg per player', sub: 'moves with the headcount' },
      { n: refereed, f: 'of', of: played.length, label: 'Refereed runs', sub: refereed === played.length ? 'every run had a ref' : `${refereed} of ${played.length} runs` },
      { n: usualHours || null, f: 'h', label: 'Usual run', sub: played[0]?.max_slots ? `${played[0].max_slots} players` : '' }],
      chart: 'PRICE PER PLAYER', bars: perRun.map((r, i) => ({ v: r.price, d: D[i] })), bf: 'peso0',
      line: avgPrice ? `Runs here average ₱${avgPrice} a head${refereed === played.length ? ', referee included' : ''}.` : 'Price per player is set per run.' });
  }
  const recLine = Object.entries(records).sort((a, b) => b[1].w - a[1].w).map(([t, r]) => `${t} ${r.w}–${r.l}`).join(' · ');
  tabs.push({ label: 'League', stats: finals.length ? [
      { n: finals.length, f: 'int', label: 'Games here', sub: recLine || 'WKND league games' },
      { n: high?.pts ?? null, f: 'int', label: 'Highest team score', sub: high ? high.team : '' },
      { n: topScorer?.pts ?? null, f: 'int', label: 'Top scorer here', sub: topScorer ? `${displayPlayerName(topScorer.name)} · total points` : '' }]
    : [{ n: null, label: 'Games here', sub: 'once games are set to this court' }, { n: null, label: 'Highest team score', sub: 'and who did it' }, { n: null, label: 'Top scorer here', sub: 'most points at this court' }],
    chart: 'POINTS PER GAME', bars: finals.slice(-6).map(g => ({ v: Number(g.team_a_score) + Number(g.team_b_score), d: ymdLabel(String(g.date).slice(0, 10), { month: 'short', day: 'numeric' }).toUpperCase() })), bf: 'int',
    line: finals.length ? `${finals.length} league game${finals.length === 1 ? '' : 's'} here, ${points} points in all${biggest ? `; biggest win by ${biggest.margin} (${biggest.winner})` : ''}.` : 'League games set to this court in the admin show up here.' });

  // ── Lists ──
  const regulars = Object.entries(perPlayer).sort((a, b) => b[1] - a[1] || String(names[a[0]]).localeCompare(String(names[b[0]]))).slice(0, 6)
    .map(([id, n]) => ({ id, name: displayPlayerName(names[id] || ''), slug: playerSlug({ name: names[id] || '' }), runs: n }));
  const pastRuns = [...played].reverse().map(r => ({ id: r.id, ymd: String(r.date).slice(0, 10), time: formatTimeRange(r.start_time, r.end_time), players: confirmed(r.id).length }));
  const nextRun = upcoming[0] ? { ...upcoming[0], ymd: String(upcoming[0].date).slice(0, 10), time: formatTimeRange(upcoming[0].start_time, upcoming[0].end_time), confirmed: confirmed(upcoming[0].id).length } : null;

  // ── Gallery: court photo, run covers, game covers; admin can hide any and pick the lead ──
  const hidden = new Set(parseJson(court.gallery_hidden_json, []));
  let photos = [];
  if (court.image_url) photos.push({ key: 'court', src: `/api/papawis-court/${encodeURIComponent(court.id)}/photo`, tag: 'THE COURT', caption: street ? `${name}, ${street}` : name, alt: `${name} basketball court` });
  for (const r of [...runs].reverse()) if (coverVers[r.id]) {
    const ymd = String(r.date).slice(0, 10);
    photos.push({ key: `run:${r.id}`, src: `/api/papawis-cover/${encodeURIComponent(r.id)}?v=${coverVers[r.id]}`, tag: `PAPAWIS · ${ymdLabel(ymd, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}`, caption: `${ymdLabel(ymd, { weekday: 'long' })} run, ${formatTimeRange(r.start_time, r.end_time)}`, alt: `Papawis run at ${name}, ${ymdLabel(ymd, { month: 'long', day: 'numeric' })}` });
  }
  for (const g of [...games].reverse()) if (g.has_cover) {
    photos.push({ key: `game:${g.id}`, src: `/api/photo/${encodeURIComponent(g.id)}?w=960`, tag: `LEAGUE · SEASON ${g.season}`, caption: `${tc(g.team_a_name)} ${g.team_a_score}–${g.team_b_score} ${tc(g.team_b_name)}`, alt: `${tc(g.team_a_name)} vs ${tc(g.team_b_name)} at ${name}` });
  }
  const allPhotos = photos;
  photos = photos.filter(p => !hidden.has(p.key));
  const mainIdx = photos.findIndex(p => p.key === court.gallery_main);
  if (mainIdx > 0) photos.unshift(photos.splice(mainIdx, 1)[0]);

  // ── Search text ──
  const nextLabel = nextRun ? `${ymdLabel(nextRun.ymd, { weekday: 'short', month: 'short', day: 'numeric' })}, ${nextRun.time}` : '';
  const kinds = [played.length ? 'Pickup Basketball' : '', finals.length ? 'League Games' : ''].filter(Boolean).join(' & ') || 'Basketball';
  // Google shows about 60 characters: the " | WKND" tail goes first when it would run long.
  const baseTitle = `${name}${city ? `, ${city}` : ''}: ${kinds}`;
  const autoTitle = baseTitle.length + 7 <= 60 ? `${baseTitle} | WKND` : baseTitle;
  const descParts = [
    `${name}${street ? ` on ${street}` : ''}${city ? `, ${city}` : ''}.`,
    played.length ? `${played.length} WKND Papawis run${played.length === 1 ? '' : 's'}, ${players} players${finals.length ? `, ${finals.length} league games` : ''}.` : finals.length ? `${finals.length} WKND league games.` : '',
    nextLabel ? `Next run: ${nextLabel}.` : 'Schedule, photos and stats.',
  ].filter(Boolean);
  let autoDescription = descParts.join(' ');
  if (autoDescription.length > 160) autoDescription = autoDescription.slice(0, 157).replace(/\s+\S*$/, '') + '…';

  // Facts for the AI writeup (every number in it must come from here).
  const facts = [
    `Court: ${name}`, city && `City: ${city}`, court.address && `Address: ${court.address}`,
    played.length && `Papawis pickup runs played here: ${played.length}`, cancelled && `Runs cancelled: ${cancelled}`,
    usualHours && `Usual run length: ${usualHours} hours`, played[0]?.max_slots && `Players per run: ${played[0].max_slots}`,
    usualDay && `Most common day: ${usualDay[0]}`, earliest && `Earliest start time of any run here: ${formatTimeRange(earliest, '')}`,
    players && `Different members who have played here: ${players}`, cameBack && `Members who came back for 2 or more runs here: ${cameBack}`,
    firstHere && `Members whose first-ever Papawis run was here: ${firstHere}`,
    slots && `Slots filled across all runs: ${checkins} of ${slots}`, avgPrice && `Average price per player: ${avgPrice} pesos`,
    refereed && `Runs with a referee: ${refereed} of ${played.length}`,
    finals.length && `WKND league games played here: ${finals.length}`, recLine && `Team records here: ${recLine}`,
    high && `Highest team score here: ${high.pts} by ${high.team}`,
    nextLabel && `Next scheduled run: ${nextLabel}`,
    ...COURT_INFO_FIELDS.filter(f => !f.adminOnly && info[f.key]).map(f => `${f.label}: ${info[f.key]}`),
  ].filter(Boolean);

  return {
    name, city, street, info, slug: court.slug,
    live: !court.page_hidden && (played.length > 0 || finals.length > 0),
    playedRuns: played.length, players, checkins, avgPrice, finalsCount: finals.length,
    tabs, regulars, pastRuns, cancelled, nextRun, upcoming,
    photos, allPhotos, hiddenPhotos: [...hidden],
    title: court.seo_title || autoTitle, description: court.seo_description || autoDescription,
    autoTitle, autoDescription, facts,
  };
}
