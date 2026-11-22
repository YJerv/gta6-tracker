/**
 * Tabs shown in the bottom bar.
 * Put a name back in this list to switch that section on again.
 * Names match the data-tab buttons in index.html: home, story, money, map, skills, cars, gear, online.
 */
export const ENABLED_TABS = ["cars", "weapons", "steal", "skills"];

/** First name in ENABLED_TABS is the page the app opens on. */
export const DEFAULT_TAB = ENABLED_TABS[0];

export function isTabEnabled(name) {
  return ENABLED_TABS.includes(name);
}

/**
 * Screens that share the Cars layout: a map, precision pins, dropdowns, and a details card.
 * Each enabled name is loaded from data/<id>.json.
 */
export const MAP_LISTS = {
  cars: {
    id: "cars",
    title: "Cars",
    noun: "car",
    plural: "cars",
    progressList: "cars",
    primary: "chapter",
    prompt: "Tap a pin or a car in the list.",
  },
  weapons: {
    id: "weapons",
    title: "Weapons",
    noun: "weapon",
    plural: "weapons",
    progressList: "weaponPins",
    primary: "category",
    prompt: "Tap a pin or a weapon in the list.",
  },
  steal: {
    id: "steal",
    title: "Steal",
    noun: "job",
    plural: "jobs",
    progressList: "stealSpots",
    primary: "category",
    prompt: "Tap a job to see its spots on the map.",
  },
  skills: {
    id: "skills",
    title: "Skills",
    noun: "skill",
    plural: "skills",
    progressList: "skillGoals",
    primary: "category",
    prompt: "Tap a skill to open the steps, drills, and goal.",
  },
};

export const WEAPONS_FOUND_KEY = "gta6-tracker-weapons-found-v1";
export const STEAL_FOUND_KEY = "gta6-tracker-steal-found-v1";
export const SKILLS_FOUND_KEY = "gta6-tracker-skills-goals-v1";

export function filterStorageKey(id) {
  return `gta6-tracker-filters-${id}-v1`;
}

export const FILTER_FIELDS = ["chapter", "precision", "found", "area", "category", "payout", "sort"];

export function emptyListFilters() {
  return { chapter: "all", precision: "all", found: "all", area: "all", category: "all", payout: "all", sort: "default" };
}

export function readIdList(storage, key) {
  try {
    const raw = JSON.parse(storage.getItem(key) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter((id) => typeof id === "string" && id.length > 0 && id.length < 80);
  } catch {
    return [];
  }
}

export function writeIdList(storage, key, ids) {
  try {
    storage.setItem(key, JSON.stringify(ids));
  } catch {
    /* The tick still shows for this visit. */
  }
}

function cleanFilters(value) {
  const next = emptyListFilters();
  if (!value || typeof value !== "object") return next;
  for (const key of FILTER_FIELDS) {
    if (typeof value[key] === "string" && value[key].length > 0 && value[key].length < 80) {
      next[key] = value[key];
    }
  }
  return next;
}

export function readFilters(storage) {
  const result = {};
  for (const id of Object.keys(MAP_LISTS)) {
    try {
      result[id] = cleanFilters(JSON.parse(storage.getItem(filterStorageKey(id)) || "null"));
    } catch {
      result[id] = emptyListFilters();
    }
  }
  return result;
}

export function writeFilters(storage, filters) {
  for (const id of Object.keys(MAP_LISTS)) {
    try {
      storage.setItem(filterStorageKey(id), JSON.stringify(cleanFilters(filters[id])));
    } catch {
      /* The choice still applies for this visit. */
    }
  }
}

/** First path segment of a hash such as #/skills/drills. */
export function tabForHash(hash) {
  const name = String(hash || "").replace(/^#/, "").replace(/^\//, "").split("/").filter(Boolean)[0];
  return name || DEFAULT_TAB;
}
