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
/**
 * Below this many clean orders there is no counterfactual worth printing: the
 * "without them" number would be the slowest of a handful of quiet-moment
 * orders, and it reads as the day the owner nearly had.
 */
export const MIN_COUNTERFACTUAL_ORDERS = 5
/**
 * How far the queue model's slope may move when its single worst-fitting point
 * is dropped. Halving or doubling means one order was holding the line up;
 * see fitFloorAndLine.
 */
export const FIT_STABILITY_FACTOR = 2

export interface TimedOrderInput {
  id: string
  item: string
  status: string
  created_at: string
  ready_at: string | null
  modifiers: { temperature?: string } | null
  /** Which barista handed it over. Partitions completion clustering (spec, F4). */
  claimed_by?: string | null
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
  /**
   * Orders placed before this one and not yet handed over — the line this
   * customer actually stood in. For a held group's members that EXCLUDES their
   * own groupmates: they arrived together, so counting each other would read
   * party size as congestion. The model is fit on served-alone orders, which
   * have no groupmates by definition, so the line itself is unaffected.
   */
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
 * Bookkeeping classifyOrders needs while it works and nobody needs afterwards:
 * whose hands the drink left in (partitions completion clustering) and which
 * held-group component it landed in (so groupmates can be kept out of each
 * other's queue depth).
 */
interface WorkingOrder extends ClassifiedOrder {
  claimedBy: string | null
  groupId: number | null
}

/**
 * Tag every measurable order. The discriminator (spec, "How to detect groups"):
 * completions clustered + placements clustered = a held group (servedTogether);
 * completions clustered + placements spread = a catch-up sweep. Requiring BOTH
 * is what survives a rush, where placements are continuously close but
 * completions are never simultaneous unless deliberately held.
 *
 * "Clustered" is stricter than "each card has a close neighbour", which chains
 * at rush cadence: completions cluster per barista, and placements cluster into
 * components whose WHOLE span fits the window. Then depth, then one fit on the
 * solo orders, then one pass of stranded flags. Order is load-bearing.
 */
export function classifyOrders(orders: TimedOrderInput[]): ClassificationResult {
  const measurable: WorkingOrder[] = orders
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
        claimedBy: o.claimed_by ?? null,
        groupId: null,
      }
    })
    .sort((a, b) => a.readyMs - b.readyMs)

  // Completion clusters: consecutive completions under READY_CLUSTER_SECONDS
  // apart. 30s is below the physical hands-on floor for one drink, so
  // sequential builds can never land in one cluster.
  //
  // One stream per pair of hands. The 30s argument holds for ONE barista; with
  // two working the bar, handovers interleave every ~25s and a shared stream
  // would chain an entire rush into a single cluster. Orders therefore cluster
  // only with orders the same barista handed over, and a null claimed_by is its
  // own stream, so solo mode is exactly as it was. Accepted limitation: a group
  // whose drinks were built by two baristas splits across streams and its
  // holding cost is undercounted (never fabricated).
  const streams = new Map<string, WorkingOrder[]>()
  for (const o of measurable) {
    // Prefixed so a barista literally named "null" can't collide with solo mode.
    const key = o.claimedBy === null ? 'solo' : `by:${o.claimedBy}`
    const stream = streams.get(key)
    if (stream) stream.push(o)
    else streams.set(key, [o])
  }

  const clusters: WorkingOrder[][] = []
  for (const stream of Array.from(streams.values())) {
    let clusterStart = 0
    for (let i = 1; i <= stream.length; i++) {
      const gapMs = i < stream.length ? stream[i].readyMs - stream[i - 1].readyMs : Infinity
      if (gapMs >= READY_CLUSTER_SECONDS * 1000) {
        clusters.push(stream.slice(clusterStart, i))
        clusterStart = i
      }
    }
  }

  let nextGroupId = 0
  for (const cluster of clusters) {
    if (cluster.length < 2) continue
    // Split the cluster into connected components of "placed within
    // PLACED_CLUSTER_SECONDS of each other" — on a timeline that is just the
    // maximal runs of consecutive placements under the window. Then test each
    // component's TOTAL span, because chaining alone is not a group: at rush
    // cadence every card has a close neighbour, so 0/120/240/360s would link
    // into one six-minute "party" that is really an end-of-rush cleanup. A real
    // group's whole ordering span fits inside the window (owner, design gate).
    const byPlaced = [...cluster].sort((a, b) => a.placedMs - b.placedMs)
    const components: WorkingOrder[][] = [[byPlaced[0]]]
    for (const member of byPlaced.slice(1)) {
      const current = components[components.length - 1]
      const previous = current[current.length - 1]
      if (member.placedMs - previous.placedMs <= PLACED_CLUSTER_SECONDS * 1000) current.push(member)
      else components.push([member])
    }

    for (const members of components) {
      const span = members[members.length - 1].placedMs - members[0].placedMs
      // Everything that isn't a qualifying group is a sweep: singletons bumped
      // alongside a group (the stale forgotten card) and over-span components
      // alike. Size is the held-group headcount, so neither inflates it.
      const isHeldGroup = members.length >= 2 && span <= PLACED_CLUSTER_SECONDS * 1000
      const groupId = isHeldGroup ? nextGroupId++ : null
      for (const member of members) {
        member.tag = isHeldGroup ? 'servedTogether' : 'sweep'
        member.groupSize = isHeldGroup ? members.length : null
        member.groupId = groupId
      }
    }
  }

  // Depth at placement: measurable orders only — same exclusion rule as
  // queueDepthAt, and O(n²) is fine at ~150 orders per event. Runs after
  // grouping because a groupmate is not "the line": five friends alone in an
  // empty cafe would otherwise register depths 0..4 off each other, and
  // groupCost's whole quiet/busy axis would read group size as congestion.
  for (const o of measurable) {
    o.queueDepth = measurable.filter(
      (other) =>
        other !== o &&
        other.placedMs <= o.placedMs &&
        other.readyMs > o.placedMs &&
        !(o.groupId !== null && other.groupId === o.groupId)
    ).length
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
 * Theil–Sen fit of wait on queue depth over served-alone orders: the slope is
 * the median of every pairwise slope, the floor the median of the leftovers.
 *
 * Deliberately not least squares. The point of this line is to catch the cards
 * that sit far above it, and least squares hands the worst offender the most
 * influence: a single forgotten card at a depth nothing else reached rotates
 * the line up through itself, ends up with a small residual, escapes the
 * stranded flag, and takes the published per-drink cost with it. A median of
 * slopes cannot be moved by one point that way. Exact-linear data gives the
 * identical answer, and O(n²) pairs is nothing at ~150 orders an event.
 *
 * Returns null rather than nonsense: needs MIN_MODEL_POINTS points, 3+
 * distinct depths, a positive slope, and a positive floor (spec, Build §2).
 *
 * Then one leave-one-out check, because the median of slopes is only robust
 * while the honest points supply most of the pairs. Same-depth pairs are
 * skipped, so a day whose solo orders sit at two depths near the point floor
 * contributes almost none — and a single forgotten card out at a third,
 * extreme depth can own the majority and drag the median to itself. A fit
 * whose slope halves or doubles when one point leaves is a fit that point
 * owns; publishing it would let that card mask itself from the stranded flag
 * AND corrupt the per-order-ahead number the dashboard prints. Returning null
 * is honest degradation: the UI's "too few solo-served orders" branch already
 * covers it. One validation pass, never refit to convergence — the check runs
 * once and never re-flags.
 */
export function fitFloorAndLine(
  points: { depth: number; waitSeconds: number }[]
): QueueModel | null {
  const model = theilSen(points)
  if (!model) return null

  let worstIndex = 0
  let worstResidual = -1
  for (let i = 0; i < points.length; i++) {
    const residual = Math.abs(
      points[i].waitSeconds - (model.floorSeconds + model.perDrinkSeconds * points[i].depth)
    )
    if (residual > worstResidual) {
      worstResidual = residual
      worstIndex = i
    }
  }

  const withoutWorst = theilSen(points.filter((_, i) => i !== worstIndex))
  if (!withoutWorst) return null
  const slope = model.perDrinkSeconds
  const looSlope = withoutWorst.perDrinkSeconds
  if (looSlope > FIT_STABILITY_FACTOR * slope || looSlope < slope / FIT_STABILITY_FACTOR)
    return null
  return model
}

/** The fit itself, with its own guards. Called twice: once whole, once leave-one-out. */
function theilSen(points: { depth: number; waitSeconds: number }[]): QueueModel | null {
  if (points.length < MIN_MODEL_POINTS) return null
  if (new Set(points.map((p) => p.depth)).size < 3) return null
  const pairSlopes: number[] = []
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const depthGap = points[j].depth - points[i].depth
      if (depthGap === 0) continue // same depth says nothing about the slope
      pairSlopes.push((points[j].waitSeconds - points[i].waitSeconds) / depthGap)
    }
  }
  // Unreachable given 3+ distinct depths, but the fit must never divide by hope.
  if (pairSlopes.length === 0) return null
  const slope = percentile(pairSlopes, 50) as number
  const intercept = percentile(
    points.map((p) => p.waitSeconds - slope * p.depth),
    50
  ) as number
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

/**
 * Median model residual per segment, over clean SOLO orders only — held groups
 * are excluded even though they are not suspect. A group's drinks sit on the
 * pass by choice; that wait is deliberate holding cost, groupCost's subject,
 * and charging it to whatever the group happened to order invents a slow drink
 * (a Cortado trio held 15 minutes reads "+755s slower" with identical prep).
 *
 * Known and accepted: a depth-only model cannot separate drink speed from
 * when-in-the-event effects, so a drink ordered mostly at the end of a rush
 * carries some of that rush in its number. These are relative deltas against
 * the day's own average, not build times (spec, stay-simple decision).
 */
function segmentComparisons(
  soloClean: ClassifiedOrder[],
  model: QueueModel | null,
  keyOf: (o: ClassifiedOrder) => string | null
): SegmentComparison[] {
  if (!model) return []
  const groups = new Map<string, number[]>()
  for (const o of soloClean) {
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
  // Comparisons narrow further: solo orders only, so a held group's deliberate
  // holding cost lands on groupCost and never on the drink it was ordering.
  const soloClean = classified.filter((o) => o.tag === 'servedAlone' && !o.stranded)

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
      // Two ways to have nothing to say: no suspects at all (nothing to
      // subtract), or too few survivors to make a p90 mean anything. A
      // mostly-suspect day lands on the second, and the caption says so.
      counterfactualP90Seconds:
        sweepCount + strandedCount > 0 && clean.length >= MIN_COUNTERFACTUAL_ORDERS
          ? percentile(
              clean.map((o) => o.waitSeconds),
              90
            )
          : null,
    },
    model,
    groupCost: groupCost(classified, model),
    perDrink: segmentComparisons(soloClean, model, (o) => o.item),
    byTemperature: segmentComparisons(soloClean, model, (o) => o.temperature),
  }
}
