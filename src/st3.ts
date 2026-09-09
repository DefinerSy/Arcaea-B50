import type { SqlJsStatic } from "sql.js";
import type { Archive, Catalog, Score } from "./archive";
import { MAX_SCORES, localDate } from "./archive.ts";
import { readSelectedCharacter } from "./character.ts";

export function readSt3(
  SQL: SqlJsStatic,
  bytes: Uint8Array,
  catalog: Catalog,
): Archive {
  const db = new SQL.Database(bytes);
  try {
    const schema = db.exec("PRAGMA table_info(scores)")[0];
    const columns = new Set(schema?.values.map((row) => String(row[1])) ?? []);
    const required = [
      "songId",
      "songDifficulty",
      "score",
      "perfectCount",
      "shinyPerfectCount",
      "nearCount",
      "missCount",
    ];
    if (!required.every((name) => columns.has(name)))
      throw new Error(
        "此数据库不是可识别的 Arcaea st3 存档：缺少 scores 表或必要字段。",
      );
    const statement = db.prepare(
      `SELECT songId, songDifficulty, score, perfectCount, shinyPerfectCount, nearCount, missCount FROM scores WHERE score > 0 LIMIT ${MAX_SCORES + 1}`,
    );
    const scores: Score[] = [];
    let skipped = 0,
      total = 0;
    const unknown = new Set<string>();
    try {
      while (statement.step()) {
        if (++total > MAX_SCORES)
          throw new Error("成绩记录过多（上限 20000 条），请检查存档。");
        const row = statement.get();
        const chart = catalog.charts[`${row[0]}:${row[1]}`];
        if (!chart) {
          skipped++;
          if (unknown.size < 5) unknown.add(`${row[0]} / ${row[1]}`);
          continue;
        }
        const [score, pure, shiny, far, lost] = row.slice(2).map(Number);
        if (
          row.slice(2).some((v) => typeof v !== "number") ||
          ![score, pure, shiny, far, lost].every(
            (v) => Number.isSafeInteger(v) && v >= 0,
          ) ||
          score > 10_100_000 ||
          Math.max(pure, far, lost) > 100_000 ||
          shiny > pure
        ) {
          skipped++;
          continue;
        }
        scores.push({ ...chart, score, pure, shiny, far, lost });
      }
    } finally {
      statement.free();
    }
    if (!scores.length)
      throw new Error(
        total
          ? "没有可匹配的有效成绩；存档可能来自更新版本，请更新曲目定数表。"
          : "存档中尚无已游玩成绩。",
      );
    const character = readSelectedCharacter(db);
    return {
      player: {
        name: "Player",
        id: "",
        title: "",
        avatar: "assets/jacket-fallback.svg",
        ...(character ? { character } : {}),
      },
      recordedAt: localDate(),
      isDemo: false,
      scores,
      source: {
        name: "st3",
        version: catalog.version,
        skipped,
        warnings: skipped
          ? [
              `有 ${skipped} 条成绩因未知谱面或无效数据未计入；B50 可能不完整。${unknown.size ? `未匹配示例：${[...unknown].join("、")}` : ""}`,
            ]
          : [],
      },
    };
  } finally {
    db.close();
  }
}
