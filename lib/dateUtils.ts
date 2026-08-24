/**
 * Date utilities for timezone-aware date comparison and formatting.
 * Uses Intl.DateTimeFormat('en-CA') for YYYY-MM-DD — same pattern as DashboardSection.
 * Formatters are cached at module level to avoid repeated allocations.
 */

const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone
const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: LOCAL_TZ })
const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: LOCAL_TZ,
})
const shortDateWithYearFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: LOCAL_TZ,
})

/**
 * Get today's date string (YYYY-MM-DD) in the device's local timezone.
 */
export function getTodayDateString(): string {
  return dateFormatter.format(new Date())
}

/**
 * Check if a UTC timestamp falls on today in the device's local timezone.
 */
export function isToday(timestamp: string): boolean {
  return dateFormatter.format(new Date(timestamp)) === getTodayDateString()
}

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

/**
 * Format elapsed duration between two timestamps as compact string.
 * e.g. "2m 30s", "45s", "3m". Clamps to zero for clock-skew safety.
 */
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

/**
 * Format a timestamp as "Mar 15" for same-year, "Mar 15, 2025" for different year.
 */
export function formatShortDate(timestamp: string): string {
  const date = new Date(timestamp)
  const isSameYear = date.getFullYear() === new Date().getFullYear()
  return isSameYear ? shortDateFormatter.format(date) : shortDateWithYearFormatter.format(date)
}
