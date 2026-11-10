# Gacha Tracker

A timeline of in-game events, banners and resets for gacha games, with live
countdowns. It is a static site with no backend. Arknights (Global server) is
the first game.

## Commands

```sh
npm install     # once
npm run dev     # local dev server
npm test        # unit tests for the date and layout logic
npm run build   # type-check and build to dist/
npm run lint
```

## Layout

| Path | Contents |
|---|---|
| `src/types.ts` | Data model: events, reset rules, game config |
| `src/games/` | One config per game: server time offset and reset rules |
| `src/data/` | One event file per game (`<game>.events.json`) |
| `src/lib/time.ts` | Time zone, day-grid and formatting helpers |
| `src/lib/resets.ts` | Next occurrence of a reset rule |
| `src/lib/layout.ts` | Stacks overlapping events onto lanes |
| `src/components/` | Header, reset panel and timeline |

Resets are stored as rules and computed in the browser. Events with their own
start and end live in the JSON files, which are edited by hand for now.

## Data and licence

Event and banner dates in `src/data/arknights.events.json` come from the
[Arknights Terra Wiki](https://arknights.wiki.gg/) and are licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

This is a fan-made tool, not affiliated with or endorsed by any game's
developer or publisher.
