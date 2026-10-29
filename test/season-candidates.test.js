// node --test test/season-candidates.test.js — payment grades and the candidate ranking.
// Only the pure helpers are tested; the module opens the DB on import (portal-db.js) but
// nothing here reads or writes it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeSeason, rankCandidates, isSeasonFee } from '../lib/season-candidates.js';

const season = { firstGame: '2026-09-13', lastRegular: '2026-10-18', lastGame: '2026-11-08', over: true };
const charge = (date, amount = 3750) => ({ type: 'charge', amount, date });
const pay = (date, amount) => ({ type: 'payment', amount, date });
const now = Date.parse('2026-11-20T12:00:00+08:00');

test('installments settled by the last regular game with short gaps are on time', () => {
  const g = gradeSeason([charge('2026-09-01'), pay('2026-09-10', 1250), pay('2026-09-30', 1250), pay('2026-10-15', 1250)], season, { now });
  assert.equal(g.grade, 'ontime');
  assert.equal(g.settled, '2026-10-15');
  assert.equal(g.longestGap, 20);
});

test('a full-plan payer is due by the first game', () => {
  const g = gradeSeason([charge('2026-08-20'), pay('2026-09-20', 3750)], season, { plan: 'full', now });
  assert.equal(g.grade, 'chased');
});

test('a gap over 30 days counts as chased even when settled before the deadline', () => {
  const g = gradeSeason([charge('2026-09-01'), pay('2026-09-02', 1000), pay('2026-10-10', 2750)], season, { now });
  assert.equal(g.longestGap, 38);
  assert.equal(g.grade, 'chased');
});

test('never due sooner than 14 days after the bill', () => {
  const g = gradeSeason([charge('2026-10-15'), pay('2026-10-25', 3750)], season, { now });
  assert.equal(g.due, '2026-10-29');
  assert.equal(g.grade, 'ontime');
});

test('settled after the last game, or never, is after season once the season is over', () => {
  assert.equal(gradeSeason([charge('2026-09-01'), pay('2026-09-05', 1000), pay('2026-09-30', 1000), pay('2026-10-25', 1000), pay('2026-11-10', 750)], season, { now }).grade, 'after');
  assert.equal(gradeSeason([charge('2026-09-01'), pay('2026-09-05', 1000)], season, { now }).grade, 'after');
  assert.equal(gradeSeason([charge('2026-09-01'), pay('2026-09-05', 1000)], { ...season, over: false }, { now }).grade, 'owing');
});

test('a balance under ₱100 counts as settled', () => {
  assert.equal(gradeSeason([charge('2026-09-01'), pay('2026-09-10', 3730)], season, { now }).grade, 'ontime');
});

test('only season-fee rows count, not Papawis or other charges tagged with the season', () => {
  assert.equal(isSeasonFee({ category: 'Season Fee' }), true);
  assert.equal(isSeasonFee({ category: 'season_fee' }), true);
  assert.equal(isSeasonFee({ category: 'Game Fee' }), true);
  assert.equal(isSeasonFee({ category: 'Papawis' }), false);
  assert.equal(isSeasonFee({ category: 'Other' }), false);
  assert.equal(isSeasonFee({ category: '' }), false);
});

test('no season fee means no grade', () => {
  assert.equal(gradeSeason([], season, { now }), null);
});

const person = (id, f = {}) => ({ id, name: id, hasAccount: true, banned: false, balance: 0, playedLast: false, games: {}, papawisRuns: 0, activeWeeks: 0, isNew: false, pay: [], ...f });
const G = grade => ({ grade });

test('ranking: eligible first, then group, then active online, then clean payers', () => {
  const ranked = rankCandidates([
    person('owes', { playedLast: true, balance: 500, activeWeeks: 12 }),
    person('regular', { papawisRuns: 6, activeWeeks: 12 }),
    person('quiet', { playedLast: true, activeWeeks: 2 }),
    person('late', { playedLast: true, activeWeeks: 10, pay: [G('chased'), G('chased')] }),
    person('star', { playedLast: true, activeWeeks: 8, pay: [G('ontime'), G('ontime')] }),
    person('newbie', { isNew: true, activeWeeks: 1 }),
    person('gone', { activeWeeks: 0 }),
  ]);
  assert.deepEqual(ranked.map(r => r.id), ['star', 'late', 'quiet', 'regular', 'newbie', 'gone', 'owes']);
  const by = Object.fromEntries(ranked.map(r => [r.id, r]));
  assert.equal(by.late.payFirst, true);
  assert.equal(by.owes.eligible, false);
  assert.deepEqual(by.owes.blockers, ['Owes']);
  assert.equal(by.owes.group, 3); // owing drops out of group 1
  assert.equal(by.regular.group, 2);
});

test('one after-season grade is enough for pay first', () => {
  assert.equal(rankCandidates([person('a', { pay: [G('after'), G('ontime')] })])[0].payFirst, true);
  assert.equal(rankCandidates([person('b', { pay: [G('chased'), G('ontime')] })])[0].payFirst, false);
});
