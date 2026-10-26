// Two scorers on one game (phase 3): who scores which side. A lane is 'a', 'b' or 'both' (one
// phone scores everything); null = watching. Lanes live in memory: every scorer's phone checks
// in every few seconds with the lane it holds (server.js POST /api/score/:id/lanes), so after a
// restart the claims come straight back. Plays never depend on lanes: a phone keeps saving and
// sending plays whatever happens here, and every play from every phone lands in one log.
//
// Rules (scorer-tool-plan): Both only while nobody else scores. A late second scorer asks for a
// side; the phone holding it gets a hand-over prompt. A scorer whose phone stopped checking in
// (no signal, battery) for STALE_MS can be taken over; an admin can take over any time. The
// clock keeper is the phone on Both, else the one on the first team; the other phone shows the
// keeper's clock.
export const ACTIVE_MS = 45_000;
export const STALE_MS = 120_000;
const other = l => (l === 'a' ? 'b' : 'a');
export const overlaps = (x, y) => !!x && !!y && (x === 'both' || y === 'both' || x === y);

export function createLanes({ now = Date.now } = {}) {
  const games = new Map(); // gameId → Map(device → { device, playerId, name, lane, clock, seen, ask, note })
  const room = id => games.get(id) || games.set(id, new Map()).get(id);
  const active = (r, me) => [...r.values()].filter(d => d.device !== me && now() - d.seen < ACTIVE_MS);
  const holderOf = (r, me, lane) => [...r.values()].find(d => d.device !== me && overlaps(d.lane, lane));

  function touch(gameId, { device, playerId = '', name = '', ini = '' }) {
    const r = room(gameId);
    const d = r.get(device) || { device, lane: null, clock: null, ask: null, note: '' };
    Object.assign(d, { playerId, name, ini, seen: now() });
    r.set(device, d);
    return { r, d };
  }

  // Take a lane. Free → yours. Held by someone checking in → conflict (ask instead). Held by a
  // phone gone quiet, or force (admins) → taken over: they drop to watching and are told.
  function claim(gameId, who, lane, { force = false } = {}) {
    const { r, d } = touch(gameId, who);
    if (lane == null) { d.lane = null; return { ok: true }; }
    const h = holderOf(r, who.device, lane);
    if (h && now() - h.seen < STALE_MS && !force) return { conflict: { name: h.name, lane: h.lane, stale: false } };
    if (h) {
      // What they lost, and when they were last heard from: plays their phone made after that
      // (offline, still scoring) may repeat the new scorer's, so they're set aside (lostFor).
      h.lost = { lane: h.lane === 'both' && lane !== 'both' ? lane : h.lane, since: h.seen, at: now(), by: who.name || '' };
      // They keep what doesn't overlap (Both → the other side), else they watch.
      h.lane = h.lane === 'both' && lane !== 'both' ? other(lane) : null;
      h.note = `${who.name || 'Another scorer'} took over${h.lane ? `; you have the other side` : ''}.`;
      if (h.lane && holderOf(r, h.device, h.lane)) h.lane = null;
    }
    d.lane = lane; d.ask = null; d.lost = null;
    return { ok: true, tookOver: h ? h.name : '', tookOverDevice: h ? h.device : '', lostLane: h ? h.lost.lane : '' };
  }

  // Ask the holder of a side for it (they see it next check-in).
  function ask(gameId, who, lane) {
    const { r, d } = touch(gameId, who);
    const h = holderOf(r, who.device, lane);
    if (!h) { d.lane = lane; d.ask = null; return { ok: true }; }
    d.ask = lane;
    return { asked: h.name, stale: now() - h.seen >= STALE_MS };
  }

  // The holder answers someone's ask. Yes: the asker gets the side; the holder keeps the other
  // side if they were on Both (or the one they gave away was all they had: they watch).
  // timeout: nobody answered in time (the holder's phone says no for them).
  function answer(gameId, who, fromDevice, yes, { timeout = false } = {}) {
    const { r, d } = touch(gameId, who);
    const a = r.get(fromDevice);
    if (!a || !a.ask) return { ok: true };
    const lane = a.ask;
    a.ask = null;
    if (!yes) { a.note = timeout ? `${d.name || 'The other scorer'} didn’t answer. Ask again?` : `${d.name || 'The other scorer'} kept that side.`; return { ok: true }; }
    d.lane = d.lane === 'both' && lane !== 'both' ? other(lane) : overlaps(d.lane, lane) ? null : d.lane;
    a.lane = lane; a.lost = null; a.note = `${d.name || 'The other scorer'} handed it over.`;
    return { ok: true };
  }

  // A check-in: keeps the phone's lane (re-claimed quietly if free), stores the keeper's clock,
  // and answers with everyone's view.
  function ping(gameId, who, { lane, clock } = {}) {
    const { r, d } = touch(gameId, who);
    if (lane !== undefined && lane !== d.lane && !d.note) {
      if (lane == null || !holderOf(r, who.device, lane)) d.lane = lane;
    }
    if (clock) d.clock = { ...clock, at: now() };
    return view(gameId, who.device);
  }

  function view(gameId, device) {
    const r = room(gameId), d = r.get(device);
    const others = active(r, device);
    const all = [d, ...others].filter(x => x && x.lane);
    const keeper = all.find(x => x.lane === 'both') || all.find(x => x.lane === 'a') || all.find(x => x.lane === 'b') || null;
    const note = d?.note || '';
    if (d) d.note = '';
    return {
      me: { lane: d?.lane ?? null, ask: d?.ask ?? null, note },
      others: others.map(o => ({ device: o.device, name: o.name, lane: o.lane })),
      asks: others.filter(o => o.ask && d && overlaps(d.lane, o.ask)).map(o => ({ device: o.device, name: o.name, ini: o.ini || '', lane: o.ask })),
      keeper: keeper ? { device: keeper.device, name: keeper.name, me: keeper.device === device, clock: keeper.clock } : null,
      // Every phone holding a side, quiet ones too, and for how long it's been quiet: the side
      // chooser says Ask (active), wait (quiet under STALE_MS) or Take over.
      holders: [...r.values()].filter(x => x.device !== device && x.lane).map(x => ({ device: x.device, name: x.name, ini: x.ini || '', lane: x.lane, quiet: now() - x.seen })),
      activeMs: ACTIVE_MS, staleMs: STALE_MS,
    };
  }

  // A phone that was taken over: { lane, since, at, by } until it scores a side again.
  const lostFor = (gameId, device) => room(gameId).get(device)?.lost || null;
  // The side a phone holds now, and whether another phone holds the other side.
  const laneOf = (gameId, device) => room(gameId).get(device)?.lane ?? null;

  // Who is scoring a game right now (holding a side, heard from within STALE_MS): two at most,
  // so the Score list can show a game as full.
  const scoring = gameId => [...room(gameId).values()].filter(x => x.lane && now() - x.seen < STALE_MS)
    .map(x => ({ device: x.device, playerId: x.playerId, name: x.name, lane: x.lane }));

  return { claim, ask, answer, ping, view, lostFor, laneOf, scoring, _games: games };
}
