# 示例存档

- `example.json`：本工具的 JSON 成绩存档，包含玩家资料、角色和 50 条合成成绩。
- `example.st3`：SQLite 格式的 Arcaea `st3` 示例，仅包含解析所需的 `scores` 表和角色配置。

两个文件的成绩相同，可用于检查网页导入、命令行导出和脚本集成。它们不包含真实玩家信息、真实游戏存档或完整游戏数据。

网页：下载任一文件后，点击「导入存档」并选择文件。

命令行：

```sh
npm run b50 -- ./examples/example.json -o ./example-json.png --width 1440
npm run b50 -- ./examples/example.st3 -o ./example-st3.png --name "Example Player" --width 2160
```

如需在更新示例成绩后同步重新生成两个文件：

```sh
npm run examples
```
