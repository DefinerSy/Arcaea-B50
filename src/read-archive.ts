import type { SqlJsStatic } from "sql.js";
import type { Catalog } from "./archive";
import { isSqlite, parseArchive, MAX_ARCHIVE_BYTES } from "./archive.ts";
import { readSt3 } from "./st3.ts";

/** The browser worker and CLI share the same format detection and validation. */
export async function readArchive(
  bytes: Uint8Array,
  loadSql: () => Promise<SqlJsStatic>,
  catalog: Catalog,
) {
  if (!bytes.byteLength) throw new Error("存档文件为空。");
  if (bytes.byteLength > MAX_ARCHIVE_BYTES)
    throw new Error("文件超过 32 MB，请选择 st3 或 JSON 成绩存档。");
  if (isSqlite(bytes))
    return { archive: readSt3(await loadSql(), bytes, catalog), isSt3: true };
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(bytes).replace(/^\uFEFF/, ""));
  } catch {
    throw new Error(
      "无法识别文件。请选择解包后的 st3 数据库，或本工具格式的 JSON 成绩存档。",
    );
  }
  return { archive: parseArchive(json), isSt3: false };
}
