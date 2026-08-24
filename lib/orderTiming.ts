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
