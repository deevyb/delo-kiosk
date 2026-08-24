import { describe, it, expect } from 'vitest'
import {
  classifyOrders,
  queueDepthAt,
  percentile,
  fitFloorAndLine,
  MIN_MODEL_POINTS,
  TimedOrderInput,
} from './orderTiming'

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

/**
 * A clean, linear event: repeated triplets where each order's wait is exactly
 * 120s + 60s per drink ahead. Depths 0/1/2 by construction; completions are
 * 80–100s apart so nothing clusters. Used by both the fit and stranded tests.
 */
function cleanTriplets(count: number): TimedOrderInput[] {
  const orders: TimedOrderInput[] = []
  for (let t = 0; t < count; t++) {
    const base = t * 600
    orders.push(order(base, base + 120)) // depth 0, wait 120
    orders.push(order(base + 40, base + 220)) // depth 1, wait 180
    orders.push(order(base + 60, base + 300)) // depth 2, wait 240
  }
  return orders
}

describe('fitFloorAndLine', () => {
  it('recovers floor and per-drink cost from clean linear data', () => {
    const { orders } = classifyOrders(cleanTriplets(4))
    const model = fitFloorAndLine(
      orders.map((o) => ({ depth: o.queueDepth, waitSeconds: o.waitSeconds }))
    )
    expect(model).not.toBeNull()
    expect(model!.floorSeconds).toBeCloseTo(120, 0)
    expect(model!.perDrinkSeconds).toBeCloseTo(60, 0)
  })
  it('returns null below the minimum point count', () => {
    const points = Array.from({ length: MIN_MODEL_POINTS - 1 }, (_, i) => ({
      depth: i % 3,
      waitSeconds: 120 + 60 * (i % 3),
    }))
    expect(fitFloorAndLine(points)).toBeNull()
  })
  it('returns null without at least 3 distinct depths', () => {
    const points = Array.from({ length: 10 }, () => ({ depth: 1, waitSeconds: 150 }))
    expect(fitFloorAndLine(points)).toBeNull()
  })
  it('returns null on a nonsense (negative) slope instead of reporting it', () => {
    const points = [0, 0, 0, 1, 1, 1, 2, 2, 2].map((depth) => ({
      depth,
      waitSeconds: 300 - 100 * depth,
    }))
    expect(fitFloorAndLine(points)).toBeNull()
  })
})

describe('stranded cards', () => {
  it('flags a long wait with an empty queue; leaves the clean orders alone', () => {
    // 6 clean triplets (18 orders) + one order that waited 10 minutes with
    // nothing ahead of it — the isolated forgotten card.
    const fixture = [...cleanTriplets(6), order(6000, 6600)]
    const { orders, model } = classifyOrders(fixture)
    expect(model).not.toBeNull()
    const strandedOnes = orders.filter((o) => o.stranded)
    expect(strandedOnes).toHaveLength(1)
    expect(strandedOnes[0].queueDepth).toBe(0)
    expect(strandedOnes[0].waitSeconds).toBe(600)
  })

  it('a genuine backlog stays clean: long waits explained by a deep queue', () => {
    // 12 orders in a burst, served strictly FIFO, 120s of service apart.
    // Waits stretch past 20 minutes late in the burst — with deep queues to
    // explain them. The discriminator must work in both directions; this is
    // the test that matters most (spec, Build §6).
    const backlog = Array.from({ length: 12 }, (_, i) => order(i * 30, 300 + i * 120))
    const { orders } = classifyOrders(backlog)
    expect(orders.every((o) => !o.stranded)).toBe(true)
    expect(orders.every((o) => o.tag === 'servedAlone')).toBe(true)
  })

  it('held groups are never stranded, whatever their residual', () => {
    const fixture = [...cleanTriplets(6), order(6000, 6900), order(6030, 6905), order(6060, 6910)]
    const { orders } = classifyOrders(fixture)
    const held = orders.filter((o) => o.tag === 'servedTogether')
    expect(held).toHaveLength(3)
    expect(held.every((o) => !o.stranded)).toBe(true)
  })

  it('no model means no stranded flags — never guess without a baseline', () => {
    const { orders, model } = classifyOrders([order(0, 1200), order(2000, 3200)])
    expect(model).toBeNull()
    expect(orders.every((o) => !o.stranded)).toBe(true)
  })
})
