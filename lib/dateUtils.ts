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
function getTodayDateString(): string {
  return dateFormatter.format(new Date())
}

/**
 * Check if a UTC timestamp falls on today in the device's local timezone.
 */
export function isToday(timestamp: string): boolean {
  return dateFormatter.format(new Date(timestamp)) === getTodayDateString()
}

/**
 * Format elapsed duration between two timestamps as compact string.
 * e.g. "2m 30s", "45s", "3m". Clamps to zero for clock-skew safety.
 */
export function formatPrepTime(createdAt: string, updatedAt: string): string {
  const diff = new Date(updatedAt).getTime() - new Date(createdAt).getTime()
  const totalSeconds = Math.max(0, Math.round(diff / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (totalSeconds === 0) return '< 1s'
  if (minutes === 0) return `${seconds}s`
  if (seconds === 0) return `${minutes}m`
  return `${minutes}m ${seconds}s`
}

/**
 * Format a timestamp as "Mar 15" for same-year, "Mar 15, 2025" for different year.
 */
export function formatShortDate(timestamp: string): string {
  const date = new Date(timestamp)
  const isSameYear = date.getFullYear() === new Date().getFullYear()
  return isSameYear ? shortDateFormatter.format(date) : shortDateWithYearFormatter.format(date)
}
