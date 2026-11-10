import type { ResetRule } from '../types.ts'
import { DAY, MINUTE } from './time.ts'

/**
 * The first instant strictly after `now` at which `rule` fires, for a server
 * at a fixed UTC offset.
 */
export function nextOccurrence(rule: ResetRule, utcOffsetMinutes: number, now: number): number {
  const shift = utcOffsetMinutes * MINUTE
  // Work in server wall-clock time: `wall` read through getUTC* is what a
  // clock on the server shows.
  const wall = now + shift
  const d = new Date(wall)
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth()
  const day = d.getUTCDate()
  const at = (y: number, m: number, dd: number) => Date.UTC(y, m, dd, rule.hour, rule.minute)

  let candidate: number
  switch (rule.frequency) {
    case 'daily': {
      candidate = at(year, month, day)
      if (candidate <= wall) candidate += DAY
      break
    }
    case 'weekly': {
      const today = ((d.getUTCDay() + 6) % 7) + 1 // ISO weekday, Monday = 1
      const daysAhead = ((rule.weekday ?? 1) - today + 7) % 7
      candidate = at(year, month, day + daysAhead)
      if (candidate <= wall) candidate += 7 * DAY
      break
    }
    case 'monthly': {
      const dayOfMonth = rule.dayOfMonth ?? 1
      candidate = at(year, month, dayOfMonth)
      if (candidate <= wall) candidate = at(year, month + 1, dayOfMonth)
      break
    }
  }
  return candidate - shift
}
