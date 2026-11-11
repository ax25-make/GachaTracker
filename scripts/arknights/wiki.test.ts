import { describe, expect, it } from 'vitest'
import { bannerTitle, parseBannerPage, parseEventPage, parseWikiDate, wikiUrl } from './wiki.ts'
import { findTemplates } from './wikitext.ts'

const UTC_MINUS_7 = -7 * 60

describe('findTemplates', () => {
  it('reads named fields and ignores pipes inside links and nested templates', () => {
    const text = `{{Event list cell
|name = A [[Some Page|Linked]] Name
|cnspec = as {{Color|code=FF0000|red}} event
|globalstart = 2026/10/14}}`
    expect(findTemplates(text, 'Event list cell')).toEqual([
      { name: 'A Linked Name', cnspec: 'as {{Color|code=FF0000|red}} event', globalstart: '2026/10/14' },
    ])
  })

  it('matches names with underscores and ignores similarly named templates', () => {
    const text = '{{Event_list_cell|name=A}}{{Event list cells|name=B}}{{Event list head}}'
    expect(findTemplates(text, 'Event list cell').map((f) => f.name)).toEqual(['A'])
  })
})

describe('parseWikiDate', () => {
  it('reads the three formats the wiki uses', () => {
    expect(parseWikiDate('2026/10/14')).toEqual({ year: 2026, month: 10, day: 14, time: null })
    expect(parseWikiDate('2025/11/27 08:00')?.time).toEqual({ hour: 8, minute: 0, second: 0 })
    expect(parseWikiDate('2026/10/28 03:59:59')?.time).toEqual({ hour: 3, minute: 59, second: 59 })
  })

  it('treats a minute-precision end time as the end of that minute', () => {
    expect(parseWikiDate('2026/10/28 03:59')?.time).toEqual({ hour: 3, minute: 59, second: 59 })
  })

  it('rejects impossible or unknown dates', () => {
    expect(parseWikiDate('2026/02/30')).toBeNull()
    expect(parseWikiDate('TBA')).toBeNull()
    expect(parseWikiDate('')).toBeNull()
  })
})

describe('parseEventPage', () => {
  const page = `{{Event list head}}
{{Event list cell
|type = celebration
|name = Critical Phase Transition
|cnstart = 2026/05/01
|cnend = 2026/05/15
|globalstart = 2026/10/14
|globalend = 2026/10/28}}
{{Event list cell
|name = Duel Channel Ivy Vine
|title = Duel Channel: Ivy Vine
|globalstart = 2026/09/23
|globalend = 2026/10/07}}
{{Event list cell
|name = Act or Die Rerun
|link = Act or Die/Rerun
|start = 2026/07/20 04:00
|end = 2026/07/30}}
{{Event list cell
|name = CN Only
|cnstart = 2026/06/08
|cnend = 2026/06/22<!--
|globalstart = 2027/01/16
|globalend = 2027/02/07-->}}
{{Event list cell
|name = Broken
|globalstart = 2026/13/01
|globalend = 2026/13/10}}`

  const result = parseEventPage(page, 'Event/2026', UTC_MINUS_7)

  it('fills in 08:00 and 03:59:59 server time for date-only entries', () => {
    expect(result.events[0]).toEqual({
      id: 'arknights-event-critical-phase-transition',
      game: 'arknights',
      title: 'Critical Phase Transition',
      category: 'event',
      start: '2026-10-14T08:00:00-07:00',
      end: '2026-10-28T03:59:59-07:00',
      url: 'https://arknights.wiki.gg/wiki/Critical_Phase_Transition',
      source: 'auto',
    })
  })

  it('uses the display title and the link field', () => {
    expect(result.events[1].title).toBe('Duel Channel: Ivy Vine')
    expect(result.events[2].url).toBe('https://arknights.wiki.gg/wiki/Act_or_Die/Rerun')
  })

  it('prefers the all-server start/end fields and keeps their times', () => {
    expect(result.events[2].start).toBe('2026-07-20T04:00:00-07:00')
  })

  it('skips entries without Global dates, including dates hidden in comments', () => {
    expect(result.events.map((e) => e.title)).not.toContain('CN Only')
  })

  it('reports unreadable dates instead of guessing', () => {
    expect(result.events).toHaveLength(3)
    expect(result.warnings).toEqual(['Event/2026: "Broken" has unreadable dates (2026/13/01 – 2026/13/10)'])
  })
})

describe('parseBannerPage', () => {
  const page = `{{Banners cell
|type = celebration
|name = Sealed With Time
|globalstart = 2026/10/14 08:00:00
|globalend = 2026/10/28 03:59:59
|operators = Closure, Crackborne}}
{{Banners cell
|type = standard
|no = 156
|start = 2025/12/19
|end = 2026/01/02}}
{{Banners cell
|type = kernel locating
|no = 13
|start = 2026/10/20 08:00:00
|end = 2026/11/03 03:59:59}}`

  const { events } = parseBannerPage(page, 'Headhunting/Banners/2026', UTC_MINUS_7)

  it('reads named banners with full times', () => {
    expect(events[0]).toMatchObject({
      id: 'arknights-banner-sealed-with-time',
      title: 'Sealed With Time',
      category: 'banner',
      start: '2026-10-14T08:00:00-07:00',
      end: '2026-10-28T03:59:59-07:00',
      url: 'https://arknights.wiki.gg/wiki/Headhunting/Banners/2026',
    })
  })

  it('names numbered banners and starts standard ones at the 04:00 reset', () => {
    expect(events[1]).toMatchObject({
      title: 'Standard Pool #156',
      start: '2025-12-19T04:00:00-07:00',
      end: '2026-01-02T03:59:59-07:00',
    })
    expect(events[2].title).toBe('Kernel Locating #13')
  })
})

describe('bannerTitle', () => {
  it('falls back to a generic label', () => {
    expect(bannerTitle({ type: 'orient', no: '7' })).toBe('Orienteering #7')
    expect(bannerTitle({ type: 'something new' })).toBe('Headhunting')
  })
})

describe('wikiUrl', () => {
  it('keeps slashes and colons readable and escapes the rest', () => {
    expect(wikiUrl("Duel Channel: Ivy Vine")).toBe('https://arknights.wiki.gg/wiki/Duel_Channel:_Ivy_Vine')
    expect(wikiUrl('What? #1')).toBe('https://arknights.wiki.gg/wiki/What%3F_%231')
  })
})
