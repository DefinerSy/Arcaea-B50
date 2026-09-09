import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import initSqlJs from "sql.js";
import {
  parseArchive,
  isSqlite,
  exportFilename,
  localAsset,
} from "../src/archive.ts";
import { readSt3 } from "../src/st3.ts";
import { getBest50 } from "../src/rating.ts";
import { readSelectedCharacter, parseCharacter } from "../src/character.ts";

const demo = JSON.parse(
  await readFile(new URL("../src/data/demo.json", import.meta.url), "utf8"),
);
const catalog = JSON.parse(
  await readFile(new URL("../src/data/catalog.json", import.meta.url), "utf8"),
);
const SQL = await initSqlJs();

test("JSON archives round trip without losing scores, profile, demo status or warnings", () => {
  const archive = parseArchive({
    ...demo,
    source: {
      name: "test.st3",
      version: "7.0",
      skipped: 1,
      warnings: ["一条谱面未匹配"],
    },
  });
  assert.deepEqual(parseArchive(JSON.parse(JSON.stringify(archive))), archive);
  assert.equal(archive.scores.length, 50);
  assert.equal(archive.isDemo, true);
});
test("invalid and empty archives fail instead of replacing the previous data", () => {
  for (const scores of [
    [],
    null,
    [{ ...demo.scores[0], score: -1 }],
    [{ ...demo.scores[0], difficulty: "BAD" }],
    [{ ...demo.scores[0], shiny: 1000000 }],
  ])
    assert.throws(() => parseArchive({ ...demo, scores }));
  assert.throws(() => parseArchive({ ...demo, recordedAt: "2026-02-30" }));
  assert.throws(() =>
    parseArchive({ ...demo, player: { ...demo.player, name: "x".repeat(33) } }),
  );
});
test("untrusted asset paths cannot fetch outside the application", () => {
  for (const path of [
    "https://example.com/a.png",
    "//example.com/a.png",
    "assets/../x.png",
    "data:image/svg+xml,<svg/>",
    "assets/x.svg?q=1",
  ])
    assert.equal(localAsset(path, "fallback"), "fallback");
  assert.equal(
    localAsset("assets/catalog-jackets/testify.jpg", "fallback"),
    "assets/catalog-jackets/testify.jpg",
  );
  assert.equal(
    exportFilename("A/B: C?", "2026-09-10"),
    "Arcaea_B50_A_B_ C__2026-09-10.png",
  );
});
function fixture() {
  const db = new SQL.Database();
  db.run(
    "CREATE TABLE scores(songId TEXT,songDifficulty INTEGER,score INTEGER,perfectCount INTEGER,shinyPerfectCount INTEGER,nearCount INTEGER,missCount INTEGER)",
  );
  const statement = db.prepare("INSERT INTO scores VALUES (?,?,?,?,?,?,?)");
  for (const score of demo.scores) {
    const difficulty = ["PST", "PRS", "FTR", "BYD", "ETR"].indexOf(
      score.difficulty,
    );
    statement.run([
      score.id,
      difficulty,
      score.score,
      score.pure,
      score.shiny,
      score.far,
      score.lost,
    ]);
  }
  // Same chart, worse score: must not count twice.
  const first = demo.scores[0];
  statement.run([
    first.id,
    ["PST", "PRS", "FTR", "BYD", "ETR"].indexOf(first.difficulty),
    9_500_000,
    1000,
    990,
    3,
    2,
  ]);
  statement.run(["not-in-catalog", 2, 9_990_000, 1000, 990, 1, 0]);
  statement.free();
  const bytes = db.export();
  db.close();
  return bytes;
}
test("real SQLite st3 is decoded and joined with constants, with duplicates and missing charts accounted for", async () => {
  const bytes = fixture();
  assert.equal(isSqlite(bytes), true);
  assert.equal(isSqlite(new TextEncoder().encode("{}")), false);
  const result = readSt3(SQL, bytes, catalog);
  assert.equal(result.isDemo, false);
  assert.equal(result.scores.length, 51);
  assert.equal(result.source?.skipped, 1);
  assert.match(result.source!.warnings[0], /not-in-catalog/);
  assert.equal(getBest50(result.scores).best.length, 50);
  assert.equal(getBest50(result.scores).b50, getBest50(demo.scores).b50);
  await mkdir(new URL("../artifacts/", import.meta.url), { recursive: true });
  await writeFile(new URL("../artifacts/test.st3", import.meta.url), bytes);
});
test("unrelated SQLite and empty st3 databases report meaningful errors", () => {
  const db = new SQL.Database();
  try {
    assert.throws(() => readSt3(SQL, db.export(), catalog), /scores/);
    db.run(
      "CREATE TABLE scores(songId TEXT,songDifficulty INTEGER,score INTEGER,perfectCount INTEGER,shinyPerfectCount INTEGER,nearCount INTEGER,missCount INTEGER)",
    );
    assert.throws(() => readSt3(SQL, db.export(), catalog), /尚无已游玩成绩/);
  } finally {
    db.close();
  }
});

test("selected character metadata supports ID zero, awakening and art override", () => {
  const db = new SQL.Database(fixture());
  try {
    db.run(
      "CREATE TABLE config(key TEXT,value TEXT); INSERT INTO config VALUES ('character','0'),('character_uncapped','1')",
    );
    assert.deepEqual(readSelectedCharacter(db), { id: 0, awakened: true });
    assert.deepEqual(readSt3(SQL, db.export(), catalog).player.character, {
      id: 0,
      awakened: true,
    });
    db.run("INSERT INTO config VALUES ('character_uncapped_override','1')");
    assert.deepEqual(readSelectedCharacter(db), { id: 0, awakened: false });
  } finally {
    db.close();
  }
});
test("only explicit selection is used, not the first character in an inventory", () => {
  const db = new SQL.Database();
  try {
    db.run(
      "CREATE TABLE characters(id INTEGER,level INTEGER); INSERT INTO characters VALUES (34,20),(1,5)",
    );
    assert.equal(readSelectedCharacter(db), undefined);
    db.run(
      "CREATE TABLE player(selectedCharacterId INTEGER,characterAwakened INTEGER);INSERT INTO player VALUES(34,1)",
    );
    assert.deepEqual(readSelectedCharacter(db), { id: 34, awakened: true });
  } finally {
    db.close();
  }
});
test("character JSON and embedded role images survive a saved archive round trip", async () => {
  const image = await readFile(
    new URL("../public/assets/characters/0_icon.webp", import.meta.url),
  );
  const archive = parseArchive({
    ...demo,
    player: {
      ...demo.player,
      character: { id: 0, awakened: false },
      characterImage: `data:image/webp;base64,${image.toString("base64")}`,
    },
  });
  assert.deepEqual(parseArchive(JSON.parse(JSON.stringify(archive))), archive);
  for (const bad of [
    "https://example.com/role.png",
    "data:image/svg+xml;base64,AAAA",
    "javascript:alert(1)",
  ])
    assert.throws(() =>
      parseArchive({
        ...demo,
        player: { ...demo.player, characterImage: bad },
      }),
    );
  for (const id of [-1, NaN, "1x", "", 10001])
    assert.equal(parseCharacter(id), undefined);
});
