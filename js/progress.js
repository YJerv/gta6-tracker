export const PROGRESS_VERSION = 1;
export const APP_ID = "gta6-tracker";
export const STORAGE_KEY = "gta6-tracker-progress-v1";

export const LIST_KEYS = [
  "missions",
  "collectibles",
  "secrets",
  "settings",
  "drills",
  "stats",
  "vehicles",
  "weapons",
  "money",
  "online",
];

export const SECTION_DEFS = [
  { id: "story", label: "Story", hash: "#/story", lists: ["missions"] },
  { id: "money", label: "Money", hash: "#/money", lists: ["money"] },
  { id: "collectibles", label: "Collectibles", hash: "#/map", lists: ["collectibles"] },
  { id: "secrets", label: "Secrets", hash: "#/map/secrets", lists: ["secrets"] },
  { id: "skills", label: "Skills", hash: "#/skills", lists: ["settings", "drills", "stats"] },
  { id: "gear", label: "Gear", hash: "#/gear", lists: ["vehicles", "weapons"] },
  { id: "online", label: "Online prep", hash: "#/online", lists: ["online"] },
];

const SIGNALS = ["version", ...LIST_KEYS, "cash", "cashNote", "spoilersHidden", "revealedIds"];

const STAGE_LABEL = {
  early: "Early story",
  mid: "Mid story",
  late: "Late story",
};

const SIDE_ORDER = ["drills", "collectibles", "online", "settings", "vehicles", "weapons", "money", "stats", "secrets"];

const SIDE_BLURB = {
  drills: "A generic drill you can do without later-chapter details.",
  collectibles: "A collectible in a chapter you have already opened.",
  online: "Generic preparation while online is unannounced.",
  settings: "A generic Xbox setting to decide once.",
  vehicles: "A vehicle row you have already opened.",
  weapons: "A weapon row you have already opened.",
  money: "A money tip in a stage you have already opened.",
  stats: "A stat row in a chapter you have already opened.",
  secrets: "A secret in a chapter you have already opened.",
};

export function emptyProgress(now = new Date().toISOString()) {
  return {
    version: PROGRESS_VERSION,
    missions: [],
    collectibles: [],
    secrets: [],
    settings: [],
    drills: [],
    stats: [],
    vehicles: [],
    weapons: [],
    money: [],
    online: [],
    cash: null,
    cashNote: "",
    spoilersHidden: true,
    revealedIds: [],
    storyOpen: { chapters: {}, missions: {} },
    updatedAt: now,
  };
}

function normaliseStoryOpen(value) {
  const chapters = {};
  const missions = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return { chapters, missions };
  for (const group of ["chapters", "missions"]) {
    const source = value[group];
    if (!source || typeof source !== "object" || Array.isArray(source)) continue;
    const target = group === "chapters" ? chapters : missions;
    for (const [id, open] of Object.entries(source)) {
      if (typeof id !== "string" || id.trim() === "" || id.length > 80) continue;
      if (typeof open !== "boolean") continue;
      target[id] = open;
    }
  }
  return { chapters, missions };
}

function cleanIdList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const id = entry.trim();
    if (!id || id.length > 80 || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

export function normaliseProgress(input, now = new Date().toISOString()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Progress must be a JSON object." };
  }
  if (!SIGNALS.some((key) => Object.prototype.hasOwnProperty.call(input, key))) {
    return { ok: false, error: "Unrecognised progress file." };
  }
  if (input.version !== undefined && input.version !== PROGRESS_VERSION) {
    return { ok: false, error: `Unsupported progress version (${input.version}).` };
  }

  const progress = emptyProgress(now);
  for (const key of LIST_KEYS) progress[key] = cleanIdList(input[key]);
  progress.revealedIds = cleanIdList(input.revealedIds);
  progress.storyOpen = normaliseStoryOpen(input.storyOpen);
  if (typeof input.spoilersHidden === "boolean") progress.spoilersHidden = input.spoilersHidden;

  if (input.cash === null || input.cash === undefined) {
    progress.cash = null;
  } else if (typeof input.cash === "number" && Number.isSafeInteger(input.cash) && input.cash >= 0) {
    progress.cash = input.cash;
  } else if (typeof input.cash === "string" && /^\d+$/.test(input.cash.trim())) {
    progress.cash = Number(input.cash.trim());
  } else {
    return { ok: false, error: "Cash must be a whole number or null." };
  }

  if (input.cashNote === undefined || input.cashNote === null) {
    progress.cashNote = "";
  } else if (typeof input.cashNote === "string" && input.cashNote.trim().length <= 140) {
    progress.cashNote = input.cashNote.trim();
  } else {
    return { ok: false, error: "Cash note must be text up to 140 characters." };
  }

  progress.updatedAt = typeof input.updatedAt === "string" && input.updatedAt.trim() ? input.updatedAt : now;
  return { ok: true, progress };
}

export function exportBundle(progress, now = new Date().toISOString()) {
  const normalised = normaliseProgress(progress, now);
  if (!normalised.ok) {
    return { ok: false, error: normalised.error };
  }
  return {
    ok: true,
    bundle: {
      app: APP_ID,
      exportedAt: now,
      progress: normalised.progress,
    },
  };
}

export function importBundle(data, now = new Date().toISOString()) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "That file is not a progress object." };
  }
  if (data.app !== undefined && data.app !== APP_ID) {
    return { ok: false, error: "That file is not from this tracker." };
  }
  if (data.progress !== undefined) return normaliseProgress(data.progress, now);
  return normaliseProgress(data, now);
}

export function toggleId(progress, list, id, now = new Date().toISOString()) {
  if (!LIST_KEYS.includes(list)) return { ok: false, error: "Unknown list." };
  if (typeof id !== "string" || id.trim() === "") return { ok: false, error: "Missing id." };
  const current = progress[list];
  const exists = current.includes(id);
  const nextList = exists ? current.filter((item) => item !== id) : current.concat(id);
  return {
    ok: true,
    on: !exists,
    progress: { ...progress, [list]: nextList, updatedAt: now },
  };
}

export function revealId(progress, id, now = new Date().toISOString()) {
  if (typeof id !== "string" || !id) return progress;
  if (progress.revealedIds.includes(id)) return { ...progress, updatedAt: now };
  return { ...progress, revealedIds: progress.revealedIds.concat(id), updatedAt: now };
}

export function setSpoilersHidden(progress, hidden, now = new Date().toISOString()) {
  return { ...progress, spoilersHidden: Boolean(hidden), updatedAt: now };
}

export function setCash(progress, input, now = new Date().toISOString()) {
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > 140) return { ok: false, error: "Keep the note to 140 characters." };
  let cash = null;
  const raw = input.cash;
  if (raw === "" || raw === null || raw === undefined) {
    cash = null;
  } else {
    const text = String(raw).trim();
    if (!/^\d+$/.test(text)) return { ok: false, error: "Enter a whole number, or leave the amount blank." };
    const value = Number(text);
    if (!Number.isSafeInteger(value)) return { ok: false, error: "That amount is too large." };
    cash = value;
  }
  return { ok: true, progress: { ...progress, cash, cashNote: note, updatedAt: now } };
}

export function formatCash(cash) {
  if (cash === null || cash === undefined) return "Not set";
  return new Intl.NumberFormat("en-GB").format(cash);
}

export function percentOf(done, total) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

export function furthestTickedChapter(chapters, missionIds) {
  const done = new Set(missionIds);
  let furthest = 0;
  for (const chapter of chapters) {
    if (chapter.missionIds.some((id) => done.has(id))) furthest = Math.max(furthest, chapter.order);
  }
  return furthest;
}

export function visibleThroughChapter(chapters, missionIds) {
  return Math.max(1, furthestTickedChapter(chapters, missionIds));
}

export function isHidden(subject, progress, through) {
  if (!progress.spoilersHidden) return false;
  if (subject.chapterOrder == null) return false;
  if (subject.chapterOrder <= through) return false;
  if (progress.revealedIds.includes(subject.id)) return false;
  if (subject.groupId && progress.revealedIds.includes(subject.groupId)) return false;
  return true;
}

export function completionReport(catalog, progress) {
  const sections = SECTION_DEFS.map((def) => {
    const entries = catalog.items.filter((item) => def.lists.includes(item.list));
    const done = entries.filter((item) => progress[item.list].includes(item.id)).length;
    return {
      id: def.id,
      label: def.label,
      hash: def.hash,
      total: entries.length,
      done,
      percent: percentOf(done, entries.length),
    };
  });
  const done = sections.reduce((sum, section) => sum + section.done, 0);
  const total = sections.reduce((sum, section) => sum + section.total, 0);
  return { done, total, percent: percentOf(done, total), sections };
}

export function nextUp(catalog, progress) {
  const through = visibleThroughChapter(catalog.chapters, progress.missions);
  const storyItems = catalog.items.filter((item) => item.list === "missions").sort((a, b) => a.sort - b.sort);
  const nextMission = storyItems.find((item) => !progress.missions.includes(item.id)) || null;
  let story = null;
  if (nextMission) {
    const chapter = catalog.chapters.find((entry) => entry.id === nextMission.groupId);
    story = {
      id: nextMission.id,
      title: nextMission.title,
      chapterOrder: nextMission.chapterOrder,
      chapterTitle: chapter ? chapter.title : "",
      groupId: nextMission.groupId,
      hidden: isHidden(nextMission, progress, through),
    };
  }

  let side = null;
  if (!story || story.hidden) {
    for (const list of SIDE_ORDER) {
      const found = catalog.items
        .filter((item) => item.list === list)
        .sort((a, b) => a.sort - b.sort)
        .find((item) => !progress[item.list].includes(item.id) && !isHidden(item, progress, through));
      if (found) {
        side = {
          id: found.id,
          list: found.list,
          title: found.title,
          section: found.section,
          sub: found.sub,
          blurb: SIDE_BLURB[list],
        };
        break;
      }
    }
  }
  return { through, story, side };
}

function savedStoryOpen(progress) {
  const saved = progress.storyOpen;
  return {
    chapters: saved && saved.chapters ? saved.chapters : {},
    missions: saved && saved.missions ? saved.missions : {},
  };
}

/** True when this chapter's mission list should be open. Missing keys follow the next-up chapter. */
export function isChapterExpanded(catalog, progress, chapterId) {
  const saved = savedStoryOpen(progress);
  if (Object.prototype.hasOwnProperty.call(saved.chapters, chapterId)) return saved.chapters[chapterId];
  const suggestion = nextUp(catalog, progress);
  return Boolean(suggestion.story && suggestion.story.groupId === chapterId);
}

/** True when this mission's steps should be open. Missing keys follow the next-up mission. */
export function isMissionExpanded(catalog, progress, missionId) {
  const saved = savedStoryOpen(progress);
  if (Object.prototype.hasOwnProperty.call(saved.missions, missionId)) return saved.missions[missionId];
  const suggestion = nextUp(catalog, progress);
  return Boolean(suggestion.story && suggestion.story.id === missionId);
}

export function setStoryOpen(progress, group, id, open, now = new Date().toISOString()) {
  if (group !== "chapters" && group !== "missions") return progress;
  if (typeof id !== "string" || id.trim() === "") return progress;
  const saved = savedStoryOpen(progress);
  return {
    ...progress,
    storyOpen: {
      chapters: { ...saved.chapters },
      missions: { ...saved.missions },
      [group]: { ...saved[group], [id]: Boolean(open) },
    },
    updatedAt: now,
  };
}

/** Record an explicit open or closed value for every chapter and mission. */
export function setAllStoryOpen(progress, catalog, open, now = new Date().toISOString()) {
  const chapters = {};
  const missions = {};
  const value = Boolean(open);
  for (const chapter of catalog.chapters) chapters[chapter.id] = value;
  for (const item of catalog.items) {
    if (item.list === "missions") missions[item.id] = value;
  }
  return { ...progress, storyOpen: { chapters, missions }, updatedAt: now };
}

function detailFor(entry, extra) {
  return {
    kicker: extra.kicker,
    title: entry.title,
    verified: entry.verified,
    generic: entry.generic,
    source: entry.source,
    summary: extra.summary,
    blocks: extra.blocks || [],
  };
}

export function buildCatalog(data) {
  const items = [];
  const details = new Map();
  const add = (item, detail) => {
    items.push(item);
    details.set(item.id, detail);
  };

  const chapters = [...data.story.chapters]
    .sort((a, b) => a.order - b.order)
    .map((chapter) => {
      const missionIds = [];
      const missions = [...chapter.missions].sort((a, b) => a.order - b.order);
      for (const mission of missions) {
        missionIds.push(mission.id);
        add({
          id: mission.id,
          list: "missions",
          section: "story",
          title: mission.title,
          chapterOrder: chapter.order,
          groupId: chapter.id,
          sort: chapter.order * 100 + mission.order,
          stage: null,
          areaId: null,
          sub: null,
        }, detailFor(mission, {
          kicker: `Chapter ${chapter.order} · Mission ${mission.order}`,
          summary: mission.summary,
          blocks: [
            { heading: "Steps", lines: mission.steps },
            { heading: "Bonus and gold objectives", lines: mission.bonusObjectives },
            { heading: "Missable items", lines: mission.missables },
          ],
        }));
      }
      return {
        id: chapter.id,
        order: chapter.order,
        title: chapter.title,
        verified: chapter.verified,
        generic: chapter.generic,
        source: chapter.source,
        summary: chapter.summary,
        missionIds,
      };
    });

  const areas = [...data.collectibles.areas]
    .sort((a, b) => a.order - b.order)
    .map((area) => {
      const itemIds = [];
      area.items.forEach((item, index) => {
        itemIds.push(item.id);
        add({
          id: item.id,
          list: "collectibles",
          section: "map",
          title: item.title,
          chapterOrder: area.chapterOrder,
          groupId: area.id,
          sort: area.order * 100 + index,
          stage: null,
          areaId: area.id,
          sub: "collectibles",
        }, detailFor(item, {
          kicker: `Area ${area.order}`,
          summary: item.detail,
          blocks: [{ heading: "Category", lines: [item.category] }],
        }));
      });
      return {
        id: area.id,
        order: area.order,
        title: area.title,
        chapterOrder: area.chapterOrder,
        verified: area.verified,
        generic: area.generic,
        source: area.source,
        summary: "",
        itemIds,
      };
    });

  const areaOrder = new Map(areas.map((area) => [area.id, area.order]));
  data.secrets.entries.forEach((entry, index) => {
    const areaNumber = entry.areaId ? areaOrder.get(entry.areaId) : null;
    add({
      id: entry.id,
      list: "secrets",
      section: "map",
      title: entry.title,
      chapterOrder: entry.chapterOrder,
      groupId: null,
      sort: index,
      stage: null,
      areaId: entry.areaId,
      sub: "secrets",
    }, detailFor(entry, {
      kicker: areaNumber ? `Area ${areaNumber}` : "Secret",
      summary: entry.detail,
      blocks: [],
    }));
  });

  const addMoney = (entry, index, sub) => {
    add({
      id: entry.id,
      list: "money",
      section: "money",
      title: entry.title,
      chapterOrder: entry.chapterOrder,
      groupId: `money-${entry.stage}`,
      sort: entry.chapterOrder * 100 + index,
      stage: entry.stage,
      areaId: null,
      sub,
    }, detailFor(entry, {
      kicker: STAGE_LABEL[entry.stage] || "Money",
      summary: entry.detail,
      blocks: [],
    }));
  };
  data.money.earners.forEach((entry, index) => addMoney(entry, index, "earners"));
  data.money.purchases.forEach((entry, index) => addMoney(entry, index, "buying"));

  data.skills.xboxSettings.forEach((entry, index) => {
    add({
      id: entry.id,
      list: "settings",
      section: "skills",
      title: entry.title,
      chapterOrder: entry.chapterOrder,
      groupId: null,
      sort: index,
      stage: null,
      areaId: null,
      sub: "settings",
    }, detailFor(entry, {
      kicker: "Generic · Xbox",
      summary: entry.detail,
      blocks: [],
    }));
  });

  const disciplineLabel = { driving: "Generic · Driving", aiming: "Generic · Aiming" };
  data.skills.drills.forEach((entry, index) => {
    add({
      id: entry.id,
      list: "drills",
      section: "skills",
      title: entry.title,
      chapterOrder: entry.chapterOrder,
      groupId: null,
      sort: index,
      stage: null,
      areaId: null,
      sub: "drills",
    }, detailFor(entry, {
      kicker: disciplineLabel[entry.discipline] || "Generic",
      summary: entry.detail,
      blocks: [],
    }));
  });

  data.skills.stats.forEach((entry, index) => {
    add({
      id: entry.id,
      list: "stats",
      section: "skills",
      title: entry.title,
      chapterOrder: entry.chapterOrder,
      groupId: entry.chapterOrder == null ? null : `stats-chapter-${entry.chapterOrder}`,
      sort: (entry.chapterOrder || 0) * 100 + index,
      stage: null,
      areaId: null,
      sub: "stats",
    }, detailFor(entry, {
      kicker: `Chapter ${entry.chapterOrder}`,
      summary: entry.detail,
      blocks: [],
    }));
  });

  const addGear = (entry, index, list, sub) => {
    add({
      id: entry.id,
      list,
      section: "gear",
      title: entry.title,
      chapterOrder: entry.chapterOrder,
      groupId: `${list}-${entry.stage}`,
      sort: entry.chapterOrder * 100 + index,
      stage: entry.stage,
      areaId: null,
      sub,
    }, detailFor(entry, {
      kicker: STAGE_LABEL[entry.stage] || "Gear",
      summary: entry.detail,
      blocks: [
        { heading: "Where to find it", lines: [entry.where] },
        { heading: "Role", lines: [entry.role] },
      ],
    }));
  };
  data.gear.vehicles.forEach((entry, index) => addGear(entry, index, "vehicles", "vehicles"));
  data.gear.weapons.forEach((entry, index) => addGear(entry, index, "weapons", "weapons"));

  data.online.checklist.forEach((entry, index) => {
    add({
      id: entry.id,
      list: "online",
      section: "online",
      title: entry.title,
      chapterOrder: entry.chapterOrder,
      groupId: null,
      sort: index,
      stage: null,
      areaId: null,
      sub: "checklist",
    }, detailFor(entry, {
      kicker: "Generic readiness",
      summary: entry.detail,
      blocks: [],
    }));
  });

  const notes = data.online.news.map((entry, index) => {
    details.set(entry.id, detailFor(entry, {
      kicker: entry.date || "Undated",
      summary: entry.detail,
      blocks: [],
    }));
    return {
      id: entry.id,
      list: null,
      section: "online",
      title: entry.title,
      chapterOrder: entry.chapterOrder,
      groupId: null,
      sort: index,
      stage: null,
      areaId: null,
      sub: "news",
    };
  });

  return { chapters, areas, items, notes, details };
}
