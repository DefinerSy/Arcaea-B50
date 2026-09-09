import { parseArgs } from "node:util";
import { resolve, basename, dirname, extname } from "node:path";
import {
  DEFAULT_EXPORT_WIDTH,
  isExportWidth,
} from "../../src/export-options.ts";

export const HELP = `Arcaea B50 — 从存档直接生成 PNG（无需网页操作）

用法：npm run b50 -- <存档路径> [选项]
      node --experimental-strip-types scripts/b50.mjs <存档路径> [选项]

  -i, --input <文件>        st3 或本工具格式的 JSON；也可使用位置参数
  -o, --output <文件.png>   输出路径；默认与存档同目录的 <名称>.b50.png
  --name <名称>            玩家名；JSON 默认沿用存档，st3 默认 Player
  --id <好友码>            覆盖好友码；传空字符串可隐藏
  --character <ID>         覆盖角色，如 0 或 34u（u 表示觉醒）
  --width <像素>           720 / 1080 / 1440 / 2160 / 2880 / 3840，默认 2880
  --theme <主题>           dark / light，默认 dark
  --browser <可执行文件>   指定 Chrome / Chromium / Edge 路径
  --timeout <秒>           渲染超时，默认 90（10–600）
  --force                 覆盖已有输出文件；默认遇到重名时报错
  --json                  在 stdout 输出 JSON 结果，方便脚本调用
  -h, --help              显示帮助

首次使用：npm ci
如果没有可用浏览器：npx playwright install chromium
Linux CI 首次安装可使用：npx playwright install --with-deps chromium
`;

export class UsageError extends Error {
  exitCode = 2;
}
export function parseCliOptions(argv, cwd = process.cwd()) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        input: { type: "string", short: "i" },
        output: { type: "string", short: "o" },
        name: { type: "string" },
        id: { type: "string" },
        character: { type: "string" },
        width: { type: "string" },
        theme: { type: "string" },
        browser: { type: "string" },
        timeout: { type: "string" },
        force: { type: "boolean" },
        json: { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (error) {
    throw new UsageError(error.message);
  }
  const { values, positionals } = parsed;
  if (values.help) return { help: true };
  if (
    positionals.length > 1 ||
    (values.input !== undefined && positionals.length)
  )
    throw new UsageError("请只传入一个存档文件。");
  const source = values.input ?? positionals[0];
  if (!source) throw new UsageError("缺少存档路径。使用 --help 查看示例。");
  const input = resolve(cwd, source);
  const output = resolve(
    cwd,
    values.output ??
      resolve(dirname(input), `${basename(input, extname(input))}.b50.png`),
  );
  if (!output.toLowerCase().endsWith(".png"))
    throw new UsageError("输出路径必须以 .png 结尾。");
  if (input === output) throw new UsageError("输出路径不能与输入存档相同。");
  const width = Number(values.width ?? DEFAULT_EXPORT_WIDTH);
  if (!isExportWidth(width))
    throw new UsageError("宽度必须是 720、1080、1440、2160、2880 或 3840。");
  const theme = values.theme ?? "dark";
  if (!["dark", "light"].includes(theme))
    throw new UsageError("主题必须是 dark 或 light。");
  const timeout = Number(values.timeout ?? 90);
  if (!Number.isInteger(timeout) || timeout < 10 || timeout > 600)
    throw new UsageError("超时必须是 10–600 秒之间的整数。");
  for (const [key, max] of [
    ["name", 32],
    ["id", 32],
  ])
    if (values[key] !== undefined && values[key].length > max)
      throw new UsageError(`${key} 不得超过 ${max} 个字符。`);
  let character;
  if (values.character !== undefined) {
    if (!/^\d+u?$/.test(values.character) || parseInt(values.character) > 10000)
      throw new UsageError("角色应为非负整数 ID，可加 u 表示觉醒，如 34u。");
    character = {
      id: parseInt(values.character),
      awakened: values.character.endsWith("u"),
    };
  }
  return {
    input,
    output,
    width,
    theme,
    timeout: timeout * 1000,
    name: values.name,
    id: values.id,
    character,
    browser: values.browser ? resolve(cwd, values.browser) : undefined,
    force: values.force ?? false,
    json: values.json ?? false,
  };
}
