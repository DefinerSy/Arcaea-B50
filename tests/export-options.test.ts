import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EXPORT_OPTIONS,
  DEFAULT_EXPORT_WIDTH,
  isExportWidth,
  exportDimensions,
} from "../src/export-options.ts";
import type { ExportWidth } from "../src/export-options.ts";

test("all six widths preserve aspect ratio with exact integer PNG dimensions", () => {
  assert.deepEqual(
    EXPORT_OPTIONS.map((option) => option.width),
    [720, 1080, 1440, 2160, 2880, 3840],
  );
  assert.equal(DEFAULT_EXPORT_WIDTH, 2880);
  const expected = [772, 1157, 1543, 2315, 3086, 4115];
  EXPORT_OPTIONS.forEach((option, i) => {
    const dimensions = exportDimensions(1543, option.width);
    assert.equal(dimensions.width, option.width);
    assert.equal(dimensions.height, expected[i]);
    assert.ok(Number.isInteger(dimensions.height));
    assert.ok(
      Math.abs(dimensions.height - (1543 * option.width) / 1440) <= 0.5,
    );
  });
});
test("unsupported widths and invalid heights are rejected before rendering", () => {
  for (const width of [0, 1, 2, 900, Infinity, NaN]) {
    assert.equal(isExportWidth(width), false);
    assert.throws(
      () => exportDimensions(1543, width as ExportWidth),
      RangeError,
    );
  }
  for (const height of [0, -1, NaN, Infinity])
    assert.throws(() => exportDimensions(height, 1440), RangeError);
});
