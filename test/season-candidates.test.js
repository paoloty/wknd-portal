// node --test test/season-candidates.test.js — payment grades and the candidate ranking.
// Only the pure helpers are tested; the module opens the DB on import (portal-db.js) but
// nothing here reads or writes it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeSeason, rankCandidates, isSeasonFee, RULES } from '../lib/season-candidates.js';

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

test('marks: low attendance, conduct, late cancels; under half of last season leaves Group 1', () => {
  const by = Object.fromEntries(rankCandidates([
    person('clean', { playedLast: true, activeWeeks: 8, attendance: { played: 6, teamGames: 7 } }),
    person('patchy', { playedLast: true, activeWeeks: 8, attendance: { played: 4, teamGames: 7 } }),
    person('absent', { playedLast: true, activeWeeks: 8, attendance: { played: 2, teamGames: 7 } }),
    person('fined', { playedLast: true, activeWeeks: 8, conduct: { fines: 1, maxTechs: 0, dq: 0 } }),
    person('hothead', { playedLast: true, activeWeeks: 8, conduct: { fines: 2, maxTechs: 0, dq: 0 } }),
    person('flaky', { playedLast: true, activeWeeks: 8, lateCancels: 2 }),
  ]).map(r => [r.id, r]));
  assert.deepEqual(by.clean.marks, []);
  assert.deepEqual(by.patchy.marks, ['attendance']);
  assert.equal(by.patchy.group, 1);
  assert.equal(by.absent.group, 3);
  assert.deepEqual(by.fined.marks, ['conduct']);
  assert.equal(by.fined.discuss, false);
  assert.equal(by.hothead.discuss, true);
  assert.deepEqual(by.flaky.marks, ['lateCancels']);
  assert.ok(by.clean.rank < by.patchy.rank);
});

test('pluses lift a player inside the group: league + Papawis, contributed', () => {
  const ranked = rankCandidates([
    person('plain', { playedLast: true, activeWeeks: 9 }),
    person('both', { playedLast: true, activeWeeks: 7, papawisRuns: 5 }),
    person('helper', { playedLast: true, activeWeeks: 7, contributions: 2 }),
  ]);
  // both and helper tie on one plus; both has more Papawis runs.
  assert.deepEqual(ranked.map(r => r.id), ['both', 'helper', 'plain']);
  assert.deepEqual(ranked.find(r => r.id === 'both').pluses, ['both']);
  assert.deepEqual(ranked.find(r => r.id === 'helper').pluses, ['contributed']);
});

test('approved admins get no marks but keep the must-haves', () => {
  const rules = { ...RULES, noMarksPlayerIds: ['adm'] };
  const [a] = rankCandidates([person('adm', { playedLast: true, activeWeeks: 0, pay: [G('after')], lateCancels: 5 })], { rules });
  assert.deepEqual(a.marks, []);
  assert.equal(a.payFirst, false);
  assert.equal(a.exempt, true);
  const [b] = rankCandidates([person('adm', { playedLast: true, balance: 900 })], { rules });
  assert.equal(b.eligible, false);
});

test('without payment: owing doesn’t block and nobody is pay first', () => {
  const p = person('debtor', { playedLast: true, activeWeeks: 8, balance: 2000, pay: [G('after'), G('owing')] });
  const [withPay] = rankCandidates([p]);
  assert.equal(withPay.eligible, false);
  const [noPay] = rankCandidates([p], { ignorePayment: true });
  assert.equal(noPay.eligible, true);
  assert.equal(noPay.group, 1);
  assert.equal(noPay.payFirst, false);
  assert.deepEqual(noPay.marks, []);
});

test('one after-season grade is enough for pay first', () => {
  assert.equal(rankCandidates([person('a', { pay: [G('after'), G('ontime')] })])[0].payFirst, true);
  assert.equal(rankCandidates([person('b', { pay: [G('chased'), G('ontime')] })])[0].payFirst, false);
});
