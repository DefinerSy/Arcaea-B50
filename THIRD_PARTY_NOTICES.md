# 第三方素材说明

本项目的 TypeScript、HTML 与 CSS 展示实现为本次重新编写，没有复制参考项目的 JavaScript / CSS 实现。

参考来源：<https://github.com/SmartRTE/SmartRTE.github.io>，资源取得日期：2026-09-10。

当前资源对应上游提交 `8140c0e8848ef063dc428ece9099c4643827d068`。

- `public/assets/jackets/`：曲绘，取自参考项目 `Processed_Illustration/`。部分谱面采用对应的难度差分曲绘。
- `public/assets/background.webp`：参考项目 `bgs/s9.webp`。
- `public/assets/avatar.webp`：参考项目 `img/avatar/34u_icon.webp`。
- `public/assets/characters/` 与 `src/data/characters.json`：参考项目 `img/avatar/` 中的角色头像与本地索引，用于按存档角色 ID 显示玩家信息背景和头像；不代表完整角色立绘。
- `public/assets/rating/`：参考项目 `img/rating/rating_0.png` 至 `rating_7.png`，用于 POTENTIAL 等级徽章。
- `public/assets/arcaea-logo.svg`：Arcaea 官方网站的白色矢量 Logo，来源 https://arcaea.lowiro.com/assets/logo-dark-bg-DZ2C5CMF.svg ，取得日期 2026-09-10；权利归 lowiro 所有。
- `public/assets/fonts/Exo-SemiBold.ttf` 与 `GeosansLight.ttf`：取自参考项目 `Fonts/`。
- `src/data/demo.json`：曲名、作者、难度与定数来源于参考项目 `json/songlist` 与 `json/constants.json`，玩家信息、成绩和判定数为合成演示数据。
- `src/data/catalog.json` 与 `public/assets/catalog-jackets/`：完整谱面索引及对应曲绘，取自同一上游提交的 `json/songlist`、`json/constants.json` 和 `Processed_Illustration/`。索引版本为 7.0.255，更新于 2026-09-08。

运行时依赖：`sql.js`（MIT）用于本地 SQLite 解析；`html-to-image`（MIT）用于浏览器内 PNG 生成。依赖的完整许可随 npm 包提供。

命令行工具使用 Playwright（Apache-2.0）驱动本地无头浏览器，并使用 Vite 准备临时渲染页面；相关依赖不会进入网页的浏览器运行时。

Arcaea 游戏名称及相关游戏素材归 lowiro 和各自创作者所有；各曲绘、音乐名称、字体及相关内容保留原权利归属。上游仓库未附带统一 LICENSE 文件，本项目不为第三方素材重新授权。对外分发或商业使用前，应核实相关素材各自的使用许可。

本项目仅为非官方前端展示，不表示与 lowiro、SmartRTE 或相关创作者有合作或背书关系。

项目根目录的 `LICENSE` 仅适用于本项目自行编写的源代码；不改变本文件中列举的第三方素材、名称、字体、曲绘与元数据的权利归属或许可条件。
