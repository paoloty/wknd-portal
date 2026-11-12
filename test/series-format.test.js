// lib/series-format.js: the playoff format read from the Season format text (2026-11-13).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSeasonFormat, roundRule, formatFactLine } from '../lib/series-format.js';
import { claimProblems } from '../lib/writer.js';

test("Paolo's wording and the old placeholder both read as twice to beat + best of 3", () => {
  for (const text of [
    'Regular Season: Double Round Robin, Semis: Top 2 Twice to Beat, Finals: Best of 3',
    'Double Round Robin · Top 4 Twice-to-Beat · Finals Best of 3',
  ]) {
    const f = parseSeasonFormat(text);
    assert.deepEqual([f.semis.kind, f.semis.high, f.semis.low], ['twice', 1, 2], text);
    assert.deepEqual([f.finals.kind, f.finals.n, f.finals.high], ['bestof', 3, 2], text);
  }
});

test('blank or unclear text keeps the league rules', () => {
  for (const text of ['', null, 'Double Round Robin']) {
    const f = parseSeasonFormat(text);
    assert.equal(f.semis.label, 'twice to beat');
    assert.equal(f.finals.label, 'best of 3');
  }
});

test('other formats: best-of-N semis, best of 5 / one-game Finals, "first to N wins"', () => {
  let f = parseSeasonFormat('Semis: Best of 3 · Finals: Best of 5');
  assert.deepEqual([f.semis.kind, f.semis.high, f.semis.low], ['bestof', 2, 2]);
  assert.deepEqual([f.finals.n, f.finals.high], [5, 3]);
  f = parseSeasonFormat('Semis: one game, Finals: first to 3 wins');
  assert.deepEqual([f.semis.kind, f.semis.high], ['single', 1]);
  assert.equal(f.finals.label, 'best of 5');
  // Twice to beat needs seeds: never the Finals.
  assert.equal(parseSeasonFormat('Finals: twice to beat').finals.label, 'best of 3');
});

test('the rule lines say the format in the words the check looks for', () => {
  const f = parseSeasonFormat('');
  assert.match(roundRule(f.semis), /twice to beat/);
  assert.match(roundRule(f.finals, true), /best of 3: first to 2 wins is champion/);
  assert.match(formatFactLine(f), /Semifinals: twice to beat.*Finals: best of 3/);
});

test('the writer check follows whatever format the facts give', () => {
  const bo5 = `Format: ${roundRule(parseSeasonFormat('Finals: Best of 5').finals, true)}.`;
  assert.deepEqual(claimProblems('A best-of-five Finals, first to 3 wins.', bo5), []);
  assert.match(claimProblems('White take Game 1 of the best-of-3 Finals.', bo5).join(' '), /best of 3/);
  assert.match(claimProblems('a three-game series', bo5).join(' '), /best of 3/);
});
