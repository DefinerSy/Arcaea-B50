import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import catalog from "./data/catalog.json";
import { readArchive } from "./read-archive";

self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    const result = await readArchive(
      new Uint8Array(event.data),
      () => initSqlJs({ locateFile: () => wasmUrl }),
      catalog,
    );
    self.postMessage({ ok: true, ...result });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "存档读取失败。",
    });
  }
};
