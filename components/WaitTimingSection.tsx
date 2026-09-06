'use client'

import { TimingStats } from '@/lib/supabase'
import { formatDuration, formatEventDate } from '@/lib/dateUtils'
import { MIN_TIMED_ORDERS, BUCKET_FAST_SECONDS, BUCKET_SLOW_SECONDS } from '@/lib/orderTiming'

/**
 * Wait analytics for one event day. Three cards: the wait (p90 hero + buckets +
 * confidence sentence), where the wait goes (floor / line / holding cost), and
 * by-drink comparison at matched queue depth. Copy rules (spec, Decisions 5-6):
 * segments are "served together/alone"; suspects are captioned, never excluded;
 * per-drink numbers are relative, never absolute build times; no shame framing.
 *
 * Motion budget: none of its own. The dashboard already fades this whole block
 * in once on mount, so the only transition here is the bucket bar re-sizing
 * when the owner picks a different date, which keeps that change from snapping.
 */

// Presentation-only significance thresholds (kept here, not lib/orderTiming.ts —
// these are display decisions, not part of the timing math itself).
/** Delta chip next to the headline p90 renders only once the change is at least this large. */
const MIN_DELTA_CHIP_SECONDS = 15
/** The "without them" counterfactual is only worth printing once it moves the headline this much. */
const MIN_COUNTERFACTUAL_GAP_SECONDS = 60
/** Below this many seconds of delta, a drink's comparison chip reads "about average" instead of a number. */
const NEGLIGIBLE_DRINK_DELTA_SECONDS = 10

interface WaitTimingSectionProps {
  timing: TimingStats | null
  dateLabel: string
}

export default function WaitTimingSection({ timing, dateLabel }: WaitTimingSectionProps) {
  if (!timing) {
    return (
      <div className="card-admin">
        <h3 className="font-bricolage font-semibold text-sm uppercase tracking-wider text-delo-navy/60 mb-2 text-balance">
          Order Wait Time
        </h3>
        <p className="text-description text-sm text-pretty">
          Not enough timed orders {dateLabel} to measure waits. Numbers appear once{' '}
          {MIN_TIMED_ORDERS} or more drinks have been marked ready.
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

/** One adaptive sentence, the entire data-quality surface (spec, Decision 6). */
function confidenceCopy(timing: TimingStats): string {
  const suspectCount = timing.suspect.suspectCount // distinct: never sum sweep + stranded
  const counterfactual = timing.suspect.counterfactualP90Seconds
  if (suspectCount === 0) {
    // No model means the stranded check never ran, so "all clean" would be
    // claiming a search that did not happen. Say which half was actually done.
    if (timing.model === null) {
      return 'No batch bumps spotted. Too few solo-served orders to check for stranded cards.'
    }
    return `All ${timing.measured} orders look cleanly timed.`
  }
  if (counterfactual === null) {
    return `${suspectCount} orders look marked-ready-late. Too few cleanly timed orders to say what the day would have looked like without them.`
  }
  if (timing.p90Seconds - counterfactual >= MIN_COUNTERFACTUAL_GAP_SECONDS) {
    return `${suspectCount} ${suspectCount === 1 ? 'order looks' : 'orders look'} marked-ready-late. Without ${suspectCount === 1 ? 'it' : 'them'}: ${formatDuration(counterfactual)}.`
  }
  return `${suspectCount} ${suspectCount === 1 ? 'order looks' : 'orders look'} marked-ready-late. Too few to matter.`
}

function WaitHeadlineCard({ timing }: { timing: TimingStats }) {
  const prev = timing.previousEvent
  const deltaSeconds = prev ? timing.p90Seconds - prev.p90Seconds : null
  const showDelta = deltaSeconds !== null && Math.abs(deltaSeconds) >= MIN_DELTA_CHIP_SECONDS

  // `measured` is at least MIN_TIMED_ORDERS wherever `timing` exists; the floor
  // is here so a malformed payload can never paint NaN across the whole bar.
  const total = Math.max(1, timing.measured)
  // Assumes both bucket edges land on whole minutes (true today: 180s/360s) —
  // a non-round edge would need its own formatter, not integer division.
  const fastMinutes = BUCKET_FAST_SECONDS / 60
  const slowMinutes = BUCKET_SLOW_SECONDS / 60
  const rawSegments = [
    { label: `Under ${fastMinutes}m`, count: timing.buckets.fast, color: 'bg-delo-chart-fast' },
    {
      label: `${fastMinutes}–${slowMinutes}m`,
      count: timing.buckets.medium,
      color: 'bg-delo-chart-mid',
    },
    { label: `Over ${slowMinutes}m`, count: timing.buckets.slow, color: 'bg-delo-chart-slow' },
  ].map((segment) => ({ ...segment, share: (segment.count / total) * 100 }))

  // Largest-remainder method: floor each share, then hand the leftover whole
  // points (100 minus the sum of floors) to the segments with the biggest
  // fractional remainders, so the displayed percentages always sum to 100.
  const floors = rawSegments.map((s) => Math.floor(s.share))
  const remainder = 100 - floors.reduce((sum, f) => sum + f, 0)
  const remainderOrder = rawSegments
    .map((s, i) => ({ i, frac: s.share - floors[i] }))
    .sort((a, b) => b.frac - a.frac)
  const percents = [...floors]
  for (let k = 0; k < remainder; k++) {
    percents[remainderOrder[k].i]++
  }
  const segments = rawSegments.map((segment, i) => ({ ...segment, percent: percents[i] }))

  // Same wording the legend prints, so the bar reads identically to a screen reader.
  const barLabel = `Wait distribution: ${segments
    .map((s) => `${s.percent}% ${s.label.toLowerCase()}`)
    .join(', ')}`

  return (
    <div className="card-admin">
      <h3 className="font-bricolage font-semibold text-sm uppercase tracking-wider text-delo-navy/60 mb-1 text-balance">
        Order Wait Time
      </h3>
      <p className="font-bricolage font-semibold text-xs uppercase tracking-wider text-delo-navy/50 mt-2.5 md:mt-3">
        90% of orders ready within
      </p>
      <p className="font-bricolage font-bold text-3xl md:text-4xl text-delo-maroon tabular-nums">
        {formatDuration(timing.p90Seconds)}
      </p>
      {/* Flex-wrap, not a second paragraph: the delta sits inline on the iPad and
          drops to its own line on a phone, where it would otherwise wrap mid-phrase. */}
      <p className="flex flex-wrap items-baseline gap-x-2 font-manrope text-sm text-delo-navy/70 mt-1 tabular-nums">
        <span>
          Median {formatDuration(timing.medianSeconds)} · {timing.measured} orders
        </span>
        {showDelta && prev && (
          <span
            className={`font-semibold ${deltaSeconds! < 0 ? 'text-delo-chart-fast' : 'text-delo-chart-slow'}`}
          >
            {deltaSeconds! < 0 ? '▼' : '▲'} {formatDuration(Math.abs(deltaSeconds!))}{' '}
            {deltaSeconds! < 0 ? 'faster' : 'slower'} than {formatEventDate(prev.date)}
          </span>
        )}
      </p>

      {/* Stacked bar: 2px card-colored gaps separate the fills, so the three
          buckets stay distinguishable without relying on hue alone. The track
          clips to a pill, which rounds whichever segments actually render. */}
      <div
        role="img"
        aria-label={barLabel}
        className="flex gap-[2px] h-3 rounded-full overflow-hidden mt-3.5 md:mt-4"
      >
        {segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <div
              key={s.label}
              aria-hidden="true"
              className={`${s.color} min-w-[3px] transition-[width] duration-300 ease-out motion-reduce:transition-none`}
              style={{ width: `${s.share}%` }}
            />
          ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 md:gap-x-4 mt-2">
        {segments.map((s) => (
          <span
            key={s.label}
            className="inline-flex items-center gap-1.5 font-manrope text-xs md:text-sm text-delo-navy/70 tabular-nums"
          >
            <span aria-hidden="true" className={`w-2.5 h-2.5 shrink-0 rounded-full ${s.color}`} />
            {s.percent}% {s.label.toLowerCase()}
          </span>
        ))}
      </div>

      <p className="text-description text-xs leading-relaxed mt-3 text-pretty">
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
    <div className={`flex items-center justify-between gap-3 ${indent ? 'pl-5' : ''}`}>
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
    <div className="card-admin">
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
          Not enough solo-served orders to split the wait yet. Check back after the next event.
        </p>
      )}
    </div>
  )
}

function ByDrinkCard({ timing }: { timing: TimingStats }) {
  const hasData = timing.perDrink.length > 0
  return (
    <div className="card-admin">
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
              <div key={drink.name} className="flex items-center justify-between gap-3">
                <span className="font-manrope text-sm text-delo-navy">{drink.name}</span>
                <DeltaChip deltaSeconds={drink.deltaSeconds} />
              </div>
            ))}
          </div>
          {timing.byTemperature.length > 0 && (
            <div className="mt-3.5 md:mt-4 pt-3.5 md:pt-4 border-t border-delo-navy/10 space-y-2">
              {timing.byTemperature.map((temp) => (
                <div key={temp.name} className="flex items-center justify-between gap-3">
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
  const negligible = Math.abs(deltaSeconds) < NEGLIGIBLE_DRINK_DELTA_SECONDS
  return (
    <span
      className={`font-manrope font-semibold text-sm tabular-nums whitespace-nowrap ${
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
