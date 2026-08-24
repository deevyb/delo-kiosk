import { describe, it, expect } from 'vitest'
import { classifyOrders, queueDepthAt, percentile, TimedOrderInput } from './orderTiming'

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

describe('classifyOrders — the discriminator', () => {
  it('a held group: placements close, completions close → servedTogether, never suspect', () => {
    // Three friends order over 2 minutes; all drinks handed over together.
    // This is the regression test for the mistake the spec exists to correct:
    // batching is service, not noise.
    const { orders } = classifyOrders([order(0, 400), order(60, 410), order(120, 420)])
    expect(orders.map((o) => o.tag)).toEqual(['servedTogether', 'servedTogether', 'servedTogether'])
    expect(orders.every((o) => !o.stranded)).toBe(true)
  })

  it('a catch-up sweep: placements spread, completions in one burst → sweep', () => {
    const { orders } = classifyOrders([order(0, 1500), order(1200, 1510)])
    expect(orders.map((o) => o.tag)).toEqual(['sweep', 'sweep'])
  })

  it('a mixed cluster: the group is servedTogether, the stale card is sweep', () => {
    const { orders } = classifyOrders([
      order(0, 1505), // placed 25 min before the others — forgotten card
      order(1150, 1500),
      order(1190, 1510),
    ])
    const byPlaced = [...orders].sort((a, b) => a.placedMs - b.placedMs)
    expect(byPlaced[0].tag).toBe('sweep')
    expect(byPlaced[1].tag).toBe('servedTogether')
    expect(byPlaced[2].tag).toBe('servedTogether')
  })

  it('a rush: continuous close placements but sequential completions → nothing clusters', () => {
    // Orders every 40s, each served 300s after placement. Completions are 40s
    // apart — beyond the 30s cluster window. Placement proximity alone must
    // never create groups; this guards the discriminator's worst failure mode.
    const rush = Array.from({ length: 10 }, (_, i) => order(i * 40, i * 40 + 300))
    const { orders } = classifyOrders(rush)
    expect(orders.every((o) => o.tag === 'servedAlone')).toBe(true)
  })

  it('computes queue depth at placement from measurable orders only', () => {
    const { orders } = classifyOrders([order(0, 300), order(60, 400), order(500, 700)])
    const byPlaced = [...orders].sort((a, b) => a.placedMs - b.placedMs)
    expect(byPlaced.map((o) => o.queueDepth)).toEqual([0, 1, 0])
  })

  it('clamps clock-skew negative waits to zero and never throws', () => {
    const { orders } = classifyOrders([order(100, 50)])
    expect(orders[0].waitSeconds).toBe(0)
  })

  it('ignores canceled, still-open, and re-queued orders', () => {
    const { orders } = classifyOrders([
      order(0, 300, { status: 'canceled' }),
      order(0, null),
      order(0, null, { status: 'in_progress' }),
    ])
    expect(orders).toHaveLength(0)
  })
})
