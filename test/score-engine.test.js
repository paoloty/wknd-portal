// node --test test/  — the scorer engine against WKND's rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldGame, defaultFreeThrows, nextPos, livePlays } from '../public/score-engine.js';

let n = 0;
const P = (type, f = {}) => ({ id: `e${++n}`, pos: n, period: 'Q1', team: 'a', ...f, type });

test('made and missed shots and free throws score and fill the line', () => {
  const g = foldGame([
    P('shot', { player: 'x', pts: 3, made: true }), P('shot', { player: 'x', pts: 2, made: false }),
    P('ft', { player: 'x', made: true }), P('shot', { team: 'b', player: 'y', pts: 4, made: true }),
  ]);
  assert.deepEqual(g.score, { a: 4, b: 4 });
  assert.equal(g.players.x.pts, 4);
  assert.equal(g.players.x.fg3m, 1);
  assert.equal(g.players.x.fg2m_miss, 1);
  assert.equal(g.players.x.ftm, 1);
  assert.equal(g.players.y.fg4m, 1);
});

test('undo (void) takes a play out and later plays re-score', () => {
  const a = P('shot', { player: 'x', pts: 2, made: true });
  const g = foldGame([a, P('shot', { player: 'x', pts: 3, made: true }), P('void', { target: a.id })]);
  assert.equal(g.score.a, 3);
  assert.equal(g.players.x.fg2m, 0);
});

test('offensive rebound only when the play right before was the same team missing', () => {
  const g = foldGame([
    P('shot', { player: 'x', pts: 2, made: false }), P('blk', { team: 'b', player: 'y' }), P('reb', { player: 'x' }),
    P('shot', { player: 'x', pts: 3, made: false }), P('reb', { team: 'b', player: 'y' }),
    P('shot', { team: 'b', player: 'y', pts: 2, made: true }), P('reb', { player: 'z' }), // no miss before: defensive
  ]);
  assert.equal(g.players.x.oreb, 1);
  assert.equal(g.players.y.oreb, 0);
  assert.equal(g.players.z.oreb, 0);
  assert.equal(g.players.z.reb, 1);
});

test('coach and bench technicals are not team fouls; a player technical is', () => {
  const g = foldGame([P('team_tech', { kind: 'coach' }), P('team_tech', { kind: 'bench' }), P('foul', { player: 'x', kind: 'technical' })]);
  assert.equal(g.teamFouls.a, 1);
});

test('a technical from the bench does not put the player on court', () => {
  const g = foldGame([P('foul', { player: 'x', kind: 'technical' })], undefined, { a: ['p1', 'p2', 'p3', 'p4', 'p5', 'x'], b: [] });
  assert.ok(!g.lastActive.a.includes('x'));
});

test('the final end of period ends the game without a next period', () => {
  const g = foldGame([P('period_end', { period: 'Q1' }), P('period_end', { period: 'Q2' }), P('period_end', { period: 'Q3' }), P('period_end', { period: 'Q4', final: true })]);
  assert.equal(g.period, 'Q4');
  assert.equal(g.final, true);
});

test('team fouls: every player foul counts (technical, offensive), reset each quarter, OT carries Q4', () => {
  const ev = [
    P('foul', { player: 'x', kind: 'technical' }), P('foul', { player: 'x', kind: 'offensive' }), P('team_tech', { kind: 'coach' }),
    P('period_end', { period: 'Q1' }),
    P('foul', { period: 'Q2', player: 'x' }),
  ];
  let g = foldGame(ev);
  assert.equal(g.period, 'Q2');
  assert.equal(g.teamFouls.a, 1);
  assert.equal(g.players.x.turnover, 1, 'offensive foul is also a turnover');
  const toQ4 = [P('period_end', { period: 'Q2' }), P('period_end', { period: 'Q3' }),
    P('foul', { period: 'Q4', player: 'x' }), P('foul', { period: 'Q4', player: 'w' }), P('period_end', { period: 'Q4' }),
    P('foul', { period: 'OT1', player: 'w' })];
  g = foldGame([...ev, ...toQ4]);
  assert.equal(g.period, 'OT1');
  assert.equal(g.teamFouls.a, 3, 'OT carries Q4 fouls');
});

test('penalty from the 5th team foul; next-foul warning at 4', () => {
  const ev = [1, 2, 3, 4].map(i => P('foul', { player: `p${i}` }));
  let g = foldGame(ev);
  assert.equal(g.penaltyNext.a, true);
  assert.equal(g.penalty.a, false);
  g = foldGame([...ev, P('foul', { player: 'p5' })]);
  assert.equal(g.penalty.a, true);
});

test('timeouts: 2 first half, 3 second half, 1 per overtime, no carry-over', () => {
  let g = foldGame([P('timeout')]);
  assert.deepEqual(g.timeouts, { allowance: 2, left: { a: 1, b: 2 } });
  g = foldGame([P('timeout'), P('period_end', { period: 'Q1' }), P('period_end', { period: 'Q2' })]);
  assert.deepEqual(g.timeouts, { allowance: 3, left: { a: 3, b: 3 } });
  g = foldGame(['Q1', 'Q2', 'Q3', 'Q4'].map(p => P('period_end', { period: p })).concat([P('timeout', { period: 'OT1', team: 'b' })]));
  assert.deepEqual(g.timeouts, { allowance: 1, left: { a: 1, b: 0 } });
});

test('foul out at 5; ejection at 2 technicals + unsportsmanlike together', () => {
  const g = foldGame([
    ...[1, 2, 3, 4, 5].map(() => P('foul', { player: 'x' })),
    P('foul', { player: 'y', kind: 'technical' }), P('foul', { player: 'y', kind: 'unsportsmanlike' }),
  ]);
  assert.equal(g.flags.x, 'fouled out');
  assert.equal(g.flags.y, 'ejected');
});

test('a steal always pairs with a turnover (a player, or the other team)', () => {
  const g = foldGame([P('stl', { player: 'x', from: 'y' }), P('stl', { player: 'x' })]);
  assert.equal(g.players.x.stl, 2);
  assert.equal(g.players.y.turnover, 1);
  assert.equal(g.teamTO.b, 1);
});

test('waves: on in the first half only by default, off when set off', () => {
  assert.equal(foldGame([]).wavesOn, true);
  assert.equal(foldGame([P('period_end', { period: 'Q1' }), P('period_end', { period: 'Q2' })]).wavesOn, false);
  assert.equal(foldGame([], { waves: 'off' }).wavesOn, false);
});

test('default free throws', () => {
  assert.equal(defaultFreeThrows('offensive', { inPenalty: true }), 0);
  assert.equal(defaultFreeThrows('personal', { inPenalty: true }), 2);
  assert.equal(defaultFreeThrows('personal'), 0);
  assert.equal(defaultFreeThrows('shooting', { shotPts: 3 }), 3);
  assert.equal(defaultFreeThrows('shooting', { andOne: true }), 1);
  assert.equal(defaultFreeThrows('technical'), 1);
  assert.equal(defaultFreeThrows('unsportsmanlike'), 2);
});

test('"Go back here": a play slotted in earlier re-scores the plays after it', () => {
  const a = P('shot', { player: 'x', pts: 2, made: true });
  const b = P('shot', { player: 'x', pts: 2, made: true });
  const ins = { id: 'ins', type: 'shot', team: 'b', player: 'y', pts: 3, made: true, period: 'Q1', pos: nextPos([a, b], a.id) };
  const g = foldGame([a, b, ins]);
  assert.deepEqual(livePlays([a, b, ins]).map(e => e.id), [a.id, 'ins', b.id]);
  assert.deepEqual(g.rows[2].score, { a: 4, b: 3 });
});

test('DNP: marked players are listed until their first stat clears it', () => {
  const g = foldGame([P('dnp', { player: 'late' }), P('dnp', { player: 'gone' }), P('shot', { player: 'late', pts: 2, made: true })]);
  assert.deepEqual(g.dnp, ['gone']);
  const back = foldGame([P('dnp', { player: 'x' }), P('dnp', { player: 'x', on: false })]);
  assert.deepEqual(back.dnp, []);
});

test('correction: the fixed play takes the old one\'s place and later scores follow', async () => {
  const { correction } = await import('../public/score-engine.js');
  const a = P('shot', { player: 'x', pts: 2, made: true });
  const b = P('shot', { team: 'b', player: 'y', pts: 3, made: true });
  const evs = [a, b];
  const fixed = correction(evs, a, { player: 'z', pts: 3 }, ['v1', 'n1']);
  const g = foldGame([...evs, ...fixed]);
  assert.equal(g.players.x, undefined); // the old play is gone, so x has no line at all
  assert.equal(g.players.z.pts, 3);
  assert.deepEqual(g.rows.map(r => r.id), ['n1', b.id]);
  assert.deepEqual(g.rows[0].score, { a: 3, b: 0 });
  // A stat change drops the old type's fields.
  const toReb = correction(evs, a, { type: 'reb', pts: undefined, made: undefined }, ['v2', 'n2']);
  assert.equal(toReb[1].pts, undefined);
  assert.equal(foldGame([...evs, ...toReb]).players.x.reb, 1);
});

test('sub: who comes on is active, who goes off sits until they play again', () => {
  const g = foldGame([P('reb', { player: 'x' }), P('reb', { player: 'y' }), P('sub', { in: 'z', out: 'x' })]);
  assert.deepEqual(g.lastActive.a, ['z', 'y', 'x']);
  assert.deepEqual(g.benched, ['x']);
  const back = foldGame([P('sub', { in: 'z', out: 'x' }), P('ast', { player: 'x' })]);
  assert.deepEqual(back.benched, []);
});

test('Papawis move: points stay with the old side, later ones count for the new side', () => {
  const g = foldGame([
    P('shot', { team: 'b', player: 'r', pts: 2, made: true }),
    P('move', { team: 'a', player: 'r', to: 'a' }),
    P('shot', { team: 'a', player: 'r', pts: 3, made: true }),
  ]);
  assert.deepEqual(g.score, { a: 3, b: 2 });
  assert.equal(g.players.r.pts, 5);
  assert.deepEqual(g.moved, { r: 'a' });
  assert.ok(!g.lastActive.b.includes('r'));
  assert.ok(g.lastActive.a.includes('r'));
});

test('penaltyAt 0 (Papawis): never in the penalty', () => {
  const fouls = Array.from({ length: 7 }, () => P('foul', { player: 'x' }));
  const g = foldGame(fouls, { penaltyAt: 0, timeouts: { firstHalf: 0, secondHalf: 0, overtime: 0 } });
  assert.equal(g.penalty.a, false);
  assert.equal(g.penaltyNext.a, false);
  assert.equal(g.timeouts.allowance, 0);
});

test('Papawis: foulOut 0 never fouls out; extra time can follow Q2', () => {
  const fouls = Array.from({ length: 6 }, () => P('foul', { player: 'x' }));
  assert.deepEqual(foldGame(fouls, { foulOut: 0 }).flags, {});
  const g = foldGame([P('period_end', { period: 'Q1' }), P('period_end', { period: 'Q2', next: 'OT1' })], { periods: 2 });
  assert.equal(g.period, 'OT1');
});
