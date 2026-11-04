// node --test test/activity-log.test.js — the one log: what's kept in a log row, how each
// source reads, and which player actions get logged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanLogDetails } from '../lib/log-details.js';
import { buildLogRows, describeAdminRequest, areaForPath, playerAuditRoute, captureConsoleErrors } from '../lib/activity-log.js';

const ctx = {
  players: { p1: { name: 'TY, Paolo' } }, regs: { r1: { id: 'r1', full_name: 'CRUZ, Ana', email: 'a@x.ph', player_id: 'p2' } },
  regsByEmail: { 'a@x.ph': { id: 'r1', full_name: 'CRUZ, Ana', player_id: 'p2' } }, runs: { run1: { title: 'Friday run' } }, games: {},
};
const empty = { admin: [], papawis: [], app: [], email: [], share: [], birthday: [], broadcast: [] };
const adminRow = o => ({ id: 1, actor: 'super', actor_type: 'super', method: 'POST', path: '/admin/x', status: 200, created_at: 5, details: '{}', ...o });

test('photos become a short note, credentials never stay', () => {
  const out = cleanLogDetails({ dataUrl: `data:image/png;base64,${'A'.repeat(2_000_000)}`, password: 'x', confirm: 'x', token: 't', amount: 500, note: 'keep' });
  assert.equal(out.dataUrl, '[file, 1.5 MB]');
  assert.deepEqual(Object.keys(out).sort(), ['amount', 'dataUrl', 'note']);
});

test('photo arrays, long text and huge forms stay small', () => {
  const out = cleanLogDetails({ dataUrls: ['data:image/png;base64,AAAA'], writeup: 'x'.repeat(5000) });
  assert.match(out.dataUrls[0], /^\[file/);
  assert.equal(out.writeup.length, 501);
  const big = {};
  for (let i = 0; i < 200; i++) big[`field_${i}`] = 'y'.repeat(100);
  const cleaned = JSON.stringify(cleanLogDetails(big));
  assert.ok(cleaned.length < 4500, `was ${cleaned.length}`);
  assert.match(cleaned, /not_kept/);
});

test('a GCash change stays readable: it is what the log is for', () => {
  assert.equal(cleanLogDetails({ gcash_number: '09171234567' }).gcash_number, '09171234567');
});

test('requests read as sentences, unknown ones still make sense', () => {
  assert.equal(describeAdminRequest('POST', '/admin/ledger/transaction/abc123/void'), 'Voided a transaction');
  assert.equal(describeAdminRequest('DELETE', '/admin/ledger/transaction/abc123'), 'Deleted a transaction');
  assert.equal(describeAdminRequest('POST', '/admin/papawis'), 'Created a run');
  assert.equal(describeAdminRequest('POST', '/admin/fines/categories/cat_12'), 'Fines: categories');
  assert.equal(describeAdminRequest('POST', '/login', 'login_failed'), 'Failed sign-in');
});

test('areas follow the admin menu', () => {
  assert.equal(areaForPath('/admin/ledger/transaction/x'), 'Finance');
  assert.equal(areaForPath('/admin/papawis/x/add'), 'Papawis');
  assert.equal(areaForPath('/login'), 'Account');
  assert.equal(areaForPath('/system/mailer'), 'System');
  assert.equal(areaForPath('/settle-balance'), 'Finance');
});

test('a failed request is a problem; an old row with no status is not', () => {
  const [bad] = buildLogRows({ ...empty, admin: [adminRow({ status: 500 })] }, ctx);
  const [old] = buildLogRows({ ...empty, admin: [adminRow({ status: 0 })] }, ctx);
  assert.equal(bad.failed, true);
  assert.equal(old.failed, false);
});

test('the action names who it was done to, from the path or the form', () => {
  const [byPath] = buildLogRows({ ...empty, admin: [adminRow({ path: '/admin/users/r1/approve' })] }, ctx);
  assert.equal(byPath.target, 'Ana CRUZ');
  assert.equal(byPath.href, '/admin/users/r1');
  const [byForm] = buildLogRows({ ...empty, admin: [adminRow({ path: '/admin/ledger/transaction', details: '{"player_id":"p1","amount":500}' })] }, ctx);
  assert.equal(byForm.target, 'Paolo TY');
  assert.equal(byForm.sub, '₱500');
});

test('every source lands in one list, newest first, and bounced email counts as a problem', () => {
  const rows = buildLogRows({
    ...empty,
    admin: [adminRow({ created_at: 1 })],
    papawis: [{ id: 'x', event_type: 'joined', player_id: 'p1', player_name: 'TY, Paolo', notes: '', created_at: 3, game_id: 'run1', game_title: 'Friday run' }],
    email: [{ id: 'm', to_email: 'a@x.ph', subject: 'Hi', kind: 'k', sent_at: 2, bounced_at: 9, status: 'sent' }],
    app: [{ id: 1, type: 'open', created_at: 9 }],
  }, ctx);
  assert.deepEqual(rows.map(r => r.source), ['papawis', 'email', 'admin']);
  assert.equal(rows[0].who, 'Paolo TY');
  assert.equal(rows[1].failed, true);
  assert.equal(rows[1].target, 'Ana CRUZ');
});

test('player actions: the right routes, and only deleting counts on a comment route', () => {
  assert.equal(playerAuditRoute('POST', '/settle-balance').event, 'settle_balance');
  assert.equal(playerAuditRoute('POST', '/papawis/abc/join').failOnly, true);
  assert.equal(playerAuditRoute('DELETE', '/games/g1/comments/c1').event, 'comment_deleted');
  assert.equal(playerAuditRoute('POST', '/games/g1/comments/c1'), null);
  assert.equal(playerAuditRoute('POST', '/app/thread/k/comments/c1/delete').event, 'comment_deleted');
  assert.equal(playerAuditRoute('GET', '/settle-balance'), null);
  assert.equal(playerAuditRoute('POST', '/notifications/mark-read'), null);
});

test('console.error reaches the log once, tagged, and never throws', () => {
  const original = console.error;
  console.error = () => {};
  try {
    const seen = [];
    captureConsoleErrors(e => seen.push(e));
    console.error('[mailer]', 'send failed');
    console.error('[mailer]', 'send failed');
    assert.equal(seen.length, 1);
    assert.equal(seen[0].path, '/system/mailer');
    assert.equal(seen[0].details.message, '[mailer] send failed');
    console.error = original;
    console.error = () => {};
    captureConsoleErrors(() => { throw new Error('db locked'); });
    assert.doesNotThrow(() => console.error('[x] boom'));
  } finally {
    console.error = original;
  }
});
