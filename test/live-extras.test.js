import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldGame, DEFAULT_RULES } from '../public/score-engine.js';
import { liveExtras, winChance, timeline } from '../lib/live-extras.js';

let n = 0;
const P = (type, f = {}) => ({ id: `e${++n}`, pos: n, type, team: 'a', period: 'Q1', clock: '12:00', ...f });
const shot = (team, player, pts, clock, period = 'Q1') => P('shot', { team, player, pts, made: true, clock, period });
const ctx = (over = {}) => ({
  rules: DEFAULT_RULES, p0: 0.6, playerName: id => id.toUpperCase(), teamOf: id => (id.startsWith('a') ? 'a' : 'b'),
  seasonAvg: () => ({ pts: 8, gp: 5 }), seasonHigh: () => 20, teamUsual: { a: { pts: 70, tpm: 6, to: 12, reb: 35 }, b: { pts: 70, tpm: 6, to: 12, reb: 35 } },
  picks: { closed: true, list: [{ side: 'a', name: 'X' }, { side: 'b', name: 'Y' }, { side: 'b', name: 'Z' }] }, myPick: 'b', ...over,
});

test('win chance: the pre-game edge early, the lead late', () => {
  assert.ok(Math.abs(winChance(0.6, 0, 1) - 0.6) < 0.02, 'tip-off = the pre-game odds');
  assert.ok(winChance(0.5, 6, 0.9) < winChance(0.5, 6, 0.1), 'the same lead counts more late');
  assert.ok(winChance(0.5, -10, 0.05) < 0.05, 'down 10 near the end');
});

test('timeline: seconds played from the period and the clock', () => {
  const T = timeline(DEFAULT_RULES);
  assert.equal(T.at('Q1', '12:00'), 0);
  assert.equal(T.at('Q2', '6:00'), 12 * 60 + 6 * 60);
  assert.equal(T.total, 48 * 60);
});

test('momentum: the run, lead changes, ties, biggest leads', () => {
  const ev = [shot('a', 'a1', 2, '11:00'), shot('b', 'b1', 3, '10:00'), shot('a', 'a1', 2, '9:00'), shot('a', 'a2', 3, '8:00'), shot('a', 'a1', 2, '7:00'), shot('b', 'b1', 2, '6:00'),
    shot('b', 'b2', 3, '5:00'), shot('b', 'b2', 3, '4:00'), shot('b', 'b1', 2, '3:00')];
  const x = liveExtras(foldGame(ev), ctx());
  assert.equal(x.momentum.run.team, 'b');
  assert.equal(x.momentum.run.pts, 10);
  assert.equal(x.momentum.biggest.a, 6);
  assert.ok(x.momentum.leadChanges >= 2);
  assert.ok(x.odds.a < 60, 'odds fell with the late run');
});

test('pace waits a quarter; picks show once closed', () => {
  const early = liveExtras(foldGame([shot('a', 'a1', 2, '10:00')]), ctx());
  assert.equal(early.pace, null);
  const later = liveExtras(foldGame([shot('a', 'a1', 2, '10:00'), shot('a', 'a1', 2, '6:00', 'Q2')]), ctx());
  assert.ok(later.pace && later.pace[0].a > 0);
  assert.equal(later.picks.total, 3);
  assert.equal(liveExtras(foldGame([shot('a', 'a1', 2, '10:00')]), ctx({ picks: { closed: false, list: [{ side: 'a' }] } })).picks, null);
});

test('no pre-game odds: no odds block', () => {
  assert.equal(liveExtras(foldGame([shot('a', 'a1', 2, '10:00')]), ctx({ p0: null })).odds, null);
});
