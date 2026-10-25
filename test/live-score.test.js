// node --test test/live-score.test.js  — the public live score folded from the scorer's plays.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveScoreData } from '../lib/live-score.js';
import { DEFAULT_RULES } from '../public/score-engine.js';

let n = 0;
const P = (type, f = {}) => ({ id: `e${++n}`, pos: n, period: 'Q1', clock: '10:00', team: 'a', ...f, type });
const bundle = events => ({
  status: 'live', rules: DEFAULT_RULES, events,
  a: { id: 'ta', name: 'WHITE', color: '#ddd', players: [{ id: 'x', name: 'Ana CRUZ', number: '7' }] },
  b: { id: 'tb', name: 'BLUE', color: '#48f', players: [{ id: 'y', name: 'Ben LIM', number: '3' }] },
});

test('score, box score lines and plays newest first; subs left out', () => {
  const l = liveScoreData(bundle([
    P('shot', { player: 'x', pts: 3, made: true, clock: '9:40' }),
    P('sub', { in: 'x', out: 'x' }),
    P('foul', { team: 'b', player: 'y', kind: 'personal', clock: '9:10' }),
  ]));
  assert.deepEqual(l.score, { a: 3, b: 0 });
  assert.equal(l.a.rows[0].pts, 3);
  assert.equal(l.a.rows[0].tpm, 1);
  assert.equal(l.b.fouls, 1);
  assert.equal(l.count, 2);
  assert.equal(l.plays[0].who, 'Ben LIM');
  assert.equal(l.plays[1].scoring, true);
  assert.equal(l.label, 'Q1');
  assert.equal(l.clock, '9:10');
});

test('breaks: halftime, and final once the last period ends with a winner', () => {
  const half = liveScoreData(bundle([P('shot', { player: 'x', pts: 2, made: true, period: 'Q2' }), P('period_end', { period: 'Q2' })]));
  assert.equal(half.label, 'Halftime');
  assert.equal(half.ended, false);
  const fin = liveScoreData(bundle([P('shot', { player: 'x', pts: 2, made: true, period: 'Q4' }), P('period_end', { period: 'Q4' })]));
  assert.equal(fin.label, 'Final');
  assert.equal(fin.ended, true);
  const tied = liveScoreData(bundle([P('period_end', { period: 'Q4' })]));
  assert.equal(tied.label, 'End of regulation');
});

test('undone plays never show', () => {
  const a = P('shot', { player: 'x', pts: 2, made: true });
  const l = liveScoreData(bundle([a, P('void', { target: a.id })]));
  assert.equal(l.score.a, 0);
  assert.equal(l.count, 0);
});
