import { describe, expect, it } from 'vitest'
import type { TrackerEvent } from '../../src/types.ts'
import type { Announcement } from './announcements.ts'
import { applyOverrides, compareEvents, finalize, formatReport, mergeSources, titlesMatch } from './merge.ts'

function event(id: string, title: string, start: string, end: string, extra: Partial<TrackerEvent> = {}): TrackerEvent {
  return { id, game: 'arknights', title, category: 'event', start, end, source: 'auto', ...extra }
}

const relaunch = event(
  'arknights-event-relaunch-anchor',
  'Relaunch Anchor',
  '2026-10-28T08:00:00-07:00',
  '2026-11-25T03:59:59-07:00',
)

describe('titlesMatch', () => {
  it('matches containment and shared words, ignoring punctuation and case', () => {
    expect(titlesMatch("The Masses' Travels Rerun", 'The Masses’ Travels - Rerun')).toBe(true)
    expect(titlesMatch('Critical Phase Transition', 'MAIN THEME: CRITICAL PHASE TRANSITION')).toBe(true)
    expect(titlesMatch('Duel Channel: Ivy Vine', 'Duel Channel Ivy Vine')).toBe(true)
  })

  it('does not match unrelated titles', () => {
    expect(titlesMatch('Critical Phase Transition', 'Recommended Monthly Card')).toBe(false)
    expect(titlesMatch('New Outfits', 'Rhodes Fashion Review')).toBe(false)
  })
})

describe('mergeSources', () => {
  const announcement: Announcement = {
    id: '1654',
    title: 'Reclamation Algorithm Relaunch Anchor',
    url: 'https://example.com/1654.html',
    main: { start: '2026-10-28T08:00:00-07:00', end: '2026-11-11T03:59:59-07:00' },
    ranges: [
      { start: '2026-10-28T08:00:00-07:00', end: '2026-11-11T03:59:59-07:00' },
      { start: '2026-10-28T09:00:00-07:00', end: '2026-11-25T03:59:59-07:00' },
    ],
  }

  it('gives a matched wiki event the announcement range closest to its dates', () => {
    const [merged] = mergeSources([relaunch], [announcement])
    expect(merged).toEqual({ ...relaunch, start: '2026-10-28T09:00:00-07:00' })
  })

  it('adds unmatched announcements as their own events, using the main range', () => {
    const range = { start: '2026-10-08T04:00:00-07:00', end: '2026-11-16T03:59:59-07:00' }
    const card: Announcement = {
      id: '1627',
      title: 'Recommended Monthly Card',
      url: 'https://example.com/1627.html',
      main: range,
      ranges: [{ start: '2026-10-08T04:00:00-07:00', end: '2026-10-20T03:59:59-07:00' }, range],
    }
    const events = mergeSources([relaunch], [card])
    expect(events[1]).toEqual({
      id: 'arknights-ann-1627',
      game: 'arknights',
      title: 'Recommended Monthly Card',
      category: 'event',
      start: '2026-10-08T04:00:00-07:00',
      end: '2026-11-16T03:59:59-07:00',
      url: 'https://example.com/1627.html',
      source: 'auto',
    })
  })

  it('does not match announcements whose dates do not overlap', () => {
    const range = { start: '2025-10-28T08:00:00-07:00', end: '2025-11-11T03:59:59-07:00' }
    const lastYear = { ...announcement, main: range, ranges: [range] }
    const events = mergeSources([relaunch], [lastYear])
    expect(events[0]).toEqual(relaunch)
    expect(events).toHaveLength(2)
  })

  it('skips unmatched announcements that have no main range', () => {
    const bundle = { ...announcement, title: 'Something Else', main: null }
    expect(mergeSources([relaunch], [bundle])).toEqual([relaunch])
  })

  it('drops a second announcement about an event that is already matched', () => {
    const second = { ...announcement, id: '1660', title: 'Relaunch Anchor Extreme Mode' }
    expect(mergeSources([relaunch], [announcement, second])).toHaveLength(1)
  })

  it('never matches banners', () => {
    const banner = { ...relaunch, id: 'b', category: 'banner' as const }
    expect(mergeSources([banner], [announcement])).toHaveLength(2)
  })

  it('does not modify its input', () => {
    const input = [{ ...relaunch }]
    mergeSources(input, [announcement])
    expect(input[0]).toEqual(relaunch)
  })
})

describe('applyOverrides', () => {
  it('excludes by id, replaces by id and adds new events as manual', () => {
    const a = event('a', 'A', '2026-01-01T08:00:00-07:00', '2026-01-02T03:59:59-07:00')
    const b = event('b', 'B', '2026-01-01T08:00:00-07:00', '2026-01-02T03:59:59-07:00')
    const fixedB = { ...b, title: 'B (fixed)' }
    const c = event('c', 'C', '2026-01-03T08:00:00-07:00', '2026-01-04T03:59:59-07:00')
    expect(applyOverrides([a, b], { exclude: ['a'], events: [fixedB, c] })).toEqual([
      { ...fixedB, source: 'manual' },
      { ...c, source: 'manual' },
    ])
  })
})

describe('finalize', () => {
  it('drops old events, sorts by start and makes ids unique', () => {
    const old = event('x', 'Old', '2024-01-01T08:00:00-07:00', '2024-01-10T03:59:59-07:00')
    const late = event('dup', 'Late', '2026-03-01T08:00:00-07:00', '2026-03-10T03:59:59-07:00')
    const early = event('dup', 'Early', '2026-02-01T08:00:00-07:00', '2026-02-10T03:59:59-07:00')
    const result = finalize([old, late, early], Date.UTC(2026, 0, 1))
    expect(result.map((e) => [e.id, e.title])).toEqual([
      ['dup', 'Early'],
      ['dup-20260301', 'Late'],
    ])
  })
})

describe('compareEvents and formatReport', () => {
  it('lists added, changed and removed events', () => {
    const a = event('a', 'A', '2026-01-01T08:00:00-07:00', '2026-01-02T03:59:59-07:00')
    const b = event('b', 'B', '2026-01-01T08:00:00-07:00', '2026-01-02T03:59:59-07:00')
    const c = event('c', 'C', '2026-01-01T08:00:00-07:00', '2026-01-02T03:59:59-07:00')
    const movedB = { ...b, end: '2026-01-05T03:59:59-07:00' }
    const report = compareEvents([a, b], [movedB, c])
    expect(report.added).toEqual([c])
    expect(report.removed).toEqual([a])
    expect(report.changed).toEqual([{ before: b, after: movedB }])
    const text = formatReport(report, ['a warning'])
    expect(text).toContain('### Added')
    expect(text).toContain('end: 2026-01-02T03:59:59-07:00 → 2026-01-05T03:59:59-07:00')
    expect(text).toContain('### Warnings')
  })

  it('says so when nothing changed', () => {
    expect(formatReport({ added: [], removed: [], changed: [] }, [])).toBe('No changes.\n')
  })
})
