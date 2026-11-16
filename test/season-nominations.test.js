// node --test test/season-nominations.test.js — "wouldn't want to play with again" on the sign-up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanNominations, summarizeNominations, namedByText } from '../lib/season-nominations.js';
import { playerAuditRoute } from '../lib/activity-log.js';

const validIds = new Set(['a', 'b', 'c', 'me']);

test('only real players, never yourself, no repeats, at most two', () => {
  assert.deepEqual(cleanNominations(['a', 'b'], { selfId: 'me', validIds }), ['a', 'b']);
  assert.deepEqual(cleanNominations(['a', 'a'], { selfId: 'me', validIds }), ['a']);
  assert.deepEqual(cleanNominations(['me', 'a'], { selfId: 'me', validIds }), ['a']);
  assert.deepEqual(cleanNominations(['ghost', ''], { selfId: 'me', validIds }), []);
  assert.deepEqual(cleanNominations(['a', 'b', 'c'], { selfId: 'me', validIds }), ['a', 'b']);
  assert.deepEqual(cleanNominations(undefined, { selfId: 'me', validIds }), []);
  assert.deepEqual(cleanNominations('a', { selfId: 'me', validIds }), ['a']);
});

const rows = [
  { nominee_player_id: 'x', nominator_name: 'Ben' },
  { nominee_player_id: 'x', nominator_name: 'Ana' },
  { nominee_player_id: 'admin', nominator_name: 'Cy' },
];

test('admins see the count and who named each player', () => {
  const s = summarizeNominations(rows, { viewerPlayerId: 'admin' });
  assert.equal(s.x.count, 2);
  assert.deepEqual(s.x.names, ['Ana', 'Ben']);
  assert.equal(s.x.hidden, false);
});

test('an admin sees their own count, but not who named them', () => {
  const s = summarizeNominations(rows, { viewerPlayerId: 'admin' });
  assert.equal(s.admin.count, 1);
  assert.deepEqual(s.admin.names, []);
  assert.equal(s.admin.hidden, true);
});

test('the super admin login has no player, so it sees every name', () => {
  assert.deepEqual(summarizeNominations(rows, {}).admin.names, ['Cy']);
});

test('the sign-up log entry keeps no answers from the form', () => {
  const route = playerAuditRoute('POST', '/season-signup');
  assert.equal(route.event, 'season_signup');
  assert.equal(route.keep, undefined);
});

test('answers stay out of the sign-up row, and off the player-facing sign-up summary', () => {
  const root = new URL('../', import.meta.url);
  const db = readFileSync(new URL('lib/portal-db.js', root), 'utf8');
  const table = db.slice(db.indexOf('CREATE TABLE IF NOT EXISTS season_signups'));
  assert.ok(!table.slice(0, table.indexOf(');')).includes('nominee'));
  const form = readFileSync(new URL('views/season-signup-flow.js', root), 'utf8');
  assert.ok(form.includes("field: 'avoid'"));
  const sent = form.slice(form.indexOf('export function signupSentScreen'), form.indexOf('export function signupClickScreen'));
  assert.ok(!sent.includes('avoid'));
});

test('the one line admins read', () => {
  const s = summarizeNominations(rows, { viewerPlayerId: 'admin' });
  assert.equal(namedByText(s.x), 'Ana, Ben');
  assert.match(namedByText(s.admin), /^1 person \(you can't see who/);
  assert.equal(namedByText(undefined), 'No one');
});

// The Season standard sticky (views/season-signup-flow.js standardBlock): never mentions names,
// votes or feedback, and blocks nothing it can't explain.
import { signupStepScreen, signupSentScreen, STANDARD_POINTS } from '../views/season-signup-flow.js';

const stepData = (standard, errors = []) => ({
  n: 4, base: '/app/signup', d: {}, errors, season: '5', deadline: '', prices: {}, now: new Date(), returning: null, payFirst: false,
  plansOffered: [], shared: [], leagueSeason: 4, sizes: [], sizeChart: {}, jersey: { total: 0 }, hasWaiver: true, onFile: {},
  openDetails: new Set(), photo: null, photoUrl: '', poseText: '', poseLabel: '', reviewLines: [], standard,
});

test('the standard sticky: pinned with Got it until read, then a chip; same words as the plain line', () => {
  const unread = signupStepScreen('app', stepData({ show: true, read: 0 }));
  assert.ok(unread.includes('data-sgn-std') && unread.includes('name="std_ok"'));
  assert.ok(unread.includes('data-sgn-std-hint'));
  assert.ok(!unread.includes('sgn-std-line'), 'no plain line next to the sticky');
  const read = signupStepScreen('app', stepData({ show: true, read: Date.now() }));
  assert.ok(read.includes('sgn-std-mini') && !read.includes('name="std_ok"') && !read.includes('data-sgn-std-hint'));
  const everyone = signupStepScreen('app', stepData({ show: false, read: 0 }));
  assert.ok(everyone.includes('sgn-std-line') && !everyone.includes('data-sgn-std'));
  for (const html of [unread, read]) {
    const i = html.indexOf('sgn-std'), block = html.slice(i, html.indexOf('</section>', i) + 10).toLowerCase();
    for (const w of ['vote', 'named', 'feedback', 'rather not', 'reported']) assert.ok(!block.includes(w), w);
  }
  for (const p of STANDARD_POINTS) assert.ok(everyone.includes(p.slice(1)));
});

test('the standard sticky on the Sent screen posts Got it on its own', () => {
  const html = signupSentScreen('app', { base: '/app/signup', season: '5', signup: { status: 'waitlisted' }, open: true, canEdit: false, standard: { show: true, read: 0 } });
  assert.ok(html.includes('action="/app/signup/standard"'));
  assert.ok(!signupSentScreen('app', { base: '/app/signup', season: '5', signup: { status: 'waitlisted' }, open: true, standard: { show: false } }).includes('data-sgn-std'));
});
