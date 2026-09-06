# Customer Wait Times Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure each order's real wait (placed → drink in hand), classify group holds vs forgotten bumps, and present p90-headlined wait analytics on the admin dashboard.

**Architecture:** A Postgres trigger owns two new timestamp columns so both ends of every measurement come from one clock. A pure, fully unit-tested module (`lib/orderTiming.ts`) does all classification and statistics. The admin stats route gains a bounded query and a `timing` block; a new `WaitTimingSection` component renders three cards. The kitchen display gains zero behaviour — two correctness edits only.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + trigger), TypeScript, Tailwind, Framer Motion, Vitest (new, dev-only).

**Spec:** `docs/specs/2026-08-23-customer-wait-times-design.md` — the plan argues from the spec; executors read both. The spec's "Decisions" section is owner-approved and non-negotiable.

## Global Constraints

- **No charting library.** Every visual is a number or a CSS bar. No new runtime dependencies at all; Vitest is dev-only.
- **`/kitchen` gains no behaviour.** Only the two correctness edits in Task 9. Nothing else under the kitchen path changes.
- **Nothing is ever excluded from the headline numbers.** Suspect orders are counted and captioned, never dropped.
- **Segment labels are "served together" / "served alone"** — never "group"/"solo" in code or UI copy (spec: describes what the data shows, not a social assumption).
- **No shame framing** in any copy. The confidence sentence is a data-quality readout, not a scolding.
- **No em dashes anywhere in UI copy** (owner directive, Aug 23). Rephrase with commas, periods, or "and". The en dash in numeric ranges ("3–6m") is a range mark, not punctuation, and stays.
- **Timing is always scoped to a single event date.** Never average waits across events.
- **Build time is never displayed.** Per-drink figures are always relative at matched queue depth.
- **Brand:** card shell `bg-white rounded-xl p-4 md:p-6 border border-delo-navy/10`; headings `font-bricolage font-semibold text-sm uppercase tracking-wider text-delo-navy/60`; `tabular-nums` on every number.
- **Chart colors (owner-approved at the mockup gate, Aug 23):** three new Tailwind tokens in `tailwind.config.ts` — `'delo-chart-fast': '#3D7E2F'`, `'delo-chart-mid': '#C18A1F'`, `'delo-chart-slow': '#AE3A1E'` — validated CVD-safe steps of the brand's sage/gold/terracotta hue families. The raw `delo-sage`/`delo-gold` tokens FAIL colorblind and normal-vision separation as adjacent fills (ΔE 11.4) and must not be used for the bar or the delta text; the chart tokens also clear AA contrast for small semibold text where the raw tokens do not.
- **Commits:** short imperative sentence (repo style, no `feat:` prefixes), formatted with `npx prettier --write` on touched files first, ending with:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Crdty7xkVxeatnkdLnKJx4
  ```
- **Branch:** all work on `customer-wait-times` (already created; spec is its first commit).

## Execution Strategy (orchestrator notes)

Fresh subagent per task via superpowers:subagent-driven-development. Effort per task: Tasks 3, 4, 5, 7 → `xhigh`; Tasks 2, 6, 8 → default; Tasks 1, 9, 10 → `low`. Review lenses in Task 11 run on `fable` model. CLAUDE.md's `/feature-dev` gate (feature touching 3+ files + DB change) is satisfied by the spec + this plan: its explore and architect phases ran as the brainstorming research pass and the owner-approved design — do not re-run it as a separate workflow. All other skill gates are embedded as explicit steps inside tasks — executors must not skip them:

| Where | Skill |
|---|---|
| Task 1, before writing SQL | `supabase:supabase-postgres-best-practices` |
| Tasks 2–6 | `superpowers:test-driven-development` discipline throughout |
| Task 7, before editing the route | `vercel:nextjs` (route handler conventions check) |
| Before Task 8 (orchestrator-led) | `design` — canvas mockup of the three cards; **owner reviews before any UI code** |
| Task 8, before writing UI | `frontend-design:frontend-design`, `dataviz`, AND `emil-design-eng` |
| Task 8, after UI compiles | `make-interfaces-feel-better` |
| Task 9, after last component edit | `vercel:react-best-practices` |
| Task 11 | Workflow multi-lens review, `/simplify`, `userinterface-wiki` + `audit-typography`, `superpowers:verification-before-completion`, owner gate, `commit-commands:commit-push-pr` |

---

### Task 1: Schema — columns, trigger, backfill, types

**Files:**
- Modify: `lib/supabase.ts:42-54` (Order interface)
- Modify: `TECHNICAL.md` (orders CREATE TABLE block ~line 115, Schema Notes ~line 133)
- No app code depends on the SQL being applied yet — types are safe to land first.

**Interfaces:**
- Consumes: nothing.
- Produces: `Order` gains `started_at: string | null` and `ready_at: string | null`. Every later task relies on these exact names and nullability.

- [ ] **Step 1: Load the Postgres skill**

Invoke `supabase:supabase-postgres-best-practices` before writing any SQL. Check the trigger below against its rules; adjust only if the skill flags a genuine problem, and note any change in the commit message.

- [ ] **Step 2: Update the Order type**

In `lib/supabase.ts`, change the `Order` interface (currently lines 42-54) to:

```ts
export interface Order {
  id: string
  customer_name: string
  item: string
  modifiers: {
    milk?: string
    temperature?: string
  }
  status: OrderStatus
  claimed_by: string | null
  created_at: string
  updated_at: string
  /** Set by DB trigger on first claim (multi-barista only); cleared on return to queue. */
  started_at: string | null
  /** Set by DB trigger when marked ready; cleared on return to queue. Source of truth for wait timing. */
  ready_at: string | null
}
```

- [ ] **Step 3: Run the typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (columns are additive; nothing reads them yet).

- [ ] **Step 4: Update TECHNICAL.md schema**

In the `CREATE TABLE orders` block, after `updated_at TIMESTAMPTZ DEFAULT now()`, add:

```sql
  started_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ
```

After the schema notes bullet about `claimed_by`, add:

```markdown
- `started_at` / `ready_at` are **server-owned**: a `BEFORE UPDATE` trigger
  (`set_order_timestamps`) ignores client-sent values and stamps them from
  Postgres's clock — `created_at` also comes from Postgres, so wait durations
  never subtract two different clocks (`updated_at` is a Vercel function's
  clock and drifts). `ready_at` is set on transition to `ready`, `started_at`
  on first claim; both are cleared on any return to `placed`, so a remade
  drink measures the remake. The trigger also makes the columns forgery-proof
  despite the public-UPDATE RLS policy (backlog #1).
```

- [ ] **Step 5: Apply the migration**

Present this SQL to the owner to run in the Supabase SQL editor (project `wryykcdqojftbqgtxpgu`), or apply it via the Supabase MCP connection if authenticated. **Pause until applied** — Tasks 2–6 can proceed without it, but flag it as pending.

```sql
ALTER TABLE orders
  ADD COLUMN started_at TIMESTAMPTZ,
  ADD COLUMN ready_at   TIMESTAMPTZ;

-- Backfill BEFORE installing the trigger: the trigger resets client-written
-- values, and would swallow this UPDATE (learned the hard way at apply time).
-- Backfill (spec Decision 10): correct, not a guess — the only write path
-- always sets a status, so no code path edits a ready order without moving it.
UPDATE orders SET ready_at = updated_at WHERE status = 'ready';

CREATE OR REPLACE FUNCTION set_order_timestamps() RETURNS trigger AS $$
BEGIN
  -- Server-owned columns. Ignore whatever the client sent, then apply
  -- transitions. `orders` still allows public UPDATE (backlog #1), so this
  -- is the only thing making these numbers forgery-resistant.
  NEW.started_at := OLD.started_at;
  NEW.ready_at   := OLD.ready_at;

  IF NEW.status = 'in_progress' AND OLD.status IS DISTINCT FROM 'in_progress' THEN
    NEW.started_at := COALESCE(OLD.started_at, now());   -- first claim wins
  END IF;

  IF NEW.status = 'ready' AND OLD.status IS DISTINCT FROM 'ready' THEN
    NEW.ready_at := now();
  END IF;

  IF NEW.status = 'placed' THEN
    NEW.started_at := NULL;   -- back to the queue: the old measurement is void,
    NEW.ready_at   := NULL;   -- mirroring how claimed_by is cleared in the PATCH route
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_timestamps
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_order_timestamps();

CREATE INDEX idx_orders_created_at_status ON orders(created_at DESC, status);
```

- [ ] **Step 6: Verify the migration (once applied)**

Run in the SQL editor:

```sql
-- 1. Backfill coverage: every ready order has ready_at
SELECT count(*) FROM orders WHERE status = 'ready' AND ready_at IS NULL;  -- expect 0
-- 2. Trigger fires: flip any test order and check
UPDATE orders SET status = 'ready' WHERE id = (SELECT id FROM orders WHERE status != 'ready' LIMIT 1) RETURNING id, status, ready_at;  -- ready_at is now()
UPDATE orders SET status = 'placed' WHERE id = '<that id>' RETURNING ready_at, started_at;  -- both NULL
```

Restore the test order to its original status afterwards.

- [ ] **Step 7: Commit**

```bash
npx prettier --write lib/supabase.ts
git add lib/supabase.ts TECHNICAL.md
git commit -m "Add server-owned started_at/ready_at timestamps to orders"
```

---

### Task 2: Vitest + orderTiming scaffolding + queueDepthAt

**Files:**
- Create: `vitest.config.ts`, `lib/orderTiming.ts`, `lib/orderTiming.test.ts`
- Modify: `package.json` (devDependency + scripts)

**Interfaces:**
- Consumes: nothing (pure module; deliberately does NOT import from `lib/supabase.ts`).
- Produces (later tasks rely on these exact names):
  - `interface TimedOrderInput { id: string; item: string; status: string; created_at: string; ready_at: string | null; modifiers: { temperature?: string } | null }`
  - `queueDepthAt(orders: TimedOrderInput[], instantIso: string): number`
  - `percentile(values: number[], p: number): number | null`
  - Constants: `READY_CLUSTER_SECONDS = 30`, `PLACED_CLUSTER_SECONDS = 180`, `BUCKET_FAST_SECONDS = 180`, `BUCKET_SLOW_SECONDS = 360`, `MIN_TIMED_ORDERS = 10`, `MIN_MODEL_POINTS = 8`, `MIN_STRANDED_OVERSHOOT_SECONDS = 120`, `STRANDED_RESIDUAL_MULTIPLIER = 3`, `MIN_SEGMENT_ORDERS = 3`

- [ ] **Step 1: Install Vitest and wire scripts**

```bash
npm install -D vitest
```

Add to `package.json` scripts (after `"lint"`): `"test": "vitest run", "test:watch": "vitest"`.

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

// Dev-only. Scoped to lib/ — component testing stays manual per project convention.
export default defineConfig({
  test: { include: ['lib/**/*.test.ts'], environment: 'node' },
})
```

- [ ] **Step 2: Write the failing tests**

Create `lib/orderTiming.test.ts`:

```ts
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
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test`
Expected: FAIL — `./orderTiming` has no exports.

- [ ] **Step 4: Implement**

Create `lib/orderTiming.ts`:

```ts
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
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
npx prettier --write vitest.config.ts lib/orderTiming.ts lib/orderTiming.test.ts package.json
git add vitest.config.ts lib/orderTiming.ts lib/orderTiming.test.ts package.json package-lock.json
git commit -m "Add Vitest and the first timing primitives: percentile and queue depth"
```

---

### Task 3: classifyOrders — held groups vs sweeps vs alone

**Files:**
- Modify: `lib/orderTiming.ts`, `lib/orderTiming.test.ts`

**Interfaces:**
- Consumes: `TimedOrderInput`, `percentile`, constants from Task 2.
- Produces:
  - `type WaitTag = 'servedAlone' | 'servedTogether' | 'sweep'`
  - `interface ClassifiedOrder { id: string; item: string; temperature: string | null; placedMs: number; readyMs: number; waitSeconds: number; queueDepth: number; tag: WaitTag; stranded: boolean }`
  - `interface QueueModel { floorSeconds: number; perDrinkSeconds: number }`
  - `interface ClassificationResult { orders: ClassifiedOrder[]; model: QueueModel | null }`
  - `classifyOrders(orders: TimedOrderInput[]): ClassificationResult`
  - In THIS task `model` is always `null` (stub); Task 4 makes it real. `stranded` is always `false` until Task 4.

- [ ] **Step 1: Write the failing tests**

Append to `lib/orderTiming.test.ts`:

```ts
// Extend the existing './orderTiming' import rather than adding a second statement:
import { classifyOrders } from './orderTiming'

describe('classifyOrders — the discriminator', () => {
  it('a held group: placements close, completions close → servedTogether, never suspect', () => {
    // Three friends order over 2 minutes; all drinks handed over together.
    // This is the regression test for the mistake the spec exists to correct:
    // batching is service, not noise.
    const { orders } = classifyOrders([order(0, 400), order(60, 410), order(120, 420)])
    expect(orders.map((o) => o.tag)).toEqual([
      'servedTogether',
      'servedTogether',
      'servedTogether',
    ])
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — `classifyOrders` is not exported.

- [ ] **Step 3: Implement**

Append to `lib/orderTiming.ts`:

```ts
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
    const gapMs = i < measurable.length ? measurable[i].readyMs - measurable[i - 1].readyMs : Infinity
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
  }

  return { orders: measurable, model: null } // model arrives in the stranded pass (Task 4)
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: PASS (all tests including Task 2's).

- [ ] **Step 5: Commit**

```bash
npx prettier --write lib/orderTiming.ts lib/orderTiming.test.ts
git add lib/orderTiming.ts lib/orderTiming.test.ts
git commit -m "Classify held groups, catch-up sweeps, and solo orders from timestamps"
```

---

### Task 4: Queue model fit + stranded cards

**Files:**
- Modify: `lib/orderTiming.ts`, `lib/orderTiming.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–3.
- Produces:
  - `fitFloorAndLine(points: { depth: number; waitSeconds: number }[]): QueueModel | null`
  - `classifyOrders` now returns a real `model` and sets `stranded` flags.

- [ ] **Step 1: Write the failing tests**

Append to `lib/orderTiming.test.ts`:

```ts
// Extend the existing './orderTiming' import rather than adding a second statement:
import { fitFloorAndLine, MIN_MODEL_POINTS } from './orderTiming'

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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — `fitFloorAndLine` not exported; stranded assertions fail.

- [ ] **Step 3: Implement**

Append `fitFloorAndLine` to `lib/orderTiming.ts`:

```ts
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
```

Then, in `classifyOrders`, replace the final line

```ts
  return { orders: measurable, model: null } // model arrives in the stranded pass (Task 4)
```

with:

```ts
  // Stranded pass. The ordering is load-bearing and runs exactly once (spec):
  // 1. tag clusters from timestamps alone (done above);
  // 2. fit on servedAlone only — sweeps and held groups must not shape the line;
  // 3. flag residuals once; never refit, which would slowly eat the legitimate tail.
  const alone = measurable.filter((o) => o.tag === 'servedAlone')
  const model = fitFloorAndLine(
    alone.map((o) => ({ depth: o.queueDepth, waitSeconds: o.waitSeconds }))
  )
  if (model) {
    const residualOf = (o: ClassifiedOrder) =>
      o.waitSeconds - (model.floorSeconds + model.perDrinkSeconds * o.queueDepth)
    const medianAbsResidual = percentile(alone.map((o) => Math.abs(residualOf(o))), 50) ?? 0
    const threshold = Math.max(
      STRANDED_RESIDUAL_MULTIPLIER * medianAbsResidual,
      MIN_STRANDED_OVERSHOOT_SECONDS
    )
    for (const o of measurable) {
      // Held groups are real waits by definition — long is only suspicious
      // when nothing explains it.
      if (o.tag !== 'servedTogether' && residualOf(o) > threshold) o.stranded = true
    }
  }

  return { orders: measurable, model }
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx prettier --write lib/orderTiming.ts lib/orderTiming.test.ts
git add lib/orderTiming.ts lib/orderTiming.test.ts
git commit -m "Fit the queue model and flag stranded cards against it"
```

---

### Task 5: groupCost + summarize

**Files:**
- Modify: `lib/orderTiming.ts`, `lib/orderTiming.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–4.
- Produces (Task 7 serializes this verbatim; Task 8 renders it):

```ts
export interface GroupCost {
  quietMedianSeconds: number | null
  busyMedianSeconds: number | null
}
export interface SegmentComparison {
  name: string
  count: number
  deltaSeconds: number // median residual vs the model at matched depth; + = slower
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
    counterfactualP90Seconds: number | null // null when nothing is suspect
  }
  model: QueueModel | null
  groupCost: GroupCost | null
  perDrink: SegmentComparison[]
  byTemperature: SegmentComparison[]
}
export function groupCost(classified: ClassifiedOrder[], model: QueueModel | null): GroupCost | null
export function summarize(orders: TimedOrderInput[]): TimingSummary | null
```

- [ ] **Step 1: Write the failing tests**

Append to `lib/orderTiming.test.ts`:

```ts
// Extend the existing './orderTiming' import at the top of the file rather than
// adding a second import statement:
import { groupCost, summarize, ClassifiedOrder } from './orderTiming'

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
    ...overrides,
  }
}

describe('groupCost', () => {
  const model = { floorSeconds: 120, perDrinkSeconds: 60 }
  it('splits the holding cost by congestion at placement', () => {
    const orders = [
      // Six alones spread across depths so the event's median depth is 3
      ...[0, 1, 2, 4, 5, 6].map((d) => classified({ queueDepth: d, waitSeconds: 120 + 60 * d })),
      // Held pair when quiet (depth 1, predicted 180): cost 120 each
      classified({ tag: 'servedTogether', queueDepth: 1, waitSeconds: 300 }),
      classified({ tag: 'servedTogether', queueDepth: 1, waitSeconds: 300 }),
      // Held pair when slammed (depth 5, predicted 420): cost 280 each
      classified({ tag: 'servedTogether', queueDepth: 5, waitSeconds: 700 }),
      classified({ tag: 'servedTogether', queueDepth: 5, waitSeconds: 700 }),
    ]
    const cost = groupCost(orders, model)
    expect(cost).toEqual({ quietMedianSeconds: 120, busyMedianSeconds: 280 })
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
    expect(summarize(Array.from({ length: 12 }, () => order(0, null, { status: 'canceled' })))).toBeNull()
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — `groupCost` / `summarize` not exported.

- [ ] **Step 3: Implement**

Append to `lib/orderTiming.ts`:

```ts
export interface GroupCost {
  quietMedianSeconds: number | null
  busyMedianSeconds: number | null
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
  const medianDepth = percentile(classified.map((o) => o.queueDepth), 50) ?? 0
  const costOf = (o: ClassifiedOrder) =>
    o.waitSeconds - (model.floorSeconds + model.perDrinkSeconds * o.queueDepth)
  return {
    quietMedianSeconds: percentile(
      together.filter((o) => o.queueDepth < medianDepth).map(costOf),
      50
    ),
    busyMedianSeconds: percentile(
      together.filter((o) => o.queueDepth >= medianDepth).map(costOf),
      50
    ),
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
    const residual = o.waitSeconds - (model.floorSeconds + model.perDrinkSeconds * o.queueDepth)
    groups.set(key, [...(groups.get(key) ?? []), residual])
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
      p90Seconds: percentile(alone.map((o) => o.waitSeconds), 90),
    },
    servedTogether: {
      count: together.length,
      p90Seconds: percentile(together.map((o) => o.waitSeconds), 90),
    },
    suspect: {
      sweepCount,
      strandedCount,
      counterfactualP90Seconds:
        sweepCount + strandedCount > 0
          ? percentile(clean.map((o) => o.waitSeconds), 90)
          : null,
    },
    model,
    groupCost: groupCost(classified, model),
    perDrink: segmentComparisons(clean, model, (o) => o.item),
    byTemperature: segmentComparisons(clean, model, (o) => o.temperature),
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: PASS. If the `counterfactualP90Seconds` assertion fails on an off-by-one in the sweep fixture, check the nearest-rank math by hand before touching thresholds — the fixture's 12 clean waits are all exactly 150.

- [ ] **Step 5: Commit**

```bash
npx prettier --write lib/orderTiming.ts lib/orderTiming.test.ts
git add lib/orderTiming.ts lib/orderTiming.test.ts
git commit -m "Summarize waits: buckets, segments, group cost, and the honest counterfactual"
```

---

### Task 5b: Group sizes + distinct suspect count (gate-approved extension)

Added at the mockup gate (owner-approved, Aug 23) plus the routing of Task 5's review
finding. Two concerns, one module touch: (a) `TimingSummary.suspect` gives consumers no
distinct suspect count — `sweepCount + strandedCount` double-counts an order that is both;
(b) the owner approved group-size cost buckets (2 / 3 / 4+) with a minimum-count guard and
a combined-row fallback, replacing the displayed quiet/busy split (which stays computed).

**Files:**
- Modify: `lib/orderTiming.ts`, `lib/orderTiming.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–5.
- Produces (Task 7 serializes, Task 8 renders — exact names):
  - `ClassifiedOrder` gains `groupSize: number | null` — for `servedTogether` members, the
    number of servedTogether members in their completion cluster (always ≥ 2); null otherwise.
  - `interface GroupSizeCost { size: 2 | 3 | 4; count: number; medianSeconds: number }` —
    `size: 4` means "4+".
  - `GroupCost` gains `overallMedianSeconds: number` and `bySize: GroupSizeCost[]`
    (quiet/busy fields remain, computed, undisplayed).
  - `TimingSummary.suspect` gains `suspectCount: number` — the DISTINCT count of orders
    that are sweep, stranded, or both. Task 8's confidence copy uses this, never the sum.
  - Module-level `residualAgainst(model: QueueModel, o: ClassifiedOrder): number` replaces
    the three duplicated residual closures (review minor).

- [ ] **Step 1: Write the failing tests**

Append to `lib/orderTiming.test.ts` (extend the existing `./orderTiming` import):

```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — `groupSize` / `bySize` / `suspectCount` missing.

- [ ] **Step 3: Implement**

In `lib/orderTiming.ts`:

1. Add `groupSize: number | null` to `ClassifiedOrder` (doc comment: "servedTogether
   members: how many were handed over together; null otherwise") and initialize `groupSize:
   null` in the mapper.
2. In the cluster-tagging loop, after tagging a cluster's members, set sizes:

```ts
    const togetherMembers = cluster.filter((m) => m.tag === 'servedTogether')
    for (const member of togetherMembers) member.groupSize = togetherMembers.length
```

3. Extract the shared residual helper and use it in all three sites (stranded pass,
   `groupCost`, `segmentComparisons`):

```ts
/** Seconds beyond what the queue model predicts for this order's depth. Positive = slower. */
function residualAgainst(model: QueueModel, o: ClassifiedOrder): number {
  return o.waitSeconds - (model.floorSeconds + model.perDrinkSeconds * o.queueDepth)
}
```

4. Extend `GroupCost` / add `GroupSizeCost` exactly as the Interfaces block above; in
   `groupCost()` add:

```ts
  const costs = together.map((o) => residualAgainst(model, o))
  const bySize: GroupSizeCost[] = ([2, 3, 4] as const)
    .map((size) => {
      const members = together.filter((o) =>
        size === 4 ? (o.groupSize ?? 0) >= 4 : o.groupSize === size
      )
      return {
        size,
        count: members.length,
        medianSeconds: percentile(members.map((o) => residualAgainst(model, o)), 50) ?? 0,
      }
    })
    .filter((bucket) => bucket.count >= MIN_SEGMENT_ORDERS)
```

   and return `{ overallMedianSeconds: percentile(costs, 50) as number, quietMedianSeconds,
   busyMedianSeconds, bySize }` (quiet/busy computed as before).
5. In `summarize()`, add to the suspect block:
   `suspectCount: classified.length - clean.length` (distinct by construction), keeping
   `sweepCount`/`strandedCount`.
6. Fix the Task 5 fixture comment that claims "the event's median depth is 3" (nearest-rank
   gives 2 for that data; the test is unaffected either way — say so in the comment), and
   add a one-line comment on the counterfactual noting the all-suspect edge also yields
   null via `percentile([], 90)`.

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: PASS — all suites, including Tasks 2–5's 26.

- [ ] **Step 5: Commit**

```bash
npx prettier --write lib/orderTiming.ts lib/orderTiming.test.ts
git add lib/orderTiming.ts lib/orderTiming.test.ts
git commit -m "Bucket group costs by size and count suspects distinctly"
```

---

### Task 6: dateUtils — utcRangeForLocalDay + formatDuration

**Files:**
- Modify: `lib/dateUtils.ts`
- Create: `lib/dateUtils.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `utcRangeForLocalDay(dateStr: string, timeZone: string): { startIso: string; endIso: string }` — Task 7's query bounds.
  - `formatDuration(totalSeconds: number): string` — Task 8's display formatter. `formatPrepTime` now delegates to it; its behaviour must not change.

- [ ] **Step 1: Write the failing tests**

Create `lib/dateUtils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { utcRangeForLocalDay, formatDuration, formatPrepTime } from './dateUtils'

describe('utcRangeForLocalDay', () => {
  it('LA summer day (PDT, UTC-7)', () => {
    expect(utcRangeForLocalDay('2026-08-23', 'America/Los_Angeles')).toEqual({
      startIso: '2026-08-23T07:00:00.000Z',
      endIso: '2026-08-24T07:00:00.000Z',
    })
  })
  it('LA winter day (PST, UTC-8)', () => {
    expect(utcRangeForLocalDay('2026-01-15', 'America/Los_Angeles')).toEqual({
      startIso: '2026-01-15T08:00:00.000Z',
      endIso: '2026-01-16T08:00:00.000Z',
    })
  })
  it('spring-forward day starts in PST and ends in PDT', () => {
    expect(utcRangeForLocalDay('2026-03-08', 'America/Los_Angeles')).toEqual({
      startIso: '2026-03-08T08:00:00.000Z',
      endIso: '2026-03-09T07:00:00.000Z',
    })
  })
  it('UTC is the identity', () => {
    expect(utcRangeForLocalDay('2026-08-23', 'UTC')).toEqual({
      startIso: '2026-08-23T00:00:00.000Z',
      endIso: '2026-08-24T00:00:00.000Z',
    })
  })
})

describe('formatDuration', () => {
  it('matches the formatPrepTime formats', () => {
    expect(formatDuration(0)).toBe('< 1s')
    expect(formatDuration(45)).toBe('45s')
    expect(formatDuration(180)).toBe('3m')
    expect(formatDuration(150)).toBe('2m 30s')
    expect(formatDuration(-5)).toBe('< 1s') // clamps like formatPrepTime
  })
  it('formatPrepTime still behaves identically after delegating', () => {
    expect(formatPrepTime('2026-08-23T17:00:00Z', '2026-08-23T17:02:30Z')).toBe('2m 30s')
    expect(formatPrepTime('2026-08-23T17:00:00Z', '2026-08-23T16:59:00Z')).toBe('< 1s')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — `utcRangeForLocalDay` / `formatDuration` not exported.

- [ ] **Step 3: Implement**

In `lib/dateUtils.ts`, replace the body of `formatPrepTime` (keep its doc comment) and add the new functions:

```ts
/**
 * Format a duration in seconds as a compact string: "2m 30s", "45s", "3m".
 * Clamps negatives to zero for clock-skew safety.
 */
export function formatDuration(totalSeconds: number): string {
  const rounded = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(rounded / 60)
  const seconds = rounded % 60

  if (rounded === 0) return '< 1s'
  if (minutes === 0) return `${seconds}s`
  if (seconds === 0) return `${minutes}m`
  return `${minutes}m ${seconds}s`
}

export function formatPrepTime(createdAt: string, updatedAt: string): string {
  return formatDuration((new Date(updatedAt).getTime() - new Date(createdAt).getTime()) / 1000)
}

/**
 * The UTC instants bounding a local calendar day in an arbitrary IANA zone —
 * lets the stats route query `created_at >= startIso AND < endIso` instead of
 * fetching everything and string-filtering per row. Pure and parameterised by
 * zone (unlike the module's cached device-zone formatters), so it's testable.
 *
 * Method: guess the instant, read it back in the target zone, correct by the
 * difference; run the correction twice so a DST shift between guess and answer
 * lands exactly.
 */
export function utcRangeForLocalDay(
  dateStr: string,
  timeZone: string
): { startIso: string; endIso: string } {
  const [y, m, d] = dateStr.split('-').map(Number)
  const nextDay = new Date(Date.UTC(y, m - 1, d + 1))
  const nextDayStr = `${nextDay.getUTCFullYear()}-${String(nextDay.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDay.getUTCDate()).padStart(2, '0')}`
  return {
    startIso: utcInstantForLocalMidnight(dateStr, timeZone).toISOString(),
    endIso: utcInstantForLocalMidnight(nextDayStr, timeZone).toISOString(),
  }
}

function utcInstantForLocalMidnight(dateStr: string, timeZone: string): Date {
  const wallClockFmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const correct = (guess: Date): Date => {
    const parts = Object.fromEntries(
      wallClockFmt.formatToParts(guess).map((p) => [p.type, p.value])
    )
    const asIfUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    )
    const target = Date.parse(`${dateStr}T00:00:00Z`)
    return new Date(guess.getTime() + (target - asIfUtc))
  }
  // Two passes: the first can be off across a DST boundary; the second lands.
  return correct(correct(new Date(`${dateStr}T00:00:00Z`)))
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx prettier --write lib/dateUtils.ts lib/dateUtils.test.ts
git add lib/dateUtils.ts lib/dateUtils.test.ts
git commit -m "Add timezone-exact day bounds and a shared duration formatter"
```

---

### Task 7: Stats route — bound the query, add the timing block

**Files:**
- Modify: `app/api/admin/stats/route.ts` (full rewrite of the handler body)
- Modify: `lib/supabase.ts` (DashboardStats gains `timing`)

**Interfaces:**
- Consumes: `summarize`, `TimingSummary`, `MIN_TIMED_ORDERS`, `TimedOrderInput` from `lib/orderTiming.ts`; `utcRangeForLocalDay` from `lib/dateUtils.ts`.
- Produces: the JSON response gains `timing: TimingStats | null`. In `lib/supabase.ts`:

```ts
import type { TimingSummary } from './orderTiming'

export interface TimingStats extends TimingSummary {
  previousEvent: { date: string; p90Seconds: number } | null
}
// DashboardStats gains: timing: TimingStats | null
```

- [ ] **Step 1: Check route conventions**

Invoke `vercel:nextjs` and confirm the rewrite below follows current App Router route-handler guidance (dynamic flag, Promise.all fan-out, error shape). Adjust only on genuine conflicts.

- [ ] **Step 2: Add the types**

In `lib/supabase.ts`, add `import type { TimingSummary } from './orderTiming'` at the top, add the `TimingStats` interface after `ModifierOption`, and add `timing: TimingStats | null` to `DashboardStats`.

- [ ] **Step 3: Rewrite the route**

Replace the body of `GET` in `app/api/admin/stats/route.ts` with (imports at top: add `summarize` and `TimedOrderInput` from `@/lib/orderTiming`, and `utcRangeForLocalDay` from `@/lib/dateUtils` — import nothing that isn't referenced):

```ts
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const timezone = searchParams.get('timezone') || 'America/Los_Angeles'
    const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone })
    const today = dateFmt.format(new Date())
    const targetDate = searchParams.get('date') || today
    const isViewingToday = targetDate === today
    const { startIso, endIso } = utcRangeForLocalDay(targetDate, timezone)

    // Bounded queries only. The old select-everything shape silently truncated
    // at PostgREST's 1,000-row default — timing math on a quietly truncated
    // dataset produces confidently wrong numbers (spec, Build §3).
    const ORDER_COLUMNS = 'id, item, modifiers, status, created_at, ready_at, claimed_by'
    const STATUSES = ['placed', 'in_progress', 'ready', 'canceled'] as const

    const [targetRes, trendRes, ...countResults] = await Promise.all([
      supabase
        .from('orders')
        .select(ORDER_COLUMNS)
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .order('created_at', { ascending: true })
        .limit(1000),
      // All-time trends when viewing today (existing quirk, deliberately kept —
      // backlog #9's business). Newest-first so an explicit cap keeps recent
      // events rather than the oldest.
      isViewingToday
        ? supabase
            .from('orders')
            .select('item, modifiers')
            .order('created_at', { ascending: false })
            .limit(5000)
        : Promise.resolve({ data: null, error: null }),
      ...STATUSES.map((status) =>
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', status)
          .lt('created_at', endIso)
      ),
    ])

    if (targetRes.error) throw targetRes.error
    if (trendRes.error) throw trendRes.error
    const targetDateOrders = targetRes.data || []

    const countByStatus = (orderList: { status: string }[]) => {
      return orderList.reduce(
        (acc, order) => {
          acc.total++
          if (order.status === 'placed') acc.placed++
          else if (order.status === 'in_progress') acc.in_progress++
          else if (order.status === 'ready') acc.ready++
          else if (order.status === 'canceled') acc.canceled++
          return acc
        },
        { total: 0, placed: 0, in_progress: 0, ready: 0, canceled: 0 }
      )
    }

    const allTime = { total: 0, placed: 0, in_progress: 0, ready: 0, canceled: 0 }
    STATUSES.forEach((status, i) => {
      const result = countResults[i]
      if (result.error) throw result.error
      allTime[status] = result.count ?? 0
    })
    allTime.total = allTime.placed + allTime.in_progress + allTime.ready + allTime.canceled

    const ordersForTrends = isViewingToday ? trendRes.data || [] : targetDateOrders

    // Popular drinks - group by item name, sort by count
    const drinkCounts: Record<string, number> = {}
    for (const order of ordersForTrends) {
      drinkCounts[order.item] = (drinkCounts[order.item] || 0) + 1
    }

    const popularDrinks = Object.entries(drinkCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)

    // Modifier breakdown - dynamic categories
    const modifierCounts: Record<string, Record<string, number>> = {}

    for (const order of ordersForTrends) {
      if (!order.modifiers) continue

      for (const [category, option] of Object.entries(order.modifiers)) {
        if (!option) continue

        if (!modifierCounts[category]) modifierCounts[category] = {}
        modifierCounts[category][option as string] =
          (modifierCounts[category][option as string] || 0) + 1
      }
    }

    const modifierBreakdown: Record<
      string,
      { option: string; count: number; percentage: number }[]
    > = {}

    for (const [category, options] of Object.entries(modifierCounts)) {
      const total = Object.values(options).reduce((a, b) => a + b, 0)

      modifierBreakdown[category] = Object.entries(options)
        .map(([option, count]) => ({
          option,
          count,
          percentage: Math.round((count / total) * 100),
        }))
        .sort((a, b) => b.count - a.count)
    }

    // Timing — always scoped to the single selected event date.
    const summary = summarize(targetDateOrders as TimedOrderInput[])
    let timing = null
    if (summary) {
      // Previous event, for the headline delta: the most recent order before
      // this day names the date; that day's own summary provides the p90.
      let previousEvent = null
      const probe = await supabase
        .from('orders')
        .select('created_at')
        .lt('created_at', startIso)
        .order('created_at', { ascending: false })
        .limit(1)
      const probeRow = probe.data?.[0]
      if (!probe.error && probeRow) {
        const prevDate = dateFmt.format(new Date(probeRow.created_at))
        const prevRange = utcRangeForLocalDay(prevDate, timezone)
        const prevRes = await supabase
          .from('orders')
          .select(ORDER_COLUMNS)
          .gte('created_at', prevRange.startIso)
          .lt('created_at', prevRange.endIso)
          .limit(1000)
        const prevSummary = prevRes.error
          ? null
          : summarize((prevRes.data || []) as TimedOrderInput[])
        if (prevSummary) {
          previousEvent = { date: prevDate, p90Seconds: prevSummary.p90Seconds }
        }
      }
      timing = { ...summary, previousEvent }
    }

    return NextResponse.json({
      today: countByStatus(targetDateOrders),
      allTime,
      popularDrinks,
      modifierBreakdown,
      timing,
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
```

Keep `export const dynamic = 'force-dynamic'` and the file's doc comment (update the comment's bullet list to mention the timing block).

- [ ] **Step 4: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 5: Verify against the live database (requires Task 1's migration applied)**

Run: `npm run dev`, then:

```bash
curl -s 'http://localhost:3000/api/admin/stats?timezone=America/Los_Angeles' | python3 -m json.tool
curl -s 'http://localhost:3000/api/admin/stats?timezone=America/Los_Angeles&date=<a past event date>' | python3 -m json.tool
```

Expected: `today`/`allTime`/`popularDrinks`/`modifierBreakdown` match the pre-change dashboard for the same dates; `timing` is an object (past event with ≥10 ready orders) or `null` (quiet day); `timing.previousEvent` names the event before the selected one. Cross-check `timing.measured` against the CSV export's ready-order count for that date.

- [ ] **Step 6: Commit**

```bash
npx prettier --write app/api/admin/stats/route.ts lib/supabase.ts
git add app/api/admin/stats/route.ts lib/supabase.ts
git commit -m "Bound the stats queries and serve the wait-timing block"
```

---

### Task 8: WaitTimingSection — the three cards

**Files:**
- Create: `components/WaitTimingSection.tsx`
- Modify: `components/DashboardSection.tsx` (imports; one insertion after the Order Count Cards grid at ~line 288; one skeleton block)
- Modify: `tailwind.config.ts` (three chart tokens per Global Constraints: `'delo-chart-fast': '#3D7E2F'`, `'delo-chart-mid': '#C18A1F'`, `'delo-chart-slow': '#AE3A1E'`, added to the extend.colors block after the secondary palette)

**Interfaces:**
- Consumes: `TimingStats` from `@/lib/supabase`; `formatDuration` from `@/lib/dateUtils`.
- Produces: `export default function WaitTimingSection({ timing, dateLabel }: { timing: TimingStats | null; dateLabel: string })`.

- [ ] **Step 0 (orchestrator, before dispatching this task): Visual mockup gate**

The orchestrator invokes the `design` skill to publish a canvas mocking the three cards with plausible numbers (use the spec's example copy: "9 in 10 within 8m 20s", the bucket bar, the confidence sentence, both Card 2 sentences, a five-drink Card 3). The owner reviews and reacts. Fold their feedback into this task's dispatch prompt as additional constraints. Do not dispatch the implementation subagent until the owner has responded.

- [ ] **Step 1: Load the design skills**

Invoke `frontend-design:frontend-design`, `dataviz`, AND `emil-design-eng` before writing any JSX. The bucket bar and stat layout are dataviz territory; the section must read as Delo, not as a template; Emil's restraint principles govern what motion and decoration to *omit*. The code below is the **functional contract** — copy strings, data displayed, null-handling, and component/prop names are fixed; visual treatment (spacing, hierarchy, motion) should be shaped by the skills and the approved mockup within the Global Constraints.

- [ ] **Step 2: Create the component**

Create `components/WaitTimingSection.tsx`:

```tsx
'use client'

import { TimingStats } from '@/lib/supabase'
import { formatDuration } from '@/lib/dateUtils'

/**
 * Wait analytics for one event day. Three cards: the wait (p90 hero + buckets +
 * confidence sentence), where the wait goes (floor / line / holding cost), and
 * by-drink comparison at matched queue depth. Copy rules (spec, Decisions 5–6):
 * segments are "served together/alone"; suspects are captioned, never excluded;
 * per-drink numbers are relative, never absolute build times; no shame framing.
 */

interface WaitTimingSectionProps {
  timing: TimingStats | null
  dateLabel: string
}

export default function WaitTimingSection({ timing, dateLabel }: WaitTimingSectionProps) {
  if (!timing) {
    return (
      <div className="bg-white rounded-xl p-4 md:p-6 border border-delo-navy/10">
        <h3 className="font-bricolage font-semibold text-sm uppercase tracking-wider text-delo-navy/60 mb-2">
          Order Wait Time
        </h3>
        <p className="text-description text-sm text-pretty">
          Not enough timed orders {dateLabel} to measure waits. Numbers appear once ten
          or more drinks have been marked ready.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 md:space-y-4">
      <WaitHeadlineCard timing={timing} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <WaitBreakdownCard timing={timing} />
        <ByDrinkCard timing={timing} />
      </div>
    </div>
  )
}

/** One adaptive sentence — the entire data-quality surface (spec, Decision 6). */
function confidenceCopy(timing: TimingStats): string {
  const suspectCount = timing.suspect.suspectCount // distinct: never sum sweep + stranded
  if (suspectCount === 0) return `All ${timing.measured} orders look cleanly timed.`
  const counterfactual = timing.suspect.counterfactualP90Seconds
  if (counterfactual !== null && timing.p90Seconds - counterfactual >= 60) {
    return `${suspectCount} orders look marked-ready-late. Without them: ${formatDuration(counterfactual)}.`
  }
  return `${suspectCount} ${suspectCount === 1 ? 'order looks' : 'orders look'} marked-ready-late. Too few to matter.`
}

function formatEventDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function WaitHeadlineCard({ timing }: { timing: TimingStats }) {
  const prev = timing.previousEvent
  const deltaSeconds = prev ? timing.p90Seconds - prev.p90Seconds : null
  const showDelta = deltaSeconds !== null && Math.abs(deltaSeconds) >= 15

  const segments = [
    { label: 'Under 3m', count: timing.buckets.fast, color: 'bg-delo-chart-fast' },
    { label: '3–6m', count: timing.buckets.medium, color: 'bg-delo-chart-mid' },
    { label: 'Over 6m', count: timing.buckets.slow, color: 'bg-delo-chart-slow' },
  ]

  return (
    <div className="bg-white rounded-xl p-4 md:p-6 border border-delo-navy/10">
      <h3 className="font-bricolage font-semibold text-sm uppercase tracking-wider text-delo-navy/60 mb-1 text-balance">
        Order Wait Time
      </h3>
      <p className="font-bricolage font-semibold text-xs uppercase tracking-wider text-delo-navy/50 mt-3">
        90% of orders ready within
      </p>
      <p className="font-bricolage font-bold text-3xl md:text-4xl text-delo-maroon tabular-nums">
        {formatDuration(timing.p90Seconds)}
      </p>
      <p className="font-manrope text-sm text-delo-navy/70 mt-1 tabular-nums">
        Median {formatDuration(timing.medianSeconds)} · {timing.measured} orders
        {showDelta && prev && (
          <span
            className={`ml-2 font-semibold ${deltaSeconds! < 0 ? 'text-delo-chart-fast' : 'text-delo-chart-slow'}`}
          >
            {deltaSeconds! < 0 ? '▼' : '▲'} {formatDuration(Math.abs(deltaSeconds!))}{' '}
            {deltaSeconds! < 0 ? 'faster' : 'slower'} than {formatEventDate(prev.date)}
          </span>
        )}
      </p>

      <div className="flex h-3 rounded-full overflow-hidden bg-delo-navy/10 mt-4">
        {segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <div
              key={s.label}
              className={`${s.color} transition-all duration-500`}
              style={{ width: `${(s.count / timing.measured) * 100}%` }}
            />
          ))}
      </div>
      <div className="flex gap-4 mt-2 flex-wrap">
        {segments.map((s) => (
          <span
            key={s.label}
            className="inline-flex items-center gap-1.5 font-manrope text-sm text-delo-navy/70 tabular-nums"
          >
            <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
            {Math.round((s.count / timing.measured) * 100)}% {s.label.toLowerCase()}
          </span>
        ))}
      </div>

      <p className="text-description text-xs md:text-sm mt-3 text-pretty">
        {confidenceCopy(timing)}
      </p>
    </div>
  )
}

/** One stat row: plain label left, tabular value right. */
function StatRow({
  label,
  value,
  indent = false,
}: {
  label: string
  value: string
  indent?: boolean
}) {
  return (
    <div className={`flex items-center justify-between ${indent ? 'pl-5' : ''}`}>
      <span
        className={`font-manrope text-sm ${indent ? 'text-delo-navy/60' : 'text-delo-navy/80'}`}
      >
        {label}
      </span>
      <span className="font-manrope font-semibold text-sm text-delo-navy tabular-nums">
        {value}
      </span>
    </div>
  )
}

function WaitBreakdownCard({ timing }: { timing: TimingStats }) {
  const { model, groupCost, servedTogether } = timing
  return (
    <div className="bg-white rounded-xl p-4 md:p-6 border border-delo-navy/10">
      <h3 className="font-bricolage font-semibold text-sm uppercase tracking-wider text-delo-navy/60 mb-3 text-balance">
        Wait Time Breakdown
      </h3>
      {model ? (
        <div className="space-y-2">
          <StatRow label="Drink baseline" value={`~${formatDuration(model.floorSeconds)}`} />
          <StatRow label="Per order ahead" value={`+${formatDuration(model.perDrinkSeconds)}`} />
          {groupCost && (
            <>
              <StatRow
                label="Held for a group"
                value={`+${formatDuration(Math.max(0, groupCost.overallMedianSeconds))}`}
              />
              {groupCost.bySize.map((bucket) => (
                <StatRow
                  key={bucket.size}
                  indent
                  label={`Group of ${bucket.size === 4 ? '4+' : bucket.size}`}
                  value={`+${formatDuration(Math.max(0, bucket.medianSeconds))}`}
                />
              ))}
            </>
          )}
          {!groupCost && servedTogether.count === 0 && (
            <p className="text-description text-xs mt-1">No orders were handed over together.</p>
          )}
        </div>
      ) : (
        <p className="text-description text-sm text-pretty">
          Not enough solo-served orders to split the wait yet. Check back after the next
          event.
        </p>
      )}
    </div>
  )
}

function ByDrinkCard({ timing }: { timing: TimingStats }) {
  const hasData = timing.perDrink.length > 0
  return (
    <div className="bg-white rounded-xl p-4 md:p-6 border border-delo-navy/10">
      <h3 className="font-bricolage font-semibold text-sm uppercase tracking-wider text-delo-navy/60 mb-3 text-balance">
        By Drink vs. the Average
      </h3>
      {!hasData ? (
        <p className="text-description text-sm text-pretty">
          Not enough data to compare drinks fairly yet.
        </p>
      ) : (
        <>
          <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2">
            {timing.perDrink.map((drink) => (
              <div key={drink.name} className="flex items-center justify-between">
                <span className="font-manrope text-delo-navy">{drink.name}</span>
                <DeltaChip deltaSeconds={drink.deltaSeconds} />
              </div>
            ))}
          </div>
          {timing.byTemperature.length > 0 && (
            <div className="mt-4 pt-4 border-t border-delo-navy/10 space-y-2">
              {timing.byTemperature.map((temp) => (
                <div key={temp.name} className="flex items-center justify-between">
                  <span className="font-manrope text-sm text-delo-navy/70">{temp.name}</span>
                  <DeltaChip deltaSeconds={temp.deltaSeconds} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function DeltaChip({ deltaSeconds }: { deltaSeconds: number }) {
  const negligible = Math.abs(deltaSeconds) < 10
  return (
    <span
      className={`font-manrope font-semibold text-sm tabular-nums ${
        negligible
          ? 'text-delo-navy/50'
          : deltaSeconds > 0
            ? 'text-delo-chart-slow'
            : 'text-delo-chart-fast'
      }`}
    >
      {negligible
        ? 'about average'
        : `${formatDuration(Math.abs(deltaSeconds))} ${deltaSeconds > 0 ? 'slower' : 'faster'}`}
    </span>
  )
}
```

- [ ] **Step 3: Wire into DashboardSection**

In `components/DashboardSection.tsx`:
1. Add `import WaitTimingSection from './WaitTimingSection'` with the other component imports.
2. Directly after the Order Count Cards grid closes (the `</div>` after the two `<StatsCard>`s, currently line 288), insert:

```tsx
          {/* Wait timing */}
          <WaitTimingSection
            timing={stats.timing}
            dateLabel={isViewingToday ? 'today' : `on ${formatDateLabel(selectedDate)}`}
          />
```

3. In `StatsLoadingSkeleton`, between the two existing grids, add a matching ghost:

```tsx
      <div className="bg-white rounded-xl p-4 md:p-6 border border-delo-navy/10 h-40" />
```

- [ ] **Step 4: Build and eyeball**

Run: `npm run build` — expected PASS. Then `npm run dev`, open `/admin` → Dashboard:
- Past event date with data → three cards, sensible numbers, no `NaN`/`undefined` anywhere.
- Quiet day → the single honest empty card.
- 375px viewport → single column, no horizontal scroll.

- [ ] **Step 5: Polish pass**

Invoke `make-interfaces-feel-better` on the new section (motion, spacing, hierarchy). Keep changes inside `WaitTimingSection.tsx` and the two `DashboardSection.tsx` insertion points.

- [ ] **Step 6: Commit**

```bash
npx prettier --write components/WaitTimingSection.tsx components/DashboardSection.tsx
git add components/WaitTimingSection.tsx components/DashboardSection.tsx
git commit -m "Show the wait on the dashboard: p90 headline, buckets, and the split"
```

---

### Task 9: Kitchen correctness edits — the minimum, and no more

**Files:**
- Modify: `components/OrderCard.tsx:52-59`
- Modify: `components/KitchenClient.tsx:52-54` (`normalizeRealtimeRow`)

**Interfaces:**
- Consumes: `Order.ready_at` / `Order.started_at` from Task 1.
- Produces: nothing new. **`/kitchen` gains no behaviour** — these are the only two edits allowed under the kitchen path.

- [ ] **Step 1: Fix the prep badge**

In `components/OrderCard.tsx`, replace lines 52-59:

```tsx
  // Ready + today: show elapsed prep time (placed → ready). Others: relative time or date.
  const isReadyToday = order.status === 'ready' && isToday(order.updated_at)
  const relevantTimestamp = order.status === 'canceled' ? order.updated_at : order.created_at
  const timeBadge = isReadyToday
    ? formatPrepTime(order.created_at, order.updated_at)
    : isToday(relevantTimestamp)
      ? getRelativeTime(relevantTimestamp, now)
      : formatShortDate(relevantTimestamp)
```

with:

```tsx
  // Ready + today: show the true wait (placed → ready_at). ready_at is trigger-owned,
  // so a drink re-queued and re-readied measures the remake — updated_at could not
  // promise that (it moves on every transition). Null fallback covers any row that
  // predates the timing migration.
  const readyAt = order.status === 'ready' ? (order.ready_at ?? order.updated_at) : null
  const isReadyToday = readyAt !== null && isToday(readyAt)
  const relevantTimestamp = order.status === 'canceled' ? order.updated_at : order.created_at
  const timeBadge =
    isReadyToday && readyAt
      ? formatPrepTime(order.created_at, readyAt)
      : isToday(relevantTimestamp)
        ? getRelativeTime(relevantTimestamp, now)
        : formatShortDate(relevantTimestamp)
```

- [ ] **Step 2: Normalize the new columns at the realtime boundary**

In `components/KitchenClient.tsx`, replace the body of `normalizeRealtimeRow` (line 53):

```ts
  return { ...row, created_at: toIso(row.created_at), updated_at: toIso(row.updated_at) }
```

with:

```ts
  return {
    ...row,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    started_at: row.started_at ? toIso(row.started_at) : null,
    ready_at: row.ready_at ? toIso(row.ready_at) : null,
  }
```

(`mergeOrders` needs no change: the PATCH route always writes `updated_at` in the same statement the trigger writes `ready_at`, so its three-field comparison still detects every mutation.)

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 4: React review**

Invoke `vercel:react-best-practices` covering `WaitTimingSection.tsx`, `DashboardSection.tsx`, `OrderCard.tsx`, and `KitchenClient.tsx` (this is the last component edit of the plan). Apply what it flags in these files only.

- [ ] **Step 5: Commit**

```bash
npx prettier --write components/OrderCard.tsx components/KitchenClient.tsx
git add components/OrderCard.tsx components/KitchenClient.tsx
git commit -m "Read the true wait from ready_at on the kitchen badge"
```

---

### Task 10: Documentation

**Files:**
- Modify: `TECHNICAL.md` (API section: stats response shape; add a short "Wait timing" design-decision note)
- Modify: `.claude/rules/status.md` (changelog entry; admin row in Current State)

**Interfaces:** none — prose only.

- [ ] **Step 1: TECHNICAL.md**

In the API routes list (~line 63-69), note that `GET /api/admin/stats` now returns a `timing` block. Add a brief subsection near the schema notes:

```markdown
### Wait Timing

The dashboard's wait analytics measure the **customer's wait** (placed → drink
in hand), not kitchen efficiency. All math lives in `lib/orderTiming.ts` (pure,
unit-tested — `npm test`): completions clustered + placements clustered =
"served together" (a held group, real wait, its own segment); completions
clustered + placements spread = a catch-up sweep (suspect); a wait far beyond
what queue depth predicts = a stranded card (suspect). Suspects are counted
and captioned on the dashboard, never excluded from headline numbers. p90 is
the headline everywhere; there is deliberately no mean. Full rationale:
`docs/specs/2026-08-23-customer-wait-times-design.md`.
```

- [ ] **Step 2: status.md**

Update the `/admin` row in Current State to mention wait timing cards. Add a changelog entry (top of the list, dated) summarizing: server-owned `started_at`/`ready_at` via trigger + backfill, the classification approach (groups are service, sweeps are captioned), p90 headline with counterfactual, bounded stats queries (closing the silent PostgREST truncation), the kitchen badge fix, and Vitest introduction. Follow the existing entries' voice — plain sentences about what changed and why it matters.

- [ ] **Step 3: Commit**

```bash
git add TECHNICAL.md .claude/rules/status.md
git commit -m "Document the wait-timing design and update project status"
```

---

### Task 11: Review gauntlet, verification, owner gate, PR

Orchestrator-led (no fresh subagent for the gates; the review lenses ARE subagents).

- [ ] **Step 1: Multi-lens review of the critical logic**

Run a Workflow with three `fable`-model reviewers over `lib/orderTiming.ts` + `lib/orderTiming.test.ts` + the timing portions of `app/api/admin/stats/route.ts`, one lens each:
- **Correctness:** off-by-ones in clustering boundaries, percentile rank math, residual sign conventions, the load-bearing tag→fit→flag ordering.
- **Hostile data:** duplicate timestamps, identical `ready_at` values, orders spanning midnight, empty/one-element arrays, `NaN` from unparseable dates, every-order-in-one-cluster.
- **Statistical soundness:** does the fit degrade safely, can the stranded threshold flag legitimate tails, does the counterfactual mislead when suspects dominate?

Verify each finding before acting (adversarial-verify pattern); fix confirmed issues, add a regression test per fix, commit.

- [ ] **Step 2: Simplify pass**

Invoke `/simplify` across the branch diff. Apply its cleanups; commit.

- [ ] **Step 3: Final UI audit**

Invoke `userinterface-wiki` over the dashboard changes, then `audit-typography` to confirm the new cards use the six-font brand system correctly (Bricolage numbers, Manrope copy, Cooper labels, Roboto Mono descriptions). Fix findings in the new section only; commit.

- [ ] **Step 4: Full verification**

Invoke `superpowers:verification-before-completion`, then run the spec's Verification list end-to-end: `npm test`, `npm run build`, trigger behaviour by hand in `/kitchen` (ready → back-to-placed → re-ready; claim/unclaim/re-claim), dashboard cross-check against CSV export, **reproduce the owner's real workflow** (three orders placed back-to-back, held, bumped together → served together, not suspect, still in p90), **reproduce a sweep** (two orders 15+ minutes apart, bumped together → captioned), both kitchen modes, 375px pass, empty states.

- [ ] **Step 5: Owner gate**

Pause. Ask the owner to test on their own devices — specifically their held-group habit and the dashboard for their last real event. **Wait for confirmation** (CLAUDE.md rule).

- [ ] **Step 6: Open the PR**

Invoke `commit-commands:commit-push-pr`: push `customer-wait-times`, open a PR titled "Measure customer waits and show them on the dashboard" summarizing the spec's frame (three-part wait, groups as service, p90 + counterfactual honesty), linking the spec file. **The workflow ends at the open PR** — merging is the owner's call.
