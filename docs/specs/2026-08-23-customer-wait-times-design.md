# Customer Wait Times — Design Spec

> Status: **Design finalized — ready to implement.** Output of two research passes (KDS
> vendor timing practice and QSR speed-of-service benchmarks; then fork-join queueing and
> batch-service literature) and a structured owner interview (Aug 23, 2026). Every
> direction decision below was made deliberately with the owner — **do not re-open them or
> re-run the interview.** Implement on a feature branch, follow the CLAUDE.md skill table,
> and pause for the owner's manual testing before committing.

## What is being measured, and what is not

**The metric is the customer's wait: from placing an order to having the drink in hand.**
It is deliberately *not* kitchen efficiency, and that distinction drives everything below.

The owner frequently holds finished drinks — three friends order together, all three drinks
get made, and all three are announced at once so the group is served as a group. The cards
stay on screen until then so the names are visible to call out. During that hold the first
customer really is still waiting. Their wait is a genuine part of the service, and the
recorded time is *correct*, not corrupted.

An earlier draft of this design treated every clustered set of completions as contaminated
data and excluded it. That was wrong, and wrong in the most damaging possible direction: it
would have deleted the slowest *legitimate* orders and made every number flatter than the
truth. Batching is the service. Only **forgetting** is noise.

## The problem

1. **Nothing is measured today.** `OrderCard.tsx:56` computes
   `formatPrepTime(created_at, updated_at)`, and `updated_at` is overwritten by *every*
   transition through the single write path at `app/api/orders/[id]/route.ts:21`. A drink
   marked ready, sent back to the queue, and re-readied silently re-measures from the new
   timestamp. There is no `ready_at` column and no status history — for any order that
   moved twice, the real wait is already unrecoverable.
2. **A single average cannot be acted on.** A customer's wait is three different things
   with three different fixes (see below). One blended number hides which lever to pull.
3. **Some cards genuinely do get bumped late**, and the owner needs to know when that has
   distorted a number — without any order being thrown away.

## Research facts to respect (verified Aug 2026 — do not re-litigate)

**On the owner's batching practice:**

- Holding a group's drinks is a **fork-join** system: a group forks into N drinks and joins
  only when all N are done, so the group's wait is the *maximum* of its branches, never the
  average. The literature calls the extra time the **synchronization penalty**.
  https://arxiv.org/pdf/1612.05486
- **Batching is usually net-positive, with one boundary condition.** An emergency-department
  study of **272,000 patient encounters** using an instrumental-variables design found batch
  ordering *"increases turnaround time for individual orders yet reduces overall service
  time"* because *"results arrive in a tighter window."* Critically:
  ***"Benefits concentrate under manageable congestion and attenuate under high
  congestion."*** Holding pays off when comfortable and costs when slammed — and that is
  testable against the kiosk's own data, because queue depth is known.
  https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6180358 · https://www.danqiluo.com/research
- Batch-arrival queueing decomposes a customer's wait into the **virtual wait** (work
  already in the system when their batch arrived) plus the **within-batch delay** (extra
  time if they are not first in their batch). This is the formal basis for the three-part
  split below. https://people.maths.bris.ac.uk/~maajg/teaching/iqn/queues.pdf
- The *opposite* policy has a documented failure mode: Starbucks produces on order-placement
  time, creating "finished goods inventory" — drinks cooling on the counter before anyone
  collects them. Chick-fil-A times production to arrival instead, cutting waits 1–2 minutes
  at >90% estimate accuracy. Holding for a group is closer to Chick-fil-A's model than to
  Starbucks'. https://www.leanblog.org/2026/03/starbucks-mobile-order-timing-problem-chick-fil-a-solved/
- Multi-item order systems predict **when the last item is ready**, since that gates
  handover. https://www.item.com/order-management-system/mobile-features-mobile-order-tracking

**On timing data generally:**

- **No major KDS vendor publishes a statistical outlier rule.** Toast, Square, Fresh KDS,
  Lightspeed and Revel defend structurally instead: rolling windows (Toast 120 min; Fresh
  15 + 30 min), hard caps (SpotOn auto-closes at 45 min), bucketing into fast/medium/slow
  rather than averaging, and histogram display (Lightspeed "Modes").
- **Fresh KDS is the only vendor addressing mean vs. median in writing**, and their framing
  is *compare* them — the gap is itself the diagnostic.
- **Percentile-pair reporting is the established public convention.** Nova Scotia's public
  wait-time service publishes only "50% served within" and "90% served within" and no mean
  at all. Call centres call the same construct a service level ("80/20").
  https://waittimes.novascotia.ca/understand-numbers
- **Espresso hands-on build time is 70–95 seconds for a milk drink** (dose/grind 10–15s,
  tamp 5s, extraction 25–30s, steam 20–30s, assembly 10–15s). This physical floor is what
  makes a 30-second completion-cluster threshold sound.
- **Little's Law: wait = queue length / completion rate**, not queue length x per-drink
  time. Completion rate has batching already baked in. The 25th Annual Drive-Thru Study
  switched its headline metric for this reason — Chick-fil-A's raw time is 7+ minutes but
  ~2m30s adjusted for throughput, identical to Dutch Bros.
- **Per-barista speed tracking is not evidence-backed**: a meta-analysis of 94 studies
  (23,000+ participants) found no overall link between electronic performance monitoring and
  better performance. Out of scope (Decision 9).

## The frame

```
Customer wait  =  the floor  +  the line  +  the group
                  (how fast a    (how many      (who they
                   drink can      were ahead)    came with)
                   possibly be)
```

Three components, three different levers — **menu**, **staffing**, **service policy**. Only
two of the three are directly measurable in solo mode; the spec is explicit about which.

## Decisions (owner-approved, Aug 23 2026)

1. **p90 is the primary number on the dashboard.** Median is shown as support; the bar
   covers the middle of the distribution, so p90 is the only place the tail is visible.
   The mean is not computed or displayed at all: the confidence sentence (Decision 6) is a
   more direct contamination signal than a mean-minus-median gap, and two headline averages
   would compete for the same attention. For the future ETA feature (backlog #7), the
   estimate will come from the queue model plus a safety pad on its historical misses — the
   pad's percentile (p75 vs p90) is **deliberately left open**, to be decided with real
   event data when that feature is designed.
2. **No ceiling. Nothing is ever excluded from the headline.** Long waits stay in, however
   long. Suspect orders are *counted and captioned*, never dropped (Decision 6).
3. **Batching is service, not noise.** Orders handed over together are measured as-is and
   reported as their own segment.
4. **Solo mode is the norm**; multi-barista is rare. The design must produce its full
   headline and group analysis from `created_at` and `ready_at` alone.
5. **Build time is not displayed.** In solo mode there is no start event, so per-order and
   per-drink build time cannot be measured — only an event-wide intercept can be inferred.
   That intercept is shown as **"the floor"**, labelled as an estimate. Per-drink figures
   are always **relative, at matched queue depth**, never absolute build times.
6. **Flagging is a caption, not a workflow.** There is no flagged-order list and no per-order
   action. A single adaptive sentence under the headline reports the count and, when it is
   material, the counterfactual p90 without those orders. That is the entire surface.
7. **`started_at` is captured but unused in the UI.** Three lines of SQL, no interface. Its
   only purpose is that rare multi-barista events give ground truth for the floor, which is
   the only way to ever check whether the solo-mode estimate is trustworthy.
8. **`/kitchen` gains no behaviour.** No nudges, no amber drift, no sweep UI. Two correctness
   edits only (Build §5).
9. **No per-barista breakdown.** See research note above.
10. **Backfill existing history silently.** `ready_at = updated_at` for orders currently at
    `ready`. This is correct rather than a guess: the only write path always sets a status,
    so no code path edits a ready order without moving it.
11. **Add Vitest scoped to `lib/`.** Dev-only; nothing changes in the iPad bundle.

## Build

### 1. Migration (SQL, run by hand in the Supabase SQL editor)

The repo has no migrations directory; schema changes are applied by hand and mirrored into
`TECHNICAL.md`. Follow that convention and record this SQL there.

```sql
ALTER TABLE orders
  ADD COLUMN started_at TIMESTAMPTZ,
  ADD COLUMN ready_at   TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION set_order_timestamps() RETURNS trigger AS $$
BEGIN
  -- Server-owned columns. Ignore whatever the client sent, then apply transitions.
  -- `orders` still allows public UPDATE (backlog #1), so this is the only thing
  -- making these numbers forgery-resistant.
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
    NEW.ready_at   := NULL;   -- mirroring how claimed_by is cleared at route.ts:27-28
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_timestamps
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_order_timestamps();

-- Decision 10
UPDATE orders SET ready_at = updated_at WHERE status = 'ready';

CREATE INDEX idx_orders_created_at_status ON orders(created_at DESC, status);
```

**Why a trigger and not the API route.** `created_at` comes from Postgres's clock while
`updated_at` is written from a Vercel function's clock — `KitchenClient.tsx:74-76` already
documents drift between Vercel instances. Subtracting two different clocks to get a duration
is how you get negative waits. A trigger puts both ends of every measurement on one clock,
makes "set only on first claim" atomic, and survives the public-UPDATE RLS hole.

### 2. `lib/orderTiming.ts` (new) — all the math, no I/O

Pure functions over plain objects, fully unit-testable. Constants at the top of the file,
each commented with the research figure it comes from.

- `READY_CLUSTER_SECONDS = 30` — safely under the 70–95s physical build floor, so genuinely
  sequential completions never cluster.
- `PLACED_CLUSTER_SECONDS = 180` — a group of 3–5 ordering one-at-a-time on a single iPad
  spans roughly 90–150 seconds.
- `BUCKETS = [180, 360]` — under 3 min / 3–6 min / over 6 min, from QSR counter targets
  (3–5 min) and Starbucks' 4-minute rule.

**`queueDepthAt(orders, instant)`** — how many orders were placed and not yet ready at that
instant. Cancelled orders are excluded entirely: we cannot know when they left the queue,
they are few, and the error is small. Document this in the function.

**`classifyOrders(orders)`** — tags each order, using placement proximity as the
discriminator that makes clustering safe during a rush:

| Completions clustered? | Placements clustered? | Tag |
|---|---|---|
| Yes | Yes | `servedTogether` — real wait, its own segment |
| Yes | No | `sweep` — suspect (Decision 6) |
| No | — | `servedAlone` |

Plus, independently: an order that waited far longer than its queue depth predicts **and**
was not `servedTogether` is tagged `strandedCard` — the isolated forgotten bump. This is the
replacement for a fixed time ceiling: relative, so it catches a 12-minute forgotten card on
a quiet day and does not punish a genuine 25-minute wait during a peak.

**Ordering matters here, and it is not optional.** `strandedCard` depends on the model, and
the model must not be fit on stranded cards, so run exactly these steps once, in order — no
iterating to convergence, which would slowly eat the legitimate tail:

1. Tag `servedTogether` / `sweep` / `servedAlone` from the timestamps alone.
2. Fit the model on `servedAlone` orders **excluding** anything already tagged `sweep`.
3. Tag `strandedCard` from residuals against that fit — an overshoot beyond 3x the median
   absolute residual. Do not refit afterwards.

Name the segments **"served together" / "served alone"**, not "group" / "solo". Three
unrelated orders batched by drink type produce the same signature and the same wait effect;
the label should describe what the data shows, not a social assumption.

**`fitFloorAndLine(servedAloneOrders)`** — least squares of wait seconds on queue depth,
returning `{ floorSeconds, perDrinkSeconds }` or `null`. Fit on `servedAlone` orders **only**,
so held groups do not inflate the floor. Guards: needs 8+ points and real variation in depth;
returns `null` on a negative slope rather than reporting nonsense. `null` must render as an
honest "not enough data yet", never a fabricated number.

**`groupCost(orders, model)`** — for each `servedTogether` order, `actual - predicted` from
the model above. Report the median, split by queue depth at placement (below vs. at-or-above
the event's median depth). This is the direct test of the ED study's congestion boundary
against the owner's own events, and it is the single most actionable output of the feature.

**`summarize(orders)`** — p90 and median wait; bucket counts; per-drink comparison at matched
queue depth (a drink's median residual against the model, so figures are relative, per
Decision 5); suspect counts; and the counterfactual p90 excluding `sweep` + `strandedCard`.

### 3. `app/api/admin/stats/route.ts` — bound the query, add a `timing` block

The route currently does `.select('item, modifiers, status, created_at')` with **no filter
and no limit** (`:17-19`), pulling every order ever written on every dashboard load. It will
silently truncate at PostgREST's 1,000-row default — roughly seven events away — and timing
math on a quietly truncated dataset produces confidently wrong numbers. Required work, not
scope creep; it also closes the `app/admin` half of backlog #4.

- Fetch rows only for the selected event date (plus the previous event, for the delta),
  selecting `id, item, modifiers, status, created_at, started_at, ready_at, claimed_by`.
- Switch the all-time counters to real `count: 'exact', head: true` queries instead of
  counting fetched rows.
- Leave `popularDrinks` / `modifierBreakdown` behaviour exactly as-is, including the
  today-shows-all-time trends quirk. That is backlog #9's business, not this spec's.
- Timing is **always scoped to a single event date**. Averaging waits across events is
  meaningless.

Response gains a `timing` block (or `null` when the event has too few timed orders to say
anything honest) carrying: p90 and median seconds, bucket counts, served-alone vs
served-together p90s, `floorSeconds` + `perDrinkSeconds` (nullable), group cost split by
congestion, per-drink relative comparison, suspect counts, counterfactual p90, and the
previous event's p90 for the delta.

### 4. `components/DashboardSection.tsx` — three cards

Invoke `/frontend-design` before writing this UI. **No charting library** — every value is a
number or a CSS bar, reusing the existing `ModifierPreferences` bar pattern (`:456-462`) and
`formatPrepTime` from `lib/dateUtils.ts`. The bundle is unchanged, which matters because
stability is the owner's first priority. Follow the file's conventions:
`grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4`, `tabular-nums` on every number,
`text-balance` on headings, and the card shell string used 11x elsewhere.

**Card 1 — The wait.** p90 as the hero number, phrased as a promise the owner could make
("9 in 10 within 8m 20s"), with the median as support and a delta against the previous
event. A fast/medium/slow bar beneath, using the `delo-sage` / `delo-gold` / `delo-terracotta`
tokens — defined in `tailwind.config.ts` and currently unused anywhere in the app.

Under it, the confidence sentence and nothing more (Decision 6). Two forms:

> *4 orders look marked-ready-late — too few to matter.*

> *22 orders look marked-ready-late. Without them: 6m 10s.*

Switch to the second form only when the counterfactual differs enough to change a decision.
No list, no card, no per-order action.

**Card 2 — Where the wait goes.** The floor, the line, and what holding costs:

> *With nobody ahead: about 1m 50s. Each drink in the line adds about 70s.*
> *Orders handed over together waited 2m 10s longer — but 5m 40s during your busiest half hour.*

That second sentence is the feature's payoff and the one number that could change how the
owner runs an event. When the model returns `null`, say so plainly instead of inventing it.

**Card 3 — By drink.** Each drink's wait **relative to the average drink at the same queue
depth**, slowest first, with the iced-vs-hot split beneath. Copy must make the comparison
explicit ("about 40s longer than average with the same line ahead"), never an absolute build
time.

Every card needs an honest empty state — a free event, a day with no orders, an event where
every order was cancelled, and an event too small to fit a model are all real.

### 5. Kitchen — the minimum, and no more

Per Decision 8, `/kitchen` gains no behaviour. Two correctness edits only:

- `components/OrderCard.tsx:52-59` — badge measures `created_at -> ready_at`, and
  `isReadyToday` keys off `ready_at`. Falls back to relative time when `ready_at` is null.
  No visual or interaction change; the badge stops being wrong on remade drinks.
- `components/KitchenClient.tsx:53` — add `started_at` and `ready_at` to the `toIso`
  normalization. Realtime and PostgREST encode `timestamptz(6)` differently and `:67-80`
  documents the last bug that caused. `mergeOrders` compares only
  `updated_at`/`status`/`claimed_by` (`:93`), so an un-normalized `ready_at` would not
  trigger a false replace — but it would leave the kitchen holding a differently-encoded
  string than the badge formats. Normalize at the boundary like the others.

### 6. Tests — `lib/orderTiming.test.ts` (Vitest, dev-only)

Add `vitest`, a minimal `vitest.config.ts`, and a `test` script. Nothing enters the
production bundle. Fixtures are synthetic events built from plain timestamps:

- **a held group** — three orders placed within 90s, completed within 5s: all tagged
  `servedTogether`, **none** tagged suspect, and their waits still counted in p90. This is
  the regression test for the mistake this spec exists to correct.
- **a catch-up sweep** — orders placed 20 minutes apart, completed in the same second:
  tagged `sweep`.
- **a rush** — orders arriving every 40s and completing sequentially: **nothing** clustered,
  because completions are never within 30s of each other. Guards the discriminator against
  its worst failure mode.
- **a stranded card** — long wait, empty queue, not part of a group: tagged `strandedCard`.
- **a genuine backlog** — long waits with a *deep* queue: all clean. The discriminator must
  work in both directions; this is the test that matters most.
- **congestion split** — groups held when quiet vs. when busy produce different `groupCost`.
- **degenerate inputs** — empty event, one order, all cancelled, `ready_at` null throughout,
  `ready_at` earlier than `created_at` (clock skew), and every order in one group (so the
  model has no `servedAlone` orders to fit on and must return `null`).

## Files touched

| File | Change |
|---|---|
| Supabase SQL (by hand) | Two columns, trigger, backfill, index |
| `lib/supabase.ts` | `Order` gains `started_at` / `ready_at`; timing types |
| `lib/orderTiming.ts` | **New** — classification, model fit, group cost, summary |
| `lib/orderTiming.test.ts` | **New** — fixtures above |
| `app/api/admin/stats/route.ts` | Bound the query, count queries for totals, `timing` block |
| `components/DashboardSection.tsx` | Three cards + subcomponents |
| `components/OrderCard.tsx` | Badge uses `ready_at` (one line + guard) |
| `components/KitchenClient.tsx` | `toIso` normalizes the two new columns |
| `package.json`, `vitest.config.ts` | Vitest, dev-only |
| `TECHNICAL.md`, `.claude/rules/status.md` | Schema, trigger rationale, changelog |

## Out of scope

Live ETA on the confirmation screen (backlog #7 — this spec makes it small, but it touches
the customer-facing order flow and should wait until wait-time data has been validated at a
real event); per-barista breakdowns; any change to kitchen behaviour; group-size breakdowns
(thin samples at 150 orders/event); the RLS fix (backlog #1) and the today-shows-all-time
trends quirk (backlog #9), both deliberately left where they are.

## Known limitation to state plainly

A group that trickles in — friends ordering several minutes apart but served together — will
have spread-out placements and be tagged `sweep`. Because suspect orders are counted and
captioned rather than excluded (Decision 2/6), a false positive slightly inflates a count
and changes no headline number. Acceptable, but note it in the code so nobody later
"fixes" it by widening `PLACED_CLUSTER_SECONDS`, which would break rush handling.

## Verification

1. `npm run test` — all fixtures pass, especially **held-group-is-not-suspect** and
   **genuine-backlog-stays-clean**.
2. `npm run build` — clean.
3. Apply the migration; confirm the backfill populated `ready_at` for existing ready orders
   and that a fresh order still flows placed -> ready normally.
4. Trigger behaviour by hand in `/kitchen`: mark ready (`ready_at` set), Back to Placed (both
   cleared), re-ready (new `ready_at`), claim/unclaim/re-claim (`started_at` follows the live
   claim). Verify the badge matches wall-clock timing.
5. Load `/admin` -> Dashboard for a past event; cross-check the headline against the CSV
   export for the same date.
6. **Reproduce the owner's real workflow**: place three orders back to back, let them sit,
   then mark all three ready within a few seconds. Confirm they are reported as served
   together, are **not** called suspect, and remain in the p90.
7. **Reproduce a sweep**: place an order, place another 15 minutes later, bump both at once.
   Confirm the confidence sentence counts them.
8. Both kitchen modes — solo (`/kitchen`) and multi-barista (`/kitchen?barista=Dev`) —
   produce comparable dashboards for equivalent events.
9. Mobile pass at 375px — all three cards, no horizontal scroll.
10. Empty states: a date with no orders, and a date where every order was cancelled.
11. Owner tests manually before commit, per CLAUDE.md.

## Review sequence

`/feature-dev` before implementation (DB change plus 3+ files). `/frontend-design` before the
dashboard UI, `/make-interfaces-feel-better` after it, `/userinterface-wiki` as the final UI
audit, `/react-best-practices` after the component edits, `/simplify` across the whole change
before testing. The classification logic in `lib/orderTiming.ts` is the critical code here and
gets a redundant multi-lens review — correctness, hostile-data, and statistical-soundness —
before the owner is asked to test. Work ends at an open PR on a branch.
