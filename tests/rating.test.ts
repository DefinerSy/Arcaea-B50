import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, access } from "node:fs/promises";
import {
  playRating,
  getBest50,
  formatRating,
  grade,
  potentialTier,
} from "../src/rating.ts";

test("potential badges change at tier boundaries and retain the highest frame above 13", () => {
  const boundaries = [3.5, 7, 10, 11, 12, 12.5, 13];
  boundaries.forEach((value, i) => {
    assert.equal(potentialTier(value - 0.00001), i);
    assert.equal(potentialTier(value), i + 1);
  });
  assert.equal(potentialTier(0), 0);
  assert.equal(potentialTier(14), 7);
});

test("rating follows the 9.5m / 9.8m / 10m boundaries and caps at constant + 2", () => {
  for (const [score, expected] of [
    [0, 0],
    [9_500_000, 10],
    [9_650_000, 10.5],
    [9_800_000, 11],
    [9_900_000, 11.5],
    [10_000_000, 12],
    [10_001_500, 12],
  ]) {
    assert.equal(playRating(score, 10), expected);
  }
});

test("invalid numeric values are rejected", () => {
  for (const score of [-1, NaN, Infinity])
    assert.throws(() => playRating(score, 10), RangeError);
  assert.throws(() => playRating(9_900_000, NaN), RangeError);
});

test("best 50 sorts by rating, keeps the best score per chart and does not mutate input", () => {
  const input = [
    { id: "a", difficulty: "FTR", constant: 10, score: 9_800_000 },
    { id: "b", difficulty: "BYD", constant: 11, score: 9_900_000 },
    { id: "a", difficulty: "FTR", constant: 10, score: 9_900_000 },
    { id: "a", difficulty: "BYD", constant: 11, score: 10_000_000 },
  ];
  const before = structuredClone(input);
  const { best } = getBest50(input);
  assert.equal(best.length, 3);
  assert.deepEqual(
    best.map((s) => s.playRating),
    [13, 12.5, 11.5],
  );
  assert.equal(best.at(-1)?.score, 9_900_000);
  assert.deepEqual(input, before);
});

test("B50, B10 and Max use the reference project denominators and exclude rank 51+", () => {
  const scores = Array.from({ length: 60 }, (_, i) => ({
    id: String(i),
    difficulty: "FTR",
    constant: 10,
    score: i < 10 ? 10_000_000 : 9_800_000,
  }));
  const stats = getBest50(scores);
  assert.equal(stats.best.length, 50);
  assert.equal(stats.b50, 11.2);
  assert.equal(stats.b10, 12);
  assert.equal(stats.max, 680 / 60);
});

test("missing scores count as zero, including empty datasets", () => {
  assert.deepEqual(getBest50([]), { best: [], b50: 0, b10: 0, max: 0 });
  const stats = getBest50([
    { id: "a", difficulty: "FTR", constant: 10, score: 10_000_000 },
  ]);
  assert.equal(stats.b50, 12 / 50);
  assert.equal(stats.b10, 12 / 10);
  assert.equal(stats.max, 24 / 60);
});

test("potential formatting truncates without rounding up and handles floating point noise", () => {
  assert.equal(formatRating(12.99999), "12.9999");
  assert.equal(formatRating(12.99999, 2), "12.99");
  assert.equal(formatRating(0.3 - 0.1), "0.2000");
});

test("grades change at the exact score thresholds", () => {
  for (const [score, expected] of [
    [9_900_000, "EX+"],
    [9_899_999, "EX"],
    [9_800_000, "EX"],
    [9_799_999, "AA"],
    [9_500_000, "AA"],
    [9_200_000, "A"],
    [8_900_000, "B"],
    [8_600_000, "C"],
    [8_599_999, "D"],
  ] as const) {
    assert.equal(grade(score), expected);
  }
});

test("demo has 50 distinct charts, consistent judgments and a local jacket for each", async () => {
  const demo = JSON.parse(
    await readFile(new URL("../src/data/demo.json", import.meta.url), "utf8"),
  );
  assert.equal(demo.scores.length, 50);
  assert.equal(
    new Set(
      demo.scores.map(
        (s: { id: string; difficulty: string }) => `${s.id}:${s.difficulty}`,
      ),
    ).size,
    50,
  );
  await Promise.all(
    demo.scores.map(
      async (s: {
        pure: number;
        far: number;
        lost: number;
        shiny: number;
        score: number;
        jacket: string;
      }) => {
        const notes = s.pure + s.far + s.lost;
        assert.equal(
          Math.floor((10_000_000 * (s.pure + s.far / 2)) / notes) + s.shiny,
          s.score,
        );
        assert.ok(s.shiny <= s.pure);
        await access(new URL(`../public/${s.jacket}`, import.meta.url));
      },
    ),
  );
});
