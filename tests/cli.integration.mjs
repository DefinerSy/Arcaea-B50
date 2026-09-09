import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { mkdtemp, writeFile, readFile, rm, stat } from "node:fs/promises";
import { join, dirname, basename, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import initSqlJs from "sql.js";

const execute = promisify(execFile);
const cli = fileURLToPath(new URL("../scripts/b50.mjs", import.meta.url));
let work, original;
const run = (args) =>
  execute(process.execPath, ["--experimental-strip-types", cli, ...args], {
    cwd: work,
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 1024 * 1024,
  });
before(async () => {
  work = await mkdtemp(join(tmpdir(), "b50-cli-test-"));
  original = await readFile(new URL("../src/data/demo.json", import.meta.url));
  await writeFile(join(work, "archive file.json"), original);
  const demo = JSON.parse(original);
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(
    "CREATE TABLE scores(songId TEXT,songDifficulty INTEGER,score INTEGER,perfectCount INTEGER,shinyPerfectCount INTEGER,nearCount INTEGER,missCount INTEGER)",
  );
  const statement = db.prepare("INSERT INTO scores VALUES (?,?,?,?,?,?,?)");
  for (const s of demo.scores)
    statement.run([
      s.id,
      ["PST", "PRS", "FTR", "BYD", "ETR"].indexOf(s.difficulty),
      s.score,
      s.pure,
      s.shiny,
      s.far,
      s.lost,
    ]);
  statement.run(["missing-chart", 2, 9900000, 1000, 990, 2, 0]);
  statement.free();
  await writeFile(join(work, "st3"), db.export());
  db.close();
});
after(async () => {
  if (
    work &&
    dirname(resolve(work)) === resolve(tmpdir()) &&
    basename(work).startsWith("b50-cli-test-")
  )
    await rm(work, { recursive: true, force: true });
});

test("JSON archive produces a real PNG from any working directory with clean machine-readable output", async () => {
  const { stdout } = await run([
    "archive file.json",
    "-o",
    "image with spaces.png",
    "--name",
    "命令行 玩家",
    "--id",
    "",
    "--width",
    "1080",
    "--theme",
    "light",
    "--json",
  ]);
  const result = JSON.parse(stdout);
  assert.equal(result.scores, 50);
  assert.equal(result.width, 1080);
  assert.equal(result.missingImages, 0);
  const png = await readFile(result.output);
  assert.equal(png.readUInt32BE(16), 1080);
  assert.equal(png.readUInt32BE(20), result.height);
  assert.ok(png.length > 10000);
  assert.deepEqual(await readFile(join(work, "archive file.json")), original);
});
test("st3 CLI exports without an output option and surfaces unmatched chart warnings", async () => {
  const { stdout, stderr } = await run([
    "st3",
    "--width",
    "720",
    "--character",
    "0",
    "--json",
  ]);
  const result = JSON.parse(stdout);
  assert.equal(result.output, join(work, "st3.b50.png"));
  assert.equal(result.scores, 50);
  assert.equal(result.skipped, 1);
  assert.equal(result.missingImages, 0);
  assert.match(stderr, /missing-chart/);
  assert.equal((await readFile(result.output)).readUInt32BE(16), 720);
});
test("invalid files and invalid arguments fail without producing PNGs", async () => {
  await writeFile(join(work, "bad.json"), "invalid");
  await assert.rejects(
    () => run(["bad.json", "-o", "bad.png"]),
    (error) => error.code === 1 && /无法识别/.test(error.stderr),
  );
  await assert.rejects(
    () => stat(join(work, "bad.png")),
    (error) => error.code === "ENOENT",
  );
  await assert.rejects(
    () => run(["archive file.json", "--width", "123"]),
    (error) => error.code === 2,
  );
});
test("existing files are preserved unless --force is explicitly supplied", async () => {
  const output = join(work, "existing.png");
  await writeFile(output, "preserve me");
  await assert.rejects(
    () => run(["archive file.json", "-o", "existing.png"]),
    (error) => error.code === 1 && /已存在/.test(error.stderr),
  );
  assert.equal(await readFile(output, "utf8"), "preserve me");
  await run([
    "archive file.json",
    "-o",
    "existing.png",
    "--width",
    "1440",
    "--force",
  ]);
  assert.equal((await readFile(output)).readUInt32BE(16), 1440);
});
test("same input/output and unavailable explicit browsers fail noninteractively", async () => {
  await writeFile(join(work, "source.png"), original);
  await assert.rejects(
    () => run(["source.png", "-o", "source.png", "--force"]),
    (error) => error.code === 2,
  );
  assert.deepEqual(await readFile(join(work, "source.png")), original);
  await assert.rejects(
    () =>
      run([
        "archive file.json",
        "-o",
        "no-browser.png",
        "--browser",
        "missing-browser",
      ]),
    (error) => error.code === 1,
  );
  await assert.rejects(
    () => stat(join(work, "no-browser.png")),
    (error) => error.code === "ENOENT",
  );
});
