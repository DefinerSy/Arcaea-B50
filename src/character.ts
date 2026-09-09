import type { Database } from "sql.js";

export interface Character {
  id: number;
  awakened: boolean;
}
export function parseCharacter(value: unknown): Character | undefined {
  if (value === undefined || value === null) return undefined;
  const obj =
    typeof value === "object"
      ? (value as Record<string, unknown>)
      : { id: value };
  const raw = obj.id;
  if (
    (typeof raw !== "number" && typeof raw !== "string") ||
    !/^\d+$/.test(String(raw))
  )
    return undefined;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 0 || id > 10000) return undefined;
  const awakened =
    obj.awakened === true || obj.awakened === 1 || obj.awakened === "1";
  return { id, awakened };
}
const normalized = (value: string) =>
  value.toLowerCase().replace(/[_\s-]/g, "");
const selectedKeys = [
  "selectedcharacter",
  "selectedcharacterid",
  "currentcharacter",
  "currentcharacterid",
  "characterid",
  "character",
];
const awakenedKeys = [
  "characterawakened",
  "characteruncapped",
  "uncapped",
  "awakened",
];
function fromFields(fields: Map<string, unknown>): Character | undefined {
  for (const key of selectedKeys) {
    if (!fields.has(key)) continue;
    const raw = fields.get(key);
    let candidate = raw;
    if (typeof raw === "string" && raw.startsWith("{")) {
      try {
        candidate = JSON.parse(raw);
      } catch {
        continue;
      }
    }
    const character = parseCharacter(candidate);
    if (!character) continue;
    for (const key of awakenedKeys) {
      if (fields.has(key)) {
        const v = fields.get(key);
        character.awakened = v === 1 || v === true || v === "1" || v === "true";
        break;
      }
    }
    // Arcaea can display the non-awakened art even after a character is uncapped.
    const override = fields.get("characteruncappedoverride");
    if (
      override === 1 ||
      override === true ||
      override === "1" ||
      override === "true"
    )
      character.awakened = false;
    return character;
  }
}
/** Only read explicit selected-character metadata, never the first owned character. */
export function readSelectedCharacter(db: Database): Character | undefined {
  const tables =
    db
      .exec("SELECT name FROM sqlite_master WHERE type='table'")[0]
      ?.values.map((row) => String(row[0])) ?? [];
  const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;
  for (const table of tables.filter((t) =>
    ["config", "settings", "player", "userdata", "user", "profile"].includes(
      normalized(t),
    ),
  )) {
    const rows = db.exec(`SELECT * FROM ${quote(table)} LIMIT 1000`)[0];
    if (!rows) continue;
    const columns = rows.columns.map(normalized);
    const keyIndex = columns.findIndex((c) =>
      ["key", "name", "option"].includes(c),
    );
    const valueIndex = columns.findIndex((c) => ["value", "val"].includes(c));
    if (keyIndex >= 0 && valueIndex >= 0) {
      const fields = new Map(
        rows.values.map((row) => [
          normalized(String(row[keyIndex])),
          row[valueIndex],
        ]),
      );
      const found = fromFields(fields);
      if (found) return found;
    } else if (rows.values.length === 1) {
      const found = fromFields(
        new Map(columns.map((name, i) => [name, rows.values[0][i]])),
      );
      if (found) return found;
    }
  }
}
