# Filling in tracker content

Game facts live in `/data/*.json`. Replace a placeholder only when you have a source you can name. Do not invent mission names, characters, locations, prices, or other GTA VI facts.

Chapter 1 missions 1 to 10 are already verified in `data/story.json`. Keep their ids. Do not rewrite that text unless you are correcting it from the named guides. Missions 11 to 22 in that chapter, and chapters 2 to 5, are still placeholders.

`notice` on that file is the Good to know box at the top of Story. It needs a source and a `lastUpdated` date. It is not covered by the spoiler switch. Add a line only when a guide actually says it, and say so in the text when two guides disagree.

A mission may have `image`, `imageCredit`, and `imageAlt` together. `image` is a file under `images/` (for example `images/chapter-1-mission-1.jpg`). Leave all three off when there is no picture. Put the new file in `sw.js` `RELATIVE_ASSETS` and bump `CACHE`. The picture is an illustration inside the expanded mission, not a claim that it is a screenshot of that mission.

Player-facing copy in the app uses British English. Keep new sentences in British English too.

## Replace one placeholder

1. Open the data file for that section. The shape is in the README under "Data file format".
2. Change `verified` from `false` to `true`.
3. Set `source` to a non-empty string: guide or article name, URL, and the date you read it. `source` must be `null` while `verified` is `false`.
4. Remove the `PLACEHOLDER:` prefix from `title` and from every other text field (`summary`, `detail`, `steps`, `bonusObjectives`, `missables`, `category`, `role`, `where`).
5. Set `lastUpdated` on that file to the day you edited it (`YYYY-MM-DD`).
6. Leave `generic` as `false` for game facts. `generic: true` is only for controller advice that is not about GTA VI, and its `source` must say that it is generic. Generic entries use `chapterOrder: null` so they are never covered by the spoiler switch.

## Spoilers

`chapterOrder` is a positive integer matching `order` on a chapter in `data/story.json`. The tracker covers anything with a higher chapter than the furthest chapter the player has ticked. Before the first tick, only chapter 1 is open.

Money and gear use editorial stages. The validator requires:

| `stage` | `chapterOrder` |
| --- | --- |
| `early` | 1 |
| `mid` | 3 |
| `late` | 5 |

Change those numbers in `scripts/schema.js` (`STAGE_CHAPTER`) and in the data together if a verified guide needs a different split. Do not treat the stage names as official chapter titles.

## Cars

`data/cars.json` is the secret-car list. Do not invent a car, an area, or a map coordinate. `mapX` and `mapY` are percentages from the top-left of `map.image`. Every car needs `precision`: `exact` (right block, about 1-2% of the map width), `street` (street level), or `area` (general area only). `chapterOrder` is `null` when the car is available from the start, or a story chapter `order` when naming it would spoil a later chapter. Steps can be long, including where two guides disagree. A car picture lives under `images/cars/`. Set `image`, `imageCredit`, `imageAlt`, and `imageSource` together, or leave all four `null`. `imageSource` is the URL the picture came from. `imageVerified` is `true` only when that picture is cleared to show; otherwise it is `false` and the card adds an Unverified image note. The file named by `image` must exist. Add every new picture, including the map, to `sw.js` and bump `CACHE`. Swap a picture by replacing the file and those fields. The card already tells the player the pin is only approximate.

## Add or remove rows

- Keep `id` values kebab-case and unique across every data file. Old ids stay ticked in saved progress, so do not recycle an id for a different row.
- Story chapters need a unique `order`. Missions need a unique `order` inside their chapter.
- A collectible's `chapterOrder` must match its area. A secret's `areaId` must be an area id, or `null`.
- New files are not required. If you do add a file, register it in `scripts/schema.js` (`DATA_FILES`), `js/app.js` (`DATA_FILES`), and `sw.js` (`RELATIVE_ASSETS`), then bump `CACHE` in `sw.js`.

## Check

From the repository root:

```bash
node scripts/validate.js
npm test
```

Both should exit 0. The validator is the schema. If you add a field, update `scripts/schema.js`, the README example, and the renderer in `js/render.js` together.
