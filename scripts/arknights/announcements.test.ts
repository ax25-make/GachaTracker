import { describe, expect, it } from 'vitest'
import {
  cleanTitle,
  firstSection,
  htmlToText,
  nearestYear,
  parseRanges,
  publishedAt,
  toAnnouncement,
} from './announcements.ts'

const NOV_2026 = Date.UTC(2026, 10, 2)

describe('htmlToText', () => {
  it('drops tags and scripts and decodes entities', () => {
    expect(
      htmlToText('<p>A&nbsp;&amp;&#32;B</p><script>var x = "<b>"</script><br/>C &#x2013; D &ndash; E'),
    ).toBe('A & B C – D – E')
  })
})

describe('parseRanges', () => {
  it('reads a range without years, using the publication date', () => {
    expect(parseRanges('November 5, 08:00 - November 19, 03:59 (UTC-7)', NOV_2026)).toEqual([
      { start: '2026-11-05T08:00:00-07:00', end: '2026-11-19T03:59:59-07:00' },
    ])
  })

  it('reads "from … to …" with the year only on the end', () => {
    const text = 'During the period from October 14, 08:00 to October 28, 2026, 03:59 (UTC-7), the unlock'
    expect(parseRanges(text, NOV_2026)).toEqual([
      { start: '2026-10-14T08:00:00-07:00', end: '2026-10-28T03:59:59-07:00' },
    ])
  })

  it('reads en dashes and full years on both ends', () => {
    expect(parseRanges('August 20, 2026, 09:00 – October 1, 2026, 03:59 (UTC-7)', NOV_2026)).toEqual([
      { start: '2026-08-20T09:00:00-07:00', end: '2026-10-01T03:59:59-07:00' },
    ])
  })

  it('carries a range across the new year', () => {
    expect(parseRanges('December 24, 08:00 - January 7, 03:59 (UTC-7)', Date.UTC(2026, 11, 20))).toEqual([
      { start: '2026-12-24T08:00:00-07:00', end: '2027-01-07T03:59:59-07:00' },
    ])
    expect(parseRanges('December 24, 08:00 - January 7, 2027, 03:59 (UTC-7)', NOV_2026)[0].start).toBe(
      '2026-12-24T08:00:00-07:00',
    )
  })

  it('keeps every distinct range in order and ignores single times', () => {
    const text = `OPEN TIME: October 28, 08:00 (UTC-7)
      October 28, 2026, 08:00 - November 11, 2026, 03:59 (UTC-7)
      October 28, 2026, 08:00 - November 25, 2026, 03:59 (UTC-7)
      October 28, 2026, 08:00 - November 25, 2026, 03:59 (UTC-7)`
    expect(parseRanges(text, NOV_2026).map((r) => r.end)).toEqual([
      '2026-11-11T03:59:59-07:00',
      '2026-11-25T03:59:59-07:00',
    ])
  })

  it('uses the offset written in the text', () => {
    expect(parseRanges('November 5, 12:00 - November 19, 03:59 (UTC+8)', NOV_2026)[0].start).toBe(
      '2026-11-05T12:00:00+08:00',
    )
  })
})

describe('nearestYear and publishedAt', () => {
  it('picks the year closest to the reference', () => {
    expect(nearestYear(12, 30, Date.UTC(2027, 0, 3))).toBe(2026)
    expect(nearestYear(1, 3, Date.UTC(2026, 11, 30))).toBe(2027)
  })

  it('never dates a post in the future', () => {
    expect(new Date(publishedAt({ month: 12, day: 30 }, Date.UTC(2027, 0, 3))).getUTCFullYear()).toBe(2026)
    expect(new Date(publishedAt({ month: 11, day: 6 }, Date.UTC(2026, 10, 10))).toISOString()).toBe(
      '2026-11-06T00:00:00.000Z',
    )
  })
})

describe('cleanTitle', () => {
  it('drops status words and line breaks', () => {
    expect(cleanTitle('Critical Phase Transition Open')).toBe('Critical Phase Transition')
    expect(cleanTitle('New Outfits Limited Time')).toBe('New Outfits')
    expect(cleanTitle("The Masses' Travels Rerun")).toBe("The Masses' Travels Rerun")
    expect(cleanTitle('Displayed Operators\nRate Up !!!')).toBe('Displayed Operators Rate Up')
  })
})

describe('toAnnouncement', () => {
  const item = {
    announceId: '1656',
    title: "The Masses' Travels Rerun",
    isWebUrl: true,
    webUrl: 'https://example.com/announcement/1656.html?t=1794106740',
    day: 2,
    month: 11,
    group: 'ACTIVITY',
  }

  it('builds a cache entry with the query string removed', () => {
    const html = '<div>November 5, 08:00 - November 19, 03:59 (UTC-7)</div>'
    const range = { start: '2026-11-05T08:00:00-07:00', end: '2026-11-19T03:59:59-07:00' }
    expect(toAnnouncement(item, html, NOV_2026 + 7 * 86_400_000)).toEqual({
      id: '1656',
      title: "The Masses' Travels Rerun",
      url: 'https://example.com/announcement/1656.html',
      main: range,
      ranges: [range],
    })
  })

  it('takes the main range from the first section only', () => {
    // Shape of a real bundled post: a mode update with no duration, then a banner and packs.
    const html = `<p><strong>01 RECLAMATION ALGORITHM [RELAUNCH ANCHOR] OPEN</strong><br/>
      <strong>UPDATE TIME: </strong>October 28, 08:00 (UTC-7)</p>
      <p><strong>02 LIMITED-TIME HEADHUNTING OPEN</strong><br/>
      <strong>DURATION:</strong> October 28, 2026, 08:00 - November 11, 2026, 03:59 (UTC-7)</p>
      <p><strong>03 LIMITED-TIME PACKS AVAILABLE</strong><br/>
      October 28, 2026, 08:00 - November 25, 2026, 03:59 (UTC-7)</p>`
    const announcement = toAnnouncement(item, html, NOV_2026)
    expect(announcement?.main).toBeNull()
    expect(announcement?.ranges).toHaveLength(2)
  })

  it('returns null for image-only posts', () => {
    expect(toAnnouncement(item, '<div>Announcement</div><img src="x.jpg">', NOV_2026)).toBeNull()
  })
})

describe('firstSection', () => {
  it('cuts at the second numbered heading', () => {
    const html = '<p>intro</p><strong>01 FIRST</strong> a <strong>DURATION:</strong> b <strong>02 SECOND</strong> c'
    expect(firstSection(html)).toBe('<strong>01 FIRST</strong> a <strong>DURATION:</strong> b ')
  })

  it('returns the whole page when there are no numbered sections', () => {
    expect(firstSection('<p>just text</p>')).toBe('<p>just text</p>')
    expect(firstSection('<strong>01 ONLY</strong> text')).toBe('<strong>01 ONLY</strong> text')
  })
})
