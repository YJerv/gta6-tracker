/**
 * Tabs shown in the bottom bar.
 * Put a name back in this list to switch that section on again.
 * Names match the data-tab buttons in index.html: home, story, money, map, skills, cars, gear, online.
 */
export const ENABLED_TABS = ["cars"];

/** First name in ENABLED_TABS is the page the app opens on. */
export const DEFAULT_TAB = ENABLED_TABS[0];

export function isTabEnabled(name) {
  return ENABLED_TABS.includes(name);
}

/**
 * Screens that share the Cars layout: a map, precision pins, three dropdowns, and a details card.
 * Weapons is ready but switched off. Add "weapons" to ENABLED_TABS once data/weapons.json
 * is beside cars.json in the same shape. The app loads that file on its own.
 */
export const MAP_LISTS = {
  cars: {
    id: "cars",
    title: "Cars",
    noun: "car",
    plural: "cars",
    progressList: "cars",
    prompt: "Tap a pin or a car in the list.",
  },
  weapons: {
    id: "weapons",
    title: "Weapons",
    noun: "weapon",
    plural: "weapons",
    progressList: "weaponPins",
    prompt: "Tap a pin or a weapon in the list.",
  },
};

export const FILTER_KEY = "gta6-tracker-filters-v1";
export const FILTER_FIELDS = ["chapter", "precision", "found", "area"];

export function emptyListFilters() {
  return { chapter: "all", precision: "all", found: "all", area: "all" };
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
  for (const id of Object.keys(MAP_LISTS)) result[id] = emptyListFilters();
  try {
    const raw = JSON.parse(storage.getItem(FILTER_KEY) || "null");
    if (!raw || typeof raw !== "object") return result;
    for (const id of Object.keys(MAP_LISTS)) result[id] = cleanFilters(raw[id]);
  } catch {
    /* A blocked store just starts from All. */
  }
  return result;
}

export function writeFilters(storage, filters) {
  try {
    const payload = {};
    for (const id of Object.keys(MAP_LISTS)) payload[id] = cleanFilters(filters[id]);
    storage.setItem(FILTER_KEY, JSON.stringify(payload));
  } catch {
    /* The choice still applies for this visit. */
  }
}

/** First path segment of a hash such as #/skills/drills. */
export function tabForHash(hash) {
  const name = String(hash || "").replace(/^#/, "").replace(/^\//, "").split("/").filter(Boolean)[0];
  return name || DEFAULT_TAB;
}
