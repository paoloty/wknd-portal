// node --test test/app-timing.test.js — the real-phone speed numbers on /admin/app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanTiming, summarizeTimings } from '../lib/app-timing.js';

test('a launch saves only what it should, whatever the phone sends', () => {
  const t = cleanTiming({ fcp: 212.6, ttfb: 40, ready: 300, fresh: 700, kb: 16000, copy: true, standalone: true, nav: 'navigate', net: '4g', colo: 'LAX', ver: 'abc123', name: 'Someone', email: 'x@example.invalid' }, { platform: 'ios' });
  assert.equal(t.fcp, 213);
  assert.equal(t.from_copy, 1);
  assert.equal(t.colo, 'LAX');
  assert.equal(t.platform, 'ios');
  assert.equal('name' in t, false);
  assert.equal('email' in t, false);
});

test('rubbish is dropped, and a launch with no first paint is no use', () => {
  assert.equal(cleanTiming(null), null);
  assert.equal(cleanTiming('x'), null);
  assert.equal(cleanTiming({ ttfb: 40 }), null);
  assert.equal(cleanTiming({ fcp: -5 }), null);
  assert.equal(cleanTiming({ fcp: 1e9 }), null);
  const t = cleanTiming({ fcp: 100, colo: '<script>', net: 'fast', nav: 'x', ver: 'a b', ready: 'soon' }, { platform: 'toaster' });
  assert.deepEqual([t.colo, t.net, t.nav, t.ver, t.platform, t.ready], ['', '', '', '', '', null]);
});

test('a time the phone does not have stays blank, not zero', () => {
  const t = cleanTiming({ fcp: 100, fresh: null, ready: undefined });
  assert.equal(t.fresh, null);
  assert.equal(t.ready, null);
});

test('copy launches and network launches stay on separate lines, biggest first', () => {
  const rows = [
    ...[100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map(fcp => ({ fcp, from_copy: 1, platform: 'ios', fresh: fcp * 2, colo: 'LAX' })),
    { fcp: 2000, from_copy: 0, platform: 'ios', fresh: null, colo: 'SIN' },
  ];
  const s = summarizeTimings(rows);
  assert.equal(s.total, 11);
  assert.equal(s.groups[0].fromCopy, true);
  assert.equal(s.groups[0].count, 10);
  assert.equal(s.groups[0].fcp.typical, 500);
  assert.equal(s.groups[0].fcp.slow, 900);
  assert.equal(s.groups[1].fcp.typical, 2000);
  assert.equal(s.groups[1].fresh.typical, null);
  assert.deepEqual(s.colos, [{ colo: 'LAX', count: 10 }, { colo: 'SIN', count: 1 }]);
});

test('no timings is an empty summary', () => {
  assert.deepEqual(summarizeTimings([]), { total: 0, groups: [], colos: [] });
});

test('the app no longer loads Google Analytics in the head', () => {
  const server = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  const start = server.indexOf('function buildAppGaSnippet');
  const fn = server.slice(start, server.indexOf('function getRequestOrigin', start));
  assert.ok(fn.includes('wkndGaSrc'));
  assert.ok(!fn.includes('<script async'));
});

test('the speed table has no column that could say who a player is', () => {
  const db = readFileSync(new URL('../lib/portal-db.js', import.meta.url), 'utf8');
  const start = db.indexOf('CREATE TABLE IF NOT EXISTS app_timings');
  const table = db.slice(start, db.indexOf(');', start));
  assert.ok(start > 0);
  assert.ok(!/reg_id|player_id|email/.test(table));
});
