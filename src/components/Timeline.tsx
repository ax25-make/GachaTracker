import { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { assignLanes } from '../lib/layout.ts'
import {
  addDays,
  dayBoundaries,
  dayParts,
  formatCountdown,
  formatDateTime,
  formatMonth,
  formatWeekday,
  startOfDay,
  timeToX,
  type Zone,
} from '../lib/time.ts'
import type { EventCategory, TrackerEvent } from '../types.ts'

const DAY_WIDTH = 44
const LANE_HEIGHT = 44
const BAR_GAP = 8

/** Row groups, in display order. A group is shown only when it has events. */
const GROUPS: { category: EventCategory; label: string }[] = [
  { category: 'event', label: 'Events' },
  { category: 'banner', label: 'Banners' },
  { category: 'custom', label: 'My events' },
]

interface Props {
  events: TrackerEvent[]
  zone: Zone
  now: number
  /** Days shown before and after today. */
  pastDays?: number
  futureDays?: number
}

export function Timeline({ events, zone, now, pastDays = 30, futureDays = 45 }: Props) {
  const today = startOfDay(now, zone)
  const boundaries = useMemo(
    () => dayBoundaries(addDays(today, -pastDays, zone), pastDays + futureDays + 1, zone),
    [today, zone, pastDays, futureDays],
  )
  const dayCount = boundaries.length - 1
  const rangeStart = boundaries[0]
  const rangeEnd = boundaries[dayCount]

  const days = useMemo(
    () => boundaries.slice(0, -1).map((ms) => ({ ms, ...dayParts(ms, zone) })),
    [boundaries, zone],
  )

  const months = useMemo(() => {
    const segments: { key: string; label: string; span: number }[] = []
    for (const day of days) {
      const key = `${day.year}-${day.month}`
      const last = segments[segments.length - 1]
      if (last?.key === key) last.span++
      else segments.push({ key, label: formatMonth(day.ms, zone), span: 1 })
    }
    return segments
  }, [days, zone])

  const groups = useMemo(() => {
    const visible = events
      .map((event) => ({ event, startMs: Date.parse(event.start), endMs: Date.parse(event.end) }))
      .filter((span) => span.endMs > rangeStart && span.startMs < rangeEnd)
    return GROUPS.map((group) => ({
      ...group,
      ...assignLanes(visible.filter((span) => span.event.category === group.category)),
    })).filter((group) => group.placed.length > 0)
  }, [events, rangeStart, rangeEnd])

  const scrollerRef = useRef<HTMLDivElement>(null)
  const scrollToNow = () => {
    const el = scrollerRef.current
    if (!el) return
    const x = timeToX(Date.now(), boundaries, DAY_WIDTH)
    el.scrollLeft = Math.max(0, x - el.clientWidth * 0.35)
  }
  // Bring "now" into view on load, and again when the grid is rebuilt (the
  // time zone was switched or the date changed).
  useEffect(scrollToNow, [boundaries])

  const nowX = timeToX(now, boundaries, DAY_WIDTH)
  const todayIndex = days.findIndex((day) => day.ms === today)

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Timeline</h2>
        <button type="button" className="button" onClick={scrollToNow}>
          Jump to now
        </button>
      </div>
      <div className="timeline" ref={scrollerRef}>
        <div
          className="tl-inner"
          style={{ width: dayCount * DAY_WIDTH, '--day-width': `${DAY_WIDTH}px` } as CSSProperties}
        >
          <div className="tl-months">
            {months.map((month) => (
              <div className="tl-month" key={month.key} style={{ width: month.span * DAY_WIDTH }}>
                <span>{month.label}</span>
              </div>
            ))}
          </div>
          <div className="tl-days">
            {days.map((day, i) => (
              <div
                key={day.ms}
                className={[
                  'tl-day',
                  i === todayIndex ? 'is-today' : '',
                  day.weekday === 0 || day.weekday === 6 ? 'is-weekend' : '',
                ].join(' ')}
              >
                <span className="tl-weekday">{formatWeekday(day.ms, zone)}</span>
                <span className="tl-daynum">{day.day}</span>
              </div>
            ))}
          </div>
          <div className="tl-body">
            {todayIndex >= 0 && (
              <div className="tl-today" style={{ left: todayIndex * DAY_WIDTH, width: DAY_WIDTH }} />
            )}
            {groups.map((group) => (
              <div className="tl-group" key={group.category}>
                <div className="tl-group-label">
                  <span>{group.label}</span>
                </div>
                <div className="tl-lanes" style={{ height: group.laneCount * LANE_HEIGHT }}>
                  {group.placed.map(({ item, lane }) => {
                    const { event, startMs, endMs } = item
                    const left = timeToX(startMs, boundaries, DAY_WIDTH)
                    const right = timeToX(endMs, boundaries, DAY_WIDTH)
                    const status = now < startMs ? 'upcoming' : now < endMs ? 'active' : 'ended'
                    const badge =
                      status === 'upcoming'
                        ? `in ${formatCountdown(startMs - now)}`
                        : status === 'active'
                          ? `${formatCountdown(endMs - now)} left`
                          : 'Ended'
                    return (
                      <a
                        key={event.id}
                        className={`tl-bar tl-bar--${event.category} is-${status}`}
                        href={event.url}
                        target="_blank"
                        rel="noreferrer"
                        title={`${event.title}\n${formatDateTime(startMs, zone)} – ${formatDateTime(endMs, zone)}`}
                        style={{
                          left,
                          width: Math.max(right - left, 4),
                          top: lane * LANE_HEIGHT + BAR_GAP / 2,
                          height: LANE_HEIGHT - BAR_GAP,
                        }}
                      >
                        <span className="tl-bar-content">
                          <span className="tl-bar-title">{event.title}</span>
                          <span className="tl-bar-badge">{badge}</span>
                        </span>
                      </a>
                    )
                  })}
                </div>
              </div>
            ))}
            {groups.length === 0 && <p className="tl-empty">No events in this range.</p>}
            <div className="tl-now" style={{ left: nowX }} />
          </div>
        </div>
      </div>
    </section>
  )
}
