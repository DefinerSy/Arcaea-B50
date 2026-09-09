import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const examples = resolve(root, 'examples');
const demo = JSON.parse(await readFile(resolve(root, 'src/data/demo.json'), 'utf8'));

const archive = {
  ...demo,
  player: {
    ...demo.player,
    name: 'Example Player',
    id: '100 000 001',
    title: '',
  },
};

await mkdir(examples, { recursive: true });
await writeFile(
  resolve(examples, 'example.json'),
  `${JSON.stringify(archive, null, 2)}\n`,
);

const difficulties = { PST: 0, PRS: 1, FTR: 2, BYD: 3, ETR: 4, INS: 3 };
const SQL = await initSqlJs();
const db = new SQL.Database();
try {
  db.run(`CREATE TABLE scores (
    songId TEXT NOT NULL,
    songDifficulty INTEGER NOT NULL,
    score INTEGER NOT NULL,
    perfectCount INTEGER NOT NULL,
    shinyPerfectCount INTEGER NOT NULL,
    nearCount INTEGER NOT NULL,
    missCount INTEGER NOT NULL
  )`);
  db.run('CREATE TABLE config (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  db.run("INSERT INTO config VALUES ('character', '34'), ('character_uncapped', '1')");

  const insert = db.prepare('INSERT INTO scores VALUES (?, ?, ?, ?, ?, ?, ?)');
  try {
    for (const score of archive.scores) {
      const difficulty = difficulties[score.difficulty];
      if (difficulty === undefined) throw new Error(`Unknown difficulty: ${score.difficulty}`);
      insert.run([
        score.id,
        difficulty,
        score.score,
        score.pure,
        score.shiny,
        score.far,
        score.lost,
      ]);
    }
  } finally {
    insert.free();
  }
  await writeFile(resolve(examples, 'example.st3'), db.export());
} finally {
  db.close();
}

console.log(`Generated examples/example.json and examples/example.st3 (${archive.scores.length} scores).`);
