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
 * Format a timestamp as "Mar 15" for same-year, "Mar 15, 2025" for different year.
 */
export function formatShortDate(timestamp: string): string {
  const date = new Date(timestamp)
  const isSameYear = date.getFullYear() === new Date().getFullYear()
  return isSameYear ? shortDateFormatter.format(date) : shortDateWithYearFormatter.format(date)
}
