// node --test test/papawis-season.test.js — which season Papawis money belongs to.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonOnDate, isPapawisCategory } from '../lib/papawis-season.js';

const starts = [{ season: 3, start: '2026-06-08' }, { season: 4, start: '2026-09-13' }];

test('during a season, it is that season', () => {
  assert.equal(seasonOnDate('2026-07-01', starts), '3');
  assert.equal(seasonOnDate('2026-10-01', starts), '4');
});

test('a season starts on its first game day', () => {
  assert.equal(seasonOnDate('2026-09-13', starts), '4');
  assert.equal(seasonOnDate('2026-09-12', starts), '3');
});

test('between seasons, it stays with the season that last started', () => {
  assert.equal(seasonOnDate('2026-08-30', starts), '3');
  assert.equal(seasonOnDate('2027-01-15', starts), '4');
});

test('a next season scheduled for later does not take today\'s runs', () => {
  assert.equal(seasonOnDate('2026-12-01', [...starts, { season: 5, start: '2027-03-01' }]), '4');
  assert.equal(seasonOnDate('2027-03-01', [...starts, { season: 5, start: '2027-03-01' }]), '5');
});

test('before the first season there is none, and order does not matter', () => {
  assert.equal(seasonOnDate('2026-01-01', starts), '');
  assert.equal(seasonOnDate('2026-10-01', [...starts].reverse()), '4');
  assert.equal(seasonOnDate('2026-10-01', []), '');
});

test('only Papawis categories count, however they are spelled', () => {
  for (const c of ['Papawis', 'papawis', ' PAPAWIS ', 'Papawis Deposit']) assert.equal(isPapawisCategory(c), true, c);
  for (const c of ['Season Fee', 'Penalty', 'Other', '', null]) assert.equal(isPapawisCategory(c), false, String(c));
});
