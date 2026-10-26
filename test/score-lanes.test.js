// node --test test/score-lanes.test.js  — two scorers: sides, asks, hand-overs, take-overs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLanes, STALE_MS } from '../lib/score-lanes.js';

const setup = () => { let t = 1000; const L = createLanes({ now: () => t }); return { L, tick: ms => { t += ms; } }; };
const A = { device: 'pa', name: 'Ana' }, B = { device: 'pb', name: 'Ben' };

test('first scorer takes Both; a second one gets a conflict and asks for a side', () => {
  const { L } = setup();
  assert.deepEqual(L.claim('g', A, 'both'), { ok: true, tookOver: '', tookOverDevice: '', lostLane: '' });
  assert.equal(L.claim('g', B, 'both').conflict.name, 'Ana');
  assert.equal(L.ask('g', B, 'b').asked, 'Ana');
  const va = L.ping('g', A, { lane: 'both' });
  assert.deepEqual(va.asks, [{ device: 'pb', name: 'Ben', ini: '', lane: 'b' }]);
  L.answer('g', A, 'pb', true);
  assert.equal(L.view('g', 'pa').me.lane, 'a');
  const vb = L.ping('g', B, {});
  assert.equal(vb.me.lane, 'b');
  assert.match(vb.me.note, /handed it over/);
});

test('saying no keeps the side and tells the asker', () => {
  const { L } = setup();
  L.claim('g', A, 'both'); L.ask('g', B, 'a');
  L.answer('g', A, 'pb', false);
  assert.equal(L.view('g', 'pa').me.lane, 'both');
  assert.match(L.ping('g', B, {}).me.note, /kept that side/);
});

test('a quiet phone can be taken over; an active one only by force', () => {
  const { L, tick } = setup();
  L.claim('g', A, 'both');
  assert.ok(L.claim('g', B, 'a').conflict);
  assert.equal(L.claim('g', B, 'a', { force: true }).tookOver, 'Ana');
  assert.equal(L.view('g', 'pa').me.lane, 'b'); // was on Both: keeps the other side
  tick(STALE_MS + 1);
  L.ping('g', B, { lane: 'a' });
  assert.equal(L.claim('g', B, 'both').tookOver, 'Ana');
  assert.equal(L.view('g', 'pa').me.lane, null);
});

test('the clock keeper is the phone on Both, else the first team', () => {
  const { L } = setup();
  L.claim('g', A, 'b'); L.claim('g', B, 'a');
  L.ping('g', B, { lane: 'a', clock: { secs: 300, running: true } });
  const v = L.ping('g', A, { lane: 'b' });
  assert.equal(v.keeper.name, 'Ben');
  assert.equal(v.keeper.clock.secs, 300);
  assert.equal(v.keeper.me, false);
});

test('a phone that was taken over is remembered until it scores a side again', () => {
  const { L, tick } = setup();
  L.claim('g', A, 'both');
  assert.equal(L.lostFor('g', 'pa'), null);
  tick(STALE_MS + 1);
  L.claim('g', B, 'both');
  const lost = L.lostFor('g', 'pa');
  assert.equal(lost.lane, 'both');
  assert.equal(lost.by, 'Ben');
  assert.ok(lost.since < lost.at); // last heard from before the take-over
  L.claim('g', A, null); // watching: still lost
  assert.ok(L.lostFor('g', 'pa'));
  tick(STALE_MS + 1);
  L.claim('g', A, 'both'); // scores again (took it back): no longer lost
  assert.equal(L.lostFor('g', 'pa'), null);
});

test('the side chooser sees quiet holders and for how long; a take-over says whose phone', () => {
  const { L, tick } = setup();
  L.claim('g', A, 'a');
  tick(60_000); // Ana's phone quiet a minute: gone from "others", still holding White
  const v = L.ping('g', B, {});
  assert.equal(v.others.length, 0);
  assert.equal(v.holders[0].name, 'Ana');
  assert.equal(v.holders[0].lane, 'a');
  assert.ok(v.holders[0].quiet >= 60_000 && v.holders[0].quiet < v.staleMs);
  assert.ok(L.claim('g', B, 'a').conflict); // not quiet long enough
  tick(STALE_MS);
  const r = L.claim('g', B, 'a');
  assert.equal(r.tookOver, 'Ana');
  assert.equal(r.tookOverDevice, 'pa');
  assert.equal(r.lostLane, 'a');
});
