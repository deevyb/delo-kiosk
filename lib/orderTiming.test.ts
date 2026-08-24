import { describe, it, expect } from 'vitest'
import { queueDepthAt, percentile, TimedOrderInput } from './orderTiming'

/** All fixtures hang off one instant so tests never touch the real clock. */
export const T0 = Date.parse('2026-08-23T17:00:00Z')
export const at = (seconds: number) => new Date(T0 + seconds * 1000).toISOString()

let nextId = 0
export function order(
  placedSeconds: number,
  readySeconds: number | null,
  overrides: Partial<TimedOrderInput> = {}
): TimedOrderInput {
  return {
    id: `o${nextId++}`,
    item: 'Latte',
    status: readySeconds === null ? 'placed' : 'ready',
    created_at: at(placedSeconds),
    ready_at: readySeconds === null ? null : at(readySeconds),
    modifiers: { temperature: 'Hot' },
    ...overrides,
  }
}

describe('percentile', () => {
  it('returns null on empty input', () => {
    expect(percentile([], 90)).toBeNull()
  })
  it('nearest-rank: p90 of 1..10 is 9, p50 is 5', () => {
    const values = [10, 3, 7, 1, 9, 5, 2, 8, 6, 4]
    expect(percentile(values, 90)).toBe(9)
    expect(percentile(values, 50)).toBe(5)
  })
  it('single value is every percentile', () => {
    expect(percentile([42], 50)).toBe(42)
    expect(percentile([42], 90)).toBe(42)
  })
})

describe('queueDepthAt', () => {
  it('counts orders placed and not yet ready at the instant', () => {
    const orders = [order(0, 300), order(60, 400), order(500, 700)]
    expect(queueDepthAt(orders, at(100))).toBe(2) // first two active
    expect(queueDepthAt(orders, at(350))).toBe(1) // first done, second active
    expect(queueDepthAt(orders, at(450))).toBe(0) // gap
  })
  it('excludes canceled and never-readied orders (unknown occupancy interval)', () => {
    const orders = [
      order(0, 300, { status: 'canceled' }),
      order(0, null), // still open
      order(0, 300),
    ]
    expect(queueDepthAt(orders, at(100))).toBe(1)
  })
})
