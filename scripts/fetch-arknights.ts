/**
 * Refreshes src/data/arknights.events.json from the Arknights Terra Wiki and
 * the in-game announcement feed. Run with `npm run data:arknights`.
 *
 * Exits with an error, without writing anything, when a source fails or
 * returns much less data than before, so a format change on either site
 * shows up as a failed run instead of silently deleting events.
 */
import { appendFile, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { arknights } from '../src/games/arknights.ts'
import type { EventDataFile, TrackerEvent } from '../src/types.ts'
import { toAnnouncement, type Announcement, type FeedItem } from './arknights/announcements.ts'
import { applyOverrides, compareEvents, finalize, formatReport, mergeSources, type Overrides } from './arknights/merge.ts'
import { parseBannerPage, parseEventPage } from './arknights/wiki.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const EVENTS_FILE = path.join(ROOT, 'src/data/arknights.events.json')
const ANNOUNCEMENTS_FILE = path.join(ROOT, 'src/data/arknights.announcements.json')
const OVERRIDES_FILE = path.join(ROOT, 'src/data/arknights.overrides.json')

const WIKI_API = 'https://arknights.wiki.gg/api.php'
const FEED = 'https://ark-us-static-online.yo-star.com/announce/Android/announcement.meta.json'
const USER_AGENT = 'GachaTracker/0.1 (+https://github.com/ax25-make/GachaTracker)'
/** Pause between requests, to stay well below anything a person could do. */
const REQUEST_GAP_MS = 1000
/** Events stay in the file until the year after they end, plus this margin. */
const KEEP_AFTER_END_MS = 60 * 86_400_000
/** Fail when the new data has fewer than this share of the old auto events. */
const MIN_KEPT_SHARE = 0.7

let lastRequest = 0
async function get(url: string): Promise<string> {
  const wait = lastRequest + REQUEST_GAP_MS - Date.now()
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  lastRequest = Date.now()
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`)
  return res.text()
}

/** The wikitext of a page, or null if the page does not exist. */
async function wikiPage(title: string): Promise<string | null> {
  const url = `${WIKI_API}?action=parse&format=json&formatversion=2&prop=wikitext&page=${encodeURIComponent(title)}`
  const body = JSON.parse(await get(url))
  if (body.error?.code === 'missingtitle') return null
  if (body.error) throw new Error(`Wiki API error for "${title}": ${body.error.code} ${body.error.info}`)
  return body.parse.wikitext as string
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback
    throw error
  }
}

const toJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

async function main() {
  const now = Date.now()
  const offset = arknights.utcOffsetMinutes
  const firstYear = new Date(now - KEEP_AFTER_END_MS).getUTCFullYear()
  const cutoff = Date.UTC(firstYear, 0, 1)
  const lastYear = new Date(now).getUTCFullYear() + 1
  const warnings: string[] = []

  // Wiki: one events page and one banners page per year.
  const wikiEvents: TrackerEvent[] = []
  let eventCount = 0
  let bannerCount = 0
  for (let year = firstYear; year <= lastYear; year++) {
    for (const [title, parse] of [
      [`Event/${year}`, parseEventPage],
      [`Headhunting/Banners/${year}`, parseBannerPage],
    ] as const) {
      const text = await wikiPage(title)
      if (text === null) continue
      const result = parse(text, title, offset)
      wikiEvents.push(...result.events)
      warnings.push(...result.warnings)
      if (parse === parseEventPage) eventCount += result.events.length
      else bannerCount += result.events.length
      console.log(`wiki  ${title}: ${result.events.length}`)
    }
  }
  if (eventCount === 0 || bannerCount === 0) {
    throw new Error(`Wiki returned ${eventCount} events and ${bannerCount} banners; the page format may have changed.`)
  }

  // Announcement feed: keep every post with dates, since the feed only lists recent ones.
  const feed = JSON.parse(await get(FEED)) as { announceList: FeedItem[] }
  if (!Array.isArray(feed.announceList)) throw new Error('Announcement feed has no announceList; its format may have changed.')
  const fresh: Announcement[] = []
  for (const item of feed.announceList) {
    if (item.group !== 'ACTIVITY' || !item.isWebUrl) continue
    const announcement = toAnnouncement(item, await get(item.webUrl), now)
    console.log(`feed  ${item.announceId} ${announcement ? `${announcement.ranges.length} ranges` : 'no dates'}: ${item.title.replace(/\s+/g, ' ')}`)
    if (announcement) fresh.push(announcement)
  }
  const cache = await readJson<{ announcements: Announcement[] }>(ANNOUNCEMENTS_FILE, { announcements: [] })
  const byId = new Map(cache.announcements.map((a) => [a.id, a]))
  for (const a of fresh) byId.set(a.id, a)
  const announcements = [...byId.values()]
    .filter((a) => a.ranges.some((r) => Date.parse(r.end) >= cutoff))
    .sort((a, b) => Number(b.id) - Number(a.id))

  // Merge, apply corrections, compare with the current file.
  const overrides = await readJson<Overrides>(OVERRIDES_FILE, { exclude: [], events: [] })
  const events = finalize(applyOverrides(mergeSources(wikiEvents, announcements), overrides), cutoff)
  const previous = await readJson<EventDataFile | null>(EVENTS_FILE, null)
  const previousEvents = previous?.events ?? []

  const previousAuto = previousEvents.filter((e) => e.source === 'auto').length
  const nextAuto = events.filter((e) => e.source === 'auto').length
  if (previousAuto >= 10 && nextAuto < previousAuto * MIN_KEPT_SHARE) {
    throw new Error(`Only ${nextAuto} events found, down from ${previousAuto}. Not writing; check the sources' formats.`)
  }

  const report = compareEvents(previousEvents, events)
  const eventsChanged = report.added.length + report.removed.length + report.changed.length > 0
  if (eventsChanged || !previous) {
    const file: EventDataFile = {
      game: arknights.id,
      updated: new Date(now).toISOString().slice(0, 10),
      sources: [
        { name: 'official in-game announcements', url: 'https://www.arknights.global/' },
        {
          name: 'Arknights Terra Wiki',
          url: 'https://arknights.wiki.gg/',
          license: 'CC BY-SA 4.0',
          licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        },
      ],
      events,
    }
    await writeFile(EVENTS_FILE, toJson(file))
  }
  const cacheText = toJson({ announcements })
  if (cacheText !== toJson({ announcements: cache.announcements })) await writeFile(ANNOUNCEMENTS_FILE, cacheText)

  const summary = formatReport(report, warnings)
  console.log(`\n${events.length} events (${report.added.length} added, ${report.changed.length} changed, ${report.removed.length} removed)\n`)
  console.log(summary)
  if (process.env.SUMMARY_FILE) await writeFile(process.env.SUMMARY_FILE, summary)
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
