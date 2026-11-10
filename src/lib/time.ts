export const SECOND = 1_000
export const MINUTE = 60 * SECOND
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

/**
 * The time zone the page displays in: the viewer's own, or a server's fixed
 * UTC offset.
 */
export type Zone = { kind: 'local' } | { kind: 'fixed'; offsetMinutes: number }

/**
 * Shifts an instant so that reading it with `getUTC*` gives the wall-clock
 * time at a fixed offset.
 */
function toWallClock(ms: number, offsetMinutes: number): Date {
  return new Date(ms + offsetMinutes * MINUTE)
}

/** The instant of midnight starting the day that contains `ms`. */
export function startOfDay(ms: number, zone: Zone): number {
  if (zone.kind === 'local') {
    const d = new Date(ms)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  }
  const shift = zone.offsetMinutes * MINUTE
  return Math.floor((ms + shift) / DAY) * DAY - shift
}

/** Midnight `days` calendar days after the midnight `dayStart`. */
export function addDays(dayStart: number, days: number, zone: Zone): number {
  if (zone.kind === 'local') {
    // Calendar arithmetic, because a local day is 23 or 25 hours long when
    // daylight saving time changes.
    const d = new Date(dayStart)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime()
  }
  return dayStart + days * DAY
}

/**
 * `count + 1` midnights: the edges of `count` consecutive day columns
 * starting at `firstDayStart`.
 */
export function dayBoundaries(firstDayStart: number, count: number, zone: Zone): number[] {
  return Array.from({ length: count + 1 }, (_, i) => addDays(firstDayStart, i, zone))
}

/**
 * Horizontal position of an instant on a grid of equal-width day columns.
 * Clamped to the grid's edges.
 */
export function timeToX(ms: number, boundaries: number[], dayWidth: number): number {
  const last = boundaries.length - 1
  if (ms <= boundaries[0]) return 0
  if (ms >= boundaries[last]) return last * dayWidth
  let i = Math.min(last - 1, Math.floor((ms - boundaries[0]) / DAY))
  while (i > 0 && ms < boundaries[i]) i--
  while (i < last - 1 && ms >= boundaries[i + 1]) i++
  const fraction = (ms - boundaries[i]) / (boundaries[i + 1] - boundaries[i])
  return (i + fraction) * dayWidth
}

export interface DayParts {
  year: number
  /** 0 = January. */
  month: number
  day: number
  /** 0 = Sunday. */
  weekday: number
}

export function dayParts(ms: number, zone: Zone): DayParts {
  if (zone.kind === 'local') {
    const d = new Date(ms)
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate(), weekday: d.getDay() }
  }
  const d = toWallClock(ms, zone.offsetMinutes)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
  }
}

function format(ms: number, zone: Zone, options: Intl.DateTimeFormatOptions): string {
  if (zone.kind === 'local') return new Intl.DateTimeFormat(undefined, options).format(ms)
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' }).format(
    toWallClock(ms, zone.offsetMinutes),
  )
}

/** e.g. "Tue, Nov 10, 04:00". */
export function formatDateTime(ms: number, zone: Zone): string {
  return format(ms, zone, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** e.g. "November 2026". */
export function formatMonth(ms: number, zone: Zone): string {
  return format(ms, zone, { month: 'long', year: 'numeric' })
}

/** e.g. "Tue". */
export function formatWeekday(ms: number, zone: Zone): string {
  return format(ms, zone, { weekday: 'short' })
}

/** e.g. "UTC-7", or the viewer's zone name such as "America/New_York". */
export function zoneLabel(zone: Zone): string {
  if (zone.kind === 'local') return Intl.DateTimeFormat().resolvedOptions().timeZone
  const total = Math.abs(zone.offsetMinutes)
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  const sign = zone.offsetMinutes < 0 ? '-' : '+'
  return `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`
}

/** "8d 08h 54m" for a day or more, "08h 54m 03s" under a day. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / SECOND))
  const days = Math.floor(total / 86_400)
  const hours = String(Math.floor((total % 86_400) / 3_600)).padStart(2, '0')
  const minutes = String(Math.floor((total % 3_600) / 60)).padStart(2, '0')
  const seconds = String(total % 60).padStart(2, '0')
  return days > 0 ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m ${seconds}s`
}
