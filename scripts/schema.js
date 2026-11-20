/**
 * Schema checks for /data/*.json.
 * Keep this file in step with the "Data file format" section of README.md.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const DATA_FILES = [
  "meta",
  "story",
  "money",
  "collectibles",
  "secrets",
  "skills",
  "gear",
  "cars",
  "online",
];

/** Editorial stages used by money.json and gear.json. */
export const STAGE_CHAPTER = {
  early: 1,
  mid: 3,
  late: 5,
};

const STAGES = Object.keys(STAGE_CHAPTER);
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PLACEHOLDER_RE = /^PLACEHOLDER:\s+\S/;
const SETTING_TOPICS = ["dead-zone", "aim-assist", "sensitivity", "feedback", "display", "layout"];
const DRILL_DISCIPLINES = ["driving", "aiming"];

export function isRealDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function push(errors, path, message) {
  errors.push(`${path} ${message}`);
}

function exactKeys(obj, keys, path, errors, optional = []) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    push(errors, path, "must be an object");
    return false;
  }
  const allowed = new Set([...keys, ...optional]);
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) push(errors, path, `has unknown key "${key}"`);
  }
  for (const key of keys) {
    if (!(key in obj)) push(errors, path, `is missing "${key}"`);
  }
  return true;
}

const IMAGE_PATH = /^images\/(?:cars\/)?[a-z0-9.-]+$/;

function imageValueSet(value) {
  return value !== null && value !== undefined;
}

function checkMissionImage(mission, label, errors) {
  const names = ["image", "imageCredit", "imageAlt"];
  const set = names.filter((key) => imageValueSet(mission[key]));
  if (set.length === 0) return;
  if (set.length !== 3) {
    push(errors, label, "image, imageCredit and imageAlt must be set together");
    return;
  }
  if (typeof mission.image !== "string" || !IMAGE_PATH.test(mission.image)) {
    push(errors, `${label}.image`, "must be a relative path under images/ or images/cars/");
  } else if (!existsSync(path.join(root, mission.image))) {
    push(errors, `${label}.image`, `file not found (${mission.image})`);
  }
  if (typeof mission.imageCredit !== "string" || mission.imageCredit.trim().length < 8) {
    push(errors, `${label}.imageCredit`, "is required when image is set");
  }
  if (typeof mission.imageAlt !== "string" || mission.imageAlt.trim().length < 8 || mission.imageAlt.length > 300) {
    push(errors, `${label}.imageAlt`, "is required when image is set");
  }
}

function checkEnvelope(data, section, errors) {
  if (!exactKeys(
    data,
    envelopeKeys(section),
    section,
    errors,
  )) return;
  if (!Number.isInteger(data.version) || data.version < 1) {
    push(errors, section, "version must be an integer >= 1");
  }
  if (!isRealDate(data.lastUpdated)) {
    push(errors, `${section}.lastUpdated`, "must be a real YYYY-MM-DD date");
  }
  if (data.section !== section) {
    push(errors, `${section}.section`, `must be "${section}"`);
  }
  if (typeof data.description !== "string" || data.description.trim().length < 20) {
    push(errors, `${section}.description`, "must be a sentence explaining the file");
  }
}

function envelopeKeys(section) {
  const common = ["version", "lastUpdated", "section", "description"];
  const extra = {
    meta: ["gameTitle", "platform", "releaseDate", "singlePlayerOnly", "onlineAnnounced", "statusNote", "facts"],
    story: ["notice", "chapters"],
    money: ["earners", "purchases"],
    collectibles: ["areas"],
    secrets: ["entries"],
    skills: ["xboxSettings", "drills", "stats"],
    gear: ["vehicles", "weapons"],
    cars: ["map", "cars"],
    online: ["news", "checklist"],
  };
  return common.concat(extra[section]);
}

function checkId(value, path, errors, ids) {
  if (typeof value !== "string" || !ID_RE.test(value) || value.length > 80) {
    push(errors, path, "must be a kebab-case id up to 80 characters");
    return;
  }
  if (ids.has(value)) push(errors, path, `duplicates id "${value}"`);
  ids.add(value);
}

function contentStrings(entry, fields) {
  const found = [];
  for (const field of fields) {
    const value = entry[field];
    if (typeof value === "string") found.push([field, value]);
    else if (Array.isArray(value)) {
      value.forEach((line, index) => {
        if (typeof line === "string") found.push([`${field}[${index}]`, line]);
      });
    }
  }
  return found;
}

function checkVerifiedPair(entry, path, errors, textFields) {
  if (typeof entry.verified !== "boolean") push(errors, `${path}.verified`, "must be boolean");
  if (typeof entry.generic !== "boolean") push(errors, `${path}.generic`, "must be boolean");
  if (!(entry.source === null || typeof entry.source === "string")) {
    push(errors, `${path}.source`, "must be a string or null");
  }
  if (typeof entry.title !== "string" || entry.title.trim().length === 0 || entry.title.length > 180) {
    push(errors, `${path}.title`, "must be non-empty text up to 180 characters");
  }

  if (entry.verified === false) {
    if (entry.source !== null) push(errors, `${path}.source`, "must be null until the entry is verified");
    if (entry.generic === true) push(errors, `${path}.generic`, "cannot be true when verified is false");
    for (const [field, value] of contentStrings(entry, textFields)) {
      if (value.length > 0 && !PLACEHOLDER_RE.test(value)) {
        push(errors, `${path}.${field}`, 'must start with "PLACEHOLDER:" while verified is false');
      }
      if (/[$£€]/.test(value)) {
        push(errors, `${path}.${field}`, "must not contain a price while verified is false");
      }
    }
  }

  if (entry.verified === true) {
    if (typeof entry.source !== "string" || entry.source.trim().length < 8) {
      push(errors, `${path}.source`, "must name a source when verified is true");
    }
    for (const [field, value] of contentStrings(entry, textFields)) {
      if (value.includes("PLACEHOLDER:")) {
        push(errors, `${path}.${field}`, "must not say PLACEHOLDER when verified is true");
      }
    }
    if (entry.generic === true && (typeof entry.source !== "string" || !/generic/i.test(entry.source))) {
      push(errors, `${path}.source`, 'must say "generic" when generic is true');
    }
    if (entry.generic === false && typeof entry.source === "string" && /^\s*generic\b/i.test(entry.source)) {
      push(errors, `${path}.source`, "must not be labelled generic when generic is false");
    }
  }
}

function checkChapterOrder(value, path, errors, { allowNull, generic }) {
  if (generic === true) {
    if (value !== null) push(errors, path, "must be null on generic entries");
    return;
  }
  if (value === null && allowNull) return;
  if (!Number.isInteger(value) || value < 1) {
    push(errors, path, allowNull ? "must be a positive integer or null" : "must be a positive integer");
  }
}

function checkStringList(value, path, errors, { max = 12, itemMax = 300 } = {}) {
  if (!Array.isArray(value)) {
    push(errors, path, "must be an array");
    return;
  }
  if (value.length > max) push(errors, path, `must have at most ${max} lines`);
  value.forEach((line, index) => {
    if (typeof line !== "string" || line.length > itemMax) {
      push(errors, `${path}[${index}]`, `must be text up to ${itemMax} characters`);
    }
  });
}

function checkStage(entry, path, errors) {
  if (!STAGES.includes(entry.stage)) {
    push(errors, `${path}.stage`, `must be one of ${STAGES.join(", ")}`);
    return;
  }
  if (entry.chapterOrder !== STAGE_CHAPTER[entry.stage]) {
    push(errors, `${path}.chapterOrder`, `must be ${STAGE_CHAPTER[entry.stage]} for stage "${entry.stage}"`);
  }
}

const LEAF_TEXT = {
  fact: ["title", "detail"],
  chapter: ["title", "summary"],
  mission: ["title", "summary", "steps", "bonusObjectives", "missables"],
  money: ["title", "detail"],
  area: ["title"],
  collectible: ["title", "category", "detail"],
  secret: ["title", "detail"],
  setting: ["title", "detail"],
  drill: ["title", "detail"],
  stat: ["title", "detail"],
  gear: ["title", "role", "where", "detail"],
  news: ["title", "detail"],
  checklist: ["title", "detail"],
};

function checkMeta(data, errors, ids) {
  checkEnvelope(data, "meta", errors);
  if (typeof data.gameTitle !== "string" || data.gameTitle.trim().length === 0) {
    push(errors, "meta.gameTitle", "must be non-empty");
  }
  if (typeof data.platform !== "string" || data.platform.trim().length === 0) {
    push(errors, "meta.platform", "must be non-empty");
  }
  if (!isRealDate(data.releaseDate)) push(errors, "meta.releaseDate", "must be a real YYYY-MM-DD date");
  if (typeof data.singlePlayerOnly !== "boolean") push(errors, "meta.singlePlayerOnly", "must be boolean");
  if (typeof data.onlineAnnounced !== "boolean") push(errors, "meta.onlineAnnounced", "must be boolean");
  if (typeof data.statusNote !== "string" || data.statusNote.trim().length < 10) {
    push(errors, "meta.statusNote", "must be a short player-facing note");
  }
  if (!Array.isArray(data.facts) || data.facts.length < 1) {
    push(errors, "meta.facts", "must be a non-empty array");
    return;
  }
  data.facts.forEach((fact, index) => {
    const path = `meta.facts[${index}]`;
    if (!exactKeys(fact, ["id", "title", "verified", "source", "generic", "detail"], path, errors)) return;
    checkId(fact.id, `${path}.id`, errors, ids);
    checkVerifiedPair(fact, path, errors, LEAF_TEXT.fact);
    if (typeof fact.detail !== "string" || fact.detail.length > 500) {
      push(errors, `${path}.detail`, "must be text up to 500 characters");
    }
  });
}

function checkNotice(notice, errors) {
  const path = "story.notice";
  if (!exactKeys(notice, ["title", "source", "lastUpdated", "items"], path, errors)) return;
  if (typeof notice.title !== "string" || notice.title.trim().length < 3 || notice.title.length > 80) {
    push(errors, `${path}.title`, "must be short text");
  }
  if (typeof notice.source !== "string" || notice.source.trim().length < 8) {
    push(errors, `${path}.source`, "must name a source");
  }
  if (!isRealDate(notice.lastUpdated)) push(errors, `${path}.lastUpdated`, "must be a real YYYY-MM-DD date");
  if (!Array.isArray(notice.items) || notice.items.length < 1 || notice.items.length > 8) {
    push(errors, `${path}.items`, "must be 1 to 8 lines");
    return;
  }
  notice.items.forEach((item, index) => {
    if (typeof item !== "string" || item.trim().length < 10 || item.length > 400) {
      push(errors, `${path}.items[${index}]`, "must be a sentence up to 400 characters");
    } else if (item.includes("PLACEHOLDER:")) {
      push(errors, `${path}.items[${index}]`, "must not be a placeholder");
    }
  });
}

function checkStory(data, errors, ids, chapterOrders) {
  checkEnvelope(data, "story", errors);
  checkNotice(data.notice, errors);
  if (!Array.isArray(data.chapters) || data.chapters.length < 1) {
    push(errors, "story.chapters", "must be a non-empty array");
    return;
  }
  const orders = new Set();
  data.chapters.forEach((chapter, index) => {
    const path = `story.chapters[${index}]`;
    if (!exactKeys(chapter, ["id", "order", "title", "verified", "source", "generic", "summary", "missions"], path, errors)) return;
    checkId(chapter.id, `${path}.id`, errors, ids);
    if (!Number.isInteger(chapter.order) || chapter.order < 1) push(errors, `${path}.order`, "must be a positive integer");
    if (orders.has(chapter.order)) push(errors, `${path}.order`, "duplicates another chapter order");
    orders.add(chapter.order);
    chapterOrders.add(chapter.order);
    checkVerifiedPair(chapter, path, errors, LEAF_TEXT.chapter);
    if (typeof chapter.summary !== "string" || chapter.summary.length > 500) {
      push(errors, `${path}.summary`, "must be text up to 500 characters");
    }
    if (!Array.isArray(chapter.missions) || chapter.missions.length < 1) {
      push(errors, `${path}.missions`, "must be a non-empty array");
      return;
    }
    const missionOrders = new Set();
    chapter.missions.forEach((mission, missionIndex) => {
      const missionPath = `${path}.missions[${missionIndex}]`;
      if (!exactKeys(mission, ["id", "order", "title", "verified", "source", "generic", "summary", "steps", "bonusObjectives", "missables"], missionPath, errors, ["image", "imageCredit", "imageAlt"])) return;
      checkMissionImage(mission, missionPath, errors);
      checkId(mission.id, `${missionPath}.id`, errors, ids);
      if (!Number.isInteger(mission.order) || mission.order < 1) push(errors, `${missionPath}.order`, "must be a positive integer");
      if (missionOrders.has(mission.order)) push(errors, `${missionPath}.order`, "duplicates another mission order in this chapter");
      missionOrders.add(mission.order);
      checkVerifiedPair(mission, missionPath, errors, LEAF_TEXT.mission);
      checkStringList(mission.steps, `${missionPath}.steps`, errors);
      checkStringList(mission.bonusObjectives, `${missionPath}.bonusObjectives`, errors);
      checkStringList(mission.missables, `${missionPath}.missables`, errors);
      if (typeof mission.summary !== "string" || mission.summary.length > 500) {
        push(errors, `${missionPath}.summary`, "must be text up to 500 characters");
      }
    });
  });
}

function checkMoneyList(list, name, errors, ids) {
  if (!Array.isArray(list) || list.length < 1) {
    push(errors, `money.${name}`, "must be a non-empty array");
    return;
  }
  list.forEach((entry, index) => {
    const path = `money.${name}[${index}]`;
    if (!exactKeys(entry, ["id", "title", "verified", "source", "generic", "stage", "chapterOrder", "detail"], path, errors)) return;
    checkId(entry.id, `${path}.id`, errors, ids);
    checkVerifiedPair(entry, path, errors, LEAF_TEXT.money);
    checkStage(entry, path, errors);
    checkChapterOrder(entry.chapterOrder, `${path}.chapterOrder`, errors, { allowNull: false, generic: entry.generic });
    if (typeof entry.detail !== "string" || entry.detail.length > 500) {
      push(errors, `${path}.detail`, "must be text up to 500 characters");
    }
  });
}

function checkMoney(data, errors, ids) {
  checkEnvelope(data, "money", errors);
  checkMoneyList(data.earners, "earners", errors, ids);
  checkMoneyList(data.purchases, "purchases", errors, ids);
}

function checkCollectibles(data, errors, ids, areaIds) {
  checkEnvelope(data, "collectibles", errors);
  if (!Array.isArray(data.areas) || data.areas.length < 1) {
    push(errors, "collectibles.areas", "must be a non-empty array");
    return;
  }
  const orders = new Set();
  data.areas.forEach((area, index) => {
    const path = `collectibles.areas[${index}]`;
    if (!exactKeys(area, ["id", "order", "title", "verified", "source", "generic", "chapterOrder", "items"], path, errors)) return;
    checkId(area.id, `${path}.id`, errors, ids);
    areaIds.add(area.id);
    if (!Number.isInteger(area.order) || area.order < 1) push(errors, `${path}.order`, "must be a positive integer");
    if (orders.has(area.order)) push(errors, `${path}.order`, "duplicates another area order");
    orders.add(area.order);
    checkVerifiedPair(area, path, errors, LEAF_TEXT.area);
    checkChapterOrder(area.chapterOrder, `${path}.chapterOrder`, errors, { allowNull: false, generic: area.generic });
    if (!Array.isArray(area.items) || area.items.length < 1) {
      push(errors, `${path}.items`, "must be a non-empty array");
      return;
    }
    area.items.forEach((item, itemIndex) => {
      const itemPath = `${path}.items[${itemIndex}]`;
      if (!exactKeys(item, ["id", "title", "verified", "source", "generic", "category", "detail", "chapterOrder"], itemPath, errors)) return;
      checkId(item.id, `${itemPath}.id`, errors, ids);
      checkVerifiedPair(item, itemPath, errors, LEAF_TEXT.collectible);
      checkChapterOrder(item.chapterOrder, `${itemPath}.chapterOrder`, errors, { allowNull: false, generic: item.generic });
      if (item.chapterOrder !== area.chapterOrder) {
        push(errors, `${itemPath}.chapterOrder`, "must match its area");
      }
      if (typeof item.detail !== "string" || item.detail.length > 500) {
        push(errors, `${itemPath}.detail`, "must be text up to 500 characters");
      }
    });
  });
}

function checkSecrets(data, errors, ids, areaIds) {
  checkEnvelope(data, "secrets", errors);
  if (!Array.isArray(data.entries) || data.entries.length < 1) {
    push(errors, "secrets.entries", "must be a non-empty array");
    return;
  }
  data.entries.forEach((entry, index) => {
    const path = `secrets.entries[${index}]`;
    if (!exactKeys(entry, ["id", "title", "verified", "source", "generic", "chapterOrder", "areaId", "detail"], path, errors)) return;
    checkId(entry.id, `${path}.id`, errors, ids);
    checkVerifiedPair(entry, path, errors, LEAF_TEXT.secret);
    checkChapterOrder(entry.chapterOrder, `${path}.chapterOrder`, errors, { allowNull: false, generic: entry.generic });
    if (!(entry.areaId === null || (typeof entry.areaId === "string" && areaIds.has(entry.areaId)))) {
      push(errors, `${path}.areaId`, "must be null or a collectibles area id");
    }
    if (typeof entry.detail !== "string" || entry.detail.length > 500) {
      push(errors, `${path}.detail`, "must be text up to 500 characters");
    }
  });
}

function checkSkills(data, errors, ids) {
  checkEnvelope(data, "skills", errors);
  checkSettings(data.xboxSettings, errors, ids);
  checkDrills(data.drills, errors, ids);
  checkStats(data.stats, errors, ids);
}

function checkSettings(list, errors, ids) {
  if (!Array.isArray(list) || list.length < 1) {
    push(errors, "skills.xboxSettings", "must be a non-empty array");
    return;
  }
  list.forEach((entry, index) => {
    const path = `skills.xboxSettings[${index}]`;
    if (!exactKeys(entry, ["id", "title", "verified", "source", "generic", "chapterOrder", "topic", "detail"], path, errors)) return;
    checkId(entry.id, `${path}.id`, errors, ids);
    checkVerifiedPair(entry, path, errors, LEAF_TEXT.setting);
    checkChapterOrder(entry.chapterOrder, `${path}.chapterOrder`, errors, { allowNull: true, generic: entry.generic });
    if (!SETTING_TOPICS.includes(entry.topic)) {
      push(errors, `${path}.topic`, `must be one of ${SETTING_TOPICS.join(", ")}`);
    }
    if (typeof entry.detail !== "string" || entry.detail.length > 800) {
      push(errors, `${path}.detail`, "must be text up to 800 characters");
    }
  });
}

function checkDrills(list, errors, ids) {
  if (!Array.isArray(list) || list.length < 1) {
    push(errors, "skills.drills", "must be a non-empty array");
    return;
  }
  list.forEach((entry, index) => {
    const path = `skills.drills[${index}]`;
    if (!exactKeys(entry, ["id", "title", "verified", "source", "generic", "chapterOrder", "discipline", "detail"], path, errors)) return;
    checkId(entry.id, `${path}.id`, errors, ids);
    checkVerifiedPair(entry, path, errors, LEAF_TEXT.drill);
    checkChapterOrder(entry.chapterOrder, `${path}.chapterOrder`, errors, { allowNull: true, generic: entry.generic });
    if (!DRILL_DISCIPLINES.includes(entry.discipline)) {
      push(errors, `${path}.discipline`, `must be one of ${DRILL_DISCIPLINES.join(", ")}`);
    }
    if (typeof entry.detail !== "string" || entry.detail.length > 800) {
      push(errors, `${path}.detail`, "must be text up to 800 characters");
    }
  });
}

function checkStats(list, errors, ids) {
  if (!Array.isArray(list) || list.length < 1) {
    push(errors, "skills.stats", "must be a non-empty array");
    return;
  }
  list.forEach((entry, index) => {
    const path = `skills.stats[${index}]`;
    if (!exactKeys(entry, ["id", "title", "verified", "source", "generic", "chapterOrder", "detail"], path, errors)) return;
    checkId(entry.id, `${path}.id`, errors, ids);
    checkVerifiedPair(entry, path, errors, LEAF_TEXT.stat);
    checkChapterOrder(entry.chapterOrder, `${path}.chapterOrder`, errors, { allowNull: false, generic: entry.generic });
    if (typeof entry.detail !== "string" || entry.detail.length > 500) {
      push(errors, `${path}.detail`, "must be text up to 500 characters");
    }
  });
}

function checkGearList(list, name, errors, ids) {
  if (!Array.isArray(list) || list.length < 1) {
    push(errors, `gear.${name}`, "must be a non-empty array");
    return;
  }
  list.forEach((entry, index) => {
    const path = `gear.${name}[${index}]`;
    if (!exactKeys(entry, ["id", "title", "verified", "source", "generic", "stage", "chapterOrder", "role", "where", "detail"], path, errors)) return;
    checkId(entry.id, `${path}.id`, errors, ids);
    checkVerifiedPair(entry, path, errors, LEAF_TEXT.gear);
    checkStage(entry, path, errors);
    checkChapterOrder(entry.chapterOrder, `${path}.chapterOrder`, errors, { allowNull: false, generic: entry.generic });
    for (const field of ["role", "where", "detail"]) {
      if (typeof entry[field] !== "string" || entry[field].length > 500) {
        push(errors, `${path}.${field}`, "must be text up to 500 characters");
      }
    }
  });
}

function checkGear(data, errors, ids) {
  checkEnvelope(data, "gear", errors);
  checkGearList(data.vehicles, "vehicles", errors, ids);
  checkGearList(data.weapons, "weapons", errors, ids);
}

function checkOnline(data, errors, ids) {
  checkEnvelope(data, "online", errors);
  if (!Array.isArray(data.news) || data.news.length < 1) {
    push(errors, "online.news", "must be a non-empty array");
  } else {
    data.news.forEach((entry, index) => {
      const path = `online.news[${index}]`;
      if (!exactKeys(entry, ["id", "title", "verified", "source", "generic", "chapterOrder", "date", "detail"], path, errors)) return;
      checkId(entry.id, `${path}.id`, errors, ids);
      checkVerifiedPair(entry, path, errors, LEAF_TEXT.news);
      checkChapterOrder(entry.chapterOrder, `${path}.chapterOrder`, errors, { allowNull: true, generic: entry.generic });
      if (!(entry.date === null || isRealDate(entry.date))) {
        push(errors, `${path}.date`, "must be a real YYYY-MM-DD date or null");
      }
      if (typeof entry.detail !== "string" || entry.detail.length > 800) {
        push(errors, `${path}.detail`, "must be text up to 800 characters");
      }
    });
  }
  if (!Array.isArray(data.checklist) || data.checklist.length < 1) {
    push(errors, "online.checklist", "must be a non-empty array");
    return;
  }
  data.checklist.forEach((entry, index) => {
    const path = `online.checklist[${index}]`;
    if (!exactKeys(entry, ["id", "title", "verified", "source", "generic", "chapterOrder", "detail"], path, errors)) return;
    checkId(entry.id, `${path}.id`, errors, ids);
    checkVerifiedPair(entry, path, errors, LEAF_TEXT.checklist);
    checkChapterOrder(entry.chapterOrder, `${path}.chapterOrder`, errors, { allowNull: true, generic: entry.generic });
    if (typeof entry.detail !== "string" || entry.detail.length > 800) {
      push(errors, `${path}.detail`, "must be text up to 800 characters");
    }
  });
}

function checkPercent(value, label, errors) {
  if (value === null) return;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    push(errors, label, "must be null or a number from 0 to 100");
  }
}

function checkPositiveOrNull(value, label, errors) {
  if (value === null) return;
  if (!Number.isInteger(value) || value < 1) push(errors, label, "must be null or a positive integer");
}

function checkCars(data, errors, ids) {
  checkEnvelope(data, "cars", errors);
  const map = data.map;
  const mapPath = "cars.map";
  if (!exactKeys(map, ["image", "imageCredit", "imageAlt", "source", "width", "height"], mapPath, errors)) return;
  const imageSet = typeof map.image === "string";
  if (!(map.image === null || imageSet)) push(errors, `${mapPath}.image`, "must be null or a path under images/");
  if (imageSet) {
    if (!IMAGE_PATH.test(map.image)) push(errors, `${mapPath}.image`, "must be a relative path under images/ or images/cars/");
    else if (!existsSync(path.join(root, map.image))) push(errors, `${mapPath}.image`, `file not found (${map.image})`);
    if (typeof map.imageCredit !== "string" || map.imageCredit.trim().length < 8) {
      push(errors, `${mapPath}.imageCredit`, "is required when image is set");
    }
    if (typeof map.imageAlt !== "string" || map.imageAlt.trim().length < 8) {
      push(errors, `${mapPath}.imageAlt`, "is required when image is set");
    }
    if (!Number.isInteger(map.width) || map.width < 1) push(errors, `${mapPath}.width`, "is required when image is set");
    if (!Number.isInteger(map.height) || map.height < 1) push(errors, `${mapPath}.height`, "is required when image is set");
  } else if (map.image === null) {
    if (map.imageCredit !== null) push(errors, `${mapPath}.imageCredit`, "must be null when there is no map image");
    if (map.imageAlt !== null) push(errors, `${mapPath}.imageAlt`, "must be null when there is no map image");
    checkPositiveOrNull(map.width, `${mapPath}.width`, errors);
    checkPositiveOrNull(map.height, `${mapPath}.height`, errors);
  }
  if (!(map.source === null || (typeof map.source === "string" && map.source.trim().length > 0))) {
    push(errors, `${mapPath}.source`, "must be a string or null");
  }
  if (!Array.isArray(data.cars) || data.cars.length < 1) {
    push(errors, "cars.cars", "must be a non-empty array");
    return;
  }
  data.cars.forEach((car, index) => {
    const carPath = `cars.cars[${index}]`;
    if (!exactKeys(car, ["id", "verified", "source", "generic", "chapterOrder", "title", "category", "area", "mapX", "mapY", "precision", "steps", "notes"], carPath, errors, ["image", "imageCredit", "imageAlt"])) return;
    checkId(car.id, `${carPath}.id`, errors, ids);
    if (car.generic !== false) push(errors, `${carPath}.generic`, "must be false");
    checkVerifiedPair(car, carPath, errors, ["title", "category", "area", "notes", "steps"]);
    checkChapterOrder(car.chapterOrder, `${carPath}.chapterOrder`, errors, { allowNull: true, generic: false });
    checkPercent(car.mapX, `${carPath}.mapX`, errors);
    checkPercent(car.mapY, `${carPath}.mapY`, errors);
    if (!["exact", "street", "area"].includes(car.precision)) {
      push(errors, `${carPath}.precision`, "must be exact, street, or area");
    }
    checkStringList(car.steps, `${carPath}.steps`, errors, { itemMax: 600 });
    if (typeof car.notes !== "string" || car.notes.length > 800) {
      push(errors, `${carPath}.notes`, "must be text up to 800 characters");
    }
    if (typeof car.category !== "string" || car.category.length > 120) {
      push(errors, `${carPath}.category`, "must be text up to 120 characters");
    }
    if (typeof car.area !== "string" || car.area.length > 120) {
      push(errors, `${carPath}.area`, "must be text up to 120 characters");
    }
    checkMissionImage(car, carPath, errors);
  });
}

function checkChapterReferences(data, chapterOrders, errors) {
  const refs = [];
  for (const entry of data.money?.earners || []) refs.push(["money earner", entry.chapterOrder]);
  for (const entry of data.money?.purchases || []) refs.push(["money purchase", entry.chapterOrder]);
  for (const area of data.collectibles?.areas || []) {
    refs.push(["collectibles area", area.chapterOrder]);
    for (const item of area.items || []) refs.push(["collectible", item.chapterOrder]);
  }
  for (const entry of data.secrets?.entries || []) refs.push(["secret", entry.chapterOrder]);
  for (const entry of data.skills?.stats || []) refs.push(["stat", entry.chapterOrder]);
  for (const entry of data.gear?.vehicles || []) refs.push(["vehicle", entry.chapterOrder]);
  for (const entry of data.gear?.weapons || []) refs.push(["weapon", entry.chapterOrder]);
  for (const entry of data.cars?.cars || []) refs.push(["car", entry.chapterOrder]);
  for (const [label, order] of refs) {
    if (Number.isInteger(order) && !chapterOrders.has(order)) {
      push(errors, label, `chapterOrder ${order} does not match a story chapter`);
    }
  }
}

/**
 * Validate the full data bundle.
 * @param {Record<string, unknown>} data keys are section names
 * @returns {string[]} human-readable errors, empty when valid
 */
export function validateAll(data) {
  const errors = [];
  if (!data || typeof data !== "object") return ["data bundle must be an object"];
  for (const section of DATA_FILES) {
    if (!(section in data)) push(errors, section, "file is missing");
  }
  if (errors.length) return errors;

  const ids = new Set();
  const chapterOrders = new Set();
  const areaIds = new Set();
  checkMeta(data.meta, errors, ids);
  checkStory(data.story, errors, ids, chapterOrders);
  checkMoney(data.money, errors, ids);
  checkCollectibles(data.collectibles, errors, ids, areaIds);
  checkSecrets(data.secrets, errors, ids, areaIds);
  checkSkills(data.skills, errors, ids);
  checkGear(data.gear, errors, ids);
  checkCars(data.cars, errors, ids);
  checkOnline(data.online, errors, ids);
  checkChapterReferences(data, chapterOrders, errors);
  return errors;
}
