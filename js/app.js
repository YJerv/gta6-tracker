import { MAP_LISTS, isTabEnabled, readFilters, writeFilters } from "./config.js";
import { illustrationCredits, mapViewForCar, renderMain, parseRoute, ROUTES } from "./render.js";
import {
  STORAGE_KEY,
  buildCatalog,
  completionReport,
  emptyProgress,
  exportBundle,
  importBundle,
  normaliseProgress,
  revealId,
  setAllStoryOpen,
  setCash,
  setSpoilersHidden,
  setStoryOpen,
  toggleId,
} from "./progress.js";

const DATA_FILES = [
  "meta", "story", "money", "collectibles", "secrets", "skills", "gear", "online",
  ...Object.keys(MAP_LISTS).filter((name) => isTabEnabled(name)),
];

let state = null;
let deferredPrompt = null;

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { progress: emptyProgress(), warning: null };
    const result = normaliseProgress(JSON.parse(raw));
    if (!result.ok) {
      return { progress: emptyProgress(), warning: "Saved progress could not be read. Ticks start from empty." };
    }
    return { progress: result.progress, warning: null };
  } catch {
    return {
      progress: emptyProgress(),
      warning: "This browser blocked saved progress. Export a backup once saving works.",
    };
  }
}

function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    state.storageWarning = null;
  } catch {
    state.storageWarning = "This browser blocked local save. Export a backup before you leave.";
  }
}

function currentRoute() {
  return { ...parseRoute(location.hash), areaId: state?.areaId || "all" };
}

function announce(text) {
  const live = document.getElementById("live");
  if (!live) return;
  live.textContent = "";
  live.textContent = text;
}

function applyTabVisibility() {
  let enabledCount = 0;
  document.querySelectorAll("[data-tab]").forEach((button) => {
    const enabled = isTabEnabled(button.dataset.tab);
    button.hidden = !enabled;
    if (enabled) enabledCount += 1;
    if (!enabled) {
      button.classList.remove("is-active");
      button.removeAttribute("aria-current");
    }
  });
  const tabs = document.querySelector(".tabs");
  if (tabs) tabs.hidden = enabledCount < 2;
  document.body.classList.toggle("single-tab", enabledCount < 2);
}

function syncDockHeight() {
  const dock = document.querySelector(".dock");
  if (!dock) return;
  const height = Math.ceil(dock.getBoundingClientRect().height);
  document.documentElement.style.setProperty("--dock", `${height}px`);
}

function openEnabledRoute() {
  const route = parseRoute(location.hash);
  const hash = `#/${route.section}${route.sub ? `/${route.sub}` : ""}`;
  if (location.hash !== hash) location.replace(hash);
}

function syncChrome(route) {
  const report = completionReport(state.catalog, state.progress);
  document.getElementById("view-title").textContent = ROUTES[route.section].title;
  document.title = `${ROUTES[route.section].title} · GTA VI Tracker`;
  document.getElementById("header-percent").textContent = `${report.percent}%`;
  document.querySelectorAll("[data-tab]").forEach((button) => {
    const on = button.dataset.tab === route.section;
    button.classList.toggle("is-active", on);
    if (on) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  const hidden = state.progress.spoilersHidden;
  for (const id of ["spoiler-toggle", "sheet-spoiler"]) {
    const button = document.getElementById(id);
    button.setAttribute("aria-pressed", hidden ? "true" : "false");
    button.textContent = hidden ? "Spoilers hidden" : "Spoilers shown";
  }
  if (state.lastSection !== route.section) {
    state.lastSection = route.section;
    document.querySelector(".tabs .is-active")?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }
}

function fillExport() {
  const result = exportBundle(state.progress);
  if (!result.ok) return;
  const box = document.getElementById("export-text");
  if (box && document.activeElement !== box) box.value = JSON.stringify(result.bundle, null, 2);
  const dates = Object.values(state.data).map((file) => file.lastUpdated).sort();
  document.getElementById("data-stamp").textContent = `Content files last updated ${dates.at(-1)}.`;
}

let glideToken = 0;
let ignoreClicksUntil = 0;

function listSpec(section) {
  return MAP_LISTS[section] || null;
}

function listRows(spec) {
  const file = state.data[spec.id];
  return file && Array.isArray(file[spec.id]) ? file[spec.id] : [];
}

function render() {
  glideToken += 1;
  const route = currentRoute();
  const spec = listSpec(route.section);
  const filters = spec ? state.filters[spec.id] : null;
  const main = document.getElementById("main");
  main.innerHTML = renderMain({
    data: state.data,
    catalog: state.catalog,
    progress: state.progress,
    route,
    storageWarning: state.storageWarning,
    canInstall: Boolean(deferredPrompt),
    cashError: state.cashError,
    listUi: filters ? { ...filters, selected: state.picked[spec.id] } : null,
    carsUi: route.section === "cars" && filters ? { ...filters, selected: state.picked.cars } : null,
  });
  if (spec && state.picked[spec.id]) {
    const pins = [...main.querySelectorAll("[data-pin]")];
    const kept = pins.length === 1 && pins[0].dataset.pin === state.picked[spec.id];
    if (!kept) {
      state.picked[spec.id] = null;
      state.mapView = { x: 0, y: 0, scale: 1 };
      render();
      return;
    }
  }
  applyMapTransform(state.mapView, { instant: true });
  main.dataset.ready = "true";
  main.dataset.section = route.section;
  if (route.sub) main.dataset.currentSub = route.sub;
  else delete main.dataset.currentSub;
  syncChrome(route);
  if (state.sheetOpen) fillExport();
  const about = document.getElementById("about-credits");
  document.body.classList.toggle("map-open", Boolean(state.mapOpen));
  syncDockHeight();
  if (about) about.textContent = illustrationCredits(state.data.story).join("\n\n");
  if (state.restoreFocus) {
    const selector = state.restoreFocus;
    state.restoreFocus = null;
    document.querySelector(selector)?.focus();
  }
}

function commit(progress) {
  state.progress = progress;
  saveProgress(progress);
  render();
}

function openSheet() {
  state.sheetOpen = true;
  state.resetArmed = false;
  document.body.classList.add("sheet-open");
  const sheet = document.getElementById("sheet");
  sheet.hidden = false;
  document.getElementById("reset-btn").textContent = "Reset progress on this device";
  document.getElementById("import-message").textContent = "";
  fillExport();
  document.getElementById("close-sheet").focus();
}

function closeSheet() {
  if (!state?.sheetOpen) return;
  state.sheetOpen = false;
  state.resetArmed = false;
  document.body.classList.remove("sheet-open");
  document.getElementById("sheet").hidden = true;
  document.getElementById("settings-open").focus();
}

function splitTick(value) {
  const index = value.indexOf(":");
  return [value.slice(0, index), value.slice(index + 1)];
}

function downloadExport() {
  const result = exportBundle(state.progress);
  if (!result.ok) return;
  const blob = new Blob([JSON.stringify(result.bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "gta6-tracker-progress.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function copyExport() {
  const text = document.getElementById("export-text").value;
  const message = document.getElementById("import-message");
  try {
    await navigator.clipboard.writeText(text);
    message.textContent = "Export copied.";
  } catch {
    const box = document.getElementById("export-text");
    box.focus();
    box.select();
    message.textContent = "Select the export box and copy it.";
  }
}

function importText() {
  const message = document.getElementById("import-message");
  let parsed;
  try {
    parsed = JSON.parse(document.getElementById("import-text").value);
  } catch {
    message.textContent = "That is not valid JSON.";
    return;
  }
  const result = importBundle(parsed);
  if (!result.ok) {
    message.textContent = result.error;
    return;
  }
  state.cashError = null;
  commit(result.progress);
  message.textContent = "Progress imported.";
}

function resetProgress() {
  const button = document.getElementById("reset-btn");
  if (!state.resetArmed) {
    state.resetArmed = true;
    button.textContent = "Tap again to erase ticks";
    return;
  }
  state.resetArmed = false;
  state.cashError = null;
  commit(emptyProgress());
  button.textContent = "Reset progress on this device";
  document.getElementById("import-message").textContent = "Progress reset on this device.";
}

async function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  try {
    await deferredPrompt.userChoice;
  } catch {
    /* The browser dismissed the prompt. */
  }
  deferredPrompt = null;
  render();
}

function onClick(event) {
  const target = event.target;
  if (!(target instanceof Element) || !state) return;
  if (Date.now() < ignoreClicksUntil) return;

  if (target.closest("[data-close-sheet], #close-sheet")) {
    closeSheet();
    return;
  }
  const tab = target.closest("[data-tab]");
  if (tab) {
    location.hash = `#/${tab.dataset.tab}`;
    return;
  }
  const sub = target.closest("[data-sub]");
  if (sub && sub.dataset.sub) {
    const route = parseRoute(location.hash);
    location.hash = `#/${route.section}/${sub.dataset.sub}`;
    return;
  }
  if (target.closest("[data-clear]")) {
    showAllPins();
    return;
  }
  if (target.closest("[data-map-open]")) {
    setMapOpen(true);
    return;
  }
  if (target.closest("[data-map-close]")) {
    setMapOpen(false);
    return;
  }
  const blockToggle = target.closest("[data-block-toggle]");
  if (blockToggle) {
    const open = blockToggle.getAttribute("aria-expanded") !== "true";
    blockToggle.setAttribute("aria-expanded", open ? "true" : "false");
    blockToggle.querySelector(".chevron")?.classList.toggle("is-open", open);
    const body = blockToggle.parentElement?.querySelector(".block-body");
    if (body) body.hidden = !open;
    return;
  }
  const pinOpen = target.closest("[data-pin], [data-open]");
  if (pinOpen && !(pinOpen instanceof HTMLSelectElement)) {
    focusPin(pinOpen.dataset.pin || pinOpen.dataset.open);
    return;
  }
  const zoom = target.closest("[data-map-zoom]");
  if (zoom) {
    const delta = zoom.dataset.mapZoom === "in" ? 0.4 : -0.4;
    state.mapView.scale += delta;
    clampMap();
    applyMapTransform();
    return;
  }
  const area = target.closest("[data-area]");
  if (area) {
    state.areaId = area.dataset.area;
    render();
    return;
  }
  const goto = target.closest("[data-goto]");
  if (goto) {
    if (location.hash === goto.dataset.goto) render();
    else location.hash = goto.dataset.goto;
    return;
  }
  const tick = target.closest("[data-tick]");
  if (tick) {
    const [list, id] = splitTick(tick.dataset.tick);
    const result = toggleId(state.progress, list, id);
    if (result.ok) {
      state.cashError = null;
      commit(result.progress);
      announce(result.on ? "Ticked." : "Cleared.");
    }
    return;
  }
  const reveal = target.closest("[data-reveal]");
  if (reveal) {
    commit(revealId(state.progress, reveal.dataset.reveal));
    announce("Shown.");
    return;
  }
  const missionToggle = target.closest("[data-mission-toggle]");
  if (missionToggle) {
    const id = missionToggle.dataset.missionToggle;
    const open = missionToggle.getAttribute("aria-expanded") !== "true";
    state.restoreFocus = `[data-mission-toggle="${id}"]`;
    commit(setStoryOpen(state.progress, "missions", id, open));
    return;
  }
  const chapterToggle = target.closest("[data-chapter-toggle]");
  if (chapterToggle) {
    const id = chapterToggle.dataset.chapterToggle;
    const open = chapterToggle.getAttribute("aria-expanded") !== "true";
    state.restoreFocus = `[data-chapter-toggle="${id}"]`;
    commit(setStoryOpen(state.progress, "chapters", id, open));
    return;
  }
  const fold = target.closest("[data-story-fold]");
  if (fold) {
    commit(setAllStoryOpen(state.progress, state.catalog, fold.dataset.storyFold === "expand"));
    return;
  }
  if (target.closest("#spoiler-toggle, #sheet-spoiler")) {
    commit(setSpoilersHidden(state.progress, !state.progress.spoilersHidden));
    return;
  }
  if (target.closest("#settings-open")) {
    openSheet();
    return;
  }
  if (target.closest("[data-install]")) {
    installApp();
    return;
  }
  if (target.closest("#download-export")) {
    downloadExport();
    return;
  }
  if (target.closest("#copy-export")) {
    copyExport();
    return;
  }
  if (target.closest("#import-btn")) {
    importText();
    return;
  }
  if (target.closest("#reset-btn")) {
    resetProgress();
  }
}

function onFilter(event) {
  const node = event.target;
  if (!(node instanceof Element) || !state) return;
  const select = node instanceof HTMLSelectElement ? node : node.closest("select");
  const kind = select && select.dataset.filter;
  if (!kind) return;
  const spec = listSpec(currentRoute().section) || MAP_LISTS.cars;
  const filters = state.filters[spec.id];
  if (!filters || filters[kind] === select.value) return;
  filters[kind] = select.value;
  writeFilters(localStorage, state.filters);
  ignoreClicksUntil = Date.now() + 500;
  render();
}

function onSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== "cash-form" || !state) return;
  event.preventDefault();
  const data = new FormData(form);
  const result = setCash(state.progress, { cash: data.get("cash"), note: data.get("note") });
  if (!result.ok) {
    state.cashError = result.error;
    render();
    return;
  }
  state.cashError = null;
  commit(result.progress);
  announce("Cash saved.");
}

const mapPointers = new Map();
let mapPinch = null;

function mapFrame() {
  const stage = document.querySelector("[data-map-stage]");
  const layer = document.querySelector("[data-map-layer]");
  if (!stage || !layer || !stage.clientWidth) return null;
  return {
    stageW: stage.clientWidth,
    stageH: stage.clientHeight,
    ratio: Number(layer.dataset.mapRatio) || 1,
  };
}

function focusPin(id, { animate = true } = {}) {
  const spec = listSpec(currentRoute().section);
  if (!spec) return;
  const from = { ...state.mapView };
  state.picked[spec.id] = id;
  render();
  const car = listRows(spec).find((item) => item.id === id);
  const frame = mapFrame();
  if (!car || car.mapX == null || car.mapY == null || !frame || state.picked[spec.id] !== id) return;
  const to = mapViewForCar(car, frame);
  if (animate) {
    glideMap(from, to);
    document.querySelector("[data-map-stage]")?.scrollIntoView({ block: "start", behavior: "smooth" });
  } else {
    state.mapView = to;
    applyMapTransform(to, { instant: true });
  }
}

function showAllPins({ animate = true } = {}) {
  const spec = listSpec(currentRoute().section);
  const from = { ...state.mapView };
  if (spec) state.picked[spec.id] = null;
  const to = { x: 0, y: 0, scale: 1 };
  render();
  if (animate) glideMap(from, to);
  else {
    state.mapView = to;
    clampMap();
    applyMapTransform(state.mapView, { instant: true });
  }
}

function refitMap() {
  if (!state) return;
  const spec = listSpec(currentRoute().section);
  const picked = spec ? state.picked[spec.id] : null;
  const car = picked ? listRows(spec).find((item) => item.id === picked) : null;
  const frame = mapFrame();
  if (car && car.mapX != null && car.mapY != null && frame) {
    state.mapView = mapViewForCar(car, frame);
    applyMapTransform(state.mapView, { instant: true });
    return;
  }
  clampMap();
  applyMapTransform(state.mapView, { instant: true });
}

function setMapOpen(open) {
  state.mapOpen = open;
  document.body.classList.toggle("map-open", open);
  requestAnimationFrame(() => refitMap());
}

function glideMap(from, to) {
  const token = ++glideToken;
  state.mapView = { ...to };
  applyMapTransform(from, { instant: true });
  requestAnimationFrame(() => {
    if (token !== glideToken || !state) return;
    applyMapTransform(state.mapView);
  });
}

function clampMap() {
  const stage = document.querySelector("[data-map-stage]");
  const layer = document.querySelector("[data-map-layer]");
  if (!stage || !layer || !state?.mapView) return;
  const view = state.mapView;
  const baseW = stage.clientWidth;
  const ratio = Number(layer.dataset.mapRatio) || 1;
  const baseH = baseW * ratio;
  const fit = Math.min(1, stage.clientHeight / baseH);
  view.scale = Math.min(4, Math.max(fit, view.scale));
  const minX = Math.min(0, stage.clientWidth - baseW * view.scale);
  const minY = Math.min(0, stage.clientHeight - baseH * view.scale);
  view.x = Math.min(0, Math.max(minX, view.x));
  view.y = Math.min(0, Math.max(minY, view.y));
}

function applyMapTransform(view, options) {
  const layer = document.querySelector("[data-map-layer]");
  const stage = document.querySelector("[data-map-stage]");
  const current = view || state?.mapView;
  if (!layer || !stage || !current) return;
  const pins = [...document.querySelectorAll("[data-pin]")];
  if (options?.instant) {
    layer.style.transition = "none";
    for (const pin of pins) pin.style.transition = "none";
  }
  const { x, y, scale } = current;
  layer.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  const baseW = stage.clientWidth;
  const ratio = Number(layer.dataset.mapRatio) || 1;
  const baseH = baseW * ratio;
  for (const pin of pins) {
    const px = (Number(pin.dataset.mapX) / 100) * baseW * scale + x;
    const py = (Number(pin.dataset.mapY) / 100) * baseH * scale + y;
    pin.style.left = `${px}px`;
    pin.style.top = `${py}px`;
  }
  if (options?.instant) {
    layer.getBoundingClientRect();
    layer.style.transition = "";
    for (const pin of pins) pin.style.transition = "";
  }
}

function onMapPointerDown(event) {
  const stage = event.target.closest("[data-map-stage]");
  if (!stage || !state) return;
  if (event.target.closest("[data-map-zoom], [data-pin], [data-clear], [data-map-open], [data-map-close]")) return;
  stage.classList.add("is-panning");
  stage.setPointerCapture(event.pointerId);
  mapPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (mapPointers.size === 2) {
    const [first, second] = [...mapPointers.values()];
    mapPinch = {
      distance: Math.hypot(first.x - second.x, first.y - second.y) || 1,
      scale: state.mapView.scale,
    };
  }
}

function onMapPointerMove(event) {
  if (!mapPointers.has(event.pointerId) || !state) return;
  const previous = mapPointers.get(event.pointerId);
  const next = { x: event.clientX, y: event.clientY };
  mapPointers.set(event.pointerId, next);
  if (mapPointers.size >= 2 && mapPinch) {
    const [first, second] = [...mapPointers.values()];
    const distance = Math.hypot(first.x - second.x, first.y - second.y) || 1;
    state.mapView.scale = mapPinch.scale * (distance / mapPinch.distance);
    state.mapView.x += next.x - previous.x;
    state.mapView.y += next.y - previous.y;
  } else if (mapPointers.size === 1) {
    state.mapView.x += next.x - previous.x;
    state.mapView.y += next.y - previous.y;
  }
  clampMap();
  applyMapTransform();
}

function onMapPointerEnd(event) {
  if (!mapPointers.has(event.pointerId)) return;
  mapPointers.delete(event.pointerId);
  if (mapPointers.size < 2) mapPinch = null;
  if (mapPointers.size === 0) document.querySelector("[data-map-stage]")?.classList.remove("is-panning");
}

function bind() {
  document.addEventListener("pointerdown", onMapPointerDown);
  document.addEventListener("pointermove", onMapPointerMove);
  document.addEventListener("pointerup", onMapPointerEnd);
  document.addEventListener("pointercancel", onMapPointerEnd);
  window.addEventListener("hashchange", () => {
    if (state) render();
  });
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (state) render();
  });
  document.body.addEventListener("click", onClick);
  document.body.addEventListener("change", onFilter);
  document.body.addEventListener("input", onFilter);
  document.body.addEventListener("submit", onSubmit);
  window.addEventListener("resize", () => syncDockHeight());
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (state?.mapOpen) setMapOpen(false);
    else closeSheet();
  });
  document.getElementById("import-file").addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    document.getElementById("import-text").value = await file.text();
  });
}

function registerSw() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {
    /* Offline install is optional if this host blocks the worker. */
  });
}

async function boot() {
  applyTabVisibility();
  openEnabledRoute();
  bind();
  try {
    const data = {};
    await Promise.all(DATA_FILES.map(async (name) => {
      const response = await fetch(`./data/${name}.json`);
      if (!response.ok) throw new Error(`Could not load ${name}`);
      data[name] = await response.json();
    }));
    const loaded = loadProgress();
    state = {
      data,
      catalog: buildCatalog(data),
      progress: loaded.progress,
      storageWarning: loaded.warning,
      areaId: "all",
      filters: readFilters(localStorage),
      picked: { cars: null, weapons: null },
      mapView: { x: 0, y: 0, scale: 1 },
      mapOpen: false,
      cashError: null,
      sheetOpen: false,
      resetArmed: false,
      lastSection: null,
    };
    render();
    registerSw();
  } catch {
    const main = document.getElementById("main");
    main.innerHTML = '<p class="banner">Could not load the tracker data. Check the connection and reload.</p>';
    main.dataset.ready = "error";
  }
}

boot();
