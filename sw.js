/* Bump CACHE when shipped files change so old caches are dropped. */
const CACHE = "gta6-tracker-v10";

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
  "./data/weapons.json",
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
  "./images/weapons/weapon-assassin-nipper-38.jpg",
  "./images/weapons/weapon-bae-luxs-w-10.jpg",
  "./images/weapons/weapon-black-eagle-import-kalinga.jpg",
  "./images/weapons/weapon-black-eagle-import-m306-tmr.jpg",
  "./images/weapons/weapon-brontasaurus-bat.jpg",
  "./images/weapons/weapon-caminos-signature-k17.jpg",
  "./images/weapons/weapon-cargo-h-and-l-38.jpg",
  "./images/weapons/weapon-chromium-w-10.jpg",
  "./images/weapons/weapon-chronic-vatra.jpg",
  "./images/weapons/weapon-clunker-556.jpg",
  "./images/weapons/weapon-cockroach-xtreme-556.jpg",
  "./images/weapons/weapon-cold-war-556.jpg",
  "./images/weapons/weapon-conspiracist-type-9.jpg",
  "./images/weapons/weapon-couch-potato-mustang-357.jpg",
  "./images/weapons/weapon-crabshack-vf5.jpg",
  "./images/weapons/weapon-cruel-huntsmans-sm-69.jpg",
  "./images/weapons/weapon-deadringer-1992.jpg",
  "./images/weapons/weapon-deever-tech-glr40.jpg",
  "./images/weapons/weapon-dirty-drifter.jpg",
  "./images/weapons/weapon-donnies-h-and-l-38.jpg",
  "./images/weapons/weapon-double-cross-vatra.jpg",
  "./images/weapons/weapon-drug-mule-kz-59.jpg",
  "./images/weapons/weapon-duval-signature-es9.jpg",
  "./images/weapons/weapon-explorers-knife.jpg",
  "./images/weapons/weapon-fib-sm-69.jpg",
  "./images/weapons/weapon-final-chapter-kvga-12.jpg",
  "./images/weapons/weapon-final-chapter-shortstraw.jpg",
  "./images/weapons/weapon-gils-kalinga-50.jpg",
  "./images/weapons/weapon-grx-556.jpg",
  "./images/weapons/weapon-guardia-brothers-vf5.jpg",
  "./images/weapons/weapon-gun-nut-sms-01.jpg",
  "./images/weapons/weapon-gutterball-moreland-850.jpg",
  "./images/weapons/weapon-hellspawn-comshot-12.jpg",
  "./images/weapons/weapon-hostile-super400.jpg",
  "./images/weapons/weapon-hunters-laird-350.jpg",
  "./images/weapons/weapon-iaa-sms-01.jpg",
  "./images/weapons/weapon-internal-affairs-ff-sr.jpg",
  "./images/weapons/weapon-jasons-hawk-and-little-morgan-revolver.jpg",
  "./images/weapons/weapon-killtelligence-sm-69.jpg",
  "./images/weapons/weapon-kingfishers-akulus.jpg",
  "./images/weapons/weapon-kingfishers-laird-350.jpg",
  "./images/weapons/weapon-kingfishers-w-22.jpg",
  "./images/weapons/weapon-kingpin-heathen.jpg",
  "./images/weapons/weapon-kolt-and-associates-556.jpg",
  "./images/weapons/weapon-kolt-and-associates-vatra.jpg",
  "./images/weapons/weapon-la-polilla-negra-kz-59.jpg",
  "./images/weapons/weapon-la-polilla-negra-vf-g1.jpg",
  "./images/weapons/weapon-little-friend-w-10.jpg",
  "./images/weapons/weapon-lucias-hawk-and-little-morgan-revolver.jpg",
  "./images/weapons/weapon-lyles-h-and-l-38.jpg",
  "./images/weapons/weapon-marabunta-grande-hobo.jpg",
  "./images/weapons/weapon-marabunta-grande-kz-59.jpg",
  "./images/weapons/weapon-marabunta-grande-type-9.jpg",
  "./images/weapons/weapon-marthas-1992.jpg",
  "./images/weapons/weapon-mercenary-lmg-6.jpg",
  "./images/weapons/weapon-mister-mangrove-laird-350.jpg",
  "./images/weapons/weapon-money-bag-1992.jpg",
  "./images/weapons/weapon-montys-1992.jpg",
  "./images/weapons/weapon-petes-kz-59.jpg",
  "./images/weapons/weapon-ptt-youngins-k17.jpg",
  "./images/weapons/weapon-quarter-mile-es9.jpg",
  "./images/weapons/weapon-redneck-w-22.jpg",
  "./images/weapons/weapon-ride-free-h-and-l-38.jpg",
  "./images/weapons/weapon-roxys-w-10.jpg",
  "./images/weapons/weapon-san4san-gorse-425.jpg",
  "./images/weapons/weapon-san4san-k17.jpg",
  "./images/weapons/weapon-san4san-kz-59.jpg",
  "./images/weapons/weapon-scrapper-vf5c.jpg",
  "./images/weapons/weapon-shark-knife.jpg",
  "./images/weapons/weapon-smuggler-gorse-425.jpg",
  "./images/weapons/weapon-soldiers-combat-knife.jpg",
  "./images/weapons/weapon-stoner-k17-mcd.jpg",
  "./images/weapons/weapon-swamp-bait-akulus.jpg",
  "./images/weapons/weapon-tallaloko-knife.jpg",
  "./images/weapons/weapon-the-guardian-es18.jpg",
  "./images/weapons/weapon-the-patriarch-drx.jpg",
  "./images/weapons/weapon-throttler-vero.jpg",
  "./images/weapons/weapon-turnt-nipper-38.jpg",
  "./images/weapons/weapon-twins-laird-350.jpg",
  "./images/weapons/weapon-unpacked-comshot-12.jpg",
  "./images/weapons/weapon-zodiac-nipper-38.jpg",
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
