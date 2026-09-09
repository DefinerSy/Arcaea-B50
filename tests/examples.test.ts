import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import initSqlJs from 'sql.js';
import { isSqlite, parseArchive } from '../src/archive.ts';
import { getBest50 } from '../src/rating.ts';
import { readSt3 } from '../src/st3.ts';

const jsonUrl = new URL('../examples/example.json', import.meta.url);
const st3Url = new URL('../examples/example.st3', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('../src/data/catalog.json', import.meta.url), 'utf8'));

test('checked-in JSON and st3 examples contain equivalent complete B50 scores', async () => {
  const json = parseArchive(JSON.parse(await readFile(jsonUrl, 'utf8')));
  const bytes = new Uint8Array(await readFile(st3Url));
  assert.equal(isSqlite(bytes), true);

  const st3 = readSt3(await initSqlJs(), bytes, catalog);
  assert.equal(json.player.name, 'Example Player');
  assert.equal(json.scores.length, 50);
  assert.equal(st3.scores.length, 50);
  assert.equal(st3.source?.skipped, 0);
  assert.deepEqual(st3.player.character, { id: 34, awakened: true });

  const expected = getBest50(json.scores);
  const actual = getBest50(st3.scores);
  assert.equal(expected.best.length, 50);
  assert.deepEqual(
    actual.best.map(score => [score.id, score.difficulty, score.score]),
    expected.best.map(score => [score.id, score.difficulty, score.score]),
  );
  assert.equal(actual.b50, expected.b50);
  assert.equal(actual.b10, expected.b10);
  assert.equal(actual.max, expected.max);
});
