// lib/key-plays.js: the numbered plays, the counted patterns and the format checks behind the
// AI key plays.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyPlayRows, keyPlayFacts, keyPlayProblems, keyPlayCards } from '../lib/key-plays.js';

// A log as the scorer stores it: newest first. ev(q, clock, teamA, text, pts) builds one entry.
let seq = 0;
const ev = (q, clock, isTeamA, who, what, pts = 0, pid = who) => ({ id: `e${++seq}`, kind: 'stat', quarter: q, clockRemaining: clock, isTeamA, playerId: pid, text: `${who}: ${what}`, ...(pts ? { statField: 'pts', changeAmount: pts } : { statField: 'x' }) });
function game(entries, a, b) {
  return { team_a_name: 'BLACK', team_b_name: 'BLUE', team_a_score: a, team_b_score: b, game_log_json: JSON.stringify(entries.slice().reverse()) };
}
const names = { s: 'Resty SANTOS', d: 'Moe DEL ROSARIO', e: 'Wico EDWARD', u: 'Richard UMALI' };
const nameOf = id => names[id] || '';

test('rows: oldest first, numbered, running score from the points', () => {
  seq = 0;
  const g = game([ev(1, '11:50', true, 'e', '2pt Made', 2), ev(1, '11:30', false, 'd', '3pt Made', 3), ev(1, '11:10', false, 'd', '2pt Miss')], 2, 3);
  const rows = keyPlayRows(g, nameOf);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(r => [r.n, r.who, r.what, r.a, r.b]), [[1, 'Wico EDWARD', '2pt made', 2, 0], [2, 'Moe DEL ROSARIO', '3pt made', 2, 3], [3, 'Moe DEL ROSARIO', '2pt miss', 2, 3]]);
  assert.equal(rows[2].miss, true);
});

test('facts: a drought with its misses and blocks, the deciding stretch, straight points, ahead for good', () => {
  seq = 0;
  const log = [
    ev(1, '10:00', false, 'u', '2pt Made', 2), ev(1, '9:40', false, 'u', '2pt Made', 2), ev(1, '9:20', false, 'u', '3pt Made', 3),
    ev(1, '9:00', true, 'e', '2pt Made', 2),
    // BLUE go cold: misses, two blocked by SANTOS, while BLACK score 12.
    ev(1, '8:30', false, 'd', '3pt Miss'), ev(1, '8:30', true, 's', 'BLK'),
    ev(1, '8:00', true, 'e', '2pt Made', 2), ev(1, '7:30', false, 'u', '2pt Miss'), ev(1, '7:30', true, 's', 'BLK'),
    ev(1, '7:00', true, 's', '2pt Made', 2), ev(1, '6:00', false, 'd', '3pt Miss'), ev(1, '5:00', true, 'e', '3pt Made', 3),
    ev(1, '4:30', false, 'u', 'TO'), ev(1, '4:00', true, 's', '3pt Made', 3),
    ev(1, '3:00', false, 'd', '3pt Made', 3),
  ];
  const g = game(log, 12, 10);
  const rows = keyPlayRows(g, nameOf);
  const { facts, numbersFacts, patterns } = keyPlayFacts(g, rows, []);
  assert.match(patterns, /STRAIGHT POINTS: Richard UMALI scored 7 straight BLUE points/);
  assert.match(patterns, /DECIDING STRETCH[^\n]*DROUGHT: BLUE went 6:20 of game time without scoring/);
  assert.match(patterns, /BLUE missed 3 shots and had 1 turnover; BLACK scored 12 points; blocks on BLUE: Resty SANTOS 2 blocks/);
  assert.match(patterns, /AHEAD FOR GOOD: play #12 /);
  assert.match(facts, /EVERY PLAY/);
  assert.doesNotMatch(numbersFacts, /#\d/);
});

test('format checks: real plays, oldest first, 4 to 7, at most 3 big', () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ n: i + 1, id: `e${i + 1}` }));
  const ok = { story: 'BLACK won it on defense.', plays: [1, 4, 8, 12, 19].map(n => ({ play: n, title: 'A title', why: 'A line.', big: n > 12 })) };
  assert.deepEqual(keyPlayProblems(ok, rows), []);
  assert.match(keyPlayProblems({ ...ok, plays: [...ok.plays, { play: 99, title: 't', why: 'w', big: false }] }, rows).join(' '), /not in the list \(99\)/);
  assert.match(keyPlayProblems({ ...ok, plays: ok.plays.slice().reverse() }, rows).join(' '), /oldest first/);
  assert.match(keyPlayProblems({ ...ok, plays: ok.plays.slice(0, 3) }, rows).join(' '), /picks 3 plays/);
  assert.match(keyPlayProblems({ ...ok, plays: ok.plays.map(p => ({ ...p, big: true })) }, rows).join(' '), /more than 3/);
});

test('cards: stored picks map to the log; a play gone from the log means rewrite', () => {
  seq = 0;
  const g = game([ev(1, '11:50', true, 'e', '2pt Made', 2), ev(2, '5:05', false, 'd', '3pt Made', 3)], 2, 3);
  const rows = keyPlayRows(g, nameOf);
  const cards = keyPlayCards({ plays: [{ n: 2, id: rows[1].id, title: 'Moe DEL ROSARIO’s three', why: 'Puts BLUE ahead.', big: true }] }, rows);
  assert.deepEqual(cards[0], { q: 2, qLabel: 'Q2', clock: '5:05', score: { a: 2, b: 3 }, side: 'b', strong: 'Moe DEL ROSARIO’s three', rest: '', why: 'Puts BLUE ahead.', big: true });
  assert.equal(keyPlayCards({ plays: [{ n: 2, id: 'gone', title: 't', why: 'w' }] }, rows), null);
});
