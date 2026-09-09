import { MAX_ARCHIVE_BYTES, exportFilename, parseArchive } from "./archive";
import type { Archive } from "./archive";
import characterAssets from "./data/characters.json";
import {
  EXPORT_OPTIONS,
  DEFAULT_EXPORT_WIDTH,
  isExportWidth,
} from "./export-options";

export function mountWorkflow(
  getArchive: () => Archive,
  applyArchive: (archive: Archive) => void,
) {
  const host = document.createElement("section");
  host.className = "workflow";
  host.setAttribute("aria-label", "存档生成 B50 图片");
  host.innerHTML = `
    <div class="workflow-top"><div><span class="workflow-kicker">YOUR SAVE, YOUR MEMORIES</span><h2>将记忆，定格为 B50。</h2><p>导入存档 → 预览成绩 → 保存高清图片 · 所有文件仅在本地处理</p></div>
      <div class="workflow-actions"><button id="import-button" class="action-button">↥ 导入存档</button><button id="export-button" class="action-button primary">↓ 导出 B50 图片</button></div></div>
    <input type="file" id="archive-input" hidden aria-label="选择 st3 或 JSON 存档">
    <div class="workflow-options"><label>玩家名称<input id="player-name" maxlength="32" placeholder="输入玩家名称"></label><label>好友码（可选）<input id="player-id" maxlength="32" placeholder="可留空隐藏"></label><label>图片宽度<select id="export-scale" title="图片高度按 B50 内容等比计算">${EXPORT_OPTIONS.map((option) => `<option value="${option.width}" ${option.width === DEFAULT_EXPORT_WIDTH ? "selected" : ""}>${option.label}</option>`).join("")}</select></label><button id="save-archive" class="text-button">保存成绩存档</button></div>
    <div class="character-controls"><span class="character-label" id="character-label"></span><select id="character-select" aria-label="选择 玩家背景 角色"><option value="">存档未提供角色</option>${Object.keys(
      characterAssets,
    )
      .filter((key) => /^\d+u?$/.test(key))
      .sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b))
      .map(
        (key) =>
          `<option value="${key}">${key === "0" ? "光" : key === "1" ? "对立" : `角色 #${parseInt(key)}`}${key.endsWith("u") ? " · 觉醒" : ""}</option>`,
      )
      .join(
        "",
      )}</select><button class="text-button" id="character-upload">补充角色图片</button><button class="text-button" id="character-reset">恢复角色默认图</button><input type="file" id="character-file" accept="image/png,image/jpeg,image/webp" aria-label="选择角色图片" hidden></div>
    <div id="workflow-status" class="workflow-status" role="status" aria-live="polite">支持 Arcaea 的 st3 数据库和本工具的 JSON 存档。</div>`;
  document.querySelector(".site-header")!.after(host);
  const dialog = document.createElement("dialog");
  dialog.className = "export-dialog";
  dialog.setAttribute("aria-labelledby", "export-title");
  dialog.innerHTML = `<div class="export-dialog-head"><div><h2 id="export-title">B50 图片已生成</h2><p id="export-info"></p></div><button id="close-export" aria-label="关闭图片预览">×</button></div><div class="export-image-scroll"><img id="export-preview" alt="生成的完整 B50 成绩图片"></div><div class="export-dialog-actions"><span>手机可长按图片保存；也可以点击下载。</span><a id="download-image" class="action-button primary">↓ 保存 PNG 图片</a></div>`;
  document.body.append(dialog);
  const $ = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const nameInput = $<HTMLInputElement>("player-name"),
    idInput = $<HTMLInputElement>("player-id");
  const fileInput = $<HTMLInputElement>("archive-input");
  nameInput.value = getArchive().player.name;
  idInput.value = getArchive().player.id;
  const resolutionSelect = $<HTMLSelectElement>("export-scale");
  try {
    const saved = Number(localStorage.getItem("arcaea-export-width"));
    if (isExportWidth(saved)) resolutionSelect.value = String(saved);
  } catch {
    /* Storage may be disabled. */
  }
  resolutionSelect.addEventListener("change", () => {
    const width = Number(resolutionSelect.value);
    if (isExportWidth(width))
      try {
        localStorage.setItem("arcaea-export-width", String(width));
      } catch {
        /* Optional preference only. */
      }
  });
  let busy = false,
    imageUrl = "";
  const status = (message: string, error = false) => {
    const el = $("workflow-status");
    el.textContent = message;
    el.classList.toggle("error", error);
    el.setAttribute("role", error ? "alert" : "status");
  };
  const lock = (value: boolean) => {
    busy = value;
    host.setAttribute("aria-busy", String(value));
    document
      .querySelectorAll<
        HTMLButtonElement | HTMLInputElement | HTMLSelectElement
      >(
        ".workflow button,.workflow input,.workflow select,.theme-switch button",
      )
      .forEach((el) => (el.disabled = value));
    if (!value) refreshCharacter();
  };
  const refreshCharacter = () => {
    const p = getArchive().player;
    const key = p.character
      ? `${p.character.id}${p.character.awakened ? "u" : ""}`
      : "";
    const available =
      (characterAssets as Record<string, string>)[key] ??
      (p.character
        ? (characterAssets as Record<string, string>)[String(p.character.id)]
        : undefined);
    $<HTMLSelectElement>("character-select").value = key;
    $("character-label").textContent = p.characterImage
      ? "玩家背景：存档中的角色图片"
      : available
        ? `玩家背景：角色 #${p.character!.id}${p.character!.awakened ? (Object.hasOwn(characterAssets, key) ? " · 觉醒" : " · 觉醒图未收录，暂用普通图") : ""}`
        : p.character
          ? "角色图片暂未收录，请补充图片。"
          : "存档未提供选中角色，可手动补充。";
    $<HTMLButtonElement>("character-reset").disabled = !p.characterImage;
  };
  refreshCharacter();
  $("character-select").addEventListener("change", () => {
    const key = $<HTMLSelectElement>("character-select").value;
    const { characterImage: _, character: __, ...player } = getArchive().player;
    applyArchive({
      ...getArchive(),
      player: {
        ...player,
        ...(key
          ? { character: { id: parseInt(key), awakened: key.endsWith("u") } }
          : {}),
      },
    });
    refreshCharacter();
    status("角色已更新，玩家背景 和导出图片会同步使用。");
  });
  $("character-reset").addEventListener("click", () => {
    const { characterImage: _, ...player } = getArchive().player;
    applyArchive({ ...getArchive(), player });
    refreshCharacter();
    status("已恢复当前角色的默认图片。");
  });
  const characterFile = $<HTMLInputElement>("character-file");
  $("character-upload").addEventListener("click", () => characterFile.click());
  characterFile.addEventListener("change", async () => {
    const file = characterFile.files?.[0];
    characterFile.value = "";
    if (!file || busy) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 8 * 1024 * 1024
    ) {
      status("请选择不超过 8 MB 的 PNG、JPEG 或 WebP 角色图片。", true);
      return;
    }
    lock(true);
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const ratio = Math.min(
        1,
        1000 / Math.max(img.naturalWidth, img.naturalHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * ratio);
      canvas.height = Math.round(img.naturalHeight * ratio);
      canvas
        .getContext("2d")!
        .drawImage(img, 0, 0, canvas.width, canvas.height);
      const characterImage = canvas.toDataURL("image/webp", 0.9);
      const next = parseArchive({
        ...getArchive(),
        player: { ...getArchive().player, characterImage },
      });
      applyArchive(next);
      status("角色图片已应用，也会保存在 JSON 成绩存档中。");
    } catch {
      status("角色图片无法读取，请换一张图片重试。", true);
    } finally {
      URL.revokeObjectURL(url);
      lock(false);
      refreshCharacter();
    }
  });
  const updatePlayer = () =>
    applyArchive({
      ...getArchive(),
      player: {
        ...getArchive().player,
        name: nameInput.value.trim() || "Player",
        id: idInput.value.trim(),
      },
    });
  nameInput.addEventListener("input", updatePlayer);
  idInput.addEventListener("input", updatePlayer);
  $("import-button").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file || busy) return;
    fileInput.value = "";
    if (file.size > MAX_ARCHIVE_BYTES) {
      status("文件超过 32 MB，请选择 st3 或 JSON 成绩存档。", true);
      return;
    }
    if (!file.size) {
      status("所选文件为空，请重新选择。", true);
      return;
    }
    lock(true);
    status(`正在本地读取 ${file.name}…`);
    let worker: Worker | undefined;
    let timer = 0;
    try {
      const bytes = await file.arrayBuffer();
      worker = new Worker(new URL("./import.worker.ts", import.meta.url), {
        type: "module",
      });
      const result = await new Promise<{ archive: Archive; isSt3: boolean }>(
        (resolve, reject) => {
          timer = window.setTimeout(
            () => reject(new Error("存档读取超时，请检查文件后重试。")),
            45_000,
          );
          worker!.onmessage = (event) =>
            event.data.ok
              ? resolve(event.data)
              : reject(new Error(event.data.error));
          worker!.onerror = () =>
            reject(new Error("存档解析器加载失败，请刷新页面后重试。"));
          worker!.postMessage(bytes, [bytes]);
        },
      );
      const archive = parseArchive(result.archive);
      if (result.isSt3)
        archive.player = {
          ...archive.player,
          name: nameInput.value.trim() || "Player",
          id: idInput.value.trim(),
        };
      archive.source = {
        ...archive.source,
        name: file.name,
        skipped: archive.source?.skipped ?? 0,
        warnings: archive.source?.warnings ?? [],
      };
      applyArchive(archive);
      nameInput.value = archive.player.name;
      idInput.value = archive.player.id;
      refreshCharacter();
      const count = new Set(
        archive.scores.map((s) => `${s.id}:${s.difficulty}`),
      ).size;
      status(
        `已读取 ${file.name}：${count} 张谱面，展示前 ${Math.min(50, count)} 首。${count < 50 ? "不足 50 首，按实际成绩导出，缺失位置按零计算平均。" : ""}${archive.source.warnings.join(" ")}${result.isSt3 ? " st3 不含玩家资料，可在上方填写。" : ""}`,
      );
    } catch (error) {
      status(
        `${error instanceof Error ? error.message : "读取失败。"} 原有成绩已保留。`,
        true,
      );
    } finally {
      clearTimeout(timer);
      worker?.terminate();
      lock(false);
    }
  });
  $("export-button").addEventListener("click", async () => {
    if (busy) return;
    updatePlayer();
    lock(true);
    const button = $("export-button");
    button.textContent = "正在生成…";
    try {
      const { exportB50 } = await import("./export");
      const width = Number(resolutionSelect.value);
      if (!isExportWidth(width)) throw new Error("请选择有效的图片分辨率。");
      const result = await exportB50(
        document.querySelector<HTMLElement>(".page-shell")!,
        width,
        status,
      );
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      imageUrl = URL.createObjectURL(result.blob);
      const archive = getArchive();
      $<HTMLImageElement>("export-preview").src = imageUrl;
      const link = $<HTMLAnchorElement>("download-image");
      link.href = imageUrl;
      link.download = exportFilename(
        archive.player.name,
        archive.recordedAt,
      ).replace(/\.png$/, `_${result.width}px.png`);
      $("export-info").textContent =
        `${result.width} × ${result.height} px · PNG · ${(result.blob.size / 1024 / 1024).toFixed(1)} MB${result.missingImages ? ` · ${result.missingImages} 张缺失曲绘已使用占位图` : ""}`;
      dialog.showModal();
      status(
        `B50 图片已生成。${result.missingImages ? "部分曲绘缺失，已使用占位图。" : ""}请在预览中保存 PNG。`,
      );
    } catch (error) {
      status(
        `导出失败：${error instanceof Error ? error.message : "请重试。"} 可选择较小的图片宽度后再试。`,
        true,
      );
    } finally {
      lock(false);
      button.textContent = "↓ 导出 B50 图片";
    }
  });
  $("close-export").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  $("save-archive").addEventListener("click", () => {
    updatePlayer();
    const archive = getArchive();
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(archive, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFilename(
      archive.player.name,
      archive.recordedAt,
    ).replace(/\.png$/, ".json");
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    status("已下载 JSON 成绩存档，下次导入即可恢复玩家资料和成绩。");
  });
  window.addEventListener("beforeunload", () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  });
}
