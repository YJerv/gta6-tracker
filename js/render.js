import { DEFAULT_TAB, MAP_LISTS, isTabEnabled, tabForHash } from "./config.js";
import { escapeHtml as e } from "./html.js";
import {
  completionReport,
  formatCash,
  isChapterExpanded,
  isHidden,
  isMissionExpanded,
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
  cars: { title: "Cars", subs: [] },
  weapons: { title: "Weapons", subs: [] },
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
  story: "Tap a chapter to show its missions, and a mission to show steps. The one you are on starts open. Later chapters stay covered while spoilers are hidden.",
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
  const parsed = Object.prototype.hasOwnProperty.call(ROUTES, name) ? name : DEFAULT_TAB;
  const section = isTabEnabled(parsed) ? parsed : DEFAULT_TAB;
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
  if (item.list === "cars") return "#/cars";
  if (item.list === "weaponPins") return "#/weapons";
  if (item.list === "online") return "#/online/checklist";
  return "#/home";
}

const FOCUS_SCALE = { exact: 2.8, street: 1.9, area: 1.2 };

/** Centre a car pin in the map window. Exact is closer than street, and area is wider. */
export function mapViewForCar(car, frame) {
  const requested = FOCUS_SCALE[car.precision] || FOCUS_SCALE.area;
  const baseW = frame.stageW;
  const baseH = baseW * frame.ratio;
  const fit = Math.min(1, frame.stageH / baseH);
  const scale = Math.min(4, Math.max(fit, requested));
  const px = (Number(car.mapX) / 100) * baseW * scale;
  const py = (Number(car.mapY) / 100) * baseH * scale;
  const minX = Math.min(0, frame.stageW - baseW * scale);
  const minY = Math.min(0, frame.stageH - baseH * scale);
  return {
    scale,
    x: Math.min(0, Math.max(minX, frame.stageW / 2 - px)),
    y: Math.min(0, Math.max(minY, frame.stageH / 2 - py)),
  };
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

function chevron(open) {
  return `<span class="chevron${open ? " is-open" : ""}" aria-hidden="true"></span>`;
}

function renderMissionRow(item, detail, progress, open) {
  const on = progress[item.list].includes(item.id);
  const body = open
    ? `<div class="mission-body">
        ${missionFigure(detail)}
        ${sourceHtml(detail)}
        ${detail.summary ? `<p class="summary">${e(detail.summary)}</p>` : ""}
        ${blocksHtml(detail.blocks)}
      </div>`
    : "";
  return `<article class="card mission-card${on ? " is-done" : ""}">
    <div class="mission-row">
      <button type="button" class="tick" data-tick="${e(item.list)}:${e(item.id)}" aria-pressed="${on ? "true" : "false"}" aria-label="${on ? "Clear" : "Tick"} ${e(detail.title)}">
        <span class="tick-box"></span>
      </button>
      <button type="button" class="mission-toggle" data-mission-toggle="${e(item.id)}" aria-expanded="${open ? "true" : "false"}">
        <span class="mission-title">${e(detail.title)}</span>
        <span class="badge-row">${badges(detail)}</span>
        ${chevron(open)}
      </button>
    </div>
    ${body}
  </article>`;
}

function renderStory(model) {
  const through = visibleThroughChapter(model.catalog.chapters, model.progress.missions);
  const controls = `<div class="fold-bar">
    <button type="button" class="btn-ghost" data-story-fold="expand">Expand all</button>
    <button type="button" class="btn-ghost" data-story-fold="collapse">Collapse all</button>
  </div>`;
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
    const total = chapter.missionIds.length;
    const expanded = isChapterExpanded(model.catalog, model.progress, chapter.id);
    const cards = expanded
      ? missions.map((item) => {
        if (isHidden(item, model.progress, through)) {
          return shield(
            `Chapter ${chapter.order}`,
            "This mission stays covered until you show it or turn spoilers off.",
            item.id,
          );
        }
        const detail = model.catalog.details.get(item.id);
        const missionOpen = isMissionExpanded(model.catalog, model.progress, item.id);
        return renderMissionRow(item, detail, model.progress, missionOpen);
      }).join("")
      : "";
    const summary = expanded
      ? `<div class="chapter-extra"><p class="badge-row">${badges(chapter)}</p><p class="summary">${e(chapter.summary)}</p></div>`
      : "";
    return `<section class="group">
      <button type="button" class="chapter-toggle" data-chapter-toggle="${e(chapter.id)}" aria-expanded="${expanded ? "true" : "false"}" aria-label="${expanded ? "Hide" : "Show"} missions in ${e(chapter.title)}. ${done} of ${total} ticked.">
        ${chevron(expanded)}
        <span class="chapter-name">${e(chapter.title)}</span>
        <span class="count">${done}/${total}</span>
      </button>
      ${summary}
      ${cards}
    </section>`;
  }).join("");
  return `${banner(INTRO.story)}${renderNotice(model.data.story.notice)}${controls}${chapters}`;
}

function missionFigure(detail) {
  if (!detail.image) return "";
  return `<figure class="mission-figure">
    <img src="${e(detail.image)}" alt="${e(detail.imageAlt)}" width="1600" height="900" loading="lazy" decoding="async">
    <figcaption>
      <span class="badge badge-generic">Illustration</span>
      <span class="illustration-note">Official promo image, not a screenshot of this mission.</span>
      <span class="image-credit">${e(detail.imageCredit)}</span>
    </figcaption>
  </figure>`;
}

export function illustrationCredits(story) {
  const seen = new Set();
  const lines = [];
  for (const chapter of story.chapters) {
    for (const mission of chapter.missions) {
      if (typeof mission.imageCredit !== "string" || seen.has(mission.imageCredit)) continue;
      seen.add(mission.imageCredit);
      lines.push(mission.imageCredit);
    }
  }
  return lines;
}

function renderNotice(notice) {
  const items = notice.items.map((item) => `<li>${e(item)}</li>`).join("");
  return `<details class="notice" open>
    <summary>${e(notice.title)}</summary>
    <ol>${items}</ol>
    <p class="source"><span>Source</span> ${e(notice.source)}</p>
  </details>`;
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
  const storyButton = isTabEnabled("story")
    ? `<button type="button" class="btn-primary" data-goto="#/story">Open story</button>`
    : "";
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
        ${storyButton}
      </div>
    </article>`;
  } else {
    story = `<article class="card next-card">
      <p class="kicker">Next up · Chapter ${suggestion.story.chapterOrder}</p>
      <h2>${e(suggestion.story.title)}</h2>
      <div class="btn-row">
        ${storyButton}
        <button type="button" class="btn-ghost" data-tick="missions:${e(suggestion.story.id)}">Tick done</button>
      </div>
    </article>`;
  }
  if (!suggestion.side) return story;
  const sideHash = hashFor(suggestion.side);
  if (!isTabEnabled(tabForHash(sideHash))) return story;
  return `${story}<article class="card">
    <p class="kicker">Also</p>
    <h3>${e(suggestion.side.title)}</h3>
    <p class="summary">${e(suggestion.side.blurb)}</p>
    <button type="button" class="btn-ghost" data-goto="${e(sideHash)}">Open it</button>
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
  const links = report.sections.filter((section) => isTabEnabled(tabForHash(section.hash))).map((section) => `<button type="button" class="section-link" data-goto="${e(section.hash)}">
      <span class="section-link-text"><strong>${e(section.label)}</strong><span>${section.done}/${section.total}</span></span>
      <span class="bar" aria-hidden="true"><span style="width:${section.percent}%"></span></span>
    </button>`).join("");
  return `${warning}
    ${banner(model.data.meta.statusNote)}
    ${banner("Chapter 1 missions 1 to 10 are sourced from named guides. The rest are placeholders until verified.", true)}
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

function foldSection(heading, body) {
  return `<section class="block">
    <button type="button" class="block-toggle" data-block-toggle aria-expanded="false">
      ${chevron(false)}
      <span>${e(heading)}</span>
    </button>
    <div class="block-body" hidden>${body}</div>
  </section>`;
}

function linkify(text) {
  return String(text).split(/(https?:\/\/[^\s)]+)/).map((part, index) => (
    index % 2 === 1 ? `<a href="${e(part)}">${e(part)}</a>` : e(part)
  )).join("");
}

function carFigure(car) {
  if (!car.image) {
    return `<div class="car-figure car-figure-empty"><span>Image coming soon</span></div>`;
  }
  const unverified = car.imageVerified === false
    ? `<span class="image-unverified">Unverified image</span>`
    : "";
  return `<figure class="car-figure">
    <img src="${e(car.image)}" alt="${e(car.imageAlt || "")}" loading="lazy" decoding="async">
    <figcaption class="image-credit">${unverified}<span>${e(car.imageCredit || "")}</span></figcaption>
  </figure>`;
}

function carSections(car, detail) {
  const blocks = (detail?.blocks || []).map((block) => {
    const lines = block.lines.length
      ? `<ul>${block.lines.map((line) => `<li>${e(line)}</li>`).join("")}</ul>`
      : `<p class="empty-line">Nothing verified yet.</p>`;
    return foldSection(block.heading, lines);
  }).join("");
  const notes = car.notes ? foldSection("Notes", `<p class="summary">${e(car.notes)}</p>`) : "";
  const sources = foldSection("Sources", `<p class="source">${linkify(car.source || "No source yet.")}</p>`);
  return `${blocks}${notes}${sources}`;
}

function renderCarCard(entry, number, model, spec) {
  const car = entry.car;
  const detail = model.catalog.details.get(car.id);
  const found = (model.progress[spec.progressList] || []).includes(car.id);
  const name = spec.noun.charAt(0).toUpperCase() + spec.noun.slice(1);
  const chapter = car.chapterOrder == null ? "From the start" : `Chapter ${car.chapterOrder}`;
  const precisionCopy = {
    exact: ["Exact", "On the right block, roughly 1-2% of map width error."],
    street: ["Street", "Street level."],
    area: ["Area", "General area only. The poster has no street names, so this marks the neighbourhood, not the building."],
  };
  const [precisionLabel, precisionText] = precisionCopy[car.precision] || ["Area", "General area only."];
  const posterNote = car.precision === "area"
    ? precisionText
    : `${precisionText} The poster has no street names.`;
  return `<article class="card car-card">
    ${carFigure(car)}
    <p class="kicker">${e(name)} ${number} · ${e(chapter)}</p>
    <h3>${e(car.title)}</h3>
    <p class="badge-row">${badges(car)} <span class="badge badge-precision precision-${e(car.precision)}">${e(precisionLabel)}</span></p>
    <p class="summary">${e(car.area)}</p>
    <p class="pin-note">${e(posterNote)}</p>
    ${carSections(car, detail)}
    <button type="button" class="car-found" data-tick="${e(spec.progressList)}:${e(car.id)}" aria-pressed="${found ? "true" : "false"}" aria-label="${found ? "Clear" : "Found it"} ${e(car.title)}">
      <span class="tick-box"></span>
      <span>${found ? "Found" : "Found it"}</span>
    </button>
  </article>`;
}

function filterSelect(name, label, value, options) {
  const choices = options.map(([id, text]) => (
    `<option value="${e(String(id))}"${String(value) === String(id) ? " selected" : ""}>${e(text)}</option>`
  )).join("");
  return `<label class="filter"><span>${e(label)}</span><select data-filter="${e(name)}" aria-label="${e(label)}">${choices}</select></label>`;
}

function renderMapList(model, spec) {
  const file = model.data[spec.id];
  const through = visibleThroughChapter(model.catalog.chapters, model.progress.missions);
  const ui = model.listUi || (spec.id === "cars" ? model.carsUi : null) || { area: "all", found: "all", chapter: "all", precision: "all", selected: null };
  const rows = (file && Array.isArray(file[spec.id]) ? file[spec.id] : []).map((car) => ({ car }));
  const visible = [];
  const hidden = [];
  for (const entry of rows) {
    const groupId = entry.car.chapterOrder == null ? `${spec.id}-chapter-start` : `${spec.id}-chapter-${entry.car.chapterOrder}`;
    const subject = { id: entry.car.id, chapterOrder: entry.car.chapterOrder, groupId };
    if (isHidden(subject, model.progress, through)) hidden.push(entry);
    else visible.push(entry);
  }
  const chapters = [...new Set(rows.map((entry) => entry.car.chapterOrder).filter((order) => order != null))].sort((a, b) => a - b);
  let pool = visible;
  let hiddenPool = hidden;
  if (ui.chapter !== "all") {
    pool = pool.filter((entry) => String(entry.car.chapterOrder) === String(ui.chapter));
    hiddenPool = hiddenPool.filter((entry) => String(entry.car.chapterOrder) === String(ui.chapter));
  }
  const areas = [...new Set(pool.map((entry) => entry.car.area))];
  let shown = pool;
  if (ui.area !== "all") shown = shown.filter((entry) => entry.car.area === ui.area);
  const foundIds = model.progress[spec.progressList] || [];
  if (ui.found === "found") shown = shown.filter((entry) => foundIds.includes(entry.car.id));
  if (ui.found === "open") shown = shown.filter((entry) => !foundIds.includes(entry.car.id));
  const precision = ui.precision || "all";
  if (precision !== "all") shown = shown.filter((entry) => entry.car.precision === precision);
  const numberOf = (entry) => visible.indexOf(entry) + 1;
  const map = (file && file.map) || {};
  const ratio = map.image && map.width && map.height ? `${map.width} / ${map.height}` : "1 / 1";
  const ratioValue = map.image && map.width && map.height ? map.height / map.width : 1;
  const picture = map.image
    ? `<img class="map-photo" src="${e(map.image)}" alt="${e(map.imageAlt || "")}" width="${Number(map.width)}" height="${Number(map.height)}" draggable="false">`
    : `<div class="map-grid" aria-hidden="true"></div><p class="map-empty">Map image to come</p>`;
  const legend = [...new Set(shown.map((entry) => entry.car.chapterOrder).filter((order) => order != null))]
    .sort((a, b) => a - b)
    .map((order) => `<span class="legend-item"><i class="map-dot" data-chapter="${order}"></i>Ch ${order}</span>`)
    .join("");
  const selected = shown.find((entry) => entry.car.id === ui.selected) || null;
  const pinSource = selected ? [selected] : shown;
  const focusedPins = pinSource.filter((entry) => entry.car.mapX != null && entry.car.mapY != null);
  const pinHtml = focusedPins.map((entry) => {
    const number = numberOf(entry);
    const chapter = entry.car.chapterOrder == null ? "0" : String(entry.car.chapterOrder);
    const pinPrecision = entry.car.precision || "area";
    const selectedClass = selected ? " is-selected" : "";
    return `<button type="button" class="map-pin precision-${e(pinPrecision)}${selectedClass}" data-pin="${e(entry.car.id)}" data-map-x="${entry.car.mapX}" data-map-y="${entry.car.mapY}" data-chapter="${e(chapter)}" aria-label="Show ${e(spec.noun)} ${number}, chapter ${e(chapter)}, ${e(pinPrecision)}"><span class="map-dot">${number}</span></button>`;
  }).join("");
  const card = selected
    ? renderCarCard(selected, numberOf(selected), model, spec)
    : `<p class="fine">${e(spec.prompt)}</p>`;
  const showAll = selected
    ? `<button type="button" class="map-clear" data-clear>Show all ${e(spec.plural)}</button>`
    : "";
  const chapterOptions = [["all", "All"]].concat(chapters.map((order) => [String(order), `Ch ${order}`]));
  const filters = [
    filterSelect("chapter", "Chapter", ui.chapter, chapterOptions),
    filterSelect("precision", "Precision", precision, [["all", "All"], ["exact", "Exact"], ["street", "Street"], ["area", "Area"]]),
    filterSelect("found", "Status", ui.found, [["all", "All"], ["open", "Still to find"], ["found", "Found"]]),
  ].join("");
  const areaOptions = [["all", "All areas"]].concat(areas.map((area) => [area, area]));
  const areaSelect = filterSelect("area", "Area", ui.area, areaOptions);
  const list = shown.map((entry) => {
    const on = ui.selected === entry.car.id ? " is-selected" : "";
    return `<button type="button" class="car-row${on}" data-open="${e(entry.car.id)}">
      <span class="map-pin-num">${numberOf(entry)}</span>
      <span class="car-row-name">${e(entry.car.title)}</span>
    </button>`;
  }).join("") || `<p class="fine">No ${e(spec.plural)} in this filter.</p>`;
  const hiddenHtml = [...new Set(hiddenPool.map((entry) => entry.car.chapterOrder))].map((order) => shield(
    order == null ? `Hidden ${spec.plural}` : `${spec.plural.charAt(0).toUpperCase()}${spec.plural.slice(1)} in chapter ${order}`,
    "Names and steps stay covered until you show this chapter or turn spoilers off.",
    order == null ? `${spec.id}-chapter-start` : `${spec.id}-chapter-${order}`,
  )).join("");
  const credit = `${map.imageCredit ? `<p class="map-credit">${e(map.imageCredit)}</p>` : ""}${map.source ? `<p class="map-credit">${e(map.source)}</p>` : ""}`;
  return `<div class="map-stage" data-map-stage>
      <div class="map-layer" data-map-layer data-map-ratio="${ratioValue}" style="aspect-ratio:${ratio}">
        ${picture}
      </div>
      ${pinHtml}
      ${showAll}
      <button type="button" class="map-open" data-map-open>Map</button>
      <button type="button" class="map-close" data-map-close>Close</button>
      <div class="map-zoom">
        <button type="button" data-map-zoom="out" aria-label="Zoom out">−</button>
        <button type="button" data-map-zoom="in" aria-label="Zoom in">+</button>
      </div>
    </div>
    ${legend ? `<p class="map-legend">${legend}</p>` : ""}
    <div class="filter-row">${filters}</div>
    <div class="filter-area">${areaSelect}</div>
    <div id="car-card">${card}</div>
    <div class="car-list">${list}</div>
    ${hiddenHtml}
    <div class="map-credits">${credit}</div>`;
}

export function renderMain(model) {
  switch (model.route.section) {
    case "story": return renderStory(model);
    case "money": return renderMoney(model);
    case "map": return renderMap(model);
    case "skills": return renderSkills(model);
    case "gear": return renderGear(model);
    case "cars": return renderMapList(model, MAP_LISTS.cars);
    case "weapons": return renderMapList(model, MAP_LISTS.weapons);
    case "online": return renderOnline(model);
    default: return renderHome(model);
  }
}
