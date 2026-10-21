// Court pages (/courts/:slug): everything the page, its search metadata and its AI writeup
// need, computed from one court's Papawis runs, sign-ups and league games. Pure functions:
// server.js gathers the rows (lib/portal-db.js) and hands them in.
import { displayPlayerName, formatTimeRange } from '../views/utils.js';
import { playerSlug } from './slugs.js';

export const COURT_CITIES = ['Makati', 'Mandaluyong', 'Pasig', 'Taguig', 'San Juan', 'Quezon City', 'Manila', 'Pateros', 'Marikina', 'Parañaque', 'Pasay'];

// "Good to know" on a court page (views/admin/papawis-court.js edits it). Ticks, not free text,
// so every court reads the same: one court type, one floor, and any number of features. Only
// directions, notes and the contact stay as text; the contact is admin-only unless
// contact_public is on.
export const COURT_TYPES = [['indoor', 'Indoor'], ['covered', 'Covered'], ['outdoor', 'Outdoor']];
export const COURT_FLOORS = [['hardwood', 'Hardwood floor'], ['rubberized', 'Rubberized floor'], ['tiles', 'Sport tile floor']];
export const COURT_FEATURES = [
  { group: 'The court', items: [['aircon', 'Air-conditioned'], ['lights', 'Lights for night games'], ['scoreboard', 'Scoreboard and game clock'], ['multi', 'More than one court']] },
  { group: 'Facilities', items: [['free_parking', 'Free parking'], ['paid_parking', 'Paid parking'], ['restrooms', 'Restrooms'], ['showers', 'Showers'], ['lockers', 'Lockers'], ['food', 'Food or café on site']] },
  { group: 'Getting there', items: [['near_mrt', 'Near an MRT station'], ['near_lrt', 'Near an LRT station'], ['in_building', 'Inside a building']] },
];
export const COURT_TEXT_FIELDS = [
  { key: 'directions', label: 'How to get there', placeholder: 'Behind the Guadalupe Commercial Complex, a few minutes from MRT-3 Guadalupe' },
  { key: 'notes', label: 'Good to know', placeholder: 'Bring a white and a dark shirt' },
  { key: 'contact', label: 'Court contact / booking', placeholder: '0917 123 4567 (front desk)', adminOnly: true },
];
// The venue's own links (shown as "Official links" and sent to Google as sameAs) and its
// posted rental rate, as the venue states it. Admin-edited; stored in info_json.
export const COURT_LINK_FIELDS = [
  { key: 'website', label: 'Official website', placeholder: 'https://activatesports.ph' },
  { key: 'booking', label: 'Booking page', placeholder: 'https://www.sparrk.ph/…' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://www.facebook.com/…' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://www.instagram.com/…' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://www.tiktok.com/@…' },
];
export function courtLinks(info) {
  const links = info?.links || {};
  return COURT_LINK_FIELDS.filter(f => /^https?:\/\//i.test(links[f.key] || '')).map(f => ({ ...f, url: links[f.key] }));
}
const FEATURE_LABEL = Object.fromEntries(COURT_FEATURES.flatMap(g => g.items));
// Older free-text info (the first version of this page) folded into the ticks.
export function normalizeCourtInfo(raw) {
  const info = { ...(raw || {}) };
  const feats = new Set(Array.isArray(info.features) ? info.features : []);
  const st = String(info.setting || '').toLowerCase();
  info.setting = COURT_TYPES.some(([k]) => k === st) ? st : '';
  const fl = String(info.floor || '').toLowerCase();
  info.floor = COURT_FLOORS.some(([k]) => k === fl) ? fl : /hard|wood/.test(fl) ? 'hardwood' : /rubber/.test(fl) ? 'rubberized' : /tile/.test(fl) ? 'tiles' : '';
  if (/^yes$/i.test(info.aircon || '')) feats.add('aircon');
  if (/^yes$/i.test(info.lights || '')) feats.add('lights');
  info.features = [...feats].filter(k => FEATURE_LABEL[k]);
  return info;
}
// The tags shown on the page, in a fixed order.
export function courtInfoTags(info) {
  const tags = [];
  const t = COURT_TYPES.find(([k]) => k === info.setting); if (t) tags.push(t[1]);
  const f = COURT_FLOORS.find(([k]) => k === info.floor); if (f) tags.push(f[1]);
  for (const g of COURT_FEATURES) for (const [k, l] of g.items) if (info.features?.includes(k)) tags.push(l);
  return tags;
}

function courtLastPlayed(lastRun, finals, apps) {
  const out = { ...lastRun };
  const day = Object.fromEntries(finals.map(g => [g.id, String(g.date).slice(0, 10)]));
  for (const x of apps) if (day[x.game_id] && (!out[x.player_id] || day[x.game_id] > out[x.player_id])) out[x.player_id] = day[x.game_id];
  return out;
}
export function courtExtraFacts(court) {
  return String(court.extra_facts || '').split('\n').map(s => s.replace(/^[-•*\s]+/, '').trim()).filter(Boolean).slice(0, 20);
}
// "14.5806, 121.0536" or a Google Maps link (…/@14.5806,121.0536,17z or ?q=14.5806,121.0536)
// → { lat, lng } inside the Philippines, else null.
export function parseMapPin(text) {
  const s = String(text || '');
  const m = s.match(/@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/) || s.match(/[?&](?:q|query|ll)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/) || s.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  return lat > 4 && lat < 22 && lng > 116 && lng < 127 ? { lat, lng } : null;
}

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

// Ratings: aspects players score 1–5 and the quick tags they tick. Shared by the page, the
// rating form and the admin list.
export const RATING_ASPECTS = [['floor', 'Floor'], ['rims', 'Rims'], ['lighting', 'Lighting'], ['getting_there', 'Getting there'], ['airflow', 'Airflow']];
export const RATING_TAGS_GOOD = [['easy_to_reach', 'Easy to get to'], ['good_floor', 'Good floor'], ['good_rims', 'Good rims'], ['well_lit', 'Well lit'], ['food_after', 'Food after'], ['worth_it', 'Worth the trip']];
export const RATING_TAGS_BAD = [['gets_warm', 'Gets warm'], ['restrooms', 'Restrooms'], ['parking', 'Parking'], ['hard_to_find', 'Hard to find']];
export const RATING_MIN_FOR_SCORE = 5;
// Visible ratings → the summary the page shows. The score itself only shows from
// RATING_MIN_FOR_SCORE ratings up; below that the page asks for the first ones.
export function summarizeRatings(rows) {
  const live = rows.filter(r => !r.hidden);
  const n = live.length;
  const avg = n ? live.reduce((a, r) => a + r.stars, 0) / n : 0;
  const dist = [5, 4, 3, 2, 1].map(k => ({ k, n: live.filter(r => r.stars === k).length }));
  const aspects = RATING_ASPECTS.map(([k, label]) => {
    const vals = live.map(r => Number(parseJson(r.aspects_json, {})[k])).filter(v => v >= 1 && v <= 5);
    return { k, label, n: vals.length, avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : 0 };
  }).filter(a => a.n);
  const tagCount = t => live.filter(r => parseJson(r.tags_json, []).includes(t)).length;
  const good = RATING_TAGS_GOOD.map(([k, l]) => ({ k, label: l, n: tagCount(k) })).filter(t => t.n).sort((a, b) => b.n - a.n);
  const bad = RATING_TAGS_BAD.map(([k, l]) => ({ k, label: l, n: tagCount(k) })).filter(t => t.n).sort((a, b) => b.n - a.n);
  const reviews = live.filter(r => r.body && r.body_status === 'approved');
  return { n, avg: Math.round(avg * 10) / 10, showScore: n >= RATING_MIN_FOR_SCORE, dist, aspects, good, bad, reviews };
}

// runs: getPapawisRunsAtCourt rows; signups: getPapawisSignupsForRuns rows; firstRuns:
// getPapawisFirstRuns rows; coverVers: { runId: updated_at }; games: finished league games at
// this court (game rows); leagueApps: { game_id, player_id } rows for those games;
// today: 'YYYY-MM-DD'.
export function buildCourtPage(court, { runs = [], signups = [], firstRuns = [], coverVers = {}, games = [], leagueApps = [], today = '' } = {}) {
  const name = courtDisplayName(court);
  const city = courtCity(court);
  const street = courtStreet(court);
  const info = normalizeCourtInfo(parseJson(court.info_json, {}));

  const played = runs.filter(r => r.status === 'completed');
  const playedIds = new Set(played.map(r => r.id));
  const cancelled = runs.filter(r => r.status === 'cancelled').length;
  const upcoming = runs.filter(r => r.status !== 'completed' && r.status !== 'cancelled' && String(r.date) >= today);
  const byRun = {};
  for (const s of signups) (byRun[s.game_id] ??= []).push(s);
  const confirmed = id => (byRun[id] || []).filter(s => s.status === 'confirmed');

  // ── Papawis numbers ──
  let checkins = 0, guests = 0, slots = 0, playerHours = 0, waitlist = 0;
  const perPlayer = {}, names = {}, seen = new Set(), lastRun = {}, spots = {};
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
    mem.forEach(s => { lastRun[s.player_id] = String(r.date).slice(0, 10); });
    // Sign-up order among members (guests ride on someone's account): "Quickest to sign up".
    [...mem].sort((a, b) => (Number(a.signed_up_at) || 0) - (Number(b.signed_up_at) || 0)).forEach((s, i) => { (spots[s.player_id] ??= []).push(i + 1); });
    perRun.push({ id: r.id, ymd: String(r.date).slice(0, 10), checkins: c.length, fresh, back, hours: h, time: formatTimeRange(r.start_time, r.end_time), refereed: !!r.has_referee,
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

  // ── League numbers: court totals only, no player or team stats ──
  const finals = games.filter(g => Number(g.team_a_score) + Number(g.team_b_score) > 0);
  const finalIds = new Set(finals.map(g => g.id));
  const combined = finals.map(g => Number(g.team_a_score) + Number(g.team_b_score));
  const margins = finals.map(g => Math.abs(Number(g.team_a_score) - Number(g.team_b_score)));
  const apps = leagueApps.filter(x => finalIds.has(x.game_id));
  const league = {
    games: finals.length,
    playoff: finals.filter(g => g.game_type === 'playoff').length,
    overtime: finals.filter(g => Number(g.overtime) > 0).length,
    avgCombined: combined.length ? Math.round(combined.reduce((x, y) => x + y, 0) / combined.length) : 0,
    highCombined: combined.length ? Math.max(...combined) : 0,
    closest: margins.length ? Math.min(...margins) : null,
    appearances: apps.length,
    players: new Set(apps.map(x => x.player_id)).size,
  };

  // ── By the numbers: Papawis + league together ──
  const visits = { ...perPlayer };
  for (const x of apps) visits[x.player_id] = (visits[x.player_id] || 0) + 1;
  const allPlayers = Object.keys(visits).length;
  const allBack = Object.values(visits).filter(n => n >= 2).length;
  const papawis = { runs: played.length, cancelled, slotsPct: slots ? Math.round(checkins / slots * 100) : 0, fastestH: fastest ? fastest.selloutH : null, waitlist, refereed };
  const firstYmd = [...played.map(r => String(r.date).slice(0, 10)), ...finals.map(g => String(g.date).slice(0, 10))].sort()[0] || '';
  const numbers = {
    since: firstYmd ? ymdLabel(firstYmd, { month: 'short', year: 'numeric' }) : '',
    sinceShort: firstYmd ? ymdLabel(firstYmd, { month: 'short' }) : '',
    games: played.length + finals.length, players: allPlayers, showUps: checkins + apps.length,
    // Came back: Papawis only. League players play every week at their court, which would
    // read as ~100% and say nothing.
    cameBack, cameBackPct: players ? Math.round(cameBack / players * 100) : 0,
    papawis, league,
  };

  // ── Court leaders: attendance only (most runs here; quickest to sign up, 2+ runs) ──
  const avgSpot = id => spots[id].reduce((x, y) => x + y, 0) / spots[id].length;
  const person = id => ({ id, name: displayPlayerName(names[id] || ''), slug: playerSlug({ name: names[id] || '' }) });
  const leaders = {
    mostRuns: Object.keys(perPlayer).sort((x, y) => perPlayer[y] - perPlayer[x] || avgSpot(x) - avgSpot(y)).slice(0, 5).map(id => ({ ...person(id), value: String(perPlayer[id]) })),
    quickest: Object.keys(spots).filter(id => spots[id].length >= 2).sort((x, y) => avgSpot(x) - avgSpot(y) || perPlayer[y] - perPlayer[x]).slice(0, 5).map(id => ({ ...person(id), value: '#' + avgSpot(id).toFixed(1) })),
  };

  // ── Lists ──
  const regulars = Object.entries(perPlayer).sort((a, b) => b[1] - a[1] || String(names[a[0]]).localeCompare(String(names[b[0]]))).slice(0, 6)
    .map(([id, n]) => ({ id, name: displayPlayerName(names[id] || ''), slug: playerSlug({ name: names[id] || '' }), runs: n }));
  const pastRuns = [...perRun].reverse().map(r => ({ id: r.id, ymd: r.ymd, time: r.time, players: r.checkins, fresh: r.fresh, selloutH: r.selloutH, refereed: r.refereed, fastest: !!fastest && fastest.id === r.id && sellouts.length > 1 }));
  const runSlots = Number(played[0]?.max_slots || upcoming[0]?.max_slots) || 0;
  const nextRun = upcoming[0] ? { ...upcoming[0], ymd: String(upcoming[0].date).slice(0, 10), time: formatTimeRange(upcoming[0].start_time, upcoming[0].end_time), confirmed: confirmed(upcoming[0].id).length } : null;

  // ── Gallery: court photo (800x400), run covers (1600x900), game covers (1200x630); ratio
  // keeps each card the shape of its photo. Admin can hide any and pick the lead ──
  const hidden = new Set(parseJson(court.gallery_hidden_json, []));
  let photos = [];
  if (court.image_url) photos.push({ key: 'court', src: `/api/papawis-court/${encodeURIComponent(court.id)}/photo`, tag: 'THE COURT', caption: street ? `${name}, ${street}` : name, alt: `${name} basketball court`, ratio: 2 });
  // Run and game photos together, newest run or game first (by when it was played, not when
  // the photo went up).
  const dated = [];
  for (const r of runs) if (coverVers[r.id]) {
    const ymd = String(r.date).slice(0, 10);
    dated.push({ at: `${ymd} ${r.start_time || ''}`, key: `run:${r.id}`, src: `/api/papawis-cover/${encodeURIComponent(r.id)}?v=${coverVers[r.id]}`, tag: `PAPAWIS · ${ymdLabel(ymd, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}`, caption: `${ymdLabel(ymd, { weekday: 'long' })} run, ${formatTimeRange(r.start_time, r.end_time)}`, alt: `Papawis run at ${name}, ${ymdLabel(ymd, { month: 'long', day: 'numeric' })}`, ratio: 16 / 9 });
  }
  for (const g of games) if (g.has_cover) {
    const ymd = String(g.date).slice(0, 10);
    dated.push({ at: `${ymd} ${g.start_time || ''}`, key: `game:${g.id}`, src: `/api/photo/${encodeURIComponent(g.id)}?w=960`, tag: `LEAGUE · S${g.season} · ${ymdLabel(ymd, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}`, caption: `${tc(g.team_a_name)} ${g.team_a_score}–${g.team_b_score} ${tc(g.team_b_name)}`, alt: `${tc(g.team_a_name)} vs ${tc(g.team_b_name)} at ${name}`, ratio: 1200 / 630 });
  }
  dated.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  photos.push(...dated.map(({ at, ...ph }) => ph));
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
  // Lead with what the court is (a court searcher's question), then what WKND does there.
  const typeWord = (COURT_TYPES.find(([k]) => k === info.setting) || [])[1];
  const what = [played.length ? 'pickup runs' : '', finals.length ? 'league games' : ''].filter(Boolean).join(' and ');
  const descParts = [
    `${name}: ${typeWord ? `${/^[aeiou]/i.test(typeWord) ? 'an' : 'a'} ${typeWord.toLowerCase()} basketball court` : 'a basketball court'}${street ? ` on ${street}` : ''}${city ? `, ${city}` : ''}.`,
    what ? `WKND ${what} here, with photos and stats.` : 'Photos and stats.',
    nextLabel ? `Next run: ${nextLabel}.` : '',
  ].filter(Boolean);
  let autoDescription = descParts.join(' ');
  if (autoDescription.length > 160) autoDescription = autoDescription.slice(0, 157).replace(/\s+\S*$/, '') + '…';

  // Facts for the AI writeup: the court itself and what a WKND run there is like. No activity
  // counts (how many runs, players or games); the stats section carries those. Every number in
  // the writeup must come from here.
  const tags = courtInfoTags(info);
  const facts = [
    `Court: ${name}`, city && `City: ${city}`, court.address && `Address: ${court.address}`,
    tags.length && `Court features: ${tags.join(', ')}`,
    info.rate && `Court rental (as the venue posts it): ${info.rate}`,
    info.directions && `How to get there: ${info.directions}`,
    info.notes && `Good to know: ${info.notes}`,
    played.length && 'WKND holds Papawis pickup runs here',
    usualHours && `A WKND Papawis run here lasts ${usualHours} hours`,
    played[0]?.max_slots && `A run has ${played[0].max_slots} player slots`,
    played.length && refereed === played.length && 'Every WKND run here has a referee',
    usualDay && `Runs here are most often on ${usualDay[0]}s`,
    played.length && slots && checkins >= slots && 'Every WKND run here so far has been full',
    avgPrice && `Price per player is set per run (about ${avgPrice} pesos)`,
    finals.length && 'WKND league games are also played here',
    // Checked by an admin (Court info → Extra facts), one per line.
    ...courtExtraFacts(court),
  ].filter(Boolean);

  return {
    name, city, street, info, slug: court.slug,
    live: !court.page_hidden && (played.length > 0 || finals.length > 0),
    playedRuns: played.length, players, checkins, avgPrice, finalsCount: finals.length,
    regulars, pastRuns, cancelled, nextRun, upcoming, numbers, leaders, usualHours, runSlots, firstHere, cameBack, refereed, fastest,
    memberIds: Object.keys(perPlayer), lastRun,
    // Who can rate the court: anyone who played a Papawis run or a league game here, with the
    // date they last played ("You played here Oct 3").
    raterIds: [...new Set([...Object.keys(perPlayer), ...apps.map(x => x.player_id)])], lastPlayed: courtLastPlayed(lastRun, finals, apps),
    photos, allPhotos, hiddenPhotos: [...hidden],
    title: court.seo_title || autoTitle, description: court.seo_description || autoDescription,
    autoTitle, autoDescription, facts,
  };
}
