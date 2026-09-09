import assert from "node:assert/strict";
import { test } from "node:test";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { parseCliOptions, UsageError } from "../scripts/lib/cli-options.mjs";
import { readArchive } from "../src/read-archive.ts";
import type { Catalog } from "../src/archive.ts";

test("CLI accepts paths with spaces, metadata, appearance and all supported widths", () => {
  for (const width of [720, 1080, 1440, 2160, 2880, 3840]) {
    const result = parseCliOptions([
      "save file.st3",
      "-o",
      "output file.png",
      "--name",
      "测试 玩家",
      "--id",
      "",
      "--character",
      "34u",
      "--width",
      String(width),
      "--theme",
      "light",
      "--json",
    ]);
    assert.equal(result.input, resolve("save file.st3"));
    assert.equal(result.output, resolve("output file.png"));
    assert.deepEqual(result.character, { id: 34, awakened: true });
    assert.equal(result.width, width);
    assert.equal(result.id, "");
    assert.equal(result.name, "测试 玩家");
    assert.equal(result.json, true);
  }
});
test("CLI help needs no input and default output is next to the archive", () => {
  assert.deepEqual(parseCliOptions(["--help"]), { help: true });
  const result = parseCliOptions(["-i", "folder/st3"]);
  assert.equal(result.output, resolve("folder/st3.b50.png"));
  assert.equal(result.width, 2880);
  assert.equal(result.theme, "dark");
  assert.equal(result.force, false);
  assert.deepEqual(parseCliOptions(["st3", "--character", "0"]).character, {
    id: 0,
    awakened: false,
  });
});
test("CLI rejects ambiguous input, invalid options and unsafe output before launching a browser", () => {
  for (const args of [
    [],
    ["one", "two"],
    ["-i", "one", "two"],
    ["x", "--width", "123"],
    ["x", "--theme", "bad"],
    ["x", "--timeout", "0"],
    ["x", "--character", "oops"],
    ["x", "-o", "out.db"],
    ["input.png", "-o", "input.png", "--force"],
    ["x", "--bad"],
  ])
    assert.throws(() => parseCliOptions(args), UsageError);
});
test("shared reader parses JSON without loading SQLite and rejects invalid files", async () => {
  const bytes = await readFile(
    new URL("../src/data/demo.json", import.meta.url),
  );
  const catalog = {
    version: "test",
    updatedAt: "2026-09-10",
    charts: {},
  } as Catalog;
  const load = async () => {
    throw new Error("SQLite must not load for JSON");
  };
  const result = await readArchive(bytes, load, catalog);
  assert.equal(result.isSt3, false);
  assert.equal(result.archive.scores.length, 50);
  await assert.rejects(
    () => readArchive(new Uint8Array(), load, catalog),
    /为空/,
  );
  await assert.rejects(
    () =>
      readArchive(new TextEncoder().encode("not an archive"), load, catalog),
    /无法识别/,
  );
});
