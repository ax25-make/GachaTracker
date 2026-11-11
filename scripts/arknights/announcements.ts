import { impliedSeconds, isValidDate, isoAtOffset, type DateRange } from './dates.ts'

/** One post from the in-game announcement feed, as kept in the cache file. */
export interface Announcement {
  id: string
  title: string
  url: string
  /**
   * The post's own duration: the first range in its first section. Null
   * when that section has none, e.g. a game-mode update whose later
   * sections only list banners and packs.
   */
  main: DateRange | null
  /** Every date range in the post, in order, for matching wiki events. */
  ranges: DateRange[]
}

/** An entry of `announcement.meta.json`. */
export interface FeedItem {
  announceId: string
  title: string
  isWebUrl: boolean
  webUrl: string
  day: number
  month: number
  group: string
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole
    }
    return ENTITIES[code.toLowerCase()] ?? whole
  })
}

/** The visible text of an announcement page, on one line. */
export function htmlToText(html: string): string {
  return decodeEntities(html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTH = '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?'
const DATETIME = `${MONTH}\\s+(\\d{1,2}),?\\s+(?:(\\d{4}),?\\s+)?(\\d{1,2}):(\\d{2})`
/** e.g. "October 14, 08:00 to October 28, 2026, 03:59 (UTC-7)". */
const RANGE = new RegExp(
  `${DATETIME}\\s*(?:-|–|—|~|to)\\s*${DATETIME}\\s*\\(UTC\\s*([+-])\\s*(\\d{1,2})(?::?(\\d{2}))?\\)`,
  'gi',
)

const DAY_MS = 86_400_000

/** The year that puts month/day closest to `reference`. `month` is 1-based. */
export function nearestYear(month: number, day: number, reference: number): number {
  const year = new Date(reference).getUTCFullYear()
  return [year - 1, year, year + 1].reduce((best, y) =>
    Math.abs(Date.UTC(y, month - 1, day) - reference) < Math.abs(Date.UTC(best, month - 1, day) - reference) ? y : best,
  )
}

/**
 * Every date range in an announcement's text. Years are often left out, so
 * they are filled in from the other end of the range or, failing that, from
 * the date the post was published (`reference`).
 */
export function parseRanges(text: string, reference: number): DateRange[] {
  const ranges: DateRange[] = []
  for (const m of text.matchAll(RANGE)) {
    const month1 = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1
    const month2 = MONTHS.indexOf(m[6].slice(0, 3).toLowerCase()) + 1
    const [day1, day2] = [Number(m[2]), Number(m[7])]
    let year1 = m[3] ? Number(m[3]) : undefined
    let year2 = m[8] ? Number(m[8]) : undefined
    if (year2 !== undefined) year1 ??= month1 > month2 ? year2 - 1 : year2
    else if (year1 !== undefined) year2 = month2 < month1 ? year1 + 1 : year1
    else {
      year1 = nearestYear(month1, day1, reference)
      year2 = month2 < month1 ? year1 + 1 : year1
    }
    if (year1 === undefined || year2 === undefined) continue
    if (!isValidDate(year1, month1, day1) || !isValidDate(year2, month2, day2)) continue

    const offsetMinutes = (m[11] === '-' ? -1 : 1) * (Number(m[12]) * 60 + Number(m[13] ?? 0))
    const [hour1, minute1, hour2, minute2] = [m[4], m[5], m[9], m[10]].map(Number)
    if (hour1 > 23 || hour2 > 23 || minute1 > 59 || minute2 > 59) continue
    const range = {
      start: isoAtOffset(year1, month1, day1, { hour: hour1, minute: minute1, second: 0 }, offsetMinutes),
      end: isoAtOffset(year2, month2, day2, { hour: hour2, minute: minute2, second: impliedSeconds(minute2) }, offsetMinutes),
    }
    if (Date.parse(range.end) <= Date.parse(range.start)) continue
    if (!ranges.some((r) => r.start === range.start && r.end === range.end)) ranges.push(range)
  }
  return ranges
}

/** Publication time of a feed item, which gives only month and day. */
export function publishedAt(item: Pick<FeedItem, 'month' | 'day'>, now: number): number {
  // A post is never from the future, so measure from a day before now.
  return Date.UTC(nearestYear(item.month, item.day, now - DAY_MS), item.month - 1, item.day)
}

/** "Critical Phase Transition Open" → "Critical Phase Transition". */
export function cleanTitle(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/[\s!]+$/, '')
    .replace(/\s+(?:now open|open|opens|available|limited time|begins|starts)$/i, '')
    .trim()
}

/**
 * The HTML of a post's first section. Posts bundle several items, each
 * under a bold numbered heading ("01 SIDESTORY: …", "02 …"); the first is
 * the item the post is named after. Posts without headings are one section.
 */
export function firstSection(html: string): string {
  const headings = [...html.matchAll(/<strong>\s*\d{1,2}\s+[^<]/gi)]
  if (headings.length < 2) return html
  return html.slice(headings[0].index, headings[1].index)
}

/** The cache entry for a feed item, or null when its page has no date ranges (such as image-only banner posts). */
export function toAnnouncement(item: FeedItem, html: string, now: number): Announcement | null {
  const published = publishedAt(item, now)
  const ranges = parseRanges(htmlToText(html), published)
  if (ranges.length === 0) return null
  return {
    id: item.announceId,
    title: cleanTitle(item.title),
    url: item.webUrl.split('?')[0],
    main: parseRanges(htmlToText(firstSection(html)), published)[0] ?? null,
    ranges,
  }
}
