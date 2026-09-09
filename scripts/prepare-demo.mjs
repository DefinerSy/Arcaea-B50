// Maintainer utility: refresh the local demo assets. Not used by the application.
import { mkdir, writeFile, readFile, copyFile } from "node:fs/promises";
import { join } from "node:path";

const upstream =
  "https://raw.githubusercontent.com/SmartRTE/SmartRTE.github.io/main/";
const source = process.argv[2];
async function download(remote, local) {
  await mkdir(join(local, ".."), { recursive: true });
  if (source) return copyFile(join(source, remote), local);
  const response = await fetch(upstream + remote, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${remote}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(local, bytes);
}
async function json(path) {
  if (source) return JSON.parse(await readFile(join(source, path), "utf8"));
  const response = await fetch(upstream + path, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}
const songlist = (await json("json/songlist")).songs;
const constants = (await json("json/constants.json")).songConstants;
const favorites = [
  "testify",
  "tempestissimo",
  "pentiment",
  "arcanaeden",
  "aegleseeker",
  "grievouslady",
  "fractureray",
  "worldender",
  "saikyostronger",
  "abstrusedilemma",
  "lamia",
  "pragmatism",
  "infinitebane",
  "viciousheroism",
  "ouroboros",
  "axiumcrisis",
  "ringedgenesis",
  "divinelight",
  "heavensdoor",
  "singularity",
  "etherstrike",
  "dantalion",
  "seclusion",
  "blackterritory",
  "cyaegha",
  "tothefurthestdream",
  "sheriruth",
  "gloryroad",
  "guardina",
  "genocider",
  "buchigireberserker",
  "lightningscrew",
  "w4",
  "manicjeer",
  "nullapophenia",
  "amygdata",
  "chaos",
  "tiferet",
  "felys",
  "kyorenromance",
  "omegafour",
  "lastcelebration",
  "eden",
  "defection",
  "gengaozo",
  "nhelv",
  "redandblue",
  "izana",
  "alexandrite",
  "blacklotus",
];
const diffs = ["PST", "PRS", "FTR", "BYD", "ETR", "INS"];
const difficulty = (chart) =>
  chart.ratingClassAlias === 1 ? "INS" : diffs[chart.ratingClass];
const chartConstant = (song, chart) => {
  const row = constants[song.idx];
  return (
    row?.[difficulty(chart)] ??
    (difficulty(chart) === "INS" ? row?.BYD : undefined)
  );
};
const candidates = songlist
  .flatMap((song) => {
    const chart = (song.difficulties ?? [])
      .filter((d) => d.ratingClass >= 2 && chartConstant(song, d))
      .sort((a, b) => chartConstant(song, b) - chartConstant(song, a))[0];
    if (!chart) return [];
    return [{ song, chart, constant: chartConstant(song, chart) }];
  })
  .filter((entry) => entry.constant >= 10);
const selected = [
  ...favorites.flatMap((id) => candidates.filter((e) => e.song.id === id)),
  ...candidates
    .filter((e) => !favorites.includes(e.song.id))
    .sort((a, b) => b.constant - a.constant),
].slice(0, 50);
await mkdir("src/data", { recursive: true });
const scores = [];
for (let offset = 0; offset < selected.length; offset += 6) {
  await Promise.all(
    selected
      .slice(offset, offset + 6)
      .map(async ({ song, chart, constant }, localIndex) => {
        const i = offset + localIndex;
        const pureMemory = i % 7 === 0;
        const notes = 1200 + i * 17;
        const far = pureMemory ? 0 : 2 + ((i * 3) % 19);
        const lost = pureMemory ? 0 : i % 4;
        const pure = notes - far - lost;
        const shiny = pure - ((i * 7) % 60);
        const score =
          Math.floor((10_000_000 * (pure + far / 2)) / notes) + shiny;
        const artId = chart.jacketOverride
          ? `${song.id}_${chart.ratingClass}`
          : song.id;
        const jacket = `public/assets/jackets/${song.id}.jpg`;
        try {
          await download(`Processed_Illustration/${artId}.jpg`, jacket);
        } catch {
          await download(`Processed_Illustration/${song.id}.jpg`, jacket);
        }
        scores[i] = {
          id: song.id,
          title: chart.title_localized?.en ?? song.title_localized.en,
          artist: chart.artist ?? song.artist,
          difficulty: difficulty(chart),
          level: `${chart.rating}${chart.ratingPlus ? "+" : ""}`,
          constant,
          score,
          pure,
          shiny,
          far,
          lost,
          jacket: `assets/jackets/${song.id}.jpg`,
        };
        console.log(`Saved ${song.id}`);
      }),
  );
}
await writeFile(
  "src/data/demo.json",
  JSON.stringify(
    {
      player: {
        name: "Hikari",
        id: "100 000 001",
        title: "在光与对立之间，拾起属于你的记忆。",
        avatar: "assets/avatar.webp",
      },
      recordedAt: "2026-09-10",
      isDemo: true,
      scores,
    },
    null,
    2,
  ) + "\n",
);
await Promise.all([
  download("bgs/s9.webp", "public/assets/background.webp"),
  download("img/avatar/34u_icon.webp", "public/assets/avatar.webp"),
  download("Fonts/Exo-SemiBold.ttf", "public/assets/fonts/Exo-SemiBold.ttf"),
  download("Fonts/GeosansLight.ttf", "public/assets/fonts/GeosansLight.ttf"),
]);
