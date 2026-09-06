import { describe, it, expect } from 'vitest'
import {
  classifyOrders,
  queueDepthAt,
  percentile,
  fitFloorAndLine,
  MIN_MODEL_POINTS,
  TimedOrderInput,
  groupCost,
  summarize,
  ClassifiedOrder,
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

function classified(overrides: Partial<ClassifiedOrder>): ClassifiedOrder {
  return {
    id: `c${nextId++}`,
    item: 'Latte',
    temperature: 'Hot',
    placedMs: T0,
    readyMs: T0 + 120_000,
    waitSeconds: 120,
    queueDepth: 0,
    tag: 'servedAlone',
    stranded: false,
    groupSize: null,
    ...overrides,
  }
}

describe('groupCost', () => {
  const model = { floorSeconds: 120, perDrinkSeconds: 60 }
  it('splits the holding cost by congestion at placement', () => {
    const orders = [
      // Six alones spread across depths. Nearest-rank puts the event's median
      // depth at 2 (all ten orders: 0,1,1,1,2,4,5,5,5,6) — the quiet/busy split
      // below lands the same way whether the cut is 2 or 3.
      ...[0, 1, 2, 4, 5, 6].map((d) => classified({ queueDepth: d, waitSeconds: 120 + 60 * d })),
      // Held pair when quiet (depth 1, predicted 180): cost 120 each
      classified({ tag: 'servedTogether', groupSize: 2, queueDepth: 1, waitSeconds: 300 }),
      classified({ tag: 'servedTogether', groupSize: 2, queueDepth: 1, waitSeconds: 300 }),
      // Held pair when slammed (depth 5, predicted 420): cost 280 each
      classified({ tag: 'servedTogether', groupSize: 2, queueDepth: 5, waitSeconds: 700 }),
      classified({ tag: 'servedTogether', groupSize: 2, queueDepth: 5, waitSeconds: 700 }),
    ]
    const cost = groupCost(orders, model)
    expect(cost).toEqual({
      overallMedianSeconds: 120,
      quietMedianSeconds: 120,
      busyMedianSeconds: 280,
      bySize: [{ size: 2, count: 4, medianSeconds: 120 }],
    })
  })
  it('is null without a model or without held orders', () => {
    expect(groupCost([classified({})], model)).toBeNull()
    expect(groupCost([classified({ tag: 'servedTogether' })], null)).toBeNull()
  })
})

describe('summarize', () => {
  it('returns null below the minimum, whatever the reason', () => {
    expect(summarize([])).toBeNull()
    expect(summarize([order(0, 120)])).toBeNull()
    expect(
      summarize(Array.from({ length: 12 }, () => order(0, null, { status: 'canceled' })))
    ).toBeNull()
    expect(summarize(Array.from({ length: 12 }, () => order(0, null)))).toBeNull()
  })

  it('sweeps stay in the headline but drive the counterfactual', () => {
    // 12 clean fast orders + a 3-order sweep that waited ~20 minutes.
    const clean = Array.from({ length: 12 }, (_, i) => order(i * 200, i * 200 + 150))
    const sweep = [order(3000, 4210), order(2000, 4215), order(1000, 4220)]
    const summary = summarize([...clean, ...sweep])!
    expect(summary.measured).toBe(15)
    expect(summary.suspect.sweepCount).toBe(3)
    expect(summary.p90Seconds).toBeGreaterThan(1000) // sweeps pull the headline up — included
    expect(summary.suspect.counterfactualP90Seconds).toBe(150) // and honesty shows the difference
    expect(summary.buckets.fast).toBe(12)
    expect(summary.buckets.slow).toBe(3)
  })

  it('an event of one giant held group still reports, with no model', () => {
    const group = Array.from({ length: 12 }, (_, i) => order(i * 10, 500 + i))
    const summary = summarize(group)!
    expect(summary.servedTogether.count).toBe(12)
    expect(summary.model).toBeNull()
    expect(summary.groupCost).toBeNull()
    expect(summary.suspect.counterfactualP90Seconds).toBeNull()
    expect(summary.perDrink).toEqual([])
  })

  it('per-drink comparison uses clean orders only and respects the minimum count', () => {
    // Cortados run 60s over the line; one stray drink appears only twice.
    const fixture = [
      ...cleanTriplets(6),
      order(6000, 6180, { item: 'Cortado' }),
      order(6600, 6780, { item: 'Cortado' }),
      order(7200, 7380, { item: 'Cortado' }),
      order(7800, 7860, { item: 'Chai' }),
      order(8400, 8460, { item: 'Chai' }),
    ]
    const summary = summarize(fixture)!
    const cortado = summary.perDrink.find((d) => d.name === 'Cortado')
    expect(cortado).toBeDefined()
    expect(cortado!.count).toBe(3)
    expect(cortado!.deltaSeconds).toBeGreaterThan(30)
    expect(summary.perDrink.find((d) => d.name === 'Chai')).toBeUndefined() // below MIN_SEGMENT_ORDERS
  })
})

/** A held group: placements 30s apart (chained ≤180s), completions 5s apart. */
function heldGroup(baseSeconds: number, size: number, readySeconds: number): TimedOrderInput[] {
  return Array.from({ length: size }, (_, i) => order(baseSeconds + i * 30, readySeconds + i * 5))
}

describe('group sizes', () => {
  it('records the servedTogether member count as groupSize; sweeps stay null', () => {
    const { orders } = classifyOrders([
      order(0, 1505), // stale card in the same completion cluster
      order(1150, 1500),
      order(1190, 1510),
    ])
    const byPlaced = [...orders].sort((a, b) => a.placedMs - b.placedMs)
    expect(byPlaced[0].groupSize).toBeNull() // sweep
    expect(byPlaced[1].groupSize).toBe(2)
    expect(byPlaced[2].groupSize).toBe(2)
  })

  it('buckets group cost by size with the minimum-count guard', () => {
    const fixture = [
      ...cleanTriplets(6),
      ...heldGroup(6000, 2, 6600),
      ...heldGroup(7000, 2, 7600), // two pairs: 4 orders in the size-2 bucket
      ...heldGroup(8000, 3, 8600), // 3 orders in the size-3 bucket
      ...heldGroup(9000, 5, 9700), // 5 orders in the 4+ bucket
    ]
    const summary = summarize(fixture)!
    expect(summary.groupCost).not.toBeNull()
    expect(summary.groupCost!.bySize.map((b) => [b.size, b.count])).toEqual([
      [2, 4],
      [3, 3],
      [4, 5],
    ])
    expect(summary.groupCost!.overallMedianSeconds).toBeGreaterThan(0)
  })

  it('falls back to the combined number when every size bucket is thin', () => {
    const summary = summarize([...cleanTriplets(6), ...heldGroup(6000, 2, 6600)])!
    expect(summary.groupCost).not.toBeNull()
    expect(summary.groupCost!.bySize).toEqual([]) // 2 orders < MIN_SEGMENT_ORDERS
    expect(typeof summary.groupCost!.overallMedianSeconds).toBe('number')
  })
})

describe('distinct suspect count', () => {
  it('an order that is both sweep and stranded counts once', () => {
    // Two orders complete together; placements 1800s apart -> both sweep.
    // The first also waited 2000s at depth 0 -> stranded too.
    const fixture = [...cleanTriplets(6), order(5000, 7000), order(6800, 7005)]
    const summary = summarize(fixture)!
    expect(summary.suspect.sweepCount).toBe(2)
    expect(summary.suspect.strandedCount).toBe(1)
    expect(summary.suspect.suspectCount).toBe(2) // NOT 3
  })
})

describe('cluster shape', () => {
  it('a spread-out sweep chained at rush cadence is not a held group', () => {
    // Cards placed 0/120/240/360s, all bumped together. Every adjacent pair sits
    // inside PLACED_CLUSTER_SECONDS, so an any-neighbour rule chains them into
    // one "group" — but a 6-minute ordering span is a cleanup, not a party.
    const { orders } = classifyOrders([
      order(0, 1000),
      order(120, 1005),
      order(240, 1010),
      order(360, 1015),
    ])
    expect(orders.map((o) => o.tag)).toEqual(['sweep', 'sweep', 'sweep', 'sweep'])
    expect(orders.every((o) => o.groupSize === null)).toBe(true)
  })

  it('two parties in one handover window stay two pairs, not one group of four', () => {
    const fixture = [
      ...cleanTriplets(6),
      order(6000, 7000),
      order(6030, 7005),
      order(6400, 7010),
      order(6430, 7015),
    ]
    const { orders } = classifyOrders(fixture)
    const held = orders.filter((o) => o.tag === 'servedTogether')
    expect(held).toHaveLength(4)
    expect(held.every((o) => o.groupSize === 2)).toBe(true)
    const summary = summarize(fixture)!
    expect(summary.groupCost!.bySize.map((b) => [b.size, b.count])).toEqual([[2, 4]])
  })

  it('two baristas interleaving handovers never merge into one cluster', () => {
    // Placements 20s apart, handovers 25s apart alternating hands. Each barista's
    // own completions are 50s apart, well past READY_CLUSTER_SECONDS, so once
    // clustering is partitioned by claimed_by the rush stays 20 solo orders.
    const rush = Array.from({ length: 20 }, (_, i) =>
      order(i * 20, 500 + i * 25, { claimed_by: i % 2 === 0 ? 'A' : 'B' })
    )
    const summary = summarize(rush)!
    expect(summary.servedTogether.count).toBe(0)
    expect(summary.suspect.sweepCount).toBe(0)
    expect(summary.model).not.toBeNull()
  })

  it('solo mode is untouched: a null claimed_by is one partition', () => {
    const { orders } = classifyOrders([order(0, 400), order(60, 410), order(120, 420)])
    expect(orders.every((o) => o.tag === 'servedTogether')).toBe(true)
  })
})

describe('queue depth excludes groupmates', () => {
  it('a party of five alone in an empty cafe is not its own queue', () => {
    const fixture = [...cleanTriplets(6), ...heldGroup(6000, 5, 6900)]
    const { orders } = classifyOrders(fixture)
    const held = orders.filter((o) => o.tag === 'servedTogether')
    expect(held).toHaveLength(5)
    // Without the exclusion these read 0,1,2,3,4 and the group's own size gets
    // mistaken for congestion, which is exactly the axis groupCost splits on.
    expect(held.map((o) => o.queueDepth)).toEqual([0, 0, 0, 0, 0])

    const cost = summarize(fixture)!.groupCost!
    expect(cost.overallMedianSeconds).toBeGreaterThan(0)
    expect(cost.quietMedianSeconds).toBeGreaterThan(0) // all five in one bucket
    expect(cost.busyMedianSeconds).toBeNull()
  })
})

describe('the fit resists leverage', () => {
  it('a stranded card at a unique extreme depth cannot rotate the line through itself', () => {
    // 12 clean orders on the 120s + 60s/drink line, then a party of eight is
    // held while one card is forgotten behind them: placed at depth 8, handed
    // over 15 minutes later. It is the only point out at that depth, so least
    // squares swings the whole line toward it, shrinks its own residual to
    // ~40s, and publishes a per-drink cost of ~95s that nothing else supports.
    const party = Array.from({ length: 8 }, (_, i) => order(6000 + i * 20, 7000 + i * 5))
    const forgotten = order(6200, 7100)
    const { orders, model } = classifyOrders([...cleanTriplets(4), ...party, forgotten])
    expect(model!.floorSeconds).toBeCloseTo(120, 0)
    expect(model!.perDrinkSeconds).toBeCloseTo(60, 0)
    const stranded = orders.filter((o) => o.stranded)
    expect(stranded).toHaveLength(1)
    expect(stranded[0].waitSeconds).toBe(900)
    expect(stranded[0].queueDepth).toBe(8)
  })
})

describe('segment comparisons see solo orders only', () => {
  it('a drink only ever ordered by a held party is not "slower"', () => {
    // 18 Lattes served one at a time on the line, and a Cortado trio held for
    // 15 minutes so three friends could take them together. The holding cost is
    // groupCost's subject; billing it to the Cortado invents a slow drink.
    const summary = summarize([
      ...cleanTriplets(6),
      order(6000, 6900, { item: 'Cortado' }),
      order(6030, 6905, { item: 'Cortado' }),
      order(6060, 6910, { item: 'Cortado' }),
    ])!
    expect(summary.servedTogether.count).toBe(3)
    expect(summary.perDrink.find((d) => d.name === 'Cortado')).toBeUndefined()
    const latte = summary.perDrink.find((d) => d.name === 'Latte')!
    expect(latte.count).toBe(18)
    expect(latte.deltaSeconds).toBeCloseTo(0, 0)
  })
})

describe('the counterfactual needs something to stand on', () => {
  /** Placements far enough apart to never link, all bumped in one burst. */
  const sweepOf = (count: number, firstPlaced: number, firstReady: number) =>
    Array.from({ length: count }, (_, i) => order(firstPlaced + i * 400, firstReady + i * 10))

  it('stays null when almost the whole day is suspect', () => {
    // 3 clean orders and a 9-card sweep: "without them the day was 2m 30s" is
    // the max of three quiet-moment orders wearing a day's worth of authority.
    const summary = summarize([
      order(0, 150),
      order(200, 350),
      order(400, 550),
      ...sweepOf(9, 1000, 5000),
    ])!
    expect(summary.measured).toBe(12)
    expect(summary.suspect.suspectCount).toBe(9)
    expect(summary.suspect.counterfactualP90Seconds).toBeNull()
  })

  it('reports once enough orders survive the filter', () => {
    const clean = Array.from({ length: 9 }, (_, i) => order(i * 200, i * 200 + 150))
    const summary = summarize([...clean, ...sweepOf(3, 3000, 5000)])!
    expect(summary.measured).toBe(12)
    expect(summary.suspect.suspectCount).toBe(3)
    expect(summary.suspect.counterfactualP90Seconds).toBe(150)
  })
})

describe('the fit refuses a line one order owns', () => {
  /**
   * Six solo orders at depth 0 and one at depth 1 sit on the honest
   * 120s + 60s-per-drink line. One card is then forgotten behind a held party
   * of five and handed over 15 minutes later, at depth 5 — the only point out
   * there. Theil-Sen skips same-depth pairs, so the six identical depth-0
   * points contribute none among themselves and the outlier owns 7 of the 13
   * surviving pairs: the median slope follows it to 156s per drink, its own
   * residual collapses to zero, it escapes the stranded flag, AND that
   * invented per-drink cost gets published. No model is the honest answer.
   */
  const fixture = () => [
    order(0, 120),
    order(600, 720),
    order(1200, 1320),
    order(1800, 1920),
    order(2400, 2520),
    order(3000, 3120), // six at depth 0, wait 120
    order(3040, 3220), // depth 1, wait 180
    ...heldGroup(4000, 5, 5000),
    order(4200, 5100), // depth 5, wait 900 — the forgotten card
  ]

  it('publishes no model when one outlier owns the majority of pairs', () => {
    const { orders, model } = classifyOrders(fixture())

    // The fixture only bites if it really has this shape.
    const alone = orders.filter((o) => o.tag === 'servedAlone')
    expect(alone).toHaveLength(8)
    expect(alone.map((o) => o.queueDepth).sort((a, b) => a - b)).toEqual([0, 0, 0, 0, 0, 0, 1, 5])

    expect(model).toBeNull()
    expect(orders.filter((o) => o.stranded)).toHaveLength(0)
  })

  it('summarize still reports the day, with the misleading line withheld', () => {
    const summary = summarize(fixture())!
    expect(summary.measured).toBe(13)
    expect(summary.servedTogether.count).toBe(5)
    expect(summary.p90Seconds).toBe(975) // the day is still reported in full
    expect(summary.model).toBeNull()
  })

  it('leaves a well-supported fit alone: 12 inliers outvote the outlier', () => {
    const points = [
      ...Array.from({ length: 4 }, () => ({ depth: 0, waitSeconds: 120 })),
      ...Array.from({ length: 4 }, () => ({ depth: 1, waitSeconds: 180 })),
      ...Array.from({ length: 4 }, () => ({ depth: 2, waitSeconds: 240 })),
      { depth: 8, waitSeconds: 900 },
    ]
    expect(fitFloorAndLine(points)).toEqual({ floorSeconds: 120, perDrinkSeconds: 60 })
  })
})
