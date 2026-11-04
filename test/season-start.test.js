// node --test test/season-start.test.js — what Start season charges, and when it refuses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { billedAmount, billedTotal, startRefusal, startChecks, startEmailState } from '../lib/season-start.js';

test('the total only counts what the ledger will actually get', () => {
  const rows = [
    { playerId: 'a', total: 3750 },
    { playerId: '', total: 3750 },
    { playerId: 'b', total: -200 },
    { playerId: 'c', total: 0 },
  ];
  assert.equal(billedAmount(rows[0]), 3750);
  assert.equal(billedAmount(rows[1]), 0);
  assert.equal(billedAmount(rows[2]), 0);
  assert.equal(billedTotal(rows), 3750);
});

test('a season can only start once, for the season being set up, with someone confirmed', () => {
  const ok = { season: '5', target: '5', draft: 'draft', confirmed: 48 };
  assert.equal(startRefusal(ok), '');
  assert.match(startRefusal({ ...ok, draft: 'started' }), /already been started/);
  assert.match(startRefusal({ ...ok, season: '4' }), /isn't the one/);
  assert.match(startRefusal({ ...ok, confirmed: 0 }), /No confirmed/);
  assert.match(startRefusal({ ...ok, season: '' }), /No season/);
  assert.equal(startRefusal({ ...ok, season: 5 }), '');
});

test('the checks name who would be skipped or left on their old team', () => {
  const rows = [
    { name: 'Ok', playerId: 'a', teamName: 'Blue', teamIsLive: true },
    { name: 'No account', playerId: '', teamName: 'Blue', teamIsLive: true },
    { name: 'No team', playerId: 'b', teamName: '', teamIsLive: false },
    { name: 'New team', playerId: 'c', teamName: 'Green', teamIsLive: false },
  ];
  const c = startChecks({ rows, fee: 3750 });
  assert.equal(c.noFee, false);
  assert.deepEqual(c.noAccount.map(r => r.name), ['No account']);
  assert.deepEqual(c.noTeam.map(r => r.name), ['No team']);
  assert.deepEqual(c.teamNotLive.map(r => r.name), ['New team']);
  assert.equal(startChecks({ rows: [], fee: 0 }).noFee, true);
});

test('a resend is only offered when something went wrong', () => {
  assert.equal(startEmailState({ status: 'sent' }).label, 'Sent');
  assert.equal(startEmailState({ status: 'sent' }).canResend, false);
  assert.equal(startEmailState({ status: 'sent', opened_at: 1 }).label, 'Opened');
  assert.equal(startEmailState({ status: 'failed' }).canResend, true);
  assert.equal(startEmailState({ status: 'sent', bounced_at: 1 }).canResend, true);
  assert.equal(startEmailState(null, { hasEmail: false }).canResend, false);
  // An interrupted run leaves some with no record: offer those. An old season with none logged: don't.
  assert.equal(startEmailState(null, { anyLogged: true }).canResend, true);
  assert.equal(startEmailState(null, { anyLogged: false }).canResend, false);
});
