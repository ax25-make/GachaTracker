import { describe, expect, it } from 'vitest'
import type { ResetRule } from '../types.ts'
import { nextOccurrence } from './resets.ts'

const UTC_MINUS_7 = -7 * 60
const iso = (ms: number) => new Date(ms).toISOString()
const at = (s: string) => new Date(s).getTime()

const daily: ResetRule = { id: 'd', title: 'Daily', frequency: 'daily', hour: 4, minute: 0 }
const weekly: ResetRule = { id: 'w', title: 'Weekly', frequency: 'weekly', weekday: 1, hour: 4, minute: 0 }
const monthly: ResetRule = { id: 'm', title: 'Monthly', frequency: 'monthly', dayOfMonth: 1, hour: 4, minute: 0 }

describe('nextOccurrence', () => {
  it('daily: later today when the reset has not happened yet', () => {
    // 03:00 server time on Nov 10 → 04:00 server time = 11:00 UTC.
    expect(iso(nextOccurrence(daily, UTC_MINUS_7, at('2026-11-10T10:00:00Z')))).toBe(
      '2026-11-10T11:00:00.000Z',
    )
  })

  it('daily: tomorrow when the reset has passed', () => {
    expect(iso(nextOccurrence(daily, UTC_MINUS_7, at('2026-11-10T12:00:00Z')))).toBe(
      '2026-11-11T11:00:00.000Z',
    )
  })

  it('daily: exactly at the reset moves to the next day', () => {
    expect(iso(nextOccurrence(daily, UTC_MINUS_7, at('2026-11-10T11:00:00Z')))).toBe(
      '2026-11-11T11:00:00.000Z',
    )
  })

  it('daily: uses the server date, not the UTC date', () => {
    // 02:00 UTC on Nov 11 is still 19:00 on Nov 10 at the server.
    expect(iso(nextOccurrence(daily, UTC_MINUS_7, at('2026-11-11T02:00:00Z')))).toBe(
      '2026-11-11T11:00:00.000Z',
    )
  })

  it('weekly: next Monday from midweek', () => {
    // Nov 10, 2026 is a Tuesday.
    expect(iso(nextOccurrence(weekly, UTC_MINUS_7, at('2026-11-10T12:00:00Z')))).toBe(
      '2026-11-16T11:00:00.000Z',
    )
  })

  it('weekly: same day before the reset, a week later after it', () => {
    expect(iso(nextOccurrence(weekly, UTC_MINUS_7, at('2026-11-16T10:59:00Z')))).toBe(
      '2026-11-16T11:00:00.000Z',
    )
    expect(iso(nextOccurrence(weekly, UTC_MINUS_7, at('2026-11-16T11:00:01Z')))).toBe(
      '2026-11-23T11:00:00.000Z',
    )
  })

  it('monthly: rolls over the year end', () => {
    expect(iso(nextOccurrence(monthly, UTC_MINUS_7, at('2026-12-15T00:00:00Z')))).toBe(
      '2027-01-01T11:00:00.000Z',
    )
  })

  it('handles a positive offset', () => {
    // UTC+8: 04:00 server time = 20:00 UTC the previous day.
    expect(iso(nextOccurrence(daily, 8 * 60, at('2026-11-10T12:00:00Z')))).toBe(
      '2026-11-10T20:00:00.000Z',
    )
  })
})
