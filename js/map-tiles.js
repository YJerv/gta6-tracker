/** On-demand JPEG tile pyramid for the illustrated Leonida map.
 *  Tiles live at relative paths so GitHub Pages and raw.githack work offline.
 */
const MANIFEST_URL = new URL("../images/map-tiles/manifest.json", import.meta.url);

let manifest = null;
let loadPromise = null;

export const MAX_MAP_SCALE = 5;

export function loadMapTiles() {
  if (loadPromise) return loadPromise;
  loadPromise = fetch(MANIFEST_URL)
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      manifest = data;
      return data;
    })
    .catch(() => null);
  return loadPromise;
}

export function pickTileLevel(levels, cssWidth, devicePixelRatio = 1) {
  if (!levels || !levels.length) return null;
  const need = Math.max(1, cssWidth * devicePixelRatio);
  let chosen = levels[0];
  for (const level of levels) {
    chosen = level;
    if (level.width >= need) return level;
  }
  return chosen;
}

function tilePath(level, column, row) {
  return `images/map-tiles/${level.z}/${column}_${row}.jpg`;
}

export function updateMapTiles(stage, layer, view) {
  if (!manifest || !stage || !layer || !view) return;
  let holder = layer.querySelector("[data-map-tiles]");
  if (!holder) {
    holder = document.createElement("div");
    holder.className = "map-tiles";
    holder.dataset.mapTiles = "";
    holder.setAttribute("aria-hidden", "true");
    layer.appendChild(holder);
  }
  const scale = Math.max(0.01, Number(view.scale) || 1);
  const cssWidth = stage.clientWidth * scale;
  const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
  const level = pickTileLevel(manifest.levels, cssWidth, dpr);
  if (!level) return;

  const baseW = stage.clientWidth;
  const ratio = Number(layer.dataset.mapRatio) || 1;
  const baseH = baseW * ratio;
  const visL = (-view.x) / scale;
  const visT = (-view.y) / scale;
  const visR = visL + stage.clientWidth / scale;
  const visB = visT + stage.clientHeight / scale;
  const pad = 1;
  const col0 = Math.max(0, Math.floor((visL / baseW) * level.width / level.tileSize) - pad);
  const row0 = Math.max(0, Math.floor((visT / baseH) * level.height / level.tileSize) - pad);
  const col1 = Math.min(level.cols - 1, Math.ceil((visR / baseW) * level.width / level.tileSize) + pad);
  const row1 = Math.min(level.rows - 1, Math.ceil((visB / baseH) * level.height / level.tileSize) + pad);

  const needed = new Set();
  for (let row = row0; row <= row1; row += 1) {
    for (let column = col0; column <= col1; column += 1) {
      const key = `${level.z}:${column}:${row}`;
      needed.add(key);
      let img = holder.querySelector(`[data-tile="${key}"]`);
      if (!img) {
        img = document.createElement("img");
        img.dataset.tile = key;
        img.alt = "";
        img.draggable = false;
        img.src = tilePath(level, column, row);
        holder.appendChild(img);
      }
      const tileW = Math.min(level.tileSize, level.width - column * level.tileSize);
      const tileH = Math.min(level.tileSize, level.height - row * level.tileSize);
      img.style.left = `${(column * level.tileSize / level.width) * 100}%`;
      img.style.top = `${(row * level.tileSize / level.height) * 100}%`;
      // Use the padded 512 source against the full tile slot so edge tiles
      // (black-padded in the pyramid) stay aligned; overflow is clipped.
      img.style.width = `${(level.tileSize / level.width) * 100}%`;
      img.style.height = `${(level.tileSize / level.height) * 100}%`;
      void tileW;
      void tileH;
    }
  }
  for (const img of [...holder.querySelectorAll("[data-tile]")]) {
    if (!needed.has(img.dataset.tile)) img.remove();
  }
}
