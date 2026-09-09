# Arcaea · Memory Archive

从 Arcaea 存档生成 Best 50 高清图片的纯前端工具。参考 [SmartRTE/SmartRTE.github.io](https://github.com/SmartRTE/SmartRTE.github.io) 的成绩字段与计算方式，重新设计并独立实现展示层。

使用 **Vite + TypeScript + 原生 CSS**，没有前端框架运行时。`sql.js` 在 Web Worker 内读取 SQLite，解析器仅在导入时加载；`html-to-image` 在导出时按需加载。所有存档处理、计算与图片生成均在本地进行，不上传文件。图片、字体、曲目表和 WASM 均来自本站。

在线使用：<https://definersy.github.io/Arcaea-B50/>

## 非交互式：存档直接输出 PNG

在项目目录安装依赖后即可使用，无需先启动网页服务，也无需手动执行 `npm run build`：

```sh
npm ci
npm run b50 -- ./st3 -o ./b50.png
```

指定玩家资料、分辨率和主题：

```sh
npm run b50 -- ./st3 -o ./output/b50.png --name "Hikari" --id "100000001" --width 2160 --theme dark
npm run b50 -- ./archive.json -o ./output/b50-light.png --width 3840 --theme light
```

参数说明：

- 输入可以是位置参数或 `--input` / `-i`，支持 st3 与本工具格式的 JSON。
- `--output` / `-o` 指定 PNG 路径；省略时输出到存档同目录的 `<存档名>.b50.png`。父目录不存在时自动创建。
- `--name`、`--id` 覆盖玩家资料；JSON 默认使用存档资料，st3 默认名称为 `Player`。`--id ""` 隐藏好友码。
- `--character 0` 选择普通角色，`--character 34u` 选择觉醒角色；省略时沿用存档的角色信息和图片。
- `--width` 支持 720 / 1080 / 1440 / 2160 / 2880 / 3840，默认 2880；高度等比计算。
- `--theme dark` 或 `--theme light`，默认 dark。命令行不读取网页的主题/分辨率偏好，参数可重复复现。
- 默认不覆盖已有图片；需要覆盖时加 `--force`。输入存档始终不会被覆盖。
- `--timeout 90` 设置渲染超时秒数（10–600），默认 90。
- `--help` 显示完整用法。

命令行通过 Playwright 在本地无头 Chromium 中渲染，**不会弹出浏览器窗口或点击网页按钮**。优先使用 Playwright 已安装的 Chromium，其次尝试系统 Chrome / Edge。没有可用浏览器时，只需首次运行：

```sh
npx playwright install chromium
```

Linux CI 可使用 `npx playwright install --with-deps chromium` 同时安装所需系统库；也可通过 `--browser "/path/to/chrome"` 或 `B50_BROWSER_PATH` 指定现有浏览器。

工具为每次调用准备独立临时构建和随机本机端口，与正在使用的网页预览互不影响；渲染后自动关闭浏览器、服务并清理临时文件。命令行与网页共享解析、B50 排序、角色、模板和 PNG 导出逻辑，保持五列布局、不带底部两栏。

### 脚本调用

需要机器可读输出时使用 `--json`。下面的 `--silent` 用于去掉 npm 自己的脚本前缀：

```sh
npm run --silent b50 -- ./st3 -o ./b50.png --width 1440 --json
```

成功时 stdout 为单行 JSON，包含 `output`（绝对路径）、`width`、`height`、`bytes`、`scores`、`skipped`、`missingImages` 和 `warnings`。未知谱面或缺失曲绘的提示写入 stderr，不污染 JSON。退出码：成功为 `0`，文件/解析/渲染失败为 `1`，参数错误为 `2`，运行中取消为 `130`；不会停下来询问或等待确认。

也可从任意目录直接调用（输入、输出相对当前目录解释）：

```sh
node --experimental-strip-types /path/to/Arcaea-B50/scripts/b50.mjs ./st3 -o ./b50.png --json
```

## 从存档生成图片

1. 点击「导入存档」，选择 Arcaea 的 `st3` 数据库文件（通常没有扩展名），或本工具保存的 JSON 成绩存档。
2. 填写玩家名称和好友码。st3 本身不提供这些玩家资料，好友码留空即可隐藏。
3. 查看 B50 预览，选择「光 / 对立」主题和图片宽度。
4. 点击「导出 B50 图片」，生成完整五列 PNG 长图；在预览中点击「保存 PNG 图片」，手机也可以长按保存。

图片宽度提供 **720 / 1080 / 1440 / 2160 / 2880 / 3840 px** 六档，默认 2880 px，并记住上次选择。高度按内容等比计算并取整，生成后显示完整尺寸和文件大小；PNG 文件名包含宽度，便于区分。手机屏幕的两列展示不会影响导出的五列布局。图片包含紧凑的玩家信息、潜力值与全部 B50 成绩，不包含工具按钮、底部说明栏或署名日期栏。两栏仍保留在网页上，导出时直接从独立画布移除，不留下空白。

「保存成绩存档」下载 JSON，保留玩家资料、全部已识别成绩与导入警告，下次可直接导入。页面不会自动持久化原始存档；关闭前请按需保存 JSON。预置成绩也可以直接试导出，页面和图片不显示演示标识。

存档支持说明：

- `st3`：需要解包后的 SQLite 数据库，不是 APK、ZIP 或加密备份。读取 `scores` 表，按曲目 ID 和难度关联本地定数、标题与曲绘。
- JSON：使用下文格式，或使用本工具的「保存成绩存档」生成。不会任意请求 JSON 中的外部素材 URL。
- 文件上限 32 MB、成绩上限 20000 条。无效文件不会替换已读取的成绩。
- 少于 50 首时导出实际记录数，不伪造缺失成绩；缺失位置按零计入平均。
- 无法匹配定数或无效的记录会跳过，网页提供具体说明，导出图顶部标记「部分成绩」。当前本地曲目表为参考项目版本 **7.0.255 / 2026-09-08**（1830 张谱面），不保证覆盖更新版本。
- 内存较少的手机若无法生成高分辨率图片，可改用 720 / 1080 / 1440 px 重试。已在 Chromium 中验证桌面和手机宽度的导出；移动 Safari 未实机测试。

## 运行

需要 Node.js 22.18+ 或 Node.js 24 LTS。

```sh
npm ci
npm run dev
```

打开终端给出的本地地址（默认 `http://127.0.0.1:5173`）。

```sh
npm test          # 验证公式、JSON、SQLite 存档、去重与数据校验
npm run test:cli  # 真实命令行/无头浏览器测试，需要可用的 Chromium、Chrome 或 Edge
npm run build    # TypeScript 检查并生成 dist/
npm run preview  # 预览生产构建
```

将 `dist/` 部署到任意静态服务器即可；相对资源路径支持 GitHub Pages 子目录部署。推送到 `main` 后，GitHub Actions 会自动构建并更新在线页面。请通过 HTTP 预览，不要直接双击 HTML。

## 已实现

- 光 / 对立双主题，主题偏好保存在本地。
- st3 / JSON 存档导入、玩家信息填写、JSON 存档保存与高清 PNG 导出。
- 非交互式命令行：传入存档直接写入 PNG，支持六档分辨率、双主题和机器可读结果。
- 切角、斜向分区的紧凑玩家信息条：存档角色作为背景，集中展示姓名、ID、成绩统计和游戏等级框的 POTENTIAL 徽章；高度随内容调整。
- 紧凑横向成绩卡：完整曲绘不叠加等级条；定数仅显示加粗数值，标签背景用对应难度颜色全填充，与单曲 PTT 分开。悬停可查看谱面等级；右侧展示曲名/分数，底部展示成绩等级与通关状态，五列展示完整 B50。
- B50、B10、Max 统计与完整 50 首成绩卡片；前 10 名突出显示。
- 曲绘、曲名、作者、难度、定数、分数、单曲潜力值、等级与 Pure / Far / Lost。
- PM、FR、EX+ 汇总。FR 不含 PM，EX+ 为独立分数等级，与 PM / FR 可重叠。
- 桌面 5 列、平板 3–4 列、手机 2 列；图片懒加载、键盘焦点、减少动画偏好和打印样式。

## 玩家信息区的角色背景

玩家信息区使用当前存档的角色图片作为背景，玩家头像同步按角色 ID 更新；不再显示独立 Logo Banner 或 ID 下方的签名。优先使用 `player.characterImage`；没有专用图片时，按 `player.character.id` 和觉醒状态选择本地角色图。内置素材来自参考项目的 126 张角色头像，**不包含完整立绘**。若希望展示完整立绘，可点「补充角色图片」选择 PNG / JPEG / WebP；图片在本地缩放后写入 JSON，重新导入仍会保留。

POTENTIAL 徽章使用参考项目的等级框素材，按 3.50 / 7.00 / 10.00 / 11.00 / 12.00 / 12.50 / 13.00 切换等级；13.00 以上使用最高等级框。原有签名字段仍兼容存档读写，但不会出现在页面或导出图中。

JSON 中可设置：

```json
{
  "player": {
    "character": { "id": 0, "awakened": false },
    "characterImage": "assets/characters/0_icon.webp"
  }
}
```

以上是需要合并到完整存档的角色字段示例。`characterImage` 可省略，也支持本工具保存的 PNG / JPEG / WebP data URL。

st3 会尝试读取 `config` / `settings` 等元数据表中的明确选中角色字段（如 `character`、`character_id`、`selectedCharacterId`），以及觉醒与外观覆盖标记；不会把拥有的第一个角色当作当前角色。不同版本不一定保存这些信息，缺失时显示「存档未提供选中角色」，可手动补选或补充图片。此兼容逻辑已用代表性 SQLite 测试验证，未取得用户实际存档，不能保证识别所有游戏版本。

围绕「存档 → B50 → 图片」实现，不包含登录、Excel / CSV 导入、逐曲成绩编辑或原站工具箱。

## 替换展示数据

修改 `src/data/demo.json` 中的 `player`、`recordedAt` 和 `scores`。图片位于 `public/assets/`；数据中的图片路径相对于站点根目录，不以 `/` 开头。

每条成绩包含：

```ts
{
  id: string;          // 曲目 ID；与 difficulty 共同确定一张谱面
  title: string;
  artist: string;
  difficulty: string;  // PST / PRS / FTR / BYD / ETR / INS
  level: string;       // 显示难度，例如 "10+"
  constant: number;
  score: number;
  pure: number;        // 总 Pure，包含 shiny
  shiny: number;       // 大 Pure
  far: number;
  lost: number;
  jacket: string;      // 例如 assets/jackets/testify.jpg
}
```

预置的玩家、分数与判定数是合成数据，不代表真实玩家成绩或谱面物量。曲目元信息与曲绘取自参考项目。`isDemo` 字段仅保留用于存档兼容，不生成页面或导出图片中的标识，也不会因隐藏标识而改变预置成绩的来源。

`src/rating.ts` 独立负责计算。同谱面多条成绩取最高分，按未截断的单曲潜力值降序排列，取前 50：

- `B50 = 前 50 总和 / 50`
- `B10 = 前 10 总和 / 10`
- `Max = (前 50 总和 + 前 10 总和) / 60`

少于指定数量时，缺失位置按零计入。显示小数时截断而非四舍五入。徽章展示参考项目口径的 Max（两位小数），不代表查询到的官方账号 PTT。

## 演示资源维护

现有资源已包含在项目内，正常安装、开发和构建**无需**运行资源脚本。需要重新生成示例时：

```sh
node scripts/prepare-demo.mjs /path/to/SmartRTE.github.io
```

也可以省略路径从上游下载。此脚本会覆盖示例数据和对应演示资源，请勿用它覆盖自己的成绩。上游曲目和定数可能随版本变化；当前示例不承诺为最新定数表。

更新 st3 解析使用的完整曲目表与曲绘（不会覆盖玩家存档）：

```sh
node scripts/prepare-catalog.mjs /path/to/SmartRTE.github.io
node scripts/prepare-characters.mjs /path/to/SmartRTE.github.io
npm run build
```

`src/data/catalog.json` 与 `public/assets/catalog-jackets/` 已随项目提供，日常开发和构建无需重新运行该脚本。`src/archive.ts` 负责数据格式校验，`src/st3.ts` 负责 SQLite 解析，`src/import.worker.ts` 负责后台读取，`src/export.ts` 负责独立高清画布生成。

素材归属见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。这是非官方同人展示项目，与 lowiro 无关联。

## 许可证

本项目自行编写的源代码以 [MIT License](./LICENSE) 开源。`public/assets/`、曲目元数据、字体及其他第三方素材不因 MIT 许可证而被重新授权；使用、再发布或商业使用这些素材前，请阅读 [第三方素材说明](./THIRD_PARTY_NOTICES.md) 并向对应权利方确认许可。
