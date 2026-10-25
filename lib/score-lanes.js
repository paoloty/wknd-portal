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

  function touch(gameId, { device, playerId = '', name = '' }) {
    const r = room(gameId);
    const d = r.get(device) || { device, lane: null, clock: null, ask: null, note: '' };
    Object.assign(d, { playerId, name, seen: now() });
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
      // They keep what doesn't overlap (Both → the other side), else they watch.
      h.lane = h.lane === 'both' && lane !== 'both' ? other(lane) : null;
      h.note = `${who.name || 'Another scorer'} took over${h.lane ? `; you have the other side` : ''}.`;
      if (h.lane && holderOf(r, h.device, h.lane)) h.lane = null;
    }
    d.lane = lane; d.ask = null;
    return { ok: true, tookOver: h ? h.name : '' };
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
  function answer(gameId, who, fromDevice, yes) {
    const { r, d } = touch(gameId, who);
    const a = r.get(fromDevice);
    if (!a || !a.ask) return { ok: true };
    const lane = a.ask;
    a.ask = null;
    if (!yes) { a.note = `${d.name || 'The other scorer'} kept that side.`; return { ok: true }; }
    d.lane = d.lane === 'both' && lane !== 'both' ? other(lane) : overlaps(d.lane, lane) ? null : d.lane;
    a.lane = lane; a.note = `${d.name || 'The other scorer'} handed it over.`;
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
      asks: others.filter(o => o.ask && d && overlaps(d.lane, o.ask)).map(o => ({ device: o.device, name: o.name, lane: o.ask })),
      keeper: keeper ? { device: keeper.device, name: keeper.name, me: keeper.device === device, clock: keeper.clock } : null,
    };
  }

  return { claim, ask, answer, ping, view, _games: games };
}
