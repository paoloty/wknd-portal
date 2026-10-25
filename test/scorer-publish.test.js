// node --test test/scorer-publish.test.js — the publish payload is read correctly by the same
// code that reads wknd-stats imports (lib/game-detail.js). Uses the worktree's copy of the DB
// only because game-detail.js imports portal-db.js; nothing is written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublishPayload } from '../lib/scorer-publish.js';
import { gameFlow, quarterMarkers } from '../lib/game-detail.js';

const game = { id: 'g1', season: 4, team_a_name: 'WHITE', team_b_name: 'BLACK' };
const players = { w1: { name: 'ANGELES, JM' }, w2: { name: 'SAUZ, Aaron' }, b1: { name: 'SANTOS, Resty' }, b2: { name: 'DOCTOR, Wel' } };
let n = 0;
const P = (type, f) => ({ id: `e${++n}`, pos: n, period: 'Q1', clock: '11:00', ...f, type });
const events = [
  P('shot', { team: 'a', player: 'w1', pts: 3, made: true, clock: '11:40' }),
  P('shot', { team: 'b', player: 'b1', pts: 2, made: true, clock: '11:10' }),
  P('shot', { team: 'b', player: 'b1', pts: 2, made: false, clock: '10:50' }),
  P('reb', { team: 'b', player: 'b2', clock: '10:48' }),
  P('shot', { team: 'b', player: 'b2', pts: 2, made: true, clock: '10:40' }),
  P('foul', { team: 'a', player: 'w2', kind: 'shooting', fts: 2, clock: '10:20' }),
  P('ft', { team: 'b', player: 'b1', made: true, clock: '10:20' }),
  P('ft', { team: 'b', player: 'b1', made: false, clock: '10:20' }),
  P('stl', { team: 'a', player: 'w2', from: 'b2', clock: '9:30' }),
  P('shot', { team: 'a', player: 'w2', pts: 2, made: true, clock: '9:20' }),
  P('period_end', { period: 'Q1', clock: '0:00' }),
  P('shot', { period: 'Q2', team: 'a', player: 'w1', pts: 3, made: true, clock: '11:30' }),
  P('team_to', { period: 'Q2', team: 'b', kind: '3 seconds', clock: '11:00' }),
];

test('publish payload matches the engine and the import shape', () => {
  const { payload, orebs } = buildPublishPayload(game, events, players, { dnp: [] });
  assert.equal(payload.teamAScore, 8);
  assert.equal(payload.teamBScore, 5);
  assert.equal(payload.playerStats.b2.to, 1, 'the steal gave b2 a turnover');
  assert.equal(payload.playerStats.b1.ftm, 1);
  assert.equal(payload.playerStats.b1.ft_miss, 1);
  assert.equal(orebs.b2, 1, 'b2 rebounded b1’s miss: offensive');
  assert.equal(payload.teamBTeamTurnovers, 1);
  assert.deepEqual(payload.periodSnapshots.map(p => [p.quarter, p.quarterStats.teamA.pts, p.quarterStats.teamB.pts]), [[1, 5, 5], [2, 3, 0]]);
  assert.match(payload.gameLog[payload.gameLog.length - 1].text, /^ANGELES, JM: 3pt Made \[WHI 3 - BLA 0\]$/);
  assert.equal(payload.gameLog[0].metaType, 'quarterEnd', 'newest first, ends with a quarter-end marker');
});

test('lib/game-detail.js reads it: quarter markers and game flow', () => {
  const { payload } = buildPublishPayload(game, events, players);
  const g = { ...game, game_log_json: JSON.stringify(payload.gameLog), team_a_score: 8, team_b_score: 5 };
  const ends = quarterMarkers(payload.gameLog, g);
  assert.deepEqual(ends[1], { a: 5, b: 5 });
  assert.deepEqual(ends[2], { a: 8, b: 5 });
  const flow = gameFlow(g);
  assert.ok(flow, 'game flow builds');
  const last = flow.points[flow.points.length - 1];
  assert.deepEqual([last.a, last.b], [8, 5]);
});
