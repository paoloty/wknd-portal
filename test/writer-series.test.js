// lib/writer.js series claims, the final-score check and running scores (Fable audit, 2026-11-11):
// a playoff recap said "forcing a deciding game" after Black had eliminated Maroon 2-0, talked
// standings and streaks, and another wrote "83-78 victory" for an 84-78 game.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claimProblems, finalScoreProblems, numberProblems, unpairRunningScores } from '../lib/writer.js';

const OVER = 'SITUATION: Season 4 playoffs, Semifinal 2, Game 2 (twice to beat). After this game: Black won the semifinal 2-0 and reach the Finals; Maroon are eliminated and their season is over. This is a playoff game: regular-season standings, records and win/loss streaks do not apply here; write about the series.';
const FORCED = 'SITUATION: Season 4 playoffs, Semifinal 2, Game 1. After this game: Black beat twice-to-beat Maroon to force a deciding Game 2. This is a playoff game: regular-season standings, records and win/loss streaks do not apply here; write about the series.';

test('a decided series can\'t be sent to a decider, and a playoff game has no standings or streaks', () => {
  const p = claimProblems('Black forced a deciding game. As for the standings, Black is on a 4-game winning streak.', OVER).join(' | ');
  assert.match(p, /deciding game/);
  assert.match(p, /regular-season standings or streaks/);
  assert.deepEqual(claimProblems('Black reach the Finals, and Maroon are eliminated.', OVER), []);
});

test('the decider is fine when the facts say so; Finals and champion claims need their facts', () => {
  assert.deepEqual(claimProblems('Black forced a deciding Game 2.', FORCED), []);
  assert.match(claimProblems('Black are the Season 4 champions.', FORCED).join(' '), /champion/);
  assert.match(claimProblems('Maroon are eliminated.', FORCED).join(' '), /eliminated/);
  assert.match(claimProblems('Black punch their ticket to the Finals.', 'Season 4 regular-season game.').join(' '), /Finals/);
});

test('a result given as a score must be the final score', () => {
  assert.match(finalScoreProblems('White Breaks Losing Streak with 83-78 Victory Over Blue', 84, 78).join(' '), /final score is 84-78/);
  assert.deepEqual(finalScoreProblems('White edge Blue 84-78 after trailing 39-23 in the second.', 84, 78), []);
  assert.equal(finalScoreProblems('White won 85-78 on Sunday.', 84, 78).length, 1);
});

test('running scores in the play-by-play are not a score pair for the number check', () => {
  const facts = 'GAME: WHITE 84 – 78 BLUE\nTORRES, Lance: +1 FT [WHI 83 - BLU 78]';
  assert.deepEqual(numberProblems('White won 84-78.', unpairRunningScores(facts)), []);
  assert.match(numberProblems('White won 83-78.', unpairRunningScores(facts)).join(' '), /83-78/);
});
