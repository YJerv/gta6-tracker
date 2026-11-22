import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_FILES, validateAll } from "./schema.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function loadData(dir = path.join(root, "data")) {
  const data = {};
  for (const section of DATA_FILES) {
    const file = path.join(dir, `${section}.json`);
    data[section] = JSON.parse(readFileSync(file, "utf8"));
  }
  return data;
}

export function validateDirectory(dir) {
  return validateAll(loadData(dir));
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const errors = validateDirectory(path.join(root, "data"));
  if (errors.length) {
    console.error(`Data validation failed (${errors.length})`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  const data = loadData(path.join(root, "data"));
  const counts = {
    chapters: data.story.chapters.length,
    missions: data.story.chapters.reduce((sum, chapter) => sum + chapter.missions.length, 0),
    earners: data.money.earners.length,
    purchases: data.money.purchases.length,
    areas: data.collectibles.areas.length,
    collectibles: data.collectibles.areas.reduce((sum, area) => sum + area.items.length, 0),
    secrets: data.secrets.entries.length,
    skills: data.skills.items.length,
    skillPins: data.skills.items.reduce((sum, item) => sum + item.locations.length, 0),
    vehicles: data.gear.vehicles.length,
    weapons: data.gear.weapons.length,
    cars: data.cars.cars.length,
    mapWeapons: data.weapons.weapons.length,
    steal: data.steal.items.length,
    news: data.online.news.length,
    checklist: data.online.checklist.length,
  };
  console.log("Data OK");
  console.log(JSON.stringify(counts));
}
