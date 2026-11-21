/* Bump CACHE when shipped files change so old caches are dropped. */
const CACHE = "gta6-tracker-v9";

const RELATIVE_ASSETS = [
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./js/config.js",
  "./js/progress.js",
  "./js/render.js",
  "./js/html.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./data/meta.json",
  "./data/story.json",
  "./data/money.json",
  "./data/collectibles.json",
  "./data/secrets.json",
  "./data/skills.json",
  "./data/gear.json",
  "./data/cars.json",
  "./data/online.json",
  "./images/chapter-1-mission-1.jpg",
  "./images/chapter-1-mission-2.jpg",
  "./images/chapter-1-mission-3.jpg",
  "./images/chapter-1-mission-4.jpg",
  "./images/chapter-1-mission-5.jpg",
  "./images/chapter-1-mission-6.jpg",
  "./images/chapter-1-mission-8.jpg",
  "./images/chapter-1-mission-9.jpg",
  "./images/chapter-1-mission-10.jpg",
  "./images/cars/leonida-map.jpg",
  "./images/cars/car-annis-hellion.jpg",
  "./images/cars/car-ascot-paragon.jpg",
  "./images/cars/car-bf-bandito.jpg",
  "./images/cars/car-bravado-banshee.jpg",
  "./images/cars/car-bravado-gauntlet-hellfire.jpg",
  "./images/cars/car-canis-crawler-82.jpg",
  "./images/cars/car-declasse-vamos.jpg",
  "./images/cars/car-declasse-yosemite-1500.jpg",
  "./images/cars/car-dinka-enduro.jpg",
  "./images/cars/car-granforma-zorrusso.jpg",
  "./images/cars/car-grotti-cheetah-95.jpg",
  "./images/cars/car-hauners-p996-lazer.jpg",
  "./images/cars/car-hauners-rhino-tank.jpg",
  "./images/cars/car-invetero-coquette-d10.jpg",
  "./images/cars/car-karin-futo.jpg",
  "./images/cars/car-mamba-gt.jpg",
  "./images/cars/car-pegassi-infernus.jpg",
  "./images/cars/car-pegassi-tempesta.jpg",
  "./images/cars/car-pegassi-toros.jpg",
  "./images/cars/car-pegassi-vitello.jpg",
  "./images/cars/car-penumbra-ff-eclipse.jpg",
  "./images/cars/car-pfister-growler.jpg",
  "./images/cars/car-piccia-furia.jpg",
  "./images/cars/car-teniente-manana.jpg",
  "./images/cars/car-truffade-thrax.jpg",
  "./images/cars/car-twinstripe-vigero.jpg",
  "./images/cars/car-vapid-dominator-buggy-67.jpg",
  "./images/cars/car-vapid-stanier-55.jpg",
  "./images/cars/car-western-nightblade.jpg",
];

const ASSETS = RELATIVE_ASSETS.map((asset) => new URL(asset, self.location).href);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request, { cache: "no-cache" });
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const fallback = await cache.match(new URL("./index.html", self.location).href);
      if (fallback) return fallback;
    }
    throw error;
  }
}
