/**
 * Tabs shown in the bottom bar.
 * Put a name back in this list to switch that section on again.
 * Names match the data-tab buttons in index.html: home, story, money, map, skills, cars, gear, online.
 */
export const ENABLED_TABS = ["story", "cars"];

/** First name in ENABLED_TABS is the page the app opens on. */
export const DEFAULT_TAB = ENABLED_TABS[0];

export function isTabEnabled(name) {
  return ENABLED_TABS.includes(name);
}

export const CHROME_KEY = "gta6-tracker-chrome-v1";

export function readChromeCollapsed(storage) {
  try {
    return storage.getItem(CHROME_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeChromeCollapsed(storage, collapsed) {
  try {
    storage.setItem(CHROME_KEY, collapsed ? "1" : "0");
  } catch {
    /* The preference is optional when storage is blocked. */
  }
}

/** First path segment of a hash such as #/skills/drills. */
export function tabForHash(hash) {
  const name = String(hash || "").replace(/^#/, "").replace(/^\//, "").split("/").filter(Boolean)[0];
  return name || DEFAULT_TAB;
}
