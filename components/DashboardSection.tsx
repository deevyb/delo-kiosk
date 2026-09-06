'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { Order, DashboardStats, OrderCounts, DrinkCount, ModifierOption } from '@/lib/supabase'
import { getTodayDateString, formatEventDate } from '@/lib/dateUtils'
import { useIsMobile } from '@/hooks/useIsMobile'
import WaitTimingSection from './WaitTimingSection'

/**
 * DashboardSection - Stats overview and CSV export
 *
 * Shows:
 * - Order counts (today + all-time) with status breakdown
 * - Popular drinks list (top 20)
 * - Modifier preferences with visual bars
 * - CSV export functionality
 */
export default function DashboardSection() {
  const isMobile = useIsMobile()

  // Stats state
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const calendarRef = useRef<HTMLDivElement>(null)

  // CSV export state
  const startDateRef = useRef<HTMLInputElement>(null)
  const endDateRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Today's date in YYYY-MM-DD for max attribute and comparison
  const todayStr = getTodayDateString()

  const isViewingToday = !selectedDate || selectedDate === todayStr

  // Format a YYYY-MM-DD date as "Feb 14" (adds year if not current year)
  const formatDateLabel = (dateStr: string) => {
    const year = Number(dateStr.split('-')[0])
    const label = formatEventDate(dateStr)
    const currentYear = new Date().getFullYear()
    return year !== currentYear ? `${label}, ${year}` : label
  }

  // Close calendar on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setCalendarOpen(false)
      }
    }
    if (calendarOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [calendarOpen])

  // Handle day selection
  const handleDaySelect = useCallback(
    (day: Date | undefined) => {
      if (!day) return
      const dateStr = new Intl.DateTimeFormat('en-CA').format(day)
      setSelectedDate(dateStr === todayStr ? '' : dateStr)
      setCalendarOpen(false)
    },
    [todayStr]
  )

  // Fetch stats on mount and when selectedDate changes
  useEffect(() => {
    const fetchStats = async () => {
      setIsLoadingStats(true)
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        const params = new URLSearchParams({ timezone: tz })
        if (selectedDate) params.set('date', selectedDate)
        const response = await fetch(`/api/admin/stats?${params}`)
        if (!response.ok) throw new Error('Failed to fetch stats')
        const data = await response.json()
        setStats(data)
        setStatsError(null)
      } catch (err) {
        console.error('Error fetching stats:', err)
        setStatsError('Failed to load statistics')
      } finally {
        setIsLoadingStats(false)
      }
    }
    fetchStats()
  }, [selectedDate])

  // Format date for spreadsheet (ISO format recognized by Google Sheets/Excel)
  const formatDate = (isoString: string): string => {
    const date = new Date(isoString)
    return date.toISOString().split('T')[0] // YYYY-MM-DD
  }

  // Format time for spreadsheet (24-hour format for sorting)
  const formatTime = (isoString: string): string => {
    const date = new Date(isoString)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }) // HH:MM
  }

  const generateCSV = (orders: Order[]): string => {
    // Separate Date and Time columns for better pivot table grouping
    const headers = ['Customer Name', 'Drink', 'Milk', 'Temperature', 'Status', 'Date', 'Time']

    const rows = orders.map((order) => [
      // Quote text fields to handle commas/special chars
      `"${order.customer_name.replace(/"/g, '""')}"`,
      `"${order.item.replace(/"/g, '""')}"`,
      order.modifiers.milk || '',
      order.modifiers.temperature || '',
      order.status,
      formatDate(order.created_at), // YYYY-MM-DD (recognized as date by spreadsheets)
      formatTime(order.created_at), // HH:MM (sortable)
    ])

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
  }

  // Build filename based on current date range state
  const buildFilename = (start: string, end: string): string => {
    if (start && end) {
      return `orders-${start}-to-${end}`
    } else if (start) {
      return `orders-from-${start}`
    } else if (end) {
      return `orders-until-${end}`
    } else {
      return `orders-all-${new Date().toISOString().split('T')[0]}`
    }
  }

  const handleDownload = async () => {
    setError(null)
    setIsLoading(true)

    // Read values directly from DOM inputs (more reliable than state)
    const currentStartDate = startDateRef.current?.value || ''
    const currentEndDate = endDateRef.current?.value || ''

    try {
      // Build query params
      const params = new URLSearchParams()
      if (currentStartDate) params.set('startDate', currentStartDate)
      if (currentEndDate) params.set('endDate', currentEndDate)

      const url = `/api/admin/orders${params.toString() ? `?${params}` : ''}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Failed to fetch orders')
      }

      const orders: Order[] = await response.json()

      if (orders.length === 0) {
        setError('No orders found for the selected date range.')
        setIsLoading(false)
        return
      }

      // Generate CSV
      const csv = generateCSV(orders)

      // Build filename using captured values
      const filename = buildFilename(currentStartDate, currentEndDate)

      // Create and trigger download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `${filename}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch {
      setError('Failed to download orders. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Date Picker */}
      <div className="flex items-center justify-end gap-3" ref={calendarRef}>
        {isMobile ? (
          <input
            type="date"
            value={selectedDate || todayStr}
            max={todayStr}
            onChange={(e) => {
              const val = e.target.value
              setSelectedDate(val === todayStr ? '' : val)
            }}
            className="px-3 py-2 bg-white border border-delo-navy/15 rounded-lg font-manrope text-sm text-delo-navy shadow-sm date-input"
          />
        ) : (
          <div className="relative">
            <button
              onClick={() => setCalendarOpen(!calendarOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-delo-navy/15 rounded-lg font-manrope text-sm text-delo-navy shadow-sm hover:border-delo-navy/30 transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="text-delo-navy/40"
              >
                <path
                  d="M5 1v2M11 1v2M2 6h12M3 3h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {isViewingToday ? 'Today' : formatDateLabel(selectedDate)}
            </button>
            <AnimatePresence>
              {calendarOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl border border-delo-navy/10 shadow-lg p-3 delo-calendar"
                >
                  <DayPicker
                    mode="single"
                    selected={selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date()}
                    onSelect={handleDaySelect}
                    disabled={{ after: new Date() }}
                    defaultMonth={selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date()}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        {!isViewingToday && (
          <button
            onClick={() => setSelectedDate('')}
            className="text-sm font-manrope text-delo-maroon/70 hover:text-delo-maroon transition-colors underline underline-offset-2 decoration-delo-maroon/30"
          >
            Reset
          </button>
        )}
      </div>

      {/* Stats Section */}
      {isLoadingStats ? (
        <StatsLoadingSkeleton />
      ) : statsError ? (
        <div className="bg-white rounded-xl p-6 border border-delo-navy/10">
          <p className="text-red-600 text-sm">{statsError}</p>
        </div>
      ) : stats ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Order Count Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <StatsCard
              title={isViewingToday ? 'Today' : formatDateLabel(selectedDate)}
              counts={stats.today}
            />
            <StatsCard
              title={isViewingToday ? 'All Time' : `Up to ${formatDateLabel(selectedDate)}`}
              counts={stats.allTime}
            />
          </div>

          {/* Popular Drinks + Modifier Preferences */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <PopularDrinksList drinks={stats.popularDrinks} />
            <ModifierPreferences breakdown={stats.modifierBreakdown} />
          </div>

          {/* Wait timing (owner ruling, Sep 6: sits below trends, above export) */}
          <WaitTimingSection
            timing={stats.timing}
            dateLabel={isViewingToday ? 'today' : `on ${formatDateLabel(selectedDate)}`}
          />
        </motion.div>
      ) : null}

      {/* CSV Export Section */}
      <div className="bg-white rounded-xl p-4 md:p-6 border border-delo-navy/10">
        <h2 className="font-bricolage font-semibold text-lg md:text-xl text-delo-navy mb-2 text-balance">
          Export Orders
        </h2>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Intro text */}
        <p className="text-description text-xs md:text-sm mb-4 md:mb-6 text-pretty">
          Download order data as CSV for your records. Leave dates blank to export all orders.
        </p>

        {/* Date range inputs */}
        <div className="mb-4 md:mb-6">
          <label className="block text-sm font-manrope font-semibold text-delo-navy/70 mb-2">
            Date Range (optional)
          </label>
          <div className="flex flex-col md:flex-row gap-3 md:gap-4 md:items-center">
            <div className="flex-1">
              <label className="block text-xs font-manrope text-delo-navy/50 mb-1 md:hidden">
                From
              </label>
              <input
                ref={startDateRef}
                type="date"
                className="w-full px-4 py-3 border border-delo-navy/20 rounded-lg font-manrope text-base focus:outline-none focus:ring-2 focus:ring-delo-maroon/30 focus:border-delo-maroon date-input"
                aria-label="Start date"
              />
            </div>
            <span className="text-delo-navy/40 font-manrope hidden md:block">to</span>
            <div className="flex-1">
              <label className="block text-xs font-manrope text-delo-navy/50 mb-1 md:hidden">
                To
              </label>
              <input
                ref={endDateRef}
                type="date"
                className="w-full px-4 py-3 border border-delo-navy/20 rounded-lg font-manrope text-base focus:outline-none focus:ring-2 focus:ring-delo-maroon/30 focus:border-delo-maroon date-input"
                aria-label="End date"
              />
            </div>
          </div>
        </div>

        {/* Download button */}
        <motion.button
          onClick={handleDownload}
          disabled={isLoading}
          whileTap={{ scale: 0.97 }}
          className="w-full md:w-auto px-6 py-3 min-h-[44px] font-manrope font-semibold text-delo-cream bg-delo-maroon hover:bg-delo-maroon/90 disabled:bg-delo-maroon/50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {isLoading ? 'Downloading...' : 'Download CSV'}
        </motion.button>
      </div>
    </div>
  )
}

// --- Subcomponents (modular for easy iteration) ---

/** Stats card showing order counts with status breakdown */
function StatsCard({ title, counts }: { title: string; counts: OrderCounts }) {
  return (
    <div className="bg-white rounded-xl p-4 md:p-6 border border-delo-navy/10">
      <h3 className="font-bricolage font-semibold text-sm uppercase tracking-wider text-delo-navy/60 mb-1 text-balance">
        {title}
      </h3>
      <p className="font-bricolage font-bold text-3xl md:text-4xl text-delo-maroon mb-3 tabular-nums">
        {counts.total}
        <span className="text-base md:text-lg font-semibold text-delo-navy/40 ml-2">orders</span>
      </p>
      <div className="flex gap-4 text-sm font-manrope flex-wrap">
        <span className="text-delo-navy/70">
          <span className="font-semibold text-[#C85A2E]">{counts.placed}</span> placed
        </span>
        {counts.in_progress > 0 && (
          <span className="text-delo-navy/70">
            <span className="font-semibold text-blue-600">{counts.in_progress}</span> in progress
          </span>
        )}
        <span className="text-delo-navy/70">
          <span className="font-semibold text-green-600">{counts.ready}</span> ready
        </span>
        <span className="text-delo-navy/70">
          <span className="font-semibold text-red-500">{counts.canceled}</span> canceled
        </span>
      </div>
    </div>
  )
}

/** Scrollable list of top drinks */
function PopularDrinksList({ drinks }: { drinks: DrinkCount[] }) {
  return (
    <div className="bg-white rounded-xl p-4 md:p-6 border border-delo-navy/10">
      <h3 className="font-bricolage font-semibold text-sm uppercase tracking-wider text-delo-navy/60 mb-4">
        Popular Drinks
      </h3>
      {drinks.length === 0 ? (
        <p className="text-description text-sm">No orders yet</p>
      ) : (
        <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2">
          {drinks.map((drink, index) => (
            <div key={drink.name} className="flex items-center justify-between">
              <span className="font-manrope text-delo-navy">
                <span className="text-delo-navy/40 w-6 inline-block">{index + 1}.</span>
                {drink.name}
              </span>
              <span className="font-manrope font-semibold text-delo-maroon tabular-nums">
                {drink.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Modifier preferences with visual progress bars */
function ModifierPreferences({ breakdown }: { breakdown: Record<string, ModifierOption[]> }) {
  const categories = Object.entries(breakdown)

  if (categories.length === 0) {
    return (
      <div className="bg-white rounded-xl p-4 md:p-6 border border-delo-navy/10">
        <h3 className="font-bricolage font-semibold text-sm uppercase tracking-wider text-delo-navy/60 mb-4">
          Modifier Preferences
        </h3>
        <p className="text-description text-sm">No data yet</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl p-4 md:p-6 border border-delo-navy/10">
      <h3 className="font-bricolage font-semibold text-sm uppercase tracking-wider text-delo-navy/60 mb-4">
        Modifier Preferences
      </h3>
      <div className="space-y-5">
        {categories.map(([category, options]) => (
          <div key={category}>
            <p className="font-cooper text-sm text-delo-navy/70 mb-2 capitalize">{category}</p>
            <div className="space-y-2">
              {options.map((option) => (
                <div key={option.option} className="flex items-center gap-3">
                  <div className="flex-1 bg-delo-navy/10 rounded-full h-3">
                    <div
                      className="bg-delo-maroon rounded-full h-3 transition-all duration-500"
                      style={{ width: `${option.percentage}%` }}
                    />
                  </div>
                  <span className="font-manrope font-semibold text-sm text-delo-navy w-10 text-right tabular-nums">
                    {option.percentage}%
                  </span>
                  <span className="font-manrope text-sm text-delo-navy/70 w-16">
                    {option.option}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Loading skeleton for stats */
function StatsLoadingSkeleton() {
  return (
    <div className="space-y-4 md:space-y-6 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <div className="bg-white rounded-xl p-4 md:p-6 border border-delo-navy/10 h-32" />
        <div className="bg-white rounded-xl p-4 md:p-6 border border-delo-navy/10 h-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <div className="bg-white rounded-xl p-4 md:p-6 border border-delo-navy/10 h-48" />
        <div className="bg-white rounded-xl p-4 md:p-6 border border-delo-navy/10 h-48" />
      </div>
      <div className="card-admin h-96" />
    </div>
  )
}
