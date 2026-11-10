// node --test test/admin-menu.test.js — the admin menu (views/admin/layout.js): every page keeps
// a home, and moving things around the menu never changes who can open what.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_SECTIONS, sectionForPath, firstAllowedAdminUrl, menuFor, menuItemFor } from '../views/admin/layout.js';

const links = menu => menu.flatMap(s => s.items.map(i => i.label));
const hrefs = menu => menu.flatMap(s => s.items.flatMap(i => i.tabs.map(t => t.href)));
const full = menuFor({ isSuperAdmin: true });

test('the permission sections are the ones stored on accounts, in the same order', () => {
  assert.deepEqual(ADMIN_SECTIONS.map(s => s.key), ['overview', 'reach', 'games-stats', 'papawis', 'awards', 'season', 'content', 'community', 'marketplace', 'finance', 'members', 'site']);
});

test('pages keep the permission they had before the menu moved', () => {
  const was = {
    '/admin/analytics': 'overview', '/admin/reach/sent': 'reach', '/admin/players': 'games-stats', '/admin/players/uploads': 'games-stats', '/admin/media': 'games-stats', '/admin/scorers': 'games-stats',
    '/admin/papawis/scorers': 'papawis', '/admin/awards/podium': 'awards', '/admin/mvp': 'awards', '/admin/seasons': 'season', '/admin/season/candidates': 'season',
    '/admin/seo': 'content', '/admin/coach-notes': 'content', '/admin/posts': 'content', '/admin/polls': 'community', '/admin/raffle': 'community', '/admin/ratings': 'community', '/admin/fines/categories': 'community',
    '/admin/marketplace/new': 'marketplace', '/admin/finance/gcash': 'finance', '/admin/ledger': 'finance', '/admin/users': 'members', '/admin/team-heads': 'members', '/admin/app': 'members', '/admin/app/announcements': 'members', '/admin/site': 'site',
  };
  for (const [path, key] of Object.entries(was)) assert.equal(sectionForPath(path)?.key, key, path);
});

test('every page in the permission table has a home in the menu', () => {
  // These only take POSTs (↺ regenerate buttons on public pages): nothing to navigate to.
  const postOnly = ['/admin/papawis-summary', '/admin/home-summary', '/admin/section-summary', '/admin/teams-summary', '/admin/leaders'];
  for (const s of ADMIN_SECTIONS) {
    for (const href of s.prefixes) {
      if (!postOnly.includes(href)) assert.ok(menuItemFor(href, full), `${href} has no menu link`);
    }
  }
});

test('the menu: 21 links on the live site, in order', () => {
  assert.deepEqual(links(full).filter(l => l !== 'Sync DB'), [
    'Home', 'Papawis', 'Games', 'Money', 'Marketplace',
    'Accounts', 'Player profiles', 'Conduct', 'Ratings', 'Chat archive',
    'Message players', 'Feed posts', 'Polls', 'News posts',
    'Season', 'Awards',
    'Site settings', 'Players app', 'AI writing', 'Admin access', 'Logs',
  ]);
});

test('Season pages run in step order, and every one is in a step', () => {
  const season = full.flatMap(s => s.items).find(i => i.id === 'season');
  assert.deepEqual([...new Set(season.tabs.map(t => t.step))], ['setup', 'signups', 'teams', 'start']);
  assert.ok(season.tabs.every(t => t.step));
  assert.ok(season.tabs.every(t => sectionForPath(t.href)?.key === 'season'));
});

test('no page is listed twice', () => {
  const list = hrefs(full);
  assert.equal(new Set(list).size, list.length);
});

test('super admin pages stay with the super admin, whatever the section list says', () => {
  const superOnly = ['/admin/logs', '/admin/share-log', '/admin/birthdays', '/admin/barkadahan', '/admin/privileges'];
  const elevated = hrefs(menuFor({ isSuperAdmin: false }));
  for (const href of superOnly) {
    assert.ok(hrefs(full).includes(href), `${href} missing for super admin`);
    assert.ok(!elevated.includes(href), `${href} shown to a player-admin`);
  }
});

test('a Papawis-only admin sees Papawis and nothing else, with no empty headings', () => {
  const menu = menuFor({ allowedSections: ['papawis'] });
  assert.deepEqual(links(menu), ['Papawis']);
  assert.deepEqual(menu.map(s => s.head), ['Run the week']);
  assert.deepEqual(hrefs(menu), ['/admin/papawis', '/admin/papawis/courts', '/admin/papawis/scorers', '/admin/papawis/activity']);
  assert.equal(firstAllowedAdminUrl(['papawis']), '/admin/papawis');
});

test('a link split across permissions only shows the tabs this admin can open', () => {
  const site = menuFor({ allowedSections: ['content'] }).flatMap(s => s.items).find(i => i.id === 'site');
  assert.deepEqual(site.tabs.map(t => t.href), ['/admin/seo', '/admin/seo/report']);
  const message = menuFor({ allowedSections: ['reach'] }).flatMap(s => s.items).find(i => i.id === 'message');
  assert.deepEqual(message.tabs.map(t => t.label), ['Compose', 'Sent']);
});

test('a page lights up the right link: the longest address wins', () => {
  const id = path => menuItemFor(path, full)?.id;
  assert.equal(id('/admin'), 'home');
  assert.equal(id('/admin/analytics'), 'home');
  assert.equal(id('/admin/app'), 'app');
  assert.equal(id('/admin/app/announcements'), 'feed');
  assert.equal(id('/admin/papawis/some-run'), 'papawis');
  assert.equal(id('/admin/players/some-player'), 'players');
  assert.equal(id('/admin/player/some-player/photo'), 'players');
  assert.equal(id('/admin/season/signups/s1'), 'season');
  assert.equal(id('/admin/seasons'), 'season');
  assert.equal(id('/admin/mvp-podium'), 'awards');
  assert.equal(id('/admin/nothing-here'), undefined);
});

test('the access screen says in menu words what each section opens', () => {
  const opens = Object.fromEntries(ADMIN_SECTIONS.map(s => [s.key, s.opens]));
  assert.equal(opens['games-stats'], 'Games, Player profiles');
  assert.equal(opens.members, 'Accounts, Feed posts, Players app');
  assert.equal(opens.finance, 'Money');
  assert.equal(opens.content, 'News posts, Site settings: Search results, Site settings: SEO report, AI writing');
  assert.equal(opens.site, 'Site settings: Site & homepage');
  for (const s of ADMIN_SECTIONS) assert.ok(s.opens, `${s.key} opens nothing`);
});
