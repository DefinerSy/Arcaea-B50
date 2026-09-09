import { readFile, writeFile, copyFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";

const source = process.argv[2];
if (!source)
  throw new Error(
    "Usage: node scripts/prepare-catalog.mjs /path/to/SmartRTE.github.io",
  );
const songs = JSON.parse(
  await readFile(join(source, "json/songlist"), "utf8"),
).songs;
const constants = JSON.parse(
  await readFile(join(source, "json/constants.json"), "utf8"),
);
const names = ["PST", "PRS", "FTR", "BYD", "ETR"];
const charts = {};
const assets = new Set();
for (const song of songs) {
  for (const chart of song.difficulties ?? []) {
    const difficulty =
      chart.ratingClassAlias === 1 ? "INS" : names[chart.ratingClass];
    const row = constants.songConstants[song.idx];
    const constant =
      row?.[difficulty] ?? (difficulty === "INS" ? row?.BYD : null);
    if (typeof constant !== "number") continue;
    const jacketName = `${song.id}${chart.jacketOverride ? `_${chart.ratingClass}` : ""}.jpg`;
    let jacket = `assets/catalog-jackets/${jacketName}`;
    try {
      await access(join(source, "Processed_Illustration", jacketName));
      assets.add(jacketName);
    } catch {
      jacket = "assets/jacket-fallback.svg";
    }
    charts[`${song.id}:${chart.ratingClass}`] = {
      id: song.id,
      title: chart.title_localized?.en ?? song.title_localized.en,
      artist: chart.artist ?? song.artist,
      difficulty,
      constant,
      level: `${chart.rating}${chart.ratingPlus ? "+" : ""}`,
      jacket,
    };
  }
}
await mkdir("public/assets/catalog-jackets", { recursive: true });
for (const name of assets)
  await copyFile(
    join(source, "Processed_Illustration", name),
    `public/assets/catalog-jackets/${name}`,
  );
await writeFile(
  "src/data/catalog.json",
  JSON.stringify({
    version: constants.version,
    updatedAt: constants.updatedAt,
    charts,
  }) + "\n",
);
console.log(
  `Prepared ${Object.keys(charts).length} charts and ${assets.size} local jackets.`,
);
