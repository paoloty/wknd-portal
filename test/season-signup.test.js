// node --test test/season-signup.test.js — the Season 5 sign-up rules (lib/season-signup.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paydaysFrom, firstPayday, planSchedule, playingTimeRisk, checkStep, checkAll, readStep, resumeStep, pickPose, reviewLines, CONTEST_POSES } from '../lib/season-signup.js';

test('paydays are the 15th and the 30th, or the last day of a shorter month', () => {
  assert.deepEqual(paydaysFrom('2027-01-20', 4), ['2027-01-30', '2027-02-15', '2027-02-28', '2027-03-15']);
  assert.deepEqual(paydaysFrom('2028-02-16', 2), ['2028-02-29', '2028-03-15']);
  assert.deepEqual(paydaysFrom('2027-01-15', 1), ['2027-01-15']);
  // the 31st is past the 30th: the next payday is the 15th
  assert.deepEqual(paydaysFrom('2027-01-31', 1), ['2027-02-15']);
});

test('the first payday is at least 5 days after confirmation', () => {
  assert.equal(firstPayday('2027-01-10'), '2027-01-15');
  assert.equal(firstPayday('2027-01-11'), '2027-01-30');
  assert.equal(firstPayday('2027-01-25'), '2027-01-30');
  assert.equal(firstPayday('2027-01-26'), '2027-02-15');
});

test('plans: same fee, jersey in the first payment, fixed paydays after', () => {
  assert.deepEqual(planSchedule('full', { confirmDay: '2027-01-08', jersey: 1200 }), [{ due: '2027-01-15', amount: 4950, what: 'Jersey + season fee' }]);
  const dp1 = planSchedule('dp1', { confirmDay: '2027-01-08', jersey: 1200 });
  assert.deepEqual(dp1.map(p => [p.due, p.amount]), [['2027-01-15', 2200], ['2027-02-15', 2750]]);
  const dp2 = planSchedule('dp2', { confirmDay: '2027-01-08', jersey: 550 });
  assert.deepEqual(dp2.map(p => [p.due, p.amount]), [['2027-01-15', 1550], ['2027-02-15', 1375], ['2027-03-15', 1375]]);
  assert.equal(dp2.reduce((s, p) => s + p.amount, 0), 550 + 3750);
});

test('playing-time risk: two triggers amber, the red bench answer or three red', () => {
  assert.equal(playingTimeRisk({ role_bench: 'stay_ready', role_chat: 'stay_out', role_coach: 'work_on' }).level, '');
  assert.equal(playingTimeRisk({ role_bench: 'ask_bench' }).level, '');
  assert.equal(playingTimeRisk({ role_bench: 'ask_bench', role_chat: 'agree_chat' }).level, 'amber');
  assert.equal(playingTimeRisk({ role_bench: 'post_chat' }).level, 'red');
  assert.equal(playingTimeRisk({ role_chat: 'agree_chat', role_coach: 'ignore' }, { selfGap: true }).level, 'red');
  assert.equal(playingTimeRisk({ role_coach: 'push_back' }, { selfGap: true }).triggers.length, 2);
});

const ctx = { sizes: ['S', 'M', 'L'], returning: true, avoidIds: new Set(['a', 'b']), selfId: 'me', hasWaiver: true, ownPhone: '09171234567', now: new Date('2026-11-09') };
const good = {
  agree: '1', games_miss: '1', payment_plan: 'dp1',
  role_playoffs: 'title', role_bench: 'stay_ready', role_chat: 'stay_out', role_coach: 'work_on',
  work_on: 'Talking on defense. I go quiet when I am tired, every game.', self_scoring: 'average', self_defense: 'average', self_overall: 'average',
  team_pref: 'stick', avoid: ['a'], jersey_top: 'L', jersey_shorts: '', emergency_name: 'Ana', emergency_phone: '0918 123 7730', birthday: '1990-03-14',
  waiver_agree: '1',
};

test('a whole good draft passes; the first problem names its step and field', () => {
  assert.equal(checkAll(good, ctx), null);
  assert.deepEqual(checkAll({ ...good, role_chat: '' }, ctx), { step: 3, field: 'role_chat', message: 'Answer this one.' });
  assert.equal(checkAll({ ...good, work_on: 'nothing' }, ctx).field, 'work_on');
  assert.equal(checkAll({ ...good, avoid: ['zz'] }, ctx).field, 'avoid');
  assert.equal(checkAll({ ...good, avoid: ['me'] }, { ...ctx, avoidIds: new Set(['me']) }).field, 'avoid');
  assert.equal(checkAll({ ...good, emergency_phone: '09171234567' }, ctx).field, 'emergency_phone');
  assert.equal(checkAll({ ...good, birthday: '2010-01-01' }, ctx).field, 'birthday');
  assert.equal(checkAll({ ...good, team_pref: '' }, { ...ctx, returning: false }), null);
  assert.equal(checkAll({ ...good, payment_plan: 'dp2' }, { ...ctx, plans: ['full'] }).field, 'payment_plan');
  assert.equal(checkAll({ ...good }, { ...ctx, hasWaiver: false }).field, 'waiver_signature');
  assert.equal(resumeStep({ agree: '1' }, ctx), 2);
  assert.equal(resumeStep(good, ctx), 6);
});

test('reading a step keeps only known choices', () => {
  const s2 = readStep(2, { games_miss: '2', away: ['abroad', 'moon'], away_when_abroad: ['2027-02', '2031-01'], payment_plan: 'full' }, { now: new Date('2026-11-09') });
  assert.deepEqual(s2.away, ['abroad']);
  assert.deepEqual(s2.away_when, { abroad: ['2027-02'] });
  assert.deepEqual(readStep(4, { avoid: ['a', 'a', 'b', 'c'], vol: ['stats', 'x'] }).avoid, ['a', 'b']);
  assert.deepEqual(readStep(4, { vol: ['stats', 'x'] }).vol, ['stats']);
  assert.equal(readStep(5, { jersey_cut: 'weird' }).jersey_cut, 'regular');
  const lines = reviewLines({ ...s2, games_miss: '1' });
  assert.match(lines[2], /Miss 1 game · trip abroad Feb · pay in full/);
});

test('poses are balanced: a new player gets one of the least used', () => {
  const counts = { and_one: 3, too_small: 1, clean: 1, finals_mvp: 2 };
  for (let i = 0; i < 20; i++) assert.ok(['too_small', 'clean'].includes(pickPose(counts)));
  assert.equal(pickPose({}, () => 0), CONTEST_POSES[0].key);
});
