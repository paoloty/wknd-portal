// node --test test/papawis-teams-final.test.js — teams going final (lib/papawis-notify.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeUnsided } from '../lib/papawis-teams.js';
import { papawisTeamsToNotify, papawisTeamsSent } from '../views/utils.js';

test('new players go on the smaller side and nobody already placed moves', () => {
  const roster = [{ id: 'a', team: 'light' }, { id: 'b', team: 'light' }, { id: 'c', team: 'dark' }, { id: 'd', team: '' }, { id: 'e', team: '' }, { id: 'f', team: null }];
  assert.deepEqual(placeUnsided(roster), [{ id: 'd', team: 'dark' }, { id: 'e', team: 'light' }, { id: 'f', team: 'dark' }]);
  assert.deepEqual(placeUnsided([{ id: 'a', team: 'dark' }]), []);
});

test('nothing to do until teams are final', () => {
  assert.equal(papawisTeamsToNotify({}, [{ team: 'light', guest_name: '', team_notified_at: null }]), 0);
});

test('after final: anyone with no side, and anyone on a side not told; guests need no telling', () => {
  const people = [
    { team: 'light', guest_name: '', team_notified_at: 5 },
    { team: 'dark', guest_name: '', team_notified_at: null },
    { team: 'dark', guest_name: 'Guest', team_notified_at: null },
    { team: '', guest_name: '', team_notified_at: null },
    { team: '', guest_name: 'Guest', team_notified_at: null },
  ];
  assert.equal(papawisTeamsToNotify({ teams_final_at: 1 }, people), 3);
  // On a locked roster nobody can be placed, so only the telling counts.
  assert.equal(papawisTeamsToNotify({ teams_final_at: 1, signups_locked_at: 1 }, people), 1);
});

test('teams only show once someone confirmed on a side has been told', () => {
  assert.equal(papawisTeamsSent([{ status: 'confirmed', team: 'light', team_notified_at: null }]), false);
  assert.equal(papawisTeamsSent([{ status: 'confirmed', team: 'light', team_notified_at: 9 }]), true);
  assert.equal(papawisTeamsSent([{ status: 'waitlist', team: 'light', team_notified_at: 9 }]), false);
});
