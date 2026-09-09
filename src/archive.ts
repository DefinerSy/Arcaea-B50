import { parseCharacter } from "./character.ts";
import type { Character } from "./character";
export const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
export const MAX_SCORES = 20_000;
export const difficulties = ["PST", "PRS", "FTR", "BYD", "ETR", "INS"] as const;
export interface Score {
  id: string;
  title: string;
  artist: string;
  difficulty: string;
  level: string;
  constant: number;
  score: number;
  pure: number;
  shiny: number;
  far: number;
  lost: number;
  jacket: string;
}
export interface Archive {
  player: {
    name: string;
    id: string;
    title: string;
    avatar: string;
    character?: Character;
    characterImage?: string;
  };
  recordedAt: string;
  isDemo: boolean;
  scores: Score[];
  source?: {
    name: string;
    version?: string;
    skipped: number;
    warnings: string[];
  };
}
export interface Chart extends Omit<
  Score,
  "score" | "pure" | "shiny" | "far" | "lost"
> {}
export interface Catalog {
  version: string;
  updatedAt: string;
  charts: Record<string, Chart>;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("存档格式不正确：需要 JSON 对象。");
  return value as Record<string, unknown>;
}
function text(value: unknown, field: string, max = 200): string {
  if (typeof value !== "string" || value.length > max)
    throw new Error(`${field} 必须是长度不超过 ${max} 的文本。`);
  return value;
}
function number(
  value: unknown,
  field: string,
  max: number,
  integer = true,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    throw new Error(`${field} 超出有效范围。`);
  return value;
}
// Imported paths never request external URLs or inject data URLs into an exported SVG.
export function localAsset(value: unknown, fallback: string): string {
  return typeof value === "string" &&
    /^assets\/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp|svg)$/.test(value) &&
    !value.includes("..")
    ? value
    : fallback;
}
export function parseArchive(value: unknown): Archive {
  const data = object(value);
  const player = object(data.player);
  const rawCharacter =
    player.character ?? player.characterId ?? player.character_id;
  const character = parseCharacter(rawCharacter);
  if (rawCharacter !== undefined && !character)
    throw new Error("角色信息无效：需要角色 ID 或 { id, awakened }。");
  let characterImage: string | undefined;
  if (player.characterImage !== undefined) {
    const value = player.characterImage;
    if (typeof value !== "string" || value.length > 4 * 1024 * 1024)
      throw new Error("角色图片格式无效或超过 4 MB。");
    characterImage =
      /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)
        ? value
        : localAsset(value, "");
    if (!characterImage)
      throw new Error(
        "角色图片必须是本地素材，或 PNG / JPEG / WebP 图片数据。",
      );
  }
  if (
    !Array.isArray(data.scores) ||
    !data.scores.length ||
    data.scores.length > MAX_SCORES
  )
    throw new Error("存档必须包含 1–20000 条成绩。");
  const scores = data.scores.map((raw, i): Score => {
    const s = object(raw);
    const difficulty = text(s.difficulty, "难度", 3);
    if (!(difficulties as readonly string[]).includes(difficulty))
      throw new Error(`第 ${i + 1} 条成绩的难度无效。`);
    const pure = number(s.pure, "Pure", 100_000);
    const shiny = number(s.shiny, "大 Pure", pure);
    return {
      id: text(s.id, "曲目 ID", 100),
      title: text(s.title, "曲名"),
      artist: text(s.artist, "作者"),
      difficulty,
      level: text(s.level, "显示难度", 5),
      constant: number(s.constant, "定数", 20, false),
      score: number(s.score, "分数", 10_100_000),
      pure,
      shiny,
      far: number(s.far, "Far", 100_000),
      lost: number(s.lost, "Lost", 100_000),
      jacket: localAsset(s.jacket, "assets/jacket-fallback.svg"),
    };
  });
  const recordedAt = text(data.recordedAt, "记录日期", 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(recordedAt) ||
    Number.isNaN(Date.parse(recordedAt)) ||
    new Date(recordedAt).toISOString().slice(0, 10) !== recordedAt
  )
    throw new Error("记录日期必须是有效的 YYYY-MM-DD 日期。");
  let source: Archive["source"];
  if (data.source) {
    const s = object(data.source);
    source = {
      name: text(s.name, "来源名称", 255),
      skipped: number(s.skipped, "跳过数量", MAX_SCORES),
      version:
        s.version === undefined ? undefined : text(s.version, "定数版本", 40),
      warnings: Array.isArray(s.warnings)
        ? s.warnings.slice(0, 10).map((w) => text(w, "提示", 500))
        : [],
    };
  }
  return {
    player: {
      name: text(player.name, "玩家名", 32),
      id: text(player.id, "好友码", 32),
      title: text(player.title ?? "", "签名", 80),
      avatar: localAsset(player.avatar, "assets/avatar.webp"),
      ...(character ? { character } : {}),
      ...(characterImage ? { characterImage } : {}),
    },
    recordedAt,
    isDemo: data.isDemo === true,
    scores,
    source,
  };
}
export function isSqlite(bytes: Uint8Array): boolean {
  return (
    new TextDecoder().decode(bytes.subarray(0, 16)) === "SQLite format 3\0"
  );
}
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function exportFilename(name: string, date: string): string {
  const safe =
    name
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .replace(/[. ]+$/g, "")
      .slice(0, 40) || "Player";
  return `Arcaea_B50_${safe}_${date}.png`;
}
