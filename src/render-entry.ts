import "./style.css";
import "./workflow.css";
import "./compact.css";
import "./profile.css";
import { parseArchive } from "./archive";
import { renderArchiveMarkup } from "./render-panel";
import { exportB50 } from "./export";
import { isExportWidth } from "./export-options";

interface RenderOptions {
  width: number;
  theme: "dark" | "light";
}
interface RenderResult {
  png: string;
  width: number;
  height: number;
  missingImages: number;
}
declare global {
  interface Window {
    renderB50: (
      archive: unknown,
      options: RenderOptions,
    ) => Promise<RenderResult>;
  }
}

let rendering = false;
window.renderB50 = async (input, options) => {
  if (rendering) throw new Error("当前渲染尚未完成。");
  if (
    !isExportWidth(options.width) ||
    !["dark", "light"].includes(options.theme)
  )
    throw new Error("图片宽度或主题无效。");
  rendering = true;
  try {
    const archive = parseArchive(input);
    document.documentElement.dataset.theme = options.theme;
    document.querySelector("#app")!.innerHTML = renderArchiveMarkup(archive);
    const result = await exportB50(
      document.querySelector<HTMLElement>(".page-shell")!,
      options.width,
      () => {},
    );
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("无法读取生成的 PNG。"));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(result.blob);
    });
    return {
      png: dataUrl.slice(dataUrl.indexOf(",") + 1),
      width: result.width,
      height: result.height,
      missingImages: result.missingImages,
    };
  } finally {
    rendering = false;
  }
};
