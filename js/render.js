import { escapeHtml as e } from "./html.js";
import {
  completionReport,
  formatCash,
  isHidden,
  nextUp,
  visibleThroughChapter,
} from "./progress.js";

export const ROUTES = {
  home: { title: "Home", subs: [] },
  story: { title: "Story", subs: [] },
  money: {
    title: "Money",
    subs: [
      { id: "earners", label: "Earners" },
      { id: "buying", label: "Worth buying" },
    ],
  },
  map: {
    title: "Map",
    subs: [
      { id: "collectibles", label: "Collectibles" },
      { id: "secrets", label: "Secrets" },
    ],
  },
  skills: {
    title: "Skills",
    subs: [
      { id: "settings", label: "Xbox settings" },
      { id: "drills", label: "Drills" },
      { id: "stats", label: "Stats" },
    ],
  },
  gear: {
    title: "Gear",
    subs: [
      { id: "vehicles", label: "Vehicles" },
      { id: "weapons", label: "Weapons" },
    ],
  },
  online: {
    title: "Online",
    subs: [
      { id: "news", label: "News" },
      { id: "checklist", label: "Readiness" },
    ],
  },
};

const INTRO = {
  story: "Tick a mission when you finish it. Later chapters stay covered while spoilers are hidden. Names below are placeholders, not a walkthrough.",
  money: "Earners and purchases are grouped into early, mid, and late stages. Those stages are editorial, not official chapter names. No prices are filled in.",
  map: "Filter the checklist by area. Secrets are on their own tab. Area names are placeholders, not verified locations.",
  skills: "Xbox settings and drills are generic controller practice. They are not GTA VI instructions. Stat rows are placeholders.",
  gear: "Vehicles and weapons to look for, by story stage, once a verified guide fills them in.",
  online: "Readiness items are generic preparation. They are not a description of an online mode.",
};

const STAGE_ORDER = ["early", "mid", "late"];
const STAGE_TITLE = { early: "Early story", mid: "Mid story", late: "Late story" };

export function parseRoute(hash) {
  const raw = String(hash || "").replace(/^#/, "").replace(/^\//, "");
  const [name, sub] = raw.split("/").filter(Boolean);
  const section = Object.prototype.hasOwnProperty.call(ROUTES, name) ? name : "home";
  const subs = ROUTES[section].subs;
  const match = subs.find((item) => item.id === sub);
  return { section, sub: match ? match.id : (subs[0] ? subs[0].id : null) };
}

export function hashFor(item) {
  if (item.list === "missions") return "#/story";
  if (item.list === "money" && item.sub === "buying") return "#/money/buying";
  if (item.list === "money") return "#/money";
  if (item.list === "collectibles") return "#/map";
  if (item.list === "secrets") return "#/map/secrets";
  if (item.list === "drills") return "#/skills/drills";
  if (item.list === "stats") return "#/skills/stats";
  if (item.list === "settings") return "#/skills";
  if (item.list === "weapons") return "#/gear/weapons";
  if (item.list === "vehicles") return "#/gear";
  if (item.list === "online") return "#/online/checklist";
  return "#/home";
}

function formatLongDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function badges(detail) {
  if (!detail.verified) return '<span class="badge badge-placeholder">Placeholder</span>';
  if (detail.generic) return '<span class="badge badge-generic">Generic</span>';
  return '<span class="badge badge-sourced">Sourced</span>';
}

function sourceHtml(detail) {
  const text = detail.source ? e(detail.source) : "No source yet.";
  return `<p class="source"><span>Source</span> ${text}</p>`;
}

function blocksHtml(blocks) {
  return blocks.map((block) => {
    const lines = block.lines.length
      ? `<ul>${block.lines.map((line) => `<li>${e(line)}</li>`).join("")}</ul>`
      : '<p class="empty-line">Nothing verified yet.</p>';
    return `<section class="block"><h4>${e(block.heading)}</h4>${lines}</section>`;
  }).join("");
}

export function renderCard(item, detail, progress) {
  const on = progress[item.list].includes(item.id);
  const faceSummary = detail.verified && detail.summary ? `<p class="summary">${e(detail.summary)}</p>` : "";
  const foldedSummary = !detail.verified && detail.summary ? `<p class="summary">${e(detail.summary)}</p>` : "";
  const moreLabel = detail.blocks.some((block) => block.heading === "Steps")
    ? "Steps and notes"
    : (detail.blocks.length ? "Notes" : "Source");
  return `<article class="card${on ? " is-done" : ""}">
    <div class="card-row">
      <div class="card-copy">
        <p class="kicker">${e(detail.kicker)}</p>
        <h3>${e(detail.title)}</h3>
        <p class="badge-row">${badges(detail)}</p>
        ${faceSummary}
      </div>
      <button type="button" class="tick" data-tick="${e(item.list)}:${e(item.id)}" aria-pressed="${on ? "true" : "false"}" aria-label="${on ? "Clear" : "Tick"} ${e(detail.title)}">
        <span class="tick-box"></span>
      </button>
    </div>
    <details class="more">
      <summary>${moreLabel}</summary>
      ${foldedSummary}
      ${blocksHtml(detail.blocks)}
      ${sourceHtml(detail)}
    </details>
  </article>`;
}

function shield(title, hint, revealId) {
  return `<article class="card shield">
    <div class="shield-bars" aria-hidden="true"><i></i><i></i><i></i></div>
    <p class="kicker">Spoilers hidden</p>
    <h3>${e(title)}</h3>
    <p class="summary">${e(hint)}</p>
    <button type="button" class="btn-primary" data-reveal="${e(revealId)}">Show this</button>
  </article>`;
}

function banner(text, quiet = false) {
  return `<p class="banner${quiet ? " banner-quiet" : ""}">${e(text)}</p>`;
}

function subnav(route) {
  const subs = ROUTES[route.section].subs;
  if (!subs.length) return "";
  const buttons = subs.map((item) => {
    const on = item.id === route.sub;
    return `<button type="button" role="tab" data-sub="${e(item.id)}" class="${on ? "is-active" : ""}" aria-selected="${on ? "true" : "false"}">${e(item.label)}</button>`;
  }).join("");
  return `<div class="subnav" role="tablist" aria-label="Within this section">${buttons}</div>`;
}

function renderItems(items, model) {
  const through = visibleThroughChapter(model.catalog.chapters, model.progress.missions);
  const html = [];
  const seen = new Set();
  for (const item of items) {
    if (isHidden(item, model.progress, through)) {
      const key = item.groupId || item.id;
      if (seen.has(key)) continue;
      seen.add(key);
      html.push(shield(
        `Chapter ${item.chapterOrder}`,
        "This row stays covered until you show it or turn spoilers off.",
        key,
      ));
      continue;
    }
    html.push(renderCard(item, model.catalog.details.get(item.id), model.progress));
  }
  return html.join("");
}

function renderStaged(items, model) {
  const through = visibleThroughChapter(model.catalog.chapters, model.progress.missions);
  return STAGE_ORDER.map((stage) => {
    const group = items.filter((item) => item.stage === stage);
    if (!group.length) return "";
    const sample = group[0];
    const hidden = isHidden({ id: sample.groupId, chapterOrder: sample.chapterOrder, groupId: null }, model.progress, through);
    if (hidden) {
      return shield(
        STAGE_TITLE[stage],
        `Covered until you tick a mission in chapter ${sample.chapterOrder} or later, or you show this block.`,
        sample.groupId,
      );
    }
    const cards = group.map((item) => renderCard(item, model.catalog.details.get(item.id), model.progress)).join("");
    return `<section class="group">
      <header class="group-head">
        <h2>${STAGE_TITLE[stage]}</h2>
        <p class="summary">Editorial stage, tied to chapter ${sample.chapterOrder} for spoilers.</p>
      </header>
      ${cards}
    </section>`;
  }).join("");
}

function renderStory(model) {
  const through = visibleThroughChapter(model.catalog.chapters, model.progress.missions);
  const chapters = model.catalog.chapters.map((chapter) => {
    const missions = model.catalog.items
      .filter((item) => item.list === "missions" && item.groupId === chapter.id)
      .sort((a, b) => a.sort - b.sort);
    const hidden = missions.filter((item) => isHidden(item, model.progress, through));
    if (hidden.length === missions.length) {
      return shield(
        `Chapter ${chapter.order}`,
        "Mission names and steps stay covered until you show this chapter or turn spoilers off.",
        chapter.id,
      );
    }
    const done = chapter.missionIds.filter((id) => model.progress.missions.includes(id)).length;
    const cards = missions.map((item) => {
      if (isHidden(item, model.progress, through)) {
        return shield(
          `Chapter ${chapter.order}`,
          "This mission stays covered until you show it or turn spoilers off.",
          item.id,
        );
      }
      return renderCard(item, model.catalog.details.get(item.id), model.progress);
    }).join("");
    return `<section class="group">
      <header class="group-head">
        <p class="kicker">Chapter ${chapter.order}</p>
        <h2>${e(chapter.title)}</h2>
        <p class="badge-row">${badges(chapter)}</p>
        <p class="summary">${e(chapter.summary)}</p>
        <p class="count">${done} of ${chapter.missionIds.length} ticked</p>
      </header>
      ${cards}
    </section>`;
  }).join("");
  return `${banner(INTRO.story)}${chapters}`;
}

function renderMoney(model) {
  const items = model.catalog.items.filter((item) => item.sub === model.route.sub).sort((a, b) => a.sort - b.sort);
  return `${banner(INTRO.money)}${subnav(model.route)}${renderStaged(items, model)}`;
}

function renderMap(model) {
  const through = visibleThroughChapter(model.catalog.chapters, model.progress.missions);
  if (model.route.sub === "secrets") {
    const items = model.catalog.items.filter((item) => item.list === "secrets").sort((a, b) => a.sort - b.sort);
    return `${banner(INTRO.map)}${subnav(model.route)}${renderItems(items, model)}`;
  }
  const chips = [`<button type="button" class="chip${model.route.areaId === "all" ? " is-active" : ""}" data-area="all">All</button>`];
  for (const area of model.catalog.areas) {
    const hidden = isHidden({ id: area.id, chapterOrder: area.chapterOrder, groupId: null }, model.progress, through);
    const done = area.itemIds.filter((id) => model.progress.collectibles.includes(id)).length;
    const label = hidden ? `Area ${area.order} · hidden` : `Area ${area.order} · ${done}/${area.itemIds.length}`;
    const on = model.route.areaId === area.id;
    chips.push(`<button type="button" class="chip${on ? " is-active" : ""}" data-area="${e(area.id)}">${e(label)}</button>`);
  }
  const areas = model.catalog.areas.filter((area) => model.route.areaId === "all" || model.route.areaId === area.id);
  const body = areas.map((area) => {
    const hidden = isHidden({ id: area.id, chapterOrder: area.chapterOrder, groupId: null }, model.progress, through);
    if (hidden) {
      return shield(
        `Area ${area.order}`,
        "Collectibles in this area stay covered until you show them or turn spoilers off.",
        area.id,
      );
    }
    const items = model.catalog.items
      .filter((item) => item.list === "collectibles" && item.areaId === area.id)
      .sort((a, b) => a.sort - b.sort);
    const cards = items.map((item) => renderCard(item, model.catalog.details.get(item.id), model.progress)).join("");
    return `<section class="group">
      <header class="group-head">
        <p class="kicker">Area ${area.order}</p>
        <h2>${e(area.title)}</h2>
        <p class="badge-row">${badges(area)}</p>
      </header>
      ${cards}
    </section>`;
  }).join("");
  return `${banner(INTRO.map)}${subnav(model.route)}<div class="chips" role="group" aria-label="Filter by area">${chips.join("")}</div>${body}`;
}

function renderSkills(model) {
  const items = model.catalog.items.filter((item) => item.sub === model.route.sub).sort((a, b) => a.sort - b.sort);
  return `${banner(INTRO.skills)}${subnav(model.route)}${renderItems(items, model)}`;
}

function renderGear(model) {
  const items = model.catalog.items.filter((item) => item.sub === model.route.sub).sort((a, b) => a.sort - b.sort);
  return `${banner(INTRO.gear)}${subnav(model.route)}${renderStaged(items, model)}`;
}

function displayKicker(kicker) {
  return /^\d{4}-\d{2}-\d{2}$/.test(kicker) ? formatLongDate(kicker) : kicker;
}

function renderOnline(model) {
  if (model.route.sub === "news") {
    const cards = model.catalog.notes.map((note) => {
      const detail = model.catalog.details.get(note.id);
      return `<article class="card">
        <p class="kicker">${e(displayKicker(detail.kicker))}</p>
        <h3>${e(detail.title)}</h3>
        <p class="badge-row">${badges(detail)}</p>
        <p class="summary">${e(detail.summary)}</p>
        ${sourceHtml(detail)}
      </article>`;
    }).join("");
    return `${banner(model.data.meta.statusNote)}${banner(INTRO.online, true)}${subnav(model.route)}${cards}`;
  }
  const items = model.catalog.items.filter((item) => item.list === "online").sort((a, b) => a.sort - b.sort);
  return `${banner(model.data.meta.statusNote)}${banner(INTRO.online, true)}${subnav(model.route)}${renderItems(items, model)}`;
}

function ringSvg(percent) {
  const radius = 46;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - percent / 100);
  return `<svg class="ring" viewBox="0 0 120 120" role="img" aria-label="${percent} percent complete">
    <circle class="ring-track" cx="60" cy="60" r="${radius}"></circle>
    <circle class="ring-value" cx="60" cy="60" r="${radius}" stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"></circle>
    <text class="ring-num" x="60" y="56" text-anchor="middle">${percent}%</text>
    <text class="ring-label" x="60" y="74" text-anchor="middle">done</text>
  </svg>`;
}

function renderNext(model) {
  const suggestion = nextUp(model.catalog, model.progress);
  let story = "";
  if (!suggestion.story) {
    story = `<article class="card next-card">
      <p class="kicker">Next up</p>
      <h2>Story list complete</h2>
      <p class="summary">Every mission in this tracker is ticked. If a verified guide has more, add them in the data files.</p>
    </article>`;
  } else if (suggestion.story.hidden) {
    story = `<article class="card next-card">
      <p class="kicker">Next up</p>
      <h2>Next story mission is covered</h2>
      <p class="summary">It is in chapter ${suggestion.story.chapterOrder}, past the furthest chapter you have ticked.</p>
      <div class="btn-row">
        <button type="button" class="btn-primary" data-reveal="${e(suggestion.story.id)}">Show this mission</button>
        <button type="button" class="btn-ghost" data-goto="#/story">Open story</button>
      </div>
    </article>`;
  } else {
    story = `<article class="card next-card">
      <p class="kicker">Next up · Chapter ${suggestion.story.chapterOrder}</p>
      <h2>${e(suggestion.story.title)}</h2>
      <div class="btn-row">
        <button type="button" class="btn-primary" data-goto="#/story">Open story</button>
        <button type="button" class="btn-ghost" data-tick="missions:${e(suggestion.story.id)}">Tick done</button>
      </div>
    </article>`;
  }
  if (!suggestion.side) return story;
  return `${story}<article class="card">
    <p class="kicker">Also</p>
    <h3>${e(suggestion.side.title)}</h3>
    <p class="summary">${e(suggestion.side.blurb)}</p>
    <button type="button" class="btn-ghost" data-goto="${e(hashFor(suggestion.side))}">Open it</button>
  </article>`;
}

function renderCash(model) {
  const value = model.progress.cash === null ? "" : String(model.progress.cash);
  return `<article class="card cash-card">
    <p class="kicker">Your cash figure</p>
    <p class="cash-figure">${e(formatCash(model.progress.cash))}</p>
    ${model.progress.cashNote ? `<p class="summary">${e(model.progress.cashNote)}</p>` : ""}
    <p class="fine">Typed by you. The game is not linked, and no in-game price is stored here.</p>
    <details class="more"${model.cashError ? " open" : ""}>
      <summary>Update cash</summary>
      ${model.cashError ? `<p class="form-error">${e(model.cashError)}</p>` : ""}
      <form id="cash-form" class="stack">
        <label for="cash-input">Amount (whole number)</label>
        <input id="cash-input" name="cash" inputmode="numeric" autocomplete="off" placeholder="Blank clears it" value="${e(value)}">
        <label for="cash-note">Note</label>
        <input id="cash-note" name="note" maxlength="140" autocomplete="off" value="${e(model.progress.cashNote)}">
        <button type="submit" class="btn-primary">Save cash</button>
      </form>
    </details>
  </article>`;
}

function renderHome(model) {
  const report = completionReport(model.catalog, model.progress);
  const warning = model.storageWarning ? banner(model.storageWarning) : "";
  const install = model.canInstall
    ? '<button type="button" class="btn-primary" data-install="1">Install app</button>'
    : '<p class="fine">To install: browser menu, then Install or Add to Home screen. After one online visit, pages open offline.</p>';
  const latest = Object.values(model.data).map((file) => file.lastUpdated).sort().at(-1);
  const links = report.sections.map((section) => `<button type="button" class="section-link" data-goto="${e(section.hash)}">
      <span class="section-link-text"><strong>${e(section.label)}</strong><span>${section.done}/${section.total}</span></span>
      <span class="bar" aria-hidden="true"><span style="width:${section.percent}%"></span></span>
    </button>`).join("");
  return `${warning}
    ${banner(model.data.meta.statusNote)}
    ${banner("Mission names, places, and prices are placeholders until a verified guide is added.", true)}
    <div class="hero">
      ${ringSvg(report.percent)}
      <div>
        <p class="kicker">On this device</p>
        <p class="hero-count">${report.done} of ${report.total}</p>
        <p class="summary">Ticks, cash, and the spoiler switch stay in this browser.</p>
      </div>
    </div>
    ${renderNext(model)}
    ${renderCash(model)}
    <h2 class="group-title">Progress</h2>
    <div class="section-list">${links}</div>
    <h2 class="group-title">Install</h2>
    ${install}
    <p class="fine">Content files last updated ${e(formatLongDate(latest))}.</p>`;
}

export function renderMain(model) {
  switch (model.route.section) {
    case "story": return renderStory(model);
    case "money": return renderMoney(model);
    case "map": return renderMap(model);
    case "skills": return renderSkills(model);
    case "gear": return renderGear(model);
    case "online": return renderOnline(model);
    default: return renderHome(model);
  }
}
