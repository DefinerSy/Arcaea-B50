import { exportDimensions } from "./export-options";
import type { ExportWidth } from "./export-options";

export interface ExportResult {
  blob: Blob;
  width: number;
  height: number;
  missingImages: number;
}

/** Render inside a desktop-width document so phone media queries cannot change the PNG. */
export async function exportB50(
  panel: HTMLElement,
  outputWidth: ExportWidth,
  progress: (message: string) => void,
): Promise<ExportResult> {
  progress("正在准备高清画布与字体…");
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText =
    "position:fixed;left:-100000px;top:0;width:1440px;height:1000px;border:0;pointer-events:none;";
  document.body.append(frame);
  try {
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(
      '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"></head><body></body></html>',
    );
    doc.close();
    doc.documentElement.dataset.theme =
      document.documentElement.dataset.theme ?? "dark";
    const base = doc.createElement("base");
    base.href = document.baseURI;
    doc.head.append(base);
    const styles = [
      ...document.querySelectorAll<HTMLStyleElement | HTMLLinkElement>(
        'style,link[rel="stylesheet"]',
      ),
    ];
    await Promise.all(
      styles.map(
        (style) =>
          new Promise<void>((resolve, reject) => {
            const copy = style.cloneNode(true) as
              HTMLStyleElement | HTMLLinkElement;
            if (style instanceof HTMLLinkElement) {
              const timer = window.setTimeout(
                () => reject(new Error("样式加载超时，请重试。")),
                20_000,
              );
              copy.onload = () => {
                clearTimeout(timer);
                resolve();
              };
              copy.onerror = () => {
                clearTimeout(timer);
                reject(new Error("无法加载导出样式，请刷新后重试。"));
              };
            }
            doc.head.append(copy);
            if (style instanceof HTMLStyleElement) resolve();
          }),
      ),
    );
    const clone = panel.cloneNode(true) as HTMLElement;
    clone.classList.add("export-panel");
    // Remove screen-only panels before measuring, so their space is not exported.
    clone
      .querySelectorAll("[data-export-exclude]")
      .forEach((node) => node.remove());
    clone.style.setProperty("padding-bottom", "20px", "important");
    doc.body.append(clone);
    // Transfer theme variables to the captured root as SVG descendants also use them.
    const rootStyle = frame.contentWindow!.getComputedStyle(
      doc.documentElement,
    );
    for (let i = 0; i < rootStyle.length; i++) {
      const key = rootStyle[i];
      if (key.startsWith("--"))
        clone.style.setProperty(key, rootStyle.getPropertyValue(key));
    }
    clone.style.backgroundColor = rootStyle.backgroundColor;
    clone.style.width = "1440px";
    clone.style.maxWidth = "none";
    let missingImages = 0;
    progress("正在加载全部曲绘…");
    const work = Promise.all(
      [...clone.querySelectorAll("img")].map(async (img) => {
        img.loading = "eager";
        try {
          await img.decode();
        } catch {
          missingImages++;
          img.src = new URL(
            `${import.meta.env.BASE_URL}assets/jacket-fallback.svg`,
            document.baseURI,
          ).href;
          await img.decode();
        }
      }),
    );
    let timeout = 0;
    try {
      await Promise.race([
        Promise.all([work, doc.fonts.ready]),
        new Promise<never>((_, reject) => {
          timeout = window.setTimeout(
            () => reject(new Error("曲绘或字体加载超时，请重试。")),
            25_000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const height = Math.ceil(clone.getBoundingClientRect().height);
    const dimensions = exportDimensions(height, outputWidth);
    progress(`正在生成 ${dimensions.width} × ${dimensions.height} PNG…`);
    const { toCanvas } = await import("html-to-image");
    const canvas = await toCanvas(clone, {
      width: 1440,
      height,
      canvasWidth: dimensions.width,
      canvasHeight: dimensions.height,
      pixelRatio: 1,
      backgroundColor: rootStyle.backgroundColor,
      skipAutoScale: true,
    });
    if (
      canvas.width !== dimensions.width ||
      canvas.height !== dimensions.height
    )
      throw new Error("图片尺寸异常，请选择较小的分辨率重试。");
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error("图片生成失败，请选择较小的分辨率重试。")),
        "image/png",
      ),
    );
    const result = {
      blob,
      width: canvas.width,
      height: canvas.height,
      missingImages,
    };
    canvas.width = canvas.height = 1;
    return result;
  } finally {
    frame.remove();
  }
}
