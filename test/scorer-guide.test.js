// node --test test/scorer-guide.test.js  — How to score (views/app/help.js) keeps up with the
// scorer (public/scorer.js). Rule (Paolo, 2026-10-27): every change to how the scorer works
// updates the guide in the same change. This catches the drift a person would miss: a question
// the scorer asks that the guide never mentions, a game-menu switch it doesn't explain, a
// screenshot that isn't there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { SCORER_GUIDE, PW_SCORER_GUIDE } from '../views/app/help.js';

const root = new URL('../', import.meta.url);
const scorer = readFileSync(new URL('public/scorer.js', root), 'utf8');
const guide = SCORER_GUIDE.flatMap(ch => [ch.title, ...ch.blocks.flat(2)]).join(' ').replace(/<[^>]+>/g, '').replace(/’/g, "'");

test('every follow-up question the scorer asks is in the guide', () => {
  // q: 'Rebound?', q: `${name} on. Who went off?`, q: `And-one: who fouled ${name}?`: the names
  // (${…}) dropped, the last sentence kept, and matched without its question mark.
  const asked = [...scorer.matchAll(/\bq: (?:'([^']*)'|`([^`]*)`)/g)]
    .map(m => (m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, '').replace(/^.*\.\s+/, '').replace(/^And-one:\s*/i, '').replace(/\s+\?/, '?').trim())
    .filter(q => q.endsWith('?'));
  assert.ok(asked.length >= 7, `found the questions in scorer.js (${asked.join(', ')})`);
  const missing = asked.filter(q => !guide.toLowerCase().includes(q.slice(0, -1).toLowerCase()));
  assert.deepEqual(missing, [], `How to score never mentions: ${missing.join(', ')}. Add them to views/app/help.js`);
});

test('every on/off switch in the game menu is explained', () => {
  const switches = [...scorer.matchAll(/'([A-Z][\w -]+): (?:on|off) \(tap to turn/g)].map(m => m[1]);
  assert.ok(switches.length >= 1, 'found the game menu switches');
  const missing = switches.filter(s => s !== 'Sounds' && !guide.includes(s));
  assert.deepEqual(missing, [], `How to score doesn't explain: ${missing.join(', ')}`);
});

test('the special cases are explained: a block asks twice, the questions switch off', () => {
  // Block: Whose shot? then Rebound? (public/scorer.js answer 'blocked' → reboundAsk only if answered).
  assert.match(scorer, /ui\.ask = id \? reboundAsk\(a\.o\) : null/, 'the block still asks Rebound? only after Whose shot? is answered: update the guide if this changed');
  assert.ok(/after a block: up to two questions/i.test(guide), 'the guide explains the block’s two questions');
  assert.ok(/the spotter: pick your questions/i.test(guide) && guide.includes('Spotter') && /\bLight\b/.test(guide), 'the guide shows how to pick the questions (the Spotter)');
});

// The Spotter (2026-11-10): every preset and every question it can switch off are in the guides,
// and Papawis Basic's trimmed list is explained in the Papawis guide.
test('the Spotter: presets and questions are explained', () => {
  assert.match(scorer, /SPOT = \{ full: \[[^\]]*\], basic: \['ast', 'wentoff'\] \}/, 'the Spotter lists changed: update both guides');
  for (const s of ['Off', 'Light', 'Full', 'Your mix']) assert.ok(guide.includes(s), `the league guide names the "${s}" preset`);
  const pw = PW_SCORER_GUIDE.flatMap(ch => [ch.title, ...ch.blocks.flat(2)]).join(' ').replace(/<[^>]+>/g, '');
  for (const s of ['Spotter', 'Assisted?', 'Who went off?']) assert.ok(pw.includes(s), `the Papawis guide explains "${s}"`);
});

test('the Try tips moves are covered by the guide', () => {
  // Each tip names a button or gesture; the guide must teach the same ones.
  for (const word of ['Undo', 'Hold FOUL', 'Offensive', 'Defensive', 'Swipe', 'End', 'bench player']) {
    assert.ok(guide.toLowerCase().includes(word.toLowerCase()), `the guide teaches "${word}"`);
  }
});

test('every screenshot the guide shows exists', () => {
  const imgs = SCORER_GUIDE.flatMap(ch => ch.blocks.filter(b => b[0] === 'img').map(b => b[1]));
  const missing = imgs.filter(f => !existsSync(new URL(`public/help/scorer/${f}`, root)));
  assert.deepEqual(missing, [], `missing in public/help/scorer: ${missing.join(', ')}`);
});

// How to score Papawis (views/app/help.js PW_SCORER_GUIDE, 2026-11-01): its screenshots exist,
// switching sides keeps its own chapter, and its switches (thumb mode, hand) are explained.
test('the Papawis guide: screenshots, the switching chapter, thumb mode', () => {
  const imgs = PW_SCORER_GUIDE.flatMap(ch => ch.blocks.filter(b => b[0] === 'img').map(b => b[1]));
  const missing = imgs.filter(f => !existsSync(new URL(`public/help/papawis/${f}`, root)));
  assert.deepEqual(missing, [], `missing in public/help/papawis: ${missing.join(', ')}`);
  assert.ok(PW_SCORER_GUIDE.some(ch => ch.slug === 'switch'), 'switching Light and Dark has its own chapter');
  const pw = PW_SCORER_GUIDE.flatMap(ch => [ch.title, ...ch.blocks.flat(2)]).join(' ');
  for (const s of ['Thumb mode', 'Hand: right', '⇄', 'Finish the run']) assert.ok(pw.includes(s), `the Papawis guide explains "${s}"`);
});
