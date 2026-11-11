export interface WallTime {
  hour: number
  minute: number
  second: number
}

export interface DateRange {
  /** ISO 8601 with a UTC offset, e.g. "2026-11-05T08:00:00-07:00". */
  start: string
  end: string
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

/** Whether the calendar date exists, e.g. false for 2026/02/30. */
export function isValidDate(year: number, month: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
}

/** ISO 8601 for a wall-clock time at a fixed UTC offset. `month` is 1-based. */
export function isoAtOffset(
  year: number,
  month: number,
  day: number,
  time: WallTime,
  offsetMinutes: number,
): string {
  const sign = offsetMinutes < 0 ? '-' : '+'
  const abs = Math.abs(offsetMinutes)
  return (
    `${pad(year, 4)}-${pad(month)}-${pad(day)}` +
    `T${pad(time.hour)}:${pad(time.minute)}:${pad(time.second)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  )
}

/**
 * Seconds for a time written without them. Sources write end times as
 * "03:59", meaning the last second of that minute.
 */
export function impliedSeconds(minute: number): number {
  return minute === 59 ? 59 : 0
}

/** Whether two ranges share any instant. */
export function overlaps(a: DateRange, b: DateRange): boolean {
  return Date.parse(a.start) < Date.parse(b.end) && Date.parse(b.start) < Date.parse(a.end)
}

/** "2026-11-05 08:00" from an ISO string, keeping its own wall-clock time. */
export function shortWallTime(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ')
}
