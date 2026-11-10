// node --test test/retrack-diff.test.js — the saved game vs re-track compare (lib/retrack-diff.js):
// real mistakes are found once each and named; plays in another order, a rebound's offensive /
// defensive flag and a re-track still under way never show up as mistakes (Fable audit 2026-11-10).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignTracks, sideBySide } from '../lib/retrack-diff.js';

// A track from short codes: "A2" = player A (team a) 2PT made, "A2x" missed, "A1" free throw,
// "rA" rebound by A, "rAo" offensive, "aA" assist, "fA" foul, "fAo" offensive foul. Running score added.
let ids = 0;
function track(codes) {
  const sc = { a: 0, b: 0 };
  return codes.map((c, k) => {
    const team = /[A-M]/.test(c.replace(/^[a-z]/, '')[0]) ? 'a' : 'b';
    const e = { id: `e${ids++}`, team, period: 'Q1', clock: `${10 - Math.floor(k / 6)}:${String(59 - (k % 60)).padStart(2, '0')}` };
    let m;
    if ((m = c.match(/^([A-Z])([123])(x?)$/))) Object.assign(e, m[2] === '1' ? { type: 'ft', player: m[1], made: !m[3] } : { type: 'shot', player: m[1], pts: Number(m[2]), made: !m[3] });
    else if ((m = c.match(/^r([A-Z])(o?)$/))) Object.assign(e, { type: 'reb', player: m[1], off: !!m[2] });
    else if ((m = c.match(/^a([A-Z])$/))) Object.assign(e, { type: 'ast', player: m[1] });
    else if ((m = c.match(/^f([A-Z])(o?)$/))) Object.assign(e, { type: 'foul', player: m[1], kind: m[2] ? 'offensive' : 'personal' });
    else throw new Error(c);
    if (e.made) sc[team] += e.type === 'ft' ? 1 : e.pts;
    e.score = { ...sc };
    return e;
  });
}
const base = ['A2', 'aB', 'N2x', 'rC', 'C3', 'O2', 'aP', 'A2x', 'rN', 'N2', 'fA', 'B1', 'B1', 'O3x', 'rB', 'B2', 'aA', 'P2', 'C2x', 'rCo', 'C2', 'Q1', 'Q1x', 'rD'];
const run = (saved, re, over = true) => alignTracks(track(saved), track(re), over, { describe: e => `${e.player} · ${e.type}`, nameOf: e => e.player });
const types = al => al.hunks.flatMap(h => h.items.map(x => x.type));

test('identical tracks: nothing differs', () => {
  const al = run(base, base);
  assert.equal(al.hunks.length, 0);
  assert.equal(al.orderCount, 0);
});

test('a missing rebound is one Missing', () => {
  const re = base.filter((c, k) => k !== 3);
  assert.deepEqual(types(run(base, re)), ['missing']);
});

test('a basket credited to a teammate is one Wrong player, with both lines in the effect', () => {
  const re = base.slice(); re[4] = 'D3';
  const al = run(base, re);
  assert.deepEqual(types(al), ['player']);
  assert.match(al.hunks[0].items[0].effect, /C PTS −3 · D PTS \+3/);
});

test('a missing basket shows once; everything after it lines up again', () => {
  const re = base.filter((c, k) => k !== 5);
  const al = run(base, re);
  assert.deepEqual(types(al), ['missing']);
  assert.match(al.hunks[0].items[0].effect, /O PTS −2/);
  assert.ok(al.divergeAt !== null, 'the scores stop matching after it');
});

test('an extra miss is one Extra', () => {
  const re = base.slice(); re.splice(14, 0, 'O3x');
  assert.deepEqual(types(run(base, re)), ['extra']);
});

test('made vs missed is one item', () => {
  const re = base.slice(); re[9] = 'N2x';
  assert.deepEqual(types(run(base, re)), ['result']);
});

test('a missing miss does not turn the next rebound into a second difference', () => {
  // Saved: a miss, then a defensive rebound. The re-track missed the shot, so its rebound looks
  // like an offensive one. Only the miss differs.
  const saved = ['A2', 'N2x', 'rC', 'C2'], re = ['A2', 'rCo', 'C2'];
  assert.deepEqual(types(run(saved, re)), ['missing']);
});

test('plays in another order are not mistakes', () => {
  const re = base.slice(); [re[2], re[3]] = [re[3], re[2]]; [re[11], re[12]] = [re[12], re[11]];
  const al = run(base, re);
  assert.equal(al.hunks.length, 0);
  assert.ok(al.orderCount >= 1);
});

test('an offensive foul is not the same play as a personal foul', () => {
  const re = base.slice(); re[10] = 'fAo';
  assert.equal(run(base, re).hunks.length, 1);
});

test('still re-tracking: saved plays not reached yet are pending, not missing', () => {
  // The re-track stopped after "aA" (it also appears earlier, which once pulled the match late).
  const re = base.slice(0, 17);
  const al = run(base, re, false);
  assert.equal(al.hunks.length, 0);
  assert.equal(al.pending, base.length - 17);
});

test('side by side: a Wrong player pair is one row, marked with its spot', () => {
  const re = base.slice(); re[4] = 'D3';
  const al = run(base, re);
  const rows = sideBySide(al, e => `${e.player} · ${e.type}`);
  const pair = rows.find(x => x.t === 'player');
  assert.ok(pair && pair.s && pair.r && pair.hunk === 1);
  assert.equal(rows.filter(x => x.t === 'same').length, base.length - 1);
});
