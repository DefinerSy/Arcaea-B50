#!/usr/bin/env node
import {
  readFile,
  writeFile,
  stat,
  mkdir,
  mkdtemp,
  rm,
  copyFile,
  rename,
} from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { HELP, parseCliOptions } from "./lib/cli-options.mjs";
import { serveBuild } from "./lib/static-server.mjs";
import { readArchive } from "../src/read-archive.ts";
import { parseArchive, MAX_ARCHIVE_BYTES } from "../src/archive.ts";
import { getBest50 } from "../src/rating.ts";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
async function existingStat(path) {
  try {
    return await stat(path);
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

async function launchBrowser(chromium, explicit) {
  if (explicit)
    return chromium.launch({
      executablePath: explicit,
      headless: true,
      timeout: 20000,
    });
  const choices = [{}, { channel: "chrome" }, { channel: "msedge" }];
  for (const choice of choices) {
    try {
      return await chromium.launch({
        ...choice,
        headless: true,
        timeout: 20000,
      });
    } catch {
      /* Try another installed browser. */
    }
  }
  throw new Error(
    "没有找到可用的无头浏览器。请运行 npx playwright install chromium，或用 --browser 指定 Chrome / Edge 可执行文件。",
  );
}

async function run(options) {
  const inputStat = await stat(options.input);
  if (!inputStat.isFile()) throw new Error("输入路径不是文件。");
  if (inputStat.size > MAX_ARCHIVE_BYTES) throw new Error("存档超过 32 MB。");
  const outputStat = await existingStat(options.output);
  if (outputStat) {
    if (inputStat.ino === outputStat.ino && inputStat.dev === outputStat.dev)
      throw new Error("不能覆盖输入存档。");
    if (!options.force)
      throw new Error("输出文件已存在。使用不同路径，或加 --force 覆盖。");
    if (!outputStat.isFile()) throw new Error("输出路径不是普通文件。");
  }
  const bytes = new Uint8Array(await readFile(options.input));
  const catalog = JSON.parse(
    await readFile(join(projectRoot, "src/data/catalog.json"), "utf8"),
  );
  const parsed = await readArchive(
    bytes,
    async () => {
      const { default: init } = await import("sql.js");
      return init();
    },
    catalog,
  );
  const archive = parsed.archive;
  if (options.name !== undefined)
    archive.player.name = options.name.trim() || "Player";
  if (options.id !== undefined) archive.player.id = options.id.trim();
  if (options.character) {
    archive.player.character = options.character;
    delete archive.player.characterImage;
  }
  const validated = parseArchive(archive);
  const warnings = [...(validated.source?.warnings ?? [])];
  const count = getBest50(validated.scores).best.length;
  if (count < 50) warnings.push(`仅有 ${count} 首有效成绩，将按实际数量导出。`);

  let browser,
    server,
    workspace,
    temporaryOutput,
    timer,
    cancelled = false,
    timedOut = false;
  const cancel = () => {
    cancelled = true;
    void browser?.close().catch(() => {});
  };
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  try {
    const [{ build }, { chromium }] = await Promise.all([
      import("vite"),
      import("playwright"),
    ]);
    workspace = await mkdtemp(join(tmpdir(), "arcaea-b50-"));
    const outputDir = join(workspace, "dist");
    await build({
      root: projectRoot,
      configFile: join(projectRoot, "vite.config.ts"),
      logLevel: "silent",
      build: { outDir: outputDir, emptyOutDir: true },
    });
    if (cancelled) throw new Error("操作已取消。");
    const served = await serveBuild(outputDir);
    server = served.server;
    browser = await launchBrowser(
      chromium,
      options.browser ?? process.env.B50_BROWSER_PATH,
    );
    if (cancelled) throw new Error("操作已取消。");
    timer = setTimeout(() => {
      timedOut = true;
      void browser.close().catch(() => {});
    }, options.timeout);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
      locale: "zh-CN",
      reducedMotion: "reduce",
    });
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === served.url
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage();
    await page.goto(`${served.url}/render.html`, {
      waitUntil: "load",
      timeout: 30000,
    });
    await page.waitForFunction(() => typeof window.renderB50 === "function");
    const result = await page.evaluate(
      ({ archive, options }) => window.renderB50(archive, options),
      {
        archive: validated,
        options: { width: options.width, theme: options.theme },
      },
    );
    clearTimeout(timer);
    if (cancelled) throw new Error("操作已取消。");
    const png = Buffer.from(result.png, "base64");
    if (
      png.length < 24 ||
      !png
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      png.readUInt32BE(16) !== options.width ||
      png.readUInt32BE(20) !== result.height
    )
      throw new Error("渲染结果不是预期尺寸的 PNG。");
    if (result.missingImages)
      warnings.push(`${result.missingImages} 张图片缺失，已使用占位图。`);
    await mkdir(dirname(options.output), { recursive: true });
    temporaryOutput = join(dirname(options.output), `.b50-${randomUUID()}.tmp`);
    await writeFile(temporaryOutput, png, { flag: "wx" });
    if (options.force) await rename(temporaryOutput, options.output);
    else
      await copyFile(temporaryOutput, options.output, constants.COPYFILE_EXCL);
    return {
      output: options.output,
      width: result.width,
      height: result.height,
      bytes: png.length,
      scores: count,
      skipped: validated.source?.skipped ?? 0,
      missingImages: result.missingImages,
      warnings,
    };
  } catch (error) {
    if (cancelled) {
      const aborted = new Error("操作已取消。");
      aborted.exitCode = 130;
      throw aborted;
    }
    if (timedOut)
      throw new Error("图片渲染超时；可降低 --width 或增加 --timeout。");
    throw error;
  } finally {
    clearTimeout(timer);
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
    if (browser) await browser.close().catch(() => {});
    if (server) {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    }
    if (temporaryOutput) await rm(temporaryOutput, { force: true });
    // Only remove the exact private temporary directory created by this invocation.
    if (
      workspace &&
      dirname(resolve(workspace)) === resolve(tmpdir()) &&
      basename(workspace).startsWith("arcaea-b50-")
    )
      await rm(workspace, { recursive: true, force: true });
  }
}

try {
  const options = parseCliOptions(process.argv.slice(2));
  if (options.help) process.stdout.write(HELP);
  else {
    const result = await run(options);
    for (const warning of result.warnings)
      process.stderr.write(`提示：${warning}\n`);
    process.stdout.write(
      options.json
        ? `${JSON.stringify(result)}\n`
        : `已生成：${result.output}\n${result.width} × ${result.height} px · ${result.scores} 首 · PNG\n`,
    );
  }
} catch (error) {
  process.stderr.write(
    `B50：${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = error.exitCode ?? 1;
}
