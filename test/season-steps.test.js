// node --test test/season-steps.test.js — what the Season step bar says at each stage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonStepState } from '../lib/season-steps.js';

const next = st => Object.keys(st).find(k => st[k].next) || '';

test('nothing set up: Set up is next', () => {
  const st = seasonStepState({});
  assert.equal(next(st), 'setup');
  assert.equal(st.setup.text, 'Not started');
  assert.equal(st.start.done, false);
});

test('a season with no fee is not set up yet', () => {
  const st = seasonStepState({ target: '5' });
  assert.equal(next(st), 'setup');
  assert.equal(st.setup.text, 'Season fee not set');
});

test('set up, sign-ups not open: Sign-ups is next', () => {
  const st = seasonStepState({ target: '5', fee: 3750 });
  assert.equal(next(st), 'signups');
  assert.equal(st.signups.text, 'Not open');
});

test('sign-ups open stays the next step, with the count', () => {
  const st = seasonStepState({ target: '5', fee: 3750, open: true, entered: 12 });
  assert.equal(next(st), 'signups');
  assert.equal(st.signups.text, 'Open · 12 in');
});

test('sign-ups closed with people in: Teams is next', () => {
  const st = seasonStepState({ target: '5', fee: 3750, entered: 55, confirmed: 48 });
  assert.equal(next(st), 'teams');
  assert.equal(st.signups.text, 'Closed · 55 in');
  assert.equal(st.teams.text, '48 confirmed');
});

test('a started season: every step done, nothing next', () => {
  const st = seasonStepState({ target: '4', fee: 3750, entered: 55, confirmed: 48, draft: 'started' });
  assert.equal(next(st), '');
  assert.ok(Object.values(st).every(s => s.done));
  assert.equal(st.start.text, 'Started');
  assert.equal(st.teams.text, 'Locked');
});

test('a started season whose fee setting was cleared is still done', () => {
  assert.equal(seasonStepState({ target: '4', draft: 'started' }).setup.done, true);
});
