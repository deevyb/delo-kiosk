/**
 * Pure timing math for the admin dashboard — no I/O, no Supabase, no Date.now().
 * Consumes plain order rows, returns plain summaries; everything is unit-testable
 * with synthetic fixtures. Spec: docs/specs/2026-08-23-customer-wait-times-design.md
 *
 * Vocabulary:
 * - "wait" = created_at → ready_at, the customer's full experience (placed → in hand).
 * - servedTogether = completions clustered AND placements clustered — a held group.
 *   Real wait, its own segment, never suspect. Batching is the service.
 * - sweep = completions clustered, placements spread — a catch-up bump. Suspect.
 * - stranded = waited far beyond what its queue depth predicts. Suspect.
 * Suspects are counted and captioned, never excluded from headline numbers.
 */

/** Below the 70–95s hands-on floor for a milk drink — sequential builds can't cluster. */
export const READY_CLUSTER_SECONDS = 30
/**
 * A group of 3–5 ordering one-at-a-time on a single iPad spans ~90–150s.
 * Do NOT widen this to catch trickle-in groups — during a rush, placements are
 * continuously close together and a wider window would merge the whole event
 * into one "group" (spec, Known limitation).
 */
export const PLACED_CLUSTER_SECONDS = 180
/** Bucket edges: QSR counter targets (3–5 min) and Starbucks' 4-minute rule. */
export const BUCKET_FAST_SECONDS = 180
export const BUCKET_SLOW_SECONDS = 360
/** Below this many measured orders, publish nothing rather than noise. */
export const MIN_TIMED_ORDERS = 10
export const MIN_MODEL_POINTS = 8
/** Absolute overshoot floor so a very uniform event can't flag everything. */
export const MIN_STRANDED_OVERSHOOT_SECONDS = 120
export const STRANDED_RESIDUAL_MULTIPLIER = 3
/** A drink/temperature needs this many clean orders to appear in comparisons. */
export const MIN_SEGMENT_ORDERS = 3

export interface TimedOrderInput {
  id: string
  item: string
  status: string
  created_at: string
  ready_at: string | null
  modifiers: { temperature?: string } | null
}

/** Nearest-rank percentile. p50 of an even-length list is the lower middle. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length))
  return sorted[rank - 1]
}

/**
 * How many orders were placed and not yet ready at `instantIso`.
 * Only orders with a known occupancy interval count: canceled and still-open
 * orders are excluded — we can't know when (or whether) they left the queue,
 * they are few, and the error is small (spec, Build §2).
 */
export function queueDepthAt(orders: TimedOrderInput[], instantIso: string): number {
  const instant = Date.parse(instantIso)
  return orders.filter(
    (o) =>
      o.status === 'ready' &&
      o.ready_at !== null &&
      Date.parse(o.created_at) <= instant &&
      Date.parse(o.ready_at) > instant
  ).length
}

export type WaitTag = 'servedAlone' | 'servedTogether' | 'sweep'

export interface ClassifiedOrder {
  id: string
  item: string
  temperature: string | null
  placedMs: number
  readyMs: number
  waitSeconds: number
  queueDepth: number
  tag: WaitTag
  stranded: boolean
  /** servedTogether members: how many were handed over together; null otherwise. */
  groupSize: number | null
}

export interface QueueModel {
  floorSeconds: number
  perDrinkSeconds: number
}

export interface ClassificationResult {
  orders: ClassifiedOrder[]
  model: QueueModel | null
}

/**
 * Tag every measurable order. The discriminator (spec, "How to detect groups"):
 * completions clustered + placements clustered = a held group (servedTogether);
 * completions clustered + placements spread = a catch-up sweep. Requiring BOTH
 * is what survives a rush, where placements are continuously close but
 * completions are never simultaneous unless deliberately held.
 */
export function classifyOrders(orders: TimedOrderInput[]): ClassificationResult {
  const measurable: ClassifiedOrder[] = orders
    .filter((o) => o.status === 'ready' && o.ready_at !== null)
    .map((o) => {
      const placedMs = Date.parse(o.created_at)
      const readyMs = Date.parse(o.ready_at as string)
      return {
        id: o.id,
        item: o.item,
        temperature: o.modifiers?.temperature ?? null,
        placedMs,
        readyMs,
        // Clamp for clock-skew safety, mirroring formatPrepTime.
        waitSeconds: Math.max(0, (readyMs - placedMs) / 1000),
        queueDepth: 0,
        tag: 'servedAlone' as WaitTag,
        stranded: false,
        groupSize: null,
      }
    })
    .sort((a, b) => a.readyMs - b.readyMs)

  // Depth at placement: measurable orders only — same exclusion rule as
  // queueDepthAt, and O(n²) is fine at ~150 orders per event.
  for (const o of measurable) {
    o.queueDepth = measurable.filter(
      (other) => other !== o && other.placedMs <= o.placedMs && other.readyMs > o.placedMs
    ).length
  }

  // Completion clusters: consecutive completions under READY_CLUSTER_SECONDS
  // apart. 30s is below the physical hands-on floor for one drink, so
  // sequential builds can never land in one cluster.
  const clusters: ClassifiedOrder[][] = []
  let clusterStart = 0
  for (let i = 1; i <= measurable.length; i++) {
    const gapMs =
      i < measurable.length ? measurable[i].readyMs - measurable[i - 1].readyMs : Infinity
    if (gapMs >= READY_CLUSTER_SECONDS * 1000) {
      clusters.push(measurable.slice(clusterStart, i))
      clusterStart = i
    }
  }

  for (const cluster of clusters) {
    if (cluster.length < 2) continue
    for (const member of cluster) {
      // Per-order, not per-cluster: a mixed cluster (a group plus one stale
      // card bumped in the same moment) splits correctly.
      const hasPlacedNeighbor = cluster.some(
        (other) =>
          other !== member &&
          Math.abs(other.placedMs - member.placedMs) <= PLACED_CLUSTER_SECONDS * 1000
      )
      member.tag = hasPlacedNeighbor ? 'servedTogether' : 'sweep'
    }
    // Size is the held-group headcount, so a mixed cluster's sweep member
    // neither carries a size nor inflates the group's.
    const togetherMembers = cluster.filter((m) => m.tag === 'servedTogether')
    for (const member of togetherMembers) member.groupSize = togetherMembers.length
  }

  // Stranded pass. The ordering is load-bearing and runs exactly once (spec):
  // 1. tag clusters from timestamps alone (done above);
  // 2. fit on servedAlone only — sweeps and held groups must not shape the line;
  // 3. flag residuals once; never refit, which would slowly eat the legitimate tail.
  const alone = measurable.filter((o) => o.tag === 'servedAlone')
  const model = fitFloorAndLine(
    alone.map((o) => ({ depth: o.queueDepth, waitSeconds: o.waitSeconds }))
  )
  if (model) {
    const medianAbsResidual =
      percentile(
        alone.map((o) => Math.abs(residualAgainst(model, o))),
        50
      ) ?? 0
    const threshold = Math.max(
      STRANDED_RESIDUAL_MULTIPLIER * medianAbsResidual,
      MIN_STRANDED_OVERSHOOT_SECONDS
    )
    for (const o of measurable) {
      // Held groups are real waits by definition — long is only suspicious
      // when nothing explains it.
      if (o.tag !== 'servedTogether' && residualAgainst(model, o) > threshold) o.stranded = true
    }
  }

  return { orders: measurable, model }
}

/**
 * Least squares of wait on queue depth over served-alone orders.
 * Returns null rather than nonsense: needs MIN_MODEL_POINTS points, 3+
 * distinct depths, a positive slope, and a positive floor (spec, Build §2).
 */
export function fitFloorAndLine(
  points: { depth: number; waitSeconds: number }[]
): QueueModel | null {
  if (points.length < MIN_MODEL_POINTS) return null
  if (new Set(points.map((p) => p.depth)).size < 3) return null
  const n = points.length
  const meanX = points.reduce((s, p) => s + p.depth, 0) / n
  const meanY = points.reduce((s, p) => s + p.waitSeconds, 0) / n
  let sxx = 0
  let sxy = 0
  for (const p of points) {
    sxx += (p.depth - meanX) ** 2
    sxy += (p.depth - meanX) * (p.waitSeconds - meanY)
  }
  if (sxx === 0) return null
  const slope = sxy / sxx
  const intercept = meanY - slope * meanX
  if (slope <= 0 || intercept <= 0) return null
  return { floorSeconds: intercept, perDrinkSeconds: slope }
}

/** Seconds beyond what the queue model predicts for this order's depth. Positive = slower. */
function residualAgainst(model: QueueModel, o: ClassifiedOrder): number {
  return o.waitSeconds - (model.floorSeconds + model.perDrinkSeconds * o.queueDepth)
}

export interface GroupSizeCost {
  /** 4 means "4 or more" — bigger groups are rare enough to pool. */
  size: 2 | 3 | 4
  count: number
  medianSeconds: number
}

export interface GroupCost {
  /** Median holding cost across every held order, whatever the group size. */
  overallMedianSeconds: number
  quietMedianSeconds: number | null
  busyMedianSeconds: number | null
  /** Only buckets with MIN_SEGMENT_ORDERS members, size ascending. May be empty. */
  bySize: GroupSizeCost[]
}

export interface SegmentComparison {
  name: string
  count: number
  /** Median residual vs the model at matched queue depth. Positive = slower. */
  deltaSeconds: number
}

export interface TimingSummary {
  measured: number
  p90Seconds: number
  medianSeconds: number
  buckets: { fast: number; medium: number; slow: number }
  servedAlone: { count: number; p90Seconds: number | null }
  servedTogether: { count: number; p90Seconds: number | null }
  suspect: {
    sweepCount: number
    strandedCount: number
    /** Distinct orders that are sweep, stranded, or both — never the sum of the two. */
    suspectCount: number
    counterfactualP90Seconds: number | null
  }
  model: QueueModel | null
  groupCost: GroupCost | null
  perDrink: SegmentComparison[]
  byTemperature: SegmentComparison[]
}

/**
 * What holding for a group costs, split by congestion at placement — the
 * direct test of the ED study's boundary condition ("benefits concentrate
 * under manageable congestion") against this kiosk's own events.
 */
export function groupCost(
  classified: ClassifiedOrder[],
  model: QueueModel | null
): GroupCost | null {
  if (!model) return null
  const together = classified.filter((o) => o.tag === 'servedTogether')
  if (together.length === 0) return null
  const medianDepth =
    percentile(
      classified.map((o) => o.queueDepth),
      50
    ) ?? 0
  const costOf = (o: ClassifiedOrder) => residualAgainst(model, o)
  const costs = together.map(costOf)
  // Thin buckets are dropped rather than shown: with one or two groups a size
  // bucket is an anecdote. When they all drop out, the overall number carries it.
  const bySize: GroupSizeCost[] = ([2, 3, 4] as const)
    .map((size) => {
      const members = together.filter((o) =>
        size === 4 ? (o.groupSize ?? 0) >= 4 : o.groupSize === size
      )
      return {
        size,
        count: members.length,
        medianSeconds: percentile(members.map(costOf), 50) ?? 0,
      }
    })
    .filter((bucket) => bucket.count >= MIN_SEGMENT_ORDERS)
  return {
    overallMedianSeconds: percentile(costs, 50) as number,
    quietMedianSeconds: percentile(
      together.filter((o) => o.queueDepth < medianDepth).map(costOf),
      50
    ),
    busyMedianSeconds: percentile(
      together.filter((o) => o.queueDepth >= medianDepth).map(costOf),
      50
    ),
    bySize,
  }
}

/** Median model residual per segment, over clean orders only. */
function segmentComparisons(
  clean: ClassifiedOrder[],
  model: QueueModel | null,
  keyOf: (o: ClassifiedOrder) => string | null
): SegmentComparison[] {
  if (!model) return []
  const groups = new Map<string, number[]>()
  for (const o of clean) {
    const key = keyOf(o)
    if (key === null) continue
    groups.set(key, [...(groups.get(key) ?? []), residualAgainst(model, o)])
  }
  return Array.from(groups.entries())
    .filter(([, residuals]) => residuals.length >= MIN_SEGMENT_ORDERS)
    .map(([name, residuals]) => ({
      name,
      count: residuals.length,
      deltaSeconds: percentile(residuals, 50) as number,
    }))
    .sort((a, b) => b.deltaSeconds - a.deltaSeconds)
}

export function summarize(orders: TimedOrderInput[]): TimingSummary | null {
  const { orders: classified, model } = classifyOrders(orders)
  if (classified.length < MIN_TIMED_ORDERS) return null

  const waits = classified.map((o) => o.waitSeconds)
  const alone = classified.filter((o) => o.tag === 'servedAlone')
  const together = classified.filter((o) => o.tag === 'servedTogether')
  const sweepCount = classified.filter((o) => o.tag === 'sweep').length
  const strandedCount = classified.filter((o) => o.stranded).length
  // Clean = not suspect. Suspects stay in every headline number; "clean" exists
  // only for the counterfactual caption and fair per-segment comparisons.
  const clean = classified.filter((o) => o.tag !== 'sweep' && !o.stranded)

  return {
    measured: classified.length,
    p90Seconds: percentile(waits, 90) as number,
    medianSeconds: percentile(waits, 50) as number,
    buckets: {
      fast: waits.filter((w) => w < BUCKET_FAST_SECONDS).length,
      medium: waits.filter((w) => w >= BUCKET_FAST_SECONDS && w < BUCKET_SLOW_SECONDS).length,
      slow: waits.filter((w) => w >= BUCKET_SLOW_SECONDS).length,
    },
    servedAlone: {
      count: alone.length,
      p90Seconds: percentile(
        alone.map((o) => o.waitSeconds),
        90
      ),
    },
    servedTogether: {
      count: together.length,
      p90Seconds: percentile(
        together.map((o) => o.waitSeconds),
        90
      ),
    },
    suspect: {
      sweepCount,
      strandedCount,
      // Distinct by construction: `clean` already excludes an order that is
      // both, so the two counts above can be summed only at the cost of
      // double-counting it. Captions use this number.
      suspectCount: classified.length - clean.length,
      // An all-suspect event leaves `clean` empty, which lands on null too —
      // percentile([], 90) is null, so there is no counterfactual to show.
      counterfactualP90Seconds:
        sweepCount + strandedCount > 0
          ? percentile(
              clean.map((o) => o.waitSeconds),
              90
            )
          : null,
    },
    model,
    groupCost: groupCost(classified, model),
    perDrink: segmentComparisons(clean, model, (o) => o.item),
    byTemperature: segmentComparisons(clean, model, (o) => o.temperature),
  }
}
