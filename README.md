# Gacha Tracker

A timeline of in-game events, banners and resets for gacha games, with live
countdowns. It is a static site with no backend. Arknights (Global server) is
the first game.

## Commands

```sh
npm install              # once
npm run dev              # local dev server
npm test                 # unit tests
npm run build            # type-check and build to dist/
npm run lint
npm run data:arknights   # refresh Arknights event data from the sources
```

On Windows PowerShell, use `npm.cmd` instead of `npm` if scripts are blocked.

## Layout

| Path | Contents |
|---|---|
| `src/types.ts` | Data model: events, reset rules, game config |
| `src/games/` | One config per game: server time offset and reset rules |
| `src/data/` | Event data per game (see below) |
| `src/lib/` | Time zone, reset and timeline layout logic |
| `src/components/` | Header, reset panel and timeline |
| `scripts/` | Data fetching and parsing |
| `.github/workflows/` | Daily data update |

Resets are stored as rules and computed in the browser. Events with their own
start and end come from the data files.

## Arknights data

`npm run data:arknights` (`scripts/fetch-arknights.ts`) combines two sources:

- **[Arknights Terra Wiki](https://arknights.wiki.gg/)**: the `Event/<year>`
  and `Headhunting/Banners/<year>` pages, read through the wiki's API. This is
  the source for all banners and most events. Event dates on the wiki have no
  times, so 08:00 to 03:59:59 server time (UTC-7) is assumed.
- **In-game announcement feed**: the list of news posts the game shows. Event
  posts give exact times, which replace the wiki's assumed ones, and add
  events the wiki has not listed yet. Banner posts are images and are
  skipped.

The feed only lists recent posts, so every post with dates is kept in
`src/data/arknights.announcements.json`.

| File | Edited by |
|---|---|
| `src/data/arknights.events.json` | The script. Do not edit by hand; changes are overwritten. |
| `src/data/arknights.announcements.json` | The script. Cache of announcement posts. |
| `src/data/arknights.overrides.json` | You. Corrections applied on every run. |

To hide an entry, add its `id` to `exclude` in the overrides file. To add or
correct one, put a full event in `events`; an event with the same `id` as a
generated one replaces it.

The script stops without writing anything when a source fails, or when it
finds far fewer events than before, which usually means a page format changed.

### Daily update

`.github/workflows/update-arknights.yml` runs the script every day at 12:30
UTC and opens a pull request when the data changes, or updates the one that
is already open. Merging the pull request brings the new data into `main`. It
can also be started by hand from the repository's Actions tab.

For the workflow to open pull requests, enable **Settings → Actions → General
→ Workflow permissions → Allow GitHub Actions to create and approve pull
requests**.

## Data and licence

Banner and event dates derived from the Arknights Terra Wiki are licensed
under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Dates
from the official announcements are facts published by the game's operator.

This is a fan-made tool, not affiliated with or endorsed by any game's
developer or publisher.
