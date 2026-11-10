import { describe, expect, it } from 'vitest'
import { assignLanes } from './layout.ts'

const span = (id: string, startMs: number, endMs: number) => ({ id, startMs, endMs })

describe('assignLanes', () => {
  it('keeps non-overlapping spans on one lane', () => {
    const { placed, laneCount } = assignLanes([span('a', 0, 10), span('b', 10, 20)])
    expect(laneCount).toBe(1)
    expect(placed.map((p) => p.lane)).toEqual([0, 0])
  })

  it('stacks overlapping spans', () => {
    const { placed, laneCount } = assignLanes([span('a', 0, 10), span('b', 5, 15), span('c', 6, 8)])
    expect(laneCount).toBe(3)
    expect(Object.fromEntries(placed.map((p) => [p.item.id, p.lane]))).toEqual({ a: 0, b: 1, c: 2 })
  })

  it('reuses the first lane that has become free', () => {
    const { placed, laneCount } = assignLanes([span('a', 0, 10), span('b', 5, 30), span('c', 12, 20)])
    expect(laneCount).toBe(2)
    expect(Object.fromEntries(placed.map((p) => [p.item.id, p.lane]))).toEqual({ a: 0, b: 1, c: 0 })
  })

  it('sorts by start time regardless of input order', () => {
    const { placed } = assignLanes([span('late', 20, 30), span('early', 0, 25)])
    expect(placed.map((p) => p.item.id)).toEqual(['early', 'late'])
    expect(placed.map((p) => p.lane)).toEqual([0, 1])
  })

  it('returns no lanes for no items', () => {
    expect(assignLanes([])).toEqual({ placed: [], laneCount: 0 })
  })
})
