export const EXPORT_OPTIONS = [
  { width: 720, label: "轻量 · 720 px" },
  { width: 1080, label: "分享 · 1080 px" },
  { width: 1440, label: "标准 · 1440 px" },
  { width: 2160, label: "精细 · 2160 px" },
  { width: 2880, label: "高清 · 2880 px" },
  { width: 3840, label: "超清 · 3840 px" },
] as const;

export type ExportWidth = (typeof EXPORT_OPTIONS)[number]["width"];
export const DEFAULT_EXPORT_WIDTH: ExportWidth = 2880;
export const EXPORT_LAYOUT_WIDTH = 1440;

export function isExportWidth(value: number): value is ExportWidth {
  return EXPORT_OPTIONS.some((option) => option.width === value);
}

export function exportDimensions(layoutHeight: number, width: ExportWidth) {
  if (
    !isExportWidth(width) ||
    !Number.isFinite(layoutHeight) ||
    layoutHeight <= 0
  ) {
    throw new RangeError("请选择有效的图片尺寸。");
  }
  return {
    width,
    height: Math.max(
      1,
      Math.round((layoutHeight * width) / EXPORT_LAYOUT_WIDTH),
    ),
  };
}
