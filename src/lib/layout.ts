export interface Span {
  startMs: number
  endMs: number
}

export interface Placed<T> {
  item: T
  /** Zero-based row within the group. */
  lane: number
}

/**
 * Stacks overlapping spans on separate lanes. Each span goes on the first
 * lane that is free at its start time, so the result uses as few lanes as
 * the overlaps allow.
 */
export function assignLanes<T extends Span>(items: T[]): { placed: Placed<T>[]; laneCount: number } {
  const sorted = [...items].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  const laneEnds: number[] = []
  const placed = sorted.map((item) => {
    let lane = laneEnds.findIndex((end) => end <= item.startMs)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = item.endMs
    return { item, lane }
  })
  return { placed, laneCount: laneEnds.length }
}
