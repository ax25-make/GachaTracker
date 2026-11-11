import type { TrackerEvent } from '../../src/types.ts'
import { impliedSeconds, isValidDate, isoAtOffset, type DateRange, type WallTime } from './dates.ts'
import { findTemplates, stripComments } from './wikitext.ts'

export const WIKI_BASE = 'https://arknights.wiki.gg/wiki/'

/** Events start at 08:00 server time unless the source says otherwise. */
const DEFAULT_START: WallTime = { hour: 8, minute: 0, second: 0 }
/** Standard and kernel banners rotate at the 04:00 daily reset. */
const RESET_START: WallTime = { hour: 4, minute: 0, second: 0 }
/** Everything ends just before the 04:00 reset on its last day. */
const DEFAULT_END: WallTime = { hour: 3, minute: 59, second: 59 }

/** Titles for banner types the wiki lists by number rather than by name. */
const NUMBERED_BANNERS: Record<string, string> = {
  standard: 'Standard Pool',
  kernel: 'Kernel Headhunting',
  'kernel locating': 'Kernel Locating',
  'kernel linkup': 'Kernel Linkup',
  jo: 'Joint Operation',
  tftw: 'The Front That Was',
  orient: 'Orienteering',
}
const RESET_START_BANNERS = new Set(['standard', 'kernel'])

export interface ParsedDate {
  year: number
  month: number
  day: number
  time: WallTime | null
}

/** Parses "2026/10/14", "2026/10/14 08:00" or "2026/10/14 08:00:00". */
export function parseWikiDate(value: string): ParsedDate | null {
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(value.trim())
  if (!m) return null
  const [year, month, day] = [m[1], m[2], m[3]].map(Number)
  if (!isValidDate(year, month, day)) return null
  if (m[4] === undefined) return { year, month, day, time: null }
  const hour = Number(m[4])
  const minute = Number(m[5])
  const second = m[6] === undefined ? impliedSeconds(minute) : Number(m[6])
  if (hour > 23 || minute > 59 || second > 59) return null
  return { year, month, day, time: { hour, minute, second } }
}

function toIso(date: ParsedDate, fallback: WallTime, offsetMinutes: number): string {
  return isoAtOffset(date.year, date.month, date.day, date.time ?? fallback, offsetMinutes)
}

export type RangeResult = { kind: 'ok'; range: DateRange } | { kind: 'none' } | { kind: 'invalid'; raw: string }

/**
 * The Global date range of a cell. The wiki's templates check `start`/`end`
 * (all servers) first, then `cnglobalstart`/`cnglobalend`, then
 * `globalstart`/`globalend`; this follows the same order.
 */
export function cellRange(
  fields: Record<string, string>,
  defaultStart: WallTime,
  offsetMinutes: number,
): RangeResult {
  const pair = (['', 'cnglobal', 'global'] as const)
    .map((prefix) => [fields[`${prefix}start`], fields[`${prefix}end`]] as const)
    .find(([start]) => start)
  if (!pair) return { kind: 'none' }
  const [rawStart, rawEnd = ''] = pair
  const start = parseWikiDate(rawStart)
  const end = parseWikiDate(rawEnd)
  if (!start || !end) return { kind: 'invalid', raw: `${rawStart} – ${rawEnd}` }
  const range = {
    start: toIso(start, defaultStart, offsetMinutes),
    end: toIso(end, DEFAULT_END, offsetMinutes),
  }
  if (Date.parse(range.end) <= Date.parse(range.start)) {
    return { kind: 'invalid', raw: `${rawStart} – ${rawEnd}` }
  }
  return { kind: 'ok', range }
}

export function slug(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function wikiUrl(pageTitle: string): string {
  return WIKI_BASE + encodeURIComponent(pageTitle.replace(/ /g, '_')).replace(/%2F/g, '/').replace(/%3A/g, ':')
}

export interface PageResult {
  events: TrackerEvent[]
  /** Cells that have a date the parser could not read. */
  warnings: string[]
}

/** Events from an `Event/<year>` page. Cells without Global dates are skipped. */
export function parseEventPage(wikitext: string, pageTitle: string, offsetMinutes: number): PageResult {
  const result: PageResult = { events: [], warnings: [] }
  for (const fields of findTemplates(stripComments(wikitext), 'Event list cell')) {
    const name = fields.name
    if (!name) continue
    const range = cellRange(fields, DEFAULT_START, offsetMinutes)
    if (range.kind === 'invalid') result.warnings.push(`${pageTitle}: "${name}" has unreadable dates (${range.raw})`)
    if (range.kind !== 'ok') continue
    const link = fields.link
    result.events.push({
      id: `arknights-event-${slug(name)}`,
      game: 'arknights',
      title: fields.title || name,
      category: 'event',
      ...range.range,
      url: link === 'no' ? wikiUrl(pageTitle) : wikiUrl(link || name),
      source: 'auto',
    })
  }
  return result
}

export function bannerTitle(fields: Record<string, string>): string {
  if (fields.title || fields.name) return fields.title || fields.name
  const type = (fields.type ?? '').toLowerCase()
  const label = NUMBERED_BANNERS[type] ?? 'Headhunting'
  return fields.no ? `${label} #${fields.no}` : label
}

/** Banners from a `Headhunting/Banners/<year>` page. */
export function parseBannerPage(wikitext: string, pageTitle: string, offsetMinutes: number): PageResult {
  const result: PageResult = { events: [], warnings: [] }
  for (const fields of findTemplates(stripComments(wikitext), 'Banners cell')) {
    const type = (fields.type ?? '').toLowerCase()
    const title = bannerTitle(fields)
    const range = cellRange(fields, RESET_START_BANNERS.has(type) ? RESET_START : DEFAULT_START, offsetMinutes)
    if (range.kind === 'invalid') result.warnings.push(`${pageTitle}: "${title}" has unreadable dates (${range.raw})`)
    if (range.kind !== 'ok') continue
    result.events.push({
      id: `arknights-banner-${slug(title)}`,
      game: 'arknights',
      title,
      category: 'banner',
      ...range.range,
      url: wikiUrl(pageTitle),
      source: 'auto',
    })
  }
  return result
}
