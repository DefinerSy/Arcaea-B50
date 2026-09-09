import { readdir, mkdir, copyFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
const source = process.argv[2];
if (!source)
  throw new Error(
    "Usage: node scripts/prepare-characters.mjs /path/to/SmartRTE.github.io",
  );
const files = (await readdir(join(source, "img/avatar"))).filter((name) =>
  /^\d+[un]?_icon\.webp$/.test(name),
);
await mkdir("public/assets/characters", { recursive: true });
const characters = {};
for (const file of files) {
  await copyFile(
    join(source, "img/avatar", file),
    `public/assets/characters/${file}`,
  );
  characters[file.replace("_icon.webp", "")] = `assets/characters/${file}`;
}
await writeFile(
  "src/data/characters.json",
  JSON.stringify(characters, null, 2) + "\n",
);
console.log(`Prepared ${files.length} character images.`);
