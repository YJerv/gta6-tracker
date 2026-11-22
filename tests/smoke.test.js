import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { escapeHtml } from "../js/html.js";
import {
  buildCatalog,
  completionReport,
  emptyProgress,
  exportBundle,
  formatCash,
  importBundle,
  isChapterExpanded,
  isHidden,
  isMissionExpanded,
  nextUp,
  normaliseProgress,
  revealId,
  setAllStoryOpen,
  setCash,
  setSpoilersHidden,
  setStoryOpen,
  toggleId,
  visibleThroughChapter,
} from "../js/progress.js";
import { ENABLED_TABS, MAP_LISTS, WEAPONS_FOUND_KEY, filterStorageKey, isTabEnabled, readFilters, readIdList, writeFilters, writeIdList } from "../js/config.js";
import { clusterLocations, illustrationCredits, mapViewForCar, mapViewForPoints, parseRoute, payoutLine, renderCard, renderMain, skillTotals, stealTotals } from "../js/render.js";
import { validateAll } from "../scripts/schema.js";
import { loadData } from "../scripts/validate.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = loadData(path.join(root, "data"));
const catalog = buildCatalog(data);
const NOW = "2026-11-20T12:00:00.000Z";

function model(progress, route) {
  return {
    data,
    catalog,
    progress,
    route: { areaId: "all", sub: null, ...route },
    storageWarning: null,
    canInstall: false,
    cashError: null,
  };
}

test("data files match the schema", () => {
  assert.deepEqual(validateAll(data), []);
});

test("recorded brief stays factual and placeholders stay unverified", () => {
  assert.equal(data.meta.releaseDate, "2026-11-19");
  assert.equal(data.meta.singlePlayerOnly, true);
  assert.equal(data.meta.onlineAnnounced, false);
  assert.equal(data.meta.platform, "Xbox Series X|S");
  const unverified = [];
  const walk = (value) => {
    if (!value || typeof value !== "object") return;
    if (value.verified === false) unverified.push(value);
    for (const child of Object.values(value)) walk(child);
  };
  walk(data);
  assert.ok(unverified.length > 10);
  for (const entry of unverified) {
    if (entry.precision || entry.locations || String(entry.id || "").startsWith("steal-")) continue;
    assert.equal(entry.source, null);
    assert.match(entry.title, /^PLACEHOLDER:/);
  }
});

test("schema rejects invented titles, missing sources, bad dates, and duplicate ids", () => {
  const invented = structuredClone(data);
  invented.story.chapters[0].missions.find((mission) => mission.id === "chapter-1-mission-11").title = "The marina job";
  assert.ok(validateAll(invented).some((error) => error.includes("PLACEHOLDER")));

  const unsourced = structuredClone(data);
  unsourced.skills.items[0].source = "";
  assert.ok(validateAll(unsourced).some((error) => error.includes("source")));

  const priced = structuredClone(data);
  priced.money.earners[0].detail = "PLACEHOLDER: Pays £50.";
  assert.ok(validateAll(priced).some((error) => error.includes("price")));

  const dated = structuredClone(data);
  dated.meta.lastUpdated = "2026-02-31";
  assert.ok(validateAll(dated).some((error) => error.includes("lastUpdated")));

  const duplicated = structuredClone(data);
  duplicated.secrets.entries[0].id = duplicated.story.chapters[0].id;
  assert.ok(validateAll(duplicated).some((error) => error.includes("duplicates id")));
});

test("empty progress is 0% and the first mission is next", () => {
  const progress = emptyProgress(NOW);
  const report = completionReport(catalog, progress);
  assert.equal(report.done, 0);
  assert.equal(report.percent, 0);
  assert.equal(report.total, catalog.items.length);
  const missionCount = data.story.chapters.reduce((sum, chapter) => sum + chapter.missions.length, 0);
  assert.equal(report.sections.find((section) => section.id === "story").total, missionCount);
  const suggestion = nextUp(catalog, progress);
  assert.equal(suggestion.through, 1);
  assert.equal(suggestion.story.id, "chapter-1-mission-1");
  assert.equal(suggestion.story.hidden, false);
  assert.equal(suggestion.side, null);
});

test("ticking a mission moves completion, the boundary, and the suggestion", () => {
  const progress = emptyProgress(NOW);
  const once = toggleId(progress, "missions", "chapter-1-mission-1", NOW);
  assert.equal(once.on, true);
  const report = completionReport(catalog, once.progress);
  assert.equal(report.sections.find((section) => section.id === "story").done, 1);
  assert.equal(report.done, 1);
  assert.equal(visibleThroughChapter(catalog.chapters, once.progress.missions), 1);
  const again = toggleId(once.progress, "missions", "chapter-1-mission-1", NOW);
  assert.equal(again.on, false);
  assert.equal(completionReport(catalog, again.progress).done, 0);

  const chapterTwo = toggleId(progress, "missions", "chapter-2-mission-1", NOW).progress;
  assert.equal(visibleThroughChapter(catalog.chapters, chapterTwo.missions), 2);
  const suggestion = nextUp(catalog, chapterTwo);
  assert.equal(suggestion.story.id, "chapter-1-mission-1");
  assert.equal(suggestion.story.hidden, false);
});

test("spoilers cover later chapters until revealed or switched off", () => {
  const progress = emptyProgress(NOW);
  const through = visibleThroughChapter(catalog.chapters, progress.missions);
  const later = catalog.items.find((item) => item.id === "chapter-2-mission-1");
  const early = catalog.items.find((item) => item.id === "chapter-1-mission-1");
  assert.equal(isHidden(early, progress, through), false);
  assert.equal(isHidden(later, progress, through), true);
  const revealed = revealId(progress, "chapter-2");
  assert.equal(isHidden(later, revealed, through), false);
  const open = setSpoilersHidden(progress, false, NOW);
  assert.equal(isHidden(later, open, through), false);

  const doneChapterOne = data.story.chapters[0].missions
    .map((mission) => mission.id)
    .reduce((current, id) => toggleId(current, "missions", id, NOW).progress, progress);
  const caughtUp = nextUp(catalog, doneChapterOne);
  assert.equal(caughtUp.story.id, "chapter-2-mission-1");
  assert.equal(caughtUp.story.hidden, true);
  assert.equal(caughtUp.side.list, "collectibles");
});

test("export and import round-trip, and rubbish is rejected", () => {
  let progress = toggleId(emptyProgress(NOW), "collectibles", "area-1-collectible-1", NOW).progress;
  progress = setCash(progress, { cash: "1250", note: " After the prologue " }, NOW).progress;
  const exported = exportBundle(progress, NOW);
  assert.equal(exported.ok, true);
  const raw = JSON.parse(JSON.stringify(exported.bundle));
  const imported = importBundle(raw, "2026-11-21T00:00:00.000Z");
  assert.equal(imported.ok, true);
  assert.deepEqual(imported.progress.collectibles, ["area-1-collectible-1"]);
  assert.equal(imported.progress.cash, 1250);
  assert.equal(imported.progress.cashNote, "After the prologue");
  assert.equal(formatCash(imported.progress.cash), "1,250");
  assert.equal(formatCash(null), "Not set");

  assert.equal(importBundle({ app: "other-game", progress: {} }, NOW).ok, false);
  assert.equal(importBundle({ hello: "nope" }, NOW).ok, false);
  assert.equal(normaliseProgress({ version: 1, cash: -5 }, NOW).ok, false);
  assert.equal(setCash(emptyProgress(NOW), { cash: "12.5", note: "" }, NOW).ok, false);
  assert.equal(importBundle("[]", NOW).ok, false);
});

test("story chapters and missions fold, and the choice is kept", () => {
  const fresh = emptyProgress(NOW);
  assert.equal(isChapterExpanded(catalog, fresh, "chapter-1"), true);
  assert.equal(isChapterExpanded(catalog, fresh, "chapter-2"), false);
  assert.equal(isMissionExpanded(catalog, fresh, "chapter-1-mission-1"), true);
  assert.equal(isMissionExpanded(catalog, fresh, "chapter-1-mission-2"), false);

  const shutChapter = setStoryOpen(fresh, "chapters", "chapter-1", false, NOW);
  assert.equal(isChapterExpanded(catalog, shutChapter, "chapter-1"), false);
  const shutMission = setStoryOpen(fresh, "missions", "chapter-1-mission-1", false, NOW);
  assert.equal(isMissionExpanded(catalog, shutMission, "chapter-1-mission-1"), false);
  assert.equal(isMissionExpanded(catalog, shutMission, "chapter-1-mission-2"), false);

  const moved = toggleId(fresh, "missions", "chapter-1-mission-1", NOW).progress;
  assert.equal(isMissionExpanded(catalog, moved, "chapter-1-mission-1"), false);
  assert.equal(isMissionExpanded(catalog, moved, "chapter-1-mission-2"), true);

  const opened = setAllStoryOpen(fresh, catalog, true, NOW);
  assert.equal(isChapterExpanded(catalog, opened, "chapter-3"), true);
  assert.equal(isMissionExpanded(catalog, opened, "chapter-2-mission-3"), true);
  const closed = setAllStoryOpen(opened, catalog, false, NOW);
  assert.equal(isChapterExpanded(catalog, closed, "chapter-1"), false);
  assert.equal(isMissionExpanded(catalog, closed, "chapter-1-mission-1"), false);

  const exported = exportBundle(shutChapter, NOW);
  const imported = importBundle(exported.bundle, NOW);
  assert.equal(imported.ok, true);
  assert.equal(imported.progress.storyOpen.chapters["chapter-1"], false);
  assert.equal(normaliseProgress({ version: 1, storyOpen: { chapters: { bad: "yes" }, missions: [] } }, NOW).progress.storyOpen.chapters.bad, undefined);

  const story = renderMain(model(fresh, { section: "story" }));
  assert.match(story, /Expand all/);
  assert.match(story, /data-chapter-toggle="chapter-1"[^>]*aria-expanded="true"/);
  assert.match(story, /0\/22/);
  assert.match(story, />Prologue</);
  assert.match(story, /PowerPyx/);
  assert.match(story, /Sourced/);
  assert.match(story, /data-mission-toggle="chapter-1-mission-1"[^>]*aria-expanded="true"/);
  assert.match(story, /data-mission-toggle="chapter-1-mission-2"[^>]*aria-expanded="false"/);
  assert.equal(story.split("Bonus and gold objectives").length - 1, 1);
  assert.doesNotMatch(story, /data-chapter-toggle="chapter-2"/);
  assert.doesNotMatch(story, /Chapter 2 mission/);

  const collapsed = renderMain(model(shutChapter, { section: "story" }));
  assert.doesNotMatch(collapsed, /Chapter 1 mission 1/);
  assert.match(collapsed, /data-chapter-toggle="chapter-1"[^>]*aria-expanded="false"/);

  const everything = renderMain(model(opened, { section: "story" }));
  assert.equal(everything.split("Bonus and gold objectives").length - 1, 22);
  assert.doesNotMatch(everything, /Chapter 2 mission/);
});

test("the story notice stays above the chapters when spoilers are hidden", () => {
  assert.equal(data.story.notice.title, "Good to know");
  assert.equal(data.story.notice.lastUpdated, "2026-11-20");
  assert.match(data.story.notice.source, /PowerPyx/);
  assert.equal(data.story.notice.items.length, 3);

  const hidden = renderMain(model(emptyProgress(NOW), { section: "story" }));
  const shown = renderMain(model(setSpoilersHidden(emptyProgress(NOW), false, NOW), { section: "story" }));
  for (const html of [hidden, shown]) {
    assert.match(html, /<details class="notice" open>/);
    assert.match(html, /Good to know/);
    assert.match(html, /no gold medals/);
    assert.match(html, /missions 3 to 6/);
    assert.match(html, /guides disagree/);
    assert.ok(html.indexOf("Good to know") < html.indexOf("data-chapter-toggle"));
  }

  const broken = structuredClone(data);
  broken.story.notice.source = "";
  assert.ok(validateAll(broken).some((error) => error.includes("story.notice.source")));
});

test("mission illustrations are credited and stay inside the open mission", () => {
  const missions = data.story.chapters[0].missions;
  const withImage = missions.filter((mission) => mission.image);
  assert.deepEqual(withImage.map((mission) => mission.id), [
    "chapter-1-mission-1",
    "chapter-1-mission-2",
    "chapter-1-mission-3",
    "chapter-1-mission-4",
    "chapter-1-mission-5",
    "chapter-1-mission-6",
    "chapter-1-mission-8",
    "chapter-1-mission-9",
    "chapter-1-mission-10",
  ]);
  assert.equal("image" in missions.find((mission) => mission.id === "chapter-1-mission-7"), false);
  assert.equal(illustrationCredits(data.story).length, 1);
  assert.match(illustrationCredits(data.story)[0], /Rockstar Games/);

  const open = renderMain(model(emptyProgress(NOW), { section: "story" }));
  assert.match(open, /src="images\/chapter-1-mission-1\.jpg"/);
  assert.match(open, /loading="lazy"/);
  assert.match(open, /Lucia in an orange prison jumpsuit and handcuffs, escorted past other inmates\./);
  assert.match(open, /Illustration/);
  assert.match(open, /Official promo image, not a screenshot of this mission/);
  assert.doesNotMatch(open, /src="images\/chapter-1-mission-2\.jpg"/);

  const shut = renderMain(model(setStoryOpen(emptyProgress(NOW), "chapters", "chapter-1", false, NOW), { section: "story" }));
  assert.equal(shut.includes("<img"), false);

  const missing = structuredClone(data);
  missing.story.chapters[0].missions[0].image = "images/missing.jpg";
  assert.ok(validateAll(missing).some((error) => error.includes("file not found")));

  const bare = structuredClone(data);
  delete bare.story.chapters[0].missions[0].imageAlt;
  assert.ok(validateAll(bare).some((error) => error.includes("imageAlt") || error.includes("set together")));

  const page = readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(page, /free, non-commercial, and has no ads/);
  assert.match(page, /fan content policy covers non-commercial use only/);
});

test("sourced cars use the Leonida map and hide later chapters", () => {
  assert.equal(data.cars.cars.length, 30);
  assert.equal(data.cars.map.image, "images/cars/leonida-map.jpg");
  assert.equal(data.cars.map.width, 1402);
  assert.equal(data.cars.map.height, 1920);
  assert.match(data.cars.map.imageCredit, /Rockstar Games/);
  const withPicture = data.cars.cars.filter((car) => car.image);
  assert.equal(withPicture.length, 29);
  assert.equal(withPicture.filter((car) => car.imageVerified === true).length, 8);
  assert.equal(withPicture.filter((car) => car.imageVerified === false).length, 21);
  assert.ok(withPicture.every((car) => typeof car.imageSource === "string" && car.imageSource.startsWith("https://")));
  const hustler = data.cars.cars.find((car) => car.id === "car-driveshaft-hustler");
  assert.equal(hustler.image, null);
  assert.equal(hustler.imageCredit, null);
  assert.equal(hustler.imageAlt, null);
  assert.equal(hustler.imageSource, null);
  assert.equal(hustler.imageVerified, false);
  for (const car of data.cars.cars) {
    assert.equal(car.verified, true);
    assert.equal(typeof car.source, "string");
    assert.ok(car.mapX >= 0 && car.mapX <= 100);
    assert.ok(car.mapY >= 0 && car.mapY <= 100);
  }

  const progress = emptyProgress(NOW);
  const page = renderMain(model(progress, { section: "cars" }));
  assert.match(page, /src="images\/cars\/leonida-map\.jpg"/);
  assert.match(page, /data-pin="car-dinka-enduro"/);
  assert.match(page, /data-map-x="58.6"/);
  assert.match(page, /precision-exact/);
  assert.match(page, /class="filter-row"/);
  assert.match(page, /data-filter="precision"/);
  assert.match(page, /data-filter="found"/);
  assert.match(page, /value="street"/);
  assert.match(page, /Still to find/);
  assert.doesNotMatch(page, /All precision/);
  assert.doesNotMatch(page, /Pins sit on Rockstar/);
  assert.match(page, /data-map-open/);
  assert.match(page, /GTADB/);
  assert.match(page, /GTA6Map\.io/);
  assert.match(page, /GTA6 GPS/);
  assert.match(page, /Driveshaft Hustler/);
  assert.doesNotMatch(page, /Twinstripe Vigero/);
  assert.match(page, /Cars in chapter 3/);
  assert.match(page, /data-filter="chapter"/);
  assert.match(page, /value="1"/);
  assert.match(page, /Map: Rockstar Games/);
  assert.ok(page.indexOf('class="car-list"') < page.indexOf('class="map-credits"'));

  const open = renderMain({
    ...model(progress, { section: "cars" }),
    carsUi: { area: "all", found: "all", chapter: "all", selected: "car-dinka-enduro" },
  });
  assert.match(open, /src="images\/cars\/car-dinka-enduro\.jpg"/);
  assert.match(open, /On the right block, roughly 1-2% of map width error/);
  assert.match(open, /The poster has no street names/);
  assert.match(open, />Exact</);
  assert.match(open, /Found it/);
  assert.match(open, /data-block-toggle/);
  assert.match(open, />Class</);
  assert.match(open, />How to find it</);
  assert.match(open, />Sources</);
  assert.match(open, /https:\/\/www\.powerpyx\.com/);
  assert.doesNotMatch(open, /image-unverified/);
  const unverified = renderMain({
    ...model(progress, { section: "cars" }),
    carsUi: { area: "all", found: "all", chapter: "all", selected: "car-penumbra-ff-eclipse" },
  });
  assert.match(unverified, /src="images\/cars\/car-penumbra-ff-eclipse\.jpg"/);
  assert.match(unverified, /image-unverified/);
  assert.match(unverified, /Unverified image/);
  const plain = renderMain({
    ...model(progress, { section: "cars" }),
    carsUi: { area: "all", found: "all", chapter: "all", selected: "car-driveshaft-hustler" },
  });
  assert.match(plain, /Image coming soon/);
  assert.doesNotMatch(plain, /image-unverified/);
  assert.doesNotMatch(plain, /car-row-copy/);

  const shown = renderMain(model(setSpoilersHidden(progress, false, NOW), { section: "cars" }));
  assert.match(shown, /Twinstripe Vigero/);

  const broken = structuredClone(data);
  broken.cars.cars[0].image = "images/cars/missing-car.jpg";
  broken.cars.cars[0].imageCredit = "Image credit text";
  broken.cars.cars[0].imageAlt = "A car picture that is missing";
  broken.cars.cars[0].imageSource = "https://example.com/missing.jpg";
  assert.ok(validateAll(broken).some((error) => error.includes("file not found")));

  const half = structuredClone(data);
  half.cars.cars[1].image = "images/cars/car-dinka-enduro.jpg";
  assert.ok(validateAll(half).some((error) => error.includes("set together")));

  const badUrl = structuredClone(data);
  badUrl.cars.cars[0].imageSource = "not a url";
  assert.ok(validateAll(badUrl).some((error) => error.includes("imageSource")));

  const vague = structuredClone(data);
  vague.cars.cars[0].precision = "nearby";
  assert.ok(validateAll(vague).some((error) => error.includes("precision")));
});

test("a selected car is the only pin, and zoom follows precision", () => {
  const progress = emptyProgress(NOW);
  const carsUi = { area: "all", found: "all", chapter: "all", precision: "all", selected: null };
  const all = renderMain({ ...model(progress, { section: "cars" }), carsUi });
  const allPins = [...all.matchAll(/data-pin="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(allPins.length > 1);
  assert.equal(all.includes("Show all cars"), false);
  assert.ok(allPins.includes("car-dinka-enduro"));
  assert.ok(allPins.includes("car-driveshaft-hustler"));

  const one = renderMain({
    ...model(progress, { section: "cars" }),
    carsUi: { ...carsUi, selected: "car-dinka-enduro" },
  });
  assert.deepEqual(
    [...one.matchAll(/data-pin="([^"]+)"/g)].map((match) => match[1]),
    ["car-dinka-enduro"],
  );
  assert.match(one, /data-clear/);
  assert.match(one, /Show all cars/);

  const street = renderMain({
    ...model(progress, { section: "cars" }),
    carsUi: { ...carsUi, precision: "street" },
  });
  const streetPins = [...street.matchAll(/data-pin="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(streetPins.includes("car-driveshaft-hustler"));
  assert.equal(streetPins.includes("car-dinka-enduro"), false);

  const dropped = renderMain({
    ...model(progress, { section: "cars" }),
    carsUi: { ...carsUi, precision: "street", selected: "car-dinka-enduro" },
  });
  assert.equal([...dropped.matchAll(/data-pin="([^"]+)"/g)].some((match) => match[1] === "car-dinka-enduro"), false);
  assert.equal(dropped.includes("Show all cars"), false);

  const frame = { stageW: 360, stageH: 640, ratio: 1920 / 1402 };
  const exact = mapViewForCar({ mapX: 50, mapY: 40, precision: "exact" }, frame);
  const streetView = mapViewForCar({ mapX: 50, mapY: 40, precision: "street" }, frame);
  const area = mapViewForCar({ mapX: 50, mapY: 40, precision: "area" }, frame);
  assert.equal(exact.scale, 2.8);
  assert.equal(streetView.scale, 1.9);
  assert.equal(area.scale, 1.2);
  assert.ok(exact.scale > streetView.scale && streetView.scale > area.scale);
  const baseW = frame.stageW;
  const baseH = baseW * frame.ratio;
  const px = (50 / 100) * baseW * streetView.scale;
  const py = (40 / 100) * baseH * streetView.scale;
  assert.ok(Math.abs(streetView.x + px - frame.stageW / 2) < 0.01);
  assert.ok(Math.abs(streetView.y + py - frame.stageH / 2) < 0.01);
});

test("steal jobs keep many spots, payouts, and a light map", () => {
  assert.equal(data.steal.items.length, 22);
  assert.equal(data.steal.items.reduce((sum, item) => sum + item.locations.length, 0), 424);
  assert.equal(data.steal.map.image, "images/cars/leonida-map.jpg");
  const atms = data.steal.items.find((item) => item.id === "steal-towable-atms");
  assert.equal(atms.locations.length, 99);
  assert.ok(clusterLocations(atms.locations, 6).length < 40);
  assert.equal(clusterLocations(atms.locations, 0).length, 99);
  const frame = { stageW: 360, stageH: 500, ratio: 1920 / 1402 };
  const fitted = mapViewForPoints([
    { mapX: 10, mapY: 20, precision: "exact" },
    { mapX: 90, mapY: 80, precision: "exact" },
  ], frame);
  const one = mapViewForCar({ mapX: 50, mapY: 50, precision: "exact" }, frame);
  assert.ok(fitted.scale < one.scale);

  const progress = emptyProgress(NOW);
  const page = renderMain({ ...model(progress, { section: "steal" }), stealFound: [] });
  assert.match(page, /data-filter="category"/);
  assert.match(page, /data-filter="payout"/);
  assert.match(page, /data-filter="found"/);
  assert.match(page, /data-filter="sort"/);
  assert.match(page, /Store stick-ups/);
  assert.match(page, /No map pin/);
  assert.match(page, /Jobs in chapter 3/);
  assert.ok((page.match(/data-cluster="/g) || []).length > 0);
  assert.ok((page.match(/data-cluster="/g) || []).length < 80);

  const shownSpoilers = setSpoilersHidden(progress, false, NOW);
  const selected = renderMain({
    ...model(shownSpoilers, { section: "steal" }),
    stealFound: ["towable-atms-a3jfv8b6"],
    listUi: { category: "all", payout: "all", found: "all", sort: "default", selected: "steal-towable-atms", spot: null },
  });
  assert.match(selected, /1 of 99 spots done/);
  assert.match(selected, /These figures come from guides/);
  assert.match(selected, /\$7,200|Varies/);
  assert.match(selected, /Unverified image/);
  assert.match(selected, /data-spot="/);

  const spot = renderMain({
    ...model(shownSpoilers, { section: "steal" }),
    stealFound: [],
    listUi: { category: "all", payout: "all", found: "all", sort: "default", selected: "steal-towable-atms", spot: "towable-atms-a3jfv8b6" },
  });
  assert.equal((spot.match(/data-map-x="/g) || []).length, 1);
  assert.match(spot, /data-spot="towable-atms-a3jfv8b6"/);

  const empty = renderMain({
    ...model(shownSpoilers, { section: "steal" }),
    stealFound: [],
    listUi: { category: "all", payout: "all", found: "all", sort: "default", selected: "steal-armored-trucks", spot: null },
  });
  assert.match(empty, /No map pin/);
  assert.match(empty, /Mark done/);
  assert.doesNotMatch(empty, /class="probable"/);

  const unsure = renderMain({
    ...model(shownSpoilers, { section: "steal" }),
    stealFound: [],
    listUi: { category: "all", payout: "all", found: "all", sort: "default", selected: "steal-vans-of-stolen-goods", spot: null },
  });
  assert.match(unsure, /Not fully confirmed/);
  assert.match(unsure, /Image coming soon/);
  assert.match(unsure, /Varies|\$1,440/);

  const banks = data.steal.items.find((item) => item.id === "steal-small-banks");
  assert.match(payoutLine(banks), /\$5,000 to \$45,000/);
  assert.deepEqual(stealTotals(data.steal.items, []), { done: 0, total: 428 });
  assert.equal(stealTotals(data.steal.items, ["towable-atms-a3jfv8b6"]).done, 1);

  const high = renderMain({
    ...model(shownSpoilers, { section: "steal" }),
    stealFound: [],
    listUi: { category: "all", payout: "high", found: "all", sort: "payout", selected: null, spot: null },
  });
  assert.match(high, /Bank vaults|vault/i);
  assert.doesNotMatch(high, /Towable ATMs/);
});

test("weapons reuse the map list, skip empty pins, and filter by type", () => {
  assert.equal(data.weapons.weapons.length, 85);
  assert.equal(data.weapons.map.image, "images/cars/leonida-map.jpg");
  const progress = emptyProgress(NOW);
  const page = renderMain(model(progress, { section: "weapons" }));
  assert.match(page, /data-filter="category"/);
  assert.match(page, /data-filter="precision"/);
  assert.match(page, /data-filter="found"/);
  assert.doesNotMatch(page, /data-filter="chapter"/);
  assert.match(page, /data-pin="weapon-kingfishers-w-22"/);
  assert.match(page, /No map pin/);
  assert.equal(page.includes('data-pin="weapon-hellspawn-comshot-12"'), false);
  assert.match(page, /Kingfishers W-22/);
  assert.match(page, /Hellspawn Comshot 12/);
  assert.doesNotMatch(page, /Bae-Luxe/);

  const rifle = renderMain({
    ...model(progress, { section: "weapons" }),
    listUi: { area: "all", found: "all", chapter: "all", precision: "all", category: "Rifle", selected: null },
  });
  assert.match(rifle, /Kingfishers W-22/);
  assert.doesNotMatch(rifle, /Kingfishers Akulus/);

  const card = renderMain({
    ...model(progress, { section: "weapons" }),
    listUi: { area: "all", found: "all", chapter: "all", precision: "all", category: "all", selected: "weapon-kingfishers-w-22" },
  });
  assert.match(card, /src="images\/weapons\/weapon-kingfishers-w-22\.jpg"/);
  assert.match(card, /Unverified image/);
  assert.match(card, /data-clear/);
  assert.deepEqual(
    [...card.matchAll(/data-pin="([^"]+)"/g)].map((match) => match[1]),
    ["weapon-kingfishers-w-22"],
  );

  const probable = renderMain({
    ...model(progress, { section: "weapons" }),
    listUi: { area: "all", found: "all", chapter: "all", precision: "all", category: "all", selected: "weapon-hellspawn-comshot-12" },
  });
  assert.match(probable, /Probable location/);
  assert.match(probable, /No map pin/);
  assert.equal([...probable.matchAll(/data-pin="/g)].length, 0);

  const blank = renderMain({
    ...model(progress, { section: "weapons" }),
    listUi: { area: "all", found: "all", chapter: "all", precision: "all", category: "all", selected: "weapon-eris-fresh-dsg" },
  });
  assert.match(blank, /Image coming soon/);

  const broken = structuredClone(data);
  broken.weapons.weapons[0].image = "images/weapons/missing-weapon.jpg";
  assert.ok(validateAll(broken).some((error) => error.includes("file not found")));
});

test("each cars dropdown filters the list and the pins", () => {
  const progress = emptyProgress(NOW);
  const base = { area: "all", found: "all", chapter: "all", precision: "all", selected: null };
  const page = (ui) => renderMain({ ...model(progress, { section: "cars" }), carsUi: { ...base, ...ui } });
  const pins = (html) => [...html.matchAll(/data-pin="([^"]+)"/g)].map((match) => match[1]);
  const names = (html) => [...html.matchAll(/class="car-row-name">([^<]+)/g)].map((match) => match[1]);

  const chapter = page({ chapter: "1" });
  assert.ok(pins(chapter).includes("car-dinka-enduro"));
  assert.equal(pins(chapter).includes("car-twinstripe-vigero"), false);
  assert.match(chapter, /data-filter="chapter"/);
  const later = page({ chapter: "5" });
  assert.equal(pins(later).length, 0);
  assert.match(later, /No cars in this filter/);

  const exact = page({ precision: "exact" });
  assert.ok(pins(exact).includes("car-dinka-enduro"));
  assert.equal(names(exact).includes("Driveshaft Hustler"), false);
  assert.match(exact, /data-filter="precision"/);

  const street = page({ precision: "street" });
  assert.ok(names(street).includes("Driveshaft Hustler"));
  assert.equal(pins(street).includes("car-dinka-enduro"), false);

  const still = page({ found: "open" });
  assert.ok(names(still).includes("Driveshaft Hustler"));
  assert.match(still, /data-filter="found"/);
  const found = page({ found: "found" });
  assert.equal(pins(found).length, 0);
  assert.match(found, /No cars in this filter/);

  const area = page({ area: "Key Lento, driveway of Jason's House" });
  assert.deepEqual(names(area), ["Dinka Enduro"]);
  assert.match(area, /data-filter="area"/);
});

test("dropdown choices are remembered and the map button stays in the dock", () => {
  const storage = {
    values: new Map(),
    getItem(key) { return this.values.has(key) ? this.values.get(key) : null; },
    setItem(key, value) { this.values.set(key, String(value)); },
  };
  const fresh = readFilters(storage);
  assert.equal(fresh.cars.precision, "all");
  writeFilters(storage, { cars: { chapter: "1", precision: "street", found: "open", area: "all", category: "all" } });
  assert.match(storage.getItem(filterStorageKey("cars")), /"precision":"street"/);
  assert.equal(readFilters(storage).cars.found, "open");
  assert.equal(readFilters(storage).weapons.chapter, "all");
  writeIdList(storage, WEAPONS_FOUND_KEY, ["weapon-kingfishers-w-22"]);
  assert.deepEqual(readIdList(storage, WEAPONS_FOUND_KEY), ["weapon-kingfishers-w-22"]);
  assert.equal(readFilters({ getItem() { throw new Error("blocked"); } }).cars.precision, "all");

  const html = readFileSync(path.join(root, "index.html"), "utf8");
  const css = readFileSync(path.join(root, "css/styles.css"), "utf8");
  assert.equal(html.includes("More map"), false);
  assert.equal(html.includes("chrome-toggle"), false);
  assert.match(html, /data-tab="weapons"/);
  assert.equal(isTabEnabled("weapons"), true);
  assert.equal(isTabEnabled("steal"), true);
  assert.equal(MAP_LISTS.weapons.primary, "category");
  assert.equal(MAP_LISTS.weapons.progressList, "weaponPins");
  assert.deepEqual(ENABLED_TABS, ["cars", "weapons", "steal", "skills"]);
  assert.match(css, /body\.map-open \.map-stage/);
  assert.match(css, /\.tabs\[hidden\]/);
  assert.match(css, /main \{[^}]*var\(--dock\)/);
});

test("rendered story hides later mission text and escapes markup", () => {
  const progress = emptyProgress(NOW);
  const hidden = renderMain(model(progress, { section: "story" }));
  assert.match(hidden, />Prologue</);
  assert.match(hidden, /PowerPyx/);
  assert.doesNotMatch(hidden, /Chapter 2 mission/);
  assert.match(hidden, /Show this/);
  assert.match(hidden, /Placeholder/);

  const shownProgress = setStoryOpen(setSpoilersHidden(progress, false, NOW), "chapters", "chapter-2", true, NOW);
  const shown = renderMain(model(shownProgress, { section: "story" }));
  assert.match(shown, /Chapter 2 mission 1/);

  const html = renderCard(
    { id: "x", list: "missions" },
    {
      kicker: "Chapter 1",
      title: "<img src=x onerror=alert(1)>",
      verified: false,
      generic: false,
      source: null,
      summary: "PLACEHOLDER: <script>",
      blocks: [],
    },
    emptyProgress(NOW),
  );
  assert.equal(html.includes("<img"), false);
  assert.equal(html.includes("<script>"), false);
  assert.match(html, /&lt;img/);
  assert.equal(escapeHtml(`"'<>&`), "&quot;&#39;&lt;&gt;&amp;");
});

test("money, map, skills, gear, and online render the right rows", () => {
  const progress = emptyProgress(NOW);
  const money = renderMain(model(progress, { section: "money", sub: "earners" }));
  assert.match(money, /Early-story earner 1/);
  assert.doesNotMatch(money, /Mid-story earner/);
  assert.match(money, /Worth buying/);

  const map = renderMain(model(progress, { section: "map", sub: "collectibles" }));
  assert.match(map, /Area 1 collectible 1/);
  assert.doesNotMatch(map, /Area 3 collectible/);
  assert.match(map, /data-area="area-3"/);

  const secrets = renderMain(model(progress, { section: "map", sub: "secrets" }));
  assert.match(secrets, /Secret 1/);
  assert.doesNotMatch(secrets, /Secret 3/);

  const skills = renderMain(model(progress, { section: "skills" }));
  assert.match(skills, /coaching suggestions/);
  assert.match(skills, /General advice/);
  assert.match(skills, /Display and performance/);
  assert.doesNotMatch(skills, /No map pin/);
  assert.doesNotMatch(skills, /Jason vs Lucia/);

  const gear = renderMain(model(progress, { section: "gear", sub: "vehicles" }));
  assert.match(gear, /Early-story vehicle 1/);
  assert.doesNotMatch(gear, /Late-story vehicle/);

  const online = renderMain(model(progress, { section: "online", sub: "news" }));
  assert.match(online, /No online mode announced/);
  assert.match(online, /PLACEHOLDER: Online news item/);
});

test("routes and the home dashboard stay inside the spoiler boundary", () => {
  assert.deepEqual(ENABLED_TABS, ["cars", "weapons", "steal", "skills"]);
  assert.equal(isTabEnabled("cars"), true);
  assert.equal(isTabEnabled("weapons"), true);
  assert.equal(isTabEnabled("steal"), true);
  assert.equal(isTabEnabled("skills"), true);
  assert.equal(isTabEnabled("story"), false);
  assert.equal(isTabEnabled("home"), false);
  assert.deepEqual(parseRoute(""), { section: "cars", sub: null });
  assert.deepEqual(parseRoute("#/story"), { section: "cars", sub: null });
  assert.deepEqual(parseRoute("#/cars"), { section: "cars", sub: null });
  assert.deepEqual(parseRoute("#/weapons"), { section: "weapons", sub: null });
  assert.deepEqual(parseRoute("#/steal"), { section: "steal", sub: null });
  assert.deepEqual(parseRoute("#/map/secrets"), { section: "cars", sub: null });
  assert.deepEqual(parseRoute("#/nope"), { section: "cars", sub: null });
  assert.deepEqual(parseRoute("#/skills"), { section: "skills", sub: null });
  assert.deepEqual(parseRoute("#/skills/drills"), { section: "skills", sub: null });

  const home = renderMain(model(emptyProgress(NOW), { section: "home" }));
  assert.match(home, /Next up/);
  assert.match(home, /Prologue/);
  assert.doesNotMatch(home, /data-goto="#\/story"/);
  assert.match(home, /data-goto="#\/cars"/);
  assert.doesNotMatch(home, /data-goto="#\/money"/);
  assert.doesNotMatch(home, /data-goto="#\/map/);
  assert.match(home, /data-goto="#\/skills"/);
  assert.doesNotMatch(home, /data-goto="#\/gear/);
  assert.doesNotMatch(home, /data-goto="#\/online/);
  assert.match(home, /named guides/);
  assert.doesNotMatch(home, /Chapter 2 mission/);
  assert.match(home, /Not set/);
  assert.match(home, /Single-player only/);
  const caughtUp = data.story.chapters[0].missions
    .map((mission) => mission.id)
    .reduce((current, id) => toggleId(current, "missions", id, NOW).progress, emptyProgress(NOW));
  const laterHome = renderMain(model(caughtUp, { section: "home" }));
  assert.doesNotMatch(laterHome, /data-goto="#\/story"/);
  assert.match(laterHome, /data-goto="#\/skills"/);
  const withCash = setCash(emptyProgress(NOW), { cash: "40", note: "<b>note</b>" }, NOW).progress;
  const cashed = renderMain(model(withCash, { section: "home" }));
  assert.match(cashed, />40</);
  assert.equal(cashed.includes("<b>"), false);
  assert.match(cashed, /&lt;b&gt;note/);
});

test("skills list goals, settings, and drill spots", () => {
  assert.equal(data.skills.items.length, 27);
  assert.equal(data.skills.section, "skills");
  assert.equal(skillTotals(data.skills.items, []).total, 27);
  assert.equal(skillTotals(data.skills.items, ["skill-driving", "skill-driving#0"]).done, 1);
  const progress = emptyProgress(NOW);
  const list = renderMain(model(progress, { section: "skills" }));
  assert.match(list, /coaching suggestions/);
  assert.match(list, /General advice/);
  assert.match(list, /<h2 class="group-title">Settings<\/h2>[\s\S]*<h2 class="group-title">Driving<\/h2>/);
  assert.doesNotMatch(list, /Jason vs Lucia/);
  const display = renderMain({
    ...model(progress, { section: "skills" }),
    listUi: { category: "all", found: "all", selected: "skill-display-performance", spot: null },
    skillsFound: [],
  });
  assert.match(display, /no Performance mode/);
  assert.match(display, /30fps/);
  assert.match(display, /120Hz/);
  assert.match(display, /settings-table/);
  assert.match(display, /Tick this goal/);
  assert.doesNotMatch(display, /data-map-x/);
  const scheme = renderMain({
    ...model(progress, { section: "skills" }),
    listUi: { category: "all", found: "all", selected: "skill-control-scheme", spot: null },
    skillsFound: ["skill-control-scheme"],
  });
  assert.match(scheme, /Default/);
  assert.match(scheme, /3 full passes/);
  assert.match(scheme, /Goal done/);
  assert.match(scheme, /<ol class="steps">/);
  const driving = renderMain({
    ...model(progress, { section: "skills" }),
    listUi: { category: "Driving", found: "all", selected: "skill-driving", spot: null },
    skillsFound: ["skill-driving#0"],
  });
  assert.match(driving, /data-map-x/);
  assert.match(driving, /Gellhorn/);
  assert.match(driving, /aria-pressed="true"/);
  assert.doesNotMatch(driving, /Display and performance/);
  const broken = structuredClone(data);
  broken.skills.items[0].drills[0].duration = "10 minutes";
  assert.ok(validateAll(broken).some((error) => error.includes("reps or duration")));
});

test("the page, manifest, and service worker are static and relative", () => {
  const html = readFileSync(path.join(root, "index.html"), "utf8");
  const css = readFileSync(path.join(root, "css/styles.css"), "utf8");
  const manifest = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const worker = readFileSync(path.join(root, "sw.js"), "utf8");
  assert.equal(/<link[^>]+href="\//.test(html), false);
  assert.equal(/<script[^>]+src="\//.test(html), false);
  assert.match(html, /lang="en-GB"/);
  assert.match(html, /Spoilers hidden/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "./index.html");
  assert.equal(manifest.scope, "./");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "any"));
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));
  const listed = [...worker.matchAll(/"(\.\/[^"]+)"/g)].map((match) => match[1].slice(2));
  assert.ok(listed.includes("index.html"));
  assert.ok(listed.includes("data/story.json"));
  for (const relative of listed) {
    readFileSync(path.join(root, relative));
  }
  for (const icon of manifest.icons) {
    readFileSync(path.join(root, icon.src.replace(/^\.\//, "")));
  }
});
