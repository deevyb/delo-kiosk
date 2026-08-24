'use client'

import { TimingStats } from '@/lib/supabase'
import { formatDuration } from '@/lib/dateUtils'

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

interface WaitTimingSectionProps {
  timing: TimingStats | null
  dateLabel: string
}

export default function WaitTimingSection({ timing, dateLabel }: WaitTimingSectionProps) {
  if (!timing) {
    return (
      <div className="bg-white rounded-xl p-4 md:p-6 border border-delo-navy/10">
        <h3 className="font-bricolage font-semibold text-sm uppercase tracking-wider text-delo-navy/60 mb-2 text-balance">
          Order Wait Time
        </h3>
        <p className="text-description text-sm text-pretty">
          Not enough timed orders {dateLabel} to measure waits. Numbers appear once ten or more
          drinks have been marked ready.
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

  // `measured` is at least MIN_TIMED_ORDERS wherever `timing` exists; the floor
  // is here so a malformed payload can never paint NaN across the whole bar.
  const total = Math.max(1, timing.measured)
  const segments = [
    { label: 'Under 3m', count: timing.buckets.fast, color: 'bg-delo-chart-fast' },
    { label: '3–6m', count: timing.buckets.medium, color: 'bg-delo-chart-mid' },
    { label: 'Over 6m', count: timing.buckets.slow, color: 'bg-delo-chart-slow' },
  ].map((segment) => ({
    ...segment,
    share: (segment.count / total) * 100,
    percent: Math.round((segment.count / total) * 100),
  }))

  // Same wording the legend prints, so the bar reads identically to a screen reader.
  const barLabel = `Wait distribution: ${segments
    .map((s) => `${s.percent}% ${s.label.toLowerCase()}`)
    .join(', ')}`

  return (
    <div className="bg-white rounded-xl p-4 md:p-6 border border-delo-navy/10">
      <h3 className="font-bricolage font-semibold text-sm uppercase tracking-wider text-delo-navy/60 mb-1 text-balance">
        Order Wait Time
      </h3>
      <p className="font-bricolage font-semibold text-[11px] md:text-xs uppercase tracking-wider text-delo-navy/50 mt-2.5 md:mt-3">
        90% of orders ready within
      </p>
      <p className="font-bricolage font-bold text-3xl md:text-4xl leading-[1.15] text-delo-maroon tabular-nums">
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
              className={`${s.color} min-w-[3px] transition-[width] duration-300 ease-out motion-reduce:transition-none`}
              style={{ width: `${s.share}%` }}
            />
          ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 md:gap-x-4 mt-2">
        {segments.map((s) => (
          <span
            key={s.label}
            className="inline-flex items-center gap-1.5 font-manrope text-[13px] md:text-sm text-delo-navy/70 tabular-nums"
          >
            <span aria-hidden="true" className={`w-2.5 h-2.5 shrink-0 rounded-full ${s.color}`} />
            {s.percent}% {s.label.toLowerCase()}
          </span>
        ))}
      </div>

      <p className="text-description text-xs md:text-[13px] leading-relaxed mt-3 text-pretty">
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
          Not enough solo-served orders to split the wait yet. Check back after the next event.
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
              <div key={drink.name} className="flex items-center justify-between gap-3">
                <span className="font-manrope text-[15px] text-delo-navy">{drink.name}</span>
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
  const negligible = Math.abs(deltaSeconds) < 10
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
