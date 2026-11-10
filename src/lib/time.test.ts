import { describe, expect, it } from 'vitest'
import {
  DAY,
  HOUR,
  dayBoundaries,
  dayParts,
  formatCountdown,
  startOfDay,
  timeToX,
  zoneLabel,
  type Zone,
} from './time.ts'

const server: Zone = { kind: 'fixed', offsetMinutes: -7 * 60 }
const at = (s: string) => new Date(s).getTime()

describe('startOfDay (fixed offset)', () => {
  it('returns server midnight, which is 07:00 UTC for UTC-7', () => {
    expect(new Date(startOfDay(at('2026-11-10T20:00:00Z'), server)).toISOString()).toBe(
      '2026-11-10T07:00:00.000Z',
    )
  })

  it('uses the server date when UTC is already on the next day', () => {
    expect(new Date(startOfDay(at('2026-11-11T02:00:00Z'), server)).toISOString()).toBe(
      '2026-11-10T07:00:00.000Z',
    )
  })
})

describe('dayParts (fixed offset)', () => {
  it('reads the calendar day at the server', () => {
    expect(dayParts(at('2026-11-11T02:00:00Z'), server)).toEqual({
      year: 2026,
      month: 10,
      day: 10,
      weekday: 2,
    })
  })
})

describe('timeToX', () => {
  const first = startOfDay(at('2026-11-10T12:00:00Z'), server)
  const boundaries = dayBoundaries(first, 3, server)

  it('places midnights on column edges and noon mid-column', () => {
    expect(timeToX(first, boundaries, 40)).toBe(0)
    expect(timeToX(first + DAY, boundaries, 40)).toBe(40)
    expect(timeToX(first + DAY + 12 * HOUR, boundaries, 40)).toBe(60)
  })

  it('clamps to the grid', () => {
    expect(timeToX(first - DAY, boundaries, 40)).toBe(0)
    expect(timeToX(first + 10 * DAY, boundaries, 40)).toBe(120)
  })
})

describe('formatCountdown', () => {
  it('shows days, hours and minutes for a day or more', () => {
    expect(formatCountdown(8 * DAY + 8 * HOUR + 54 * 60_000)).toBe('8d 08h 54m')
  })

  it('shows seconds under a day', () => {
    expect(formatCountdown(5 * HOUR + 3_000)).toBe('05h 00m 03s')
  })

  it('never goes negative', () => {
    expect(formatCountdown(-5_000)).toBe('00h 00m 00s')
  })
})

describe('zoneLabel', () => {
  it('formats fixed offsets', () => {
    expect(zoneLabel(server)).toBe('UTC-7')
    expect(zoneLabel({ kind: 'fixed', offsetMinutes: 330 })).toBe('UTC+5:30')
  })
})
