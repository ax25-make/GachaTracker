export type EventCategory = 'event' | 'banner' | 'custom'

/** An event with its own start and end, such as a banner or a limited event. */
export interface TrackerEvent {
  id: string
  /** Matches `GameConfig.id`. */
  game: string
  title: string
  category: EventCategory
  /** ISO 8601 with a UTC offset, e.g. "2026-10-14T08:00:00-07:00". */
  start: string
  end: string
  /** Page to open when the bar is clicked. */
  url?: string
  /** "auto" events come from a data file, "manual" ones from the user. */
  source: 'auto' | 'manual'
}

/**
 * A reset that repeats on a fixed schedule in server time. Only the rule is
 * stored; occurrences are computed when needed.
 */
export interface ResetRule {
  id: string
  title: string
  frequency: 'daily' | 'weekly' | 'monthly'
  /** Server wall-clock time of the reset. */
  hour: number
  minute: number
  /** Weekly rules only: ISO weekday, 1 = Monday … 7 = Sunday. */
  weekday?: number
  /** Monthly rules only: 1–28, so the day exists in every month. */
  dayOfMonth?: number
}

export interface GameConfig {
  id: string
  name: string
  /** Shown next to the game name, e.g. "Global". */
  server: string
  /**
   * Server time as a fixed offset from UTC, in minutes. Gacha servers
   * generally do not observe daylight saving time.
   */
  utcOffsetMinutes: number
  resets: ResetRule[]
}

/** Shape of the per-game files in `src/data`. */
export interface EventDataFile {
  game: string
  /** Date the data was last pulled from its source, as YYYY-MM-DD. */
  updated: string
  attribution: {
    name: string
    url: string
    license: string
    licenseUrl: string
  }
  events: TrackerEvent[]
}
