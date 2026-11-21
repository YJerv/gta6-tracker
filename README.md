# GTA VI Tracker

A mobile-first progress tracker for a single-player GTA VI playthrough on Xbox Series X|S. It is a static site: HTML, CSS, and vanilla JavaScript, with no build step and no backend. Progress stays in the browser. After one online visit, a service worker opens the same files offline.

Launch is recorded here as **19 November 2026**, single-player only. No online mode was announced as of 20 November 2026. Chapter 1 missions 1 to 10 are sourced from named guides in `data/story.json`. Every other mission, place, and price is still a placeholder until a verified guide is added.

## Use it

Open `index.html` over HTTP (not as a bare file, or the JSON will not load). The app opens on Cars. The bottom bar hides while only one section is switched on. Spoilers and Settings stay above it. Other sections, including Story, are still in the code and the data files. Add a name back to `ENABLED_TABS` in `js/config.js` (`home`, `story`, `money`, `map`, `skills`, `cars`, `gear`, `online`) to show that tab again.

- **Home** shows completion, a cash figure you type yourself, and the next unticked mission.
- **Story** is chapters and missions, with steps, bonus or gold objectives, and missables inside each card.
- **Money** lists earners and purchases by an editorial early / mid / late stage.
- **Map** is a collectible checklist you can filter by area. Secrets are the other tab.
- **Skills** has generic Xbox settings, generic driving and aiming drills, and placeholder stat rows.
- **Gear** is vehicles and weapons by the same stages, including where to find them once that text is real.
- **Online** is news plus a readiness checklist. It is not a description of a live mode.

**Spoilers hidden** (the default) covers chapters after the furthest chapter with a ticked mission. Before the first tick, only chapter 1 is open. **Show this** opens one covered block. **Spoilers shown** opens everything. Ticks, cash, the spoiler switch, and one-off reveals are stored under `localStorage` key `gta6-tracker-progress-v1`.

Settings can download or copy that progress as JSON, import a file, or reset this device. Import accepts the export wrapper or a raw progress object.

Install it from the browser menu (Install, or Add to Home screen). The manifest uses `display: standalone`.

## Run locally

From this directory:

```bash
python3 -m http.server 8080
```

Then open `http://127.0.0.1:8080/`. Check the data and the progress logic with:

```bash
node scripts/validate.js
npm test
```

Node 20 or newer. There are no packages to install.

## Deploy

Paths are relative, so the site works at a domain root or in a subpath such as GitHub Pages project sites and raw.githack commit URLs.

### GitHub Pages

This repository does not turn Pages on. To publish it yourself later:

1. Push the branch you want to publish.
2. In the repository on GitHub, open Settings, then Pages.
3. Deploy from a branch and choose the branch plus the `/` (root) folder.
4. Wait for the Pages URL, usually `https://yjerv.github.io/gta6-tracker/`.

Do not add a build command. The site is the files as they are.

### raw.githack

For a commit that is already on GitHub:

`https://raw.githack.com/YJerv/gta6-tracker/<commit>/index.html`

Replace `<commit>` with the full commit SHA. Use that host for a short-lived preview. It is not a substitute for Pages if you want a stable install URL.

## Offline

`sw.js` precaches the HTML, CSS, JavaScript, manifest, icons, and data files, then tries the network first and falls back to the cache. Bump the `CACHE` name in `sw.js` when you add a file to `RELATIVE_ASSETS`, so old caches are dropped. Editing an existing JSON file updates on the next online load without a bump.

## Data file format

Each file in `/data` is one section. `scripts/schema.js` is the checker. `node scripts/validate.js` prints every failure and exits 1.

Shared envelope, required on every file:

| Field | Rule |
| --- | --- |
| `version` | Integer, `1` or higher. |
| `lastUpdated` | Real `YYYY-MM-DD` date. |
| `section` | Must match the file name (`story` for `story.json`). |
| `description` | What the file is for. At least a sentence. |

Shared fields on content entries:

| Field | Rule |
| --- | --- |
| `id` | Kebab-case, unique across **all** data files, 80 characters or fewer. |
| `title` | Non-empty, 180 characters or fewer. |
| `verified` | `true` only when `source` backs the text. |
| `source` | String when `verified` is `true`. Must be `null` when `verified` is `false`. |
| `generic` | `true` only for advice that is not a GTA VI fact. The source must contain the word "generic". `chapterOrder` must then be `null`. |
| `chapterOrder` | Positive integer matching a chapter `order` in `story.json`, or `null` when the row is not story-gated. |

While `verified` is `false`, every text field (`title`, `summary`, `detail`, `steps`, `bonusObjectives`, `missables`, `category`, `role`, `where`) must be empty or start with `PLACEHOLDER:`. Unverified text must not contain `$`, `£`, or `€`. Verified text must not contain `PLACEHOLDER:`.

Do not add undeclared keys. The validator rejects them.

### `data/meta.json`

Known framing only. Do not hide mission or location facts in here.

| Field | Rule |
| --- | --- |
| `gameTitle` | Non-empty string. |
| `platform` | Non-empty string. This app is written for Xbox Series X\|S. |
| `releaseDate` | Real `YYYY-MM-DD` date. |
| `singlePlayerOnly` | Boolean. |
| `onlineAnnounced` | Boolean. |
| `statusNote` | Short note shown on Home and Online. |
| `facts` | One or more sourced notes. Fields: `id`, `title`, `verified`, `source`, `generic`, `detail`. |

```json
{
  "id": "fact-release-date",
  "title": "Launched 19 November 2026",
  "verified": true,
  "source": "Project brief for this tracker, recorded 20 November 2026.",
  "generic": false,
  "detail": "Launch date recorded for this tracker. This file does not list missions, characters, locations, or prices."
}
```

### `data/story.json`

`notice` sits above the chapters on the Story tab. It is not hidden by the spoiler switch. Fields: `title`, `source` (non-empty), `lastUpdated` (`YYYY-MM-DD`), and `items` (1 to 8 sentences, no `PLACEHOLDER:` prefix). The player can fold it. It is not a dismiss control.

`chapters` is a non-empty array. Chapter fields: `id`, `order` (unique positive integer), `title`, `verified`, `source`, `generic`, `summary`, `missions`.

Each mission: `id`, `order` (unique inside the chapter), `title`, `verified`, `source`, `generic`, `summary`, `steps`, `bonusObjectives`, `missables`. The three lists are arrays of strings (empty until a guide provides them, at most 12 lines, 300 characters each).

Optional illustration fields, set together or not at all: `image` (a relative path under `images/`, and the file must exist), `imageCredit`, and `imageAlt`. The picture is shown only inside that mission once it is expanded, so the spoiler switch hides it with the rest of the mission. Add the file to `RELATIVE_ASSETS` in `sw.js` and bump `CACHE`.

The shipped file has five chapters, which is what the cited guides list. Chapter 1 is verified as "Just Like Paradise" and has 22 mission slots. Missions 1 to 10 are sourced. Missions 11 to 22, and chapters 2 to 5, are still placeholders. Keep the ids `chapter-1-mission-1` through `chapter-1-mission-10` stable so saved ticks still match.

```json
{
  "title": "Good to know",
  "source": "PowerPyx, read 20 November 2026.",
  "lastUpdated": "2026-11-20",
  "items": [
    "GTA VI has no gold medals and no mission replay, so do the optional extras the first time."
  ]
}
```

A placeholder mission still looks like this:

```json
{
  "id": "chapter-1-mission-11",
  "order": 11,
  "title": "PLACEHOLDER: Chapter 1 mission 11 - to be filled from a verified guide",
  "verified": false,
  "source": null,
  "generic": false,
  "summary": "PLACEHOLDER: Spoiler-light overview to be filled from a verified guide.",
  "steps": [],
  "bonusObjectives": [],
  "missables": []
}
```

### `data/money.json`

`earners` and `purchases` use the same entry shape: `id`, `title`, `verified`, `source`, `generic`, `stage`, `chapterOrder`, `detail`.

`stage` is `early`, `mid`, or `late`. Those words are editorial, not official act names. `chapterOrder` must be 1, 3, or 5 respectively (`STAGE_CHAPTER` in `scripts/schema.js`). No prices until a source gives one, and then only on a verified entry.

```json
{
  "id": "money-earner-early-1",
  "title": "PLACEHOLDER: Early-story earner 1 - to be filled from a verified guide",
  "verified": false,
  "source": null,
  "generic": false,
  "stage": "early",
  "chapterOrder": 1,
  "detail": "PLACEHOLDER: Why this is a strong way to make money at this stage, and what it requires. No payout is verified."
}
```

### `data/collectibles.json`

`areas` have `id`, `order`, `title`, `verified`, `source`, `generic`, `chapterOrder`, `items`.

Each item: `id`, `title`, `verified`, `source`, `generic`, `category`, `detail`, `chapterOrder`. The item's `chapterOrder` must equal its area's.

```json
{
  "id": "area-1-collectible-1",
  "title": "PLACEHOLDER: Area 1 collectible 1 - to be filled from a verified guide",
  "verified": false,
  "source": null,
  "generic": false,
  "category": "PLACEHOLDER: Collectible category",
  "detail": "PLACEHOLDER: Where to find it, and whether it can be missed.",
  "chapterOrder": 1
}
```

### `data/secrets.json`

Easter eggs, separate from the map checklist. `entries`: `id`, `title`, `verified`, `source`, `generic`, `chapterOrder`, `areaId`, `detail`. `areaId` is an area id from `collectibles.json`, or `null`.

```json
{
  "id": "secret-1",
  "title": "PLACEHOLDER: Secret 1 - to be filled from a verified guide",
  "verified": false,
  "source": null,
  "generic": false,
  "chapterOrder": 1,
  "areaId": "area-1",
  "detail": "PLACEHOLDER: What the secret or easter egg is, and how to trigger it."
}
```

### `data/skills.json`

Three arrays:

- `xboxSettings`: the shared fields plus `topic` (`dead-zone`, `aim-assist`, `sensitivity`, `feedback`, `display`, `layout`) and `detail` (up to 800 characters).
- `drills`: shared fields plus `discipline` (`driving` or `aiming`) and `detail`.
- `stats`: shared fields plus `detail`. These are the game-stat placeholders.

Generic rows must say they are not GTA VI instructions.

```json
{
  "id": "setting-dead-zone",
  "title": "Look and move dead zones",
  "verified": true,
  "source": "Generic Xbox Series controller guidance. Not a GTA VI setting, and not a recommended number.",
  "generic": true,
  "chapterOrder": null,
  "topic": "dead-zone",
  "detail": "If the camera creeps while your thumb is off the stick, the dead zone is too small."
}
```

### `data/gear.json`

`vehicles` and `weapons`: `id`, `title`, `verified`, `source`, `generic`, `stage`, `chapterOrder`, `role`, `where`, `detail`. `stage` uses the same early / mid / late rule as money.

```json
{
  "id": "vehicle-early-1",
  "title": "PLACEHOLDER: Early-story vehicle 1 - to be filled from a verified guide",
  "verified": false,
  "source": null,
  "generic": false,
  "stage": "early",
  "chapterOrder": 1,
  "role": "PLACEHOLDER: Suggested role to be filled from a verified guide.",
  "where": "PLACEHOLDER: Where to find it, to be filled from a verified guide.",
  "detail": "PLACEHOLDER: Why this is a strong pick at this stage."
}
```

### `data/cars.json`

Secret and rare cars, with a map. `map` has `image` (a path under `images/` or `images/cars/`, or `null`), `imageCredit`, `imageAlt`, `source`, `width`, and `height`. Credit, alt, width, and height are required when `image` is a path, and the file must exist. `width` and `height` are the picture's pixel size. Pins use `mapX` and `mapY` as percentages from the top-left of that picture.

Each car: `id`, `verified`, `source`, `generic` (must be `false`), `chapterOrder` (`null` if it is available from the start), `title`, `category`, `area`, `mapX`, `mapY` (each `null` or a number from 0 to 100), `precision` (`exact`, `street`, or `area`), `steps`, `notes`, `image`, `imageCredit`, `imageAlt`, `imageSource`, and `imageVerified`. Leave `image`, `imageCredit`, `imageAlt`, and `imageSource` all `null` when there is no picture. When `image` is a path under `images/cars/`, the credit, alt, and source URL are required and the file must exist. `imageVerified` is `true` or `false`. Unverified text starts with `PLACEHOLDER:`. Steps may be long when guides disagree; the card wraps them.

`precision` is how close the pin is. `exact` means the right block, roughly 1-2% of the map width. `street` means street level. `area` means the general area only. The poster still has no street names.

The shipped file uses Rockstar's Leonida map poster (`images/cars/leonida-map.jpg`, 1402×1920). The credit under the map is the file's `imageCredit` and `source` text, including GTADB, GTA6Map.io, and GTA6 GPS.

```json
{
  "id": "car-placeholder-1",
  "verified": false,
  "source": null,
  "generic": false,
  "chapterOrder": null,
  "title": "PLACEHOLDER: Secret car 1 - to be filled from a verified guide",
  "category": "PLACEHOLDER: Class",
  "area": "PLACEHOLDER: Area 1",
  "mapX": 22,
  "mapY": 30,
  "precision": "area",
  "steps": [
    "PLACEHOLDER: How to find it, to be filled from a verified guide."
  ],
  "notes": "PLACEHOLDER: Extra notes to be filled from a verified guide.",
  "image": null,
  "imageCredit": null,
  "imageAlt": null,
  "imageSource": null,
  "imageVerified": false
}
```

### `data/online.json`

`news`: shared fields plus `date` (`YYYY-MM-DD` or `null`) and `detail`. News is not story-gated (`chapterOrder` is `null`). Do not speculate. A verified item needs a source.

`checklist`: shared fields plus `detail`. The rows shipped here are generic readiness, not online-mode facts.

```json
{
  "id": "online-news-launch-status",
  "title": "No online mode announced",
  "verified": true,
  "source": "Project brief for this tracker, recorded 20 November 2026. Not a publisher statement copied from the web.",
  "generic": false,
  "chapterOrder": null,
  "date": "2026-11-20",
  "detail": "As of 20 November 2026 this tracker has no verified announcement of a GTA VI online mode."
}
```

How to replace placeholders without breaking the spoiler rules: `docs/CONTENT.md`.

## Progress file

Export produces:

```json
{
  "app": "gta6-tracker",
  "exportedAt": "2026-11-20T12:00:00.000Z",
  "progress": {
    "version": 1,
    "missions": ["chapter-1-mission-1"],
    "collectibles": [],
    "secrets": [],
    "settings": [],
    "drills": [],
    "stats": [],
    "vehicles": [],
    "weapons": [],
    "money": [],
    "online": [],
    "cash": 1250,
    "cashNote": "After the prologue",
    "spoilersHidden": true,
    "revealedIds": [],
    "storyOpen": { "chapters": { "chapter-1": true }, "missions": {} },
    "updatedAt": "2026-11-20T12:00:00.000Z"
  }
}
```

`cash` is a whole number you typed, or `null`. It is not read from the game. Unknown ids are kept on import so a future content edit does not wipe old ticks, but only ids that still exist count toward the percentage. Completion is the share of trackable rows that are ticked. News items are not trackable.

`revealedIds` holds ids you opened with **Show this** while spoilers stay hidden. Revealing a chapter id opens that chapter. Revealing `money-mid`, `vehicles-late`, or an area id opens that block.

`storyOpen` remembers which story chapters and missions are expanded on this device. A missing id follows the default: the chapter that contains the next unticked mission is expanded, and so is that mission. Every other chapter and mission starts collapsed. `true` or `false` overrides that default. Expand all and Collapse all write an explicit value for every id. Spoiler covers ignore this and stay hidden.

## Screenshots

Phone-sized captures (390×844) of each section are in `docs/screenshots/`.

## Layout

```
index.html
manifest.webmanifest
sw.js
css/styles.css
js/app.js          browser boot, storage, routing
js/render.js       HTML for each section
js/progress.js     ticks, spoilers, import/export (also used by tests)
js/html.js
data/*.json
scripts/validate.js
scripts/schema.js
tests/smoke.test.js
icons/
```
