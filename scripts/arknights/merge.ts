import type { TrackerEvent } from '../../src/types.ts'
import type { Announcement } from './announcements.ts'
import { overlaps, shortWallTime, type DateRange } from './dates.ts'

/** Hand-edited corrections, applied after the sources are merged. */
export interface Overrides {
  /** Ids of events to drop, e.g. an announcement that is not worth tracking. */
  exclude: string[]
  /** Events to add, or to replace the generated event with the same id. */
  events: TrackerEvent[]
}

function words(text: string): string[] {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

/**
 * Whether two titles name the same event, e.g. "The Masses' Travels Rerun"
 * and "The Masses' Travels - Rerun". True when one contains the other, or
 * when most of their words are shared.
 */
export function titlesMatch(a: string, b: string): boolean {
  const wa = words(a)
  const wb = words(b)
  const ca = wa.join('')
  const cb = wb.join('')
  if (ca.length >= 4 && cb.length >= 4 && (ca.includes(cb) || cb.includes(ca))) return true
  const sa = new Set(wa)
  const sb = new Set(wb)
  const shared = [...sa].filter((w) => sb.has(w)).length
  const union = new Set([...sa, ...sb]).size
  return union > 0 && shared / union >= 0.6
}

function distance(a: DateRange, b: DateRange): number {
  return Math.abs(Date.parse(a.start) - Date.parse(b.start)) + Math.abs(Date.parse(a.end) - Date.parse(b.end))
}

/**
 * Combines wiki events with announcements. An announcement that matches a
 * wiki event by title and dates gives that event its exact times, using the
 * announcement's range closest to the wiki's dates. Announcements with no
 * match become events of their own, using their main range, unless they
 * have none.
 */
export function mergeSources(wikiEvents: TrackerEvent[], announcements: Announcement[]): TrackerEvent[] {
  const events = wikiEvents.map((e) => ({ ...e }))
  const claimed = new Set<string>()
  const ordered = [...announcements].sort((a, b) => Number(a.id) - Number(b.id))

  for (const ann of ordered) {
    const match = events.find(
      (e) =>
        e.category === 'event' &&
        e.source === 'auto' &&
        !claimed.has(e.id) &&
        titlesMatch(e.title, ann.title) &&
        ann.ranges.some((r) => overlaps(r, e)),
    )
    if (match) {
      claimed.add(match.id)
      const best = ann.ranges.reduce((a, b) => (distance(b, match) < distance(a, match) ? b : a))
      match.start = best.start
      match.end = best.end
      continue
    }
    const alreadyCovered = events.some(
      (e) => e.category === 'event' && titlesMatch(e.title, ann.title) && ann.ranges.some((r) => overlaps(r, e)),
    )
    if (alreadyCovered || !ann.main) continue
    events.push({
      id: `arknights-ann-${ann.id}`,
      game: 'arknights',
      title: ann.title,
      category: 'event',
      start: ann.main.start,
      end: ann.main.end,
      url: ann.url,
      source: 'auto',
    })
  }
  return events
}

export function applyOverrides(events: TrackerEvent[], overrides: Overrides): TrackerEvent[] {
  const excluded = new Set(overrides.exclude)
  const byId = new Map(events.filter((e) => !excluded.has(e.id)).map((e) => [e.id, e]))
  for (const event of overrides.events) byId.set(event.id, { ...event, source: 'manual' })
  return [...byId.values()]
}

/**
 * Drops events that ended before `cutoffMs`, makes ids unique (a repeated
 * id gets its start date appended) and sorts by start time.
 */
export function finalize(events: TrackerEvent[], cutoffMs: number): TrackerEvent[] {
  const kept = events
    .filter((e) => Date.parse(e.end) >= cutoffMs)
    .sort(
      (a, b) =>
        Date.parse(a.start) - Date.parse(b.start) ||
        a.category.localeCompare(b.category) ||
        a.title.localeCompare(b.title),
    )
  const seen = new Set<string>()
  return kept.map((e) => {
    let id = e.id
    if (seen.has(id)) id = `${id}-${e.start.slice(0, 10).replace(/-/g, '')}`
    for (let n = 2; seen.has(id); n++) id = `${e.id}-${n}`
    seen.add(id)
    return id === e.id ? e : { ...e, id }
  })
}

export interface ChangeReport {
  added: TrackerEvent[]
  removed: TrackerEvent[]
  changed: { before: TrackerEvent; after: TrackerEvent }[]
}

export function compareEvents(before: TrackerEvent[], after: TrackerEvent[]): ChangeReport {
  const old = new Map(before.map((e) => [e.id, e]))
  const next = new Map(after.map((e) => [e.id, e]))
  return {
    added: after.filter((e) => !old.has(e.id)),
    removed: before.filter((e) => !next.has(e.id)),
    changed: after
      .filter((e) => old.has(e.id) && JSON.stringify(old.get(e.id)) !== JSON.stringify(e))
      .map((e) => ({ before: old.get(e.id)!, after: e })),
  }
}

function describe(e: TrackerEvent): string {
  return `**${e.title}** (${e.category}) ${shortWallTime(e.start)} → ${shortWallTime(e.end)} \`${e.id}\``
}

/** A Markdown summary for the pull request body. */
export function formatReport(report: ChangeReport, warnings: string[]): string {
  const lines: string[] = []
  const section = (title: string, items: string[]) => {
    if (items.length === 0) return
    lines.push(`### ${title}`, '', ...items.map((i) => `- ${i}`), '')
  }
  section('Added', report.added.map(describe))
  section(
    'Changed',
    report.changed.map(({ before, after }) => {
      const diffs = (['title', 'start', 'end', 'url'] as const)
        .filter((k) => before[k] !== after[k])
        .map((k) => `${k}: ${before[k] ?? '—'} → ${after[k] ?? '—'}`)
      return `${describe(after)}<br>${diffs.join('<br>')}`
    }),
  )
  section('Removed', report.removed.map(describe))
  section('Warnings', warnings)
  return lines.length > 0 ? lines.join('\n') : 'No changes.\n'
}
