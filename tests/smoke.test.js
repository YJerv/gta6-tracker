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
import { parseRoute, renderCard, renderMain } from "../js/render.js";
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
    assert.equal(entry.source, null);
    assert.match(entry.title, /^PLACEHOLDER:/);
  }
});

test("schema rejects invented titles, missing sources, bad dates, and duplicate ids", () => {
  const invented = structuredClone(data);
  invented.story.chapters[0].missions.find((mission) => mission.id === "chapter-1-mission-11").title = "The marina job";
  assert.ok(validateAll(invented).some((error) => error.includes("PLACEHOLDER")));

  const unsourced = structuredClone(data);
  unsourced.skills.drills[0].source = "";
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
  assert.ok(report.percent > 0);
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
  assert.equal(caughtUp.side.list, "drills");
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

  const skills = renderMain(model(progress, { section: "skills", sub: "settings" }));
  assert.match(skills, /Look and move dead zones/);
  assert.match(skills, /Generic/);
  assert.match(skills, /Not a GTA VI setting/);

  const stats = renderMain(model(progress, { section: "skills", sub: "stats" }));
  assert.match(stats, /Stat 1/);
  assert.doesNotMatch(stats, /Stat 3/);

  const gear = renderMain(model(progress, { section: "gear", sub: "vehicles" }));
  assert.match(gear, /Early-story vehicle 1/);
  assert.doesNotMatch(gear, /Late-story vehicle/);

  const online = renderMain(model(progress, { section: "online", sub: "news" }));
  assert.match(online, /No online mode announced/);
  assert.match(online, /PLACEHOLDER: Online news item/);
});

test("routes and the home dashboard stay inside the spoiler boundary", () => {
  assert.deepEqual(parseRoute(""), { section: "home", sub: null });
  assert.deepEqual(parseRoute("#/map/secrets"), { section: "map", sub: "secrets" });
  assert.deepEqual(parseRoute("#/nope"), { section: "home", sub: null });
  assert.equal(parseRoute("#/skills/drills").sub, "drills");

  const home = renderMain(model(emptyProgress(NOW), { section: "home" }));
  assert.match(home, /Next up/);
  assert.match(home, /Prologue/);
  assert.match(home, /named guides/);
  assert.doesNotMatch(home, /Chapter 2 mission/);
  assert.match(home, /Not set/);
  assert.match(home, /Single-player only/);
  const withCash = setCash(emptyProgress(NOW), { cash: "40", note: "<b>note</b>" }, NOW).progress;
  const cashed = renderMain(model(withCash, { section: "home" }));
  assert.match(cashed, />40</);
  assert.equal(cashed.includes("<b>"), false);
  assert.match(cashed, /&lt;b&gt;note/);
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
