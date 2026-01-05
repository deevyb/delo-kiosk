'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Order, DashboardStats, OrderCounts, DrinkCount, ModifierOption } from '@/lib/supabase'

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
  // Stats state
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)

  // CSV export state
  const startDateRef = useRef<HTMLInputElement>(null)
  const endDateRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch stats on mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/admin/stats')
        if (!response.ok) throw new Error('Failed to fetch stats')
        const data = await response.json()
        setStats(data)
      } catch (err) {
        console.error('Error fetching stats:', err)
        setStatsError('Failed to load statistics')
      } finally {
        setIsLoadingStats(false)
      }
    }
    fetchStats()
  }, [])

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
          <div className="grid grid-cols-2 gap-4">
            <StatsCard title="Today" counts={stats.today} />
            <StatsCard title="All Time" counts={stats.allTime} />
          </div>

          {/* Popular Drinks + Modifier Preferences */}
          <div className="grid grid-cols-2 gap-4">
            <PopularDrinksList drinks={stats.popularDrinks} />
            <ModifierPreferences breakdown={stats.modifierBreakdown} />
          </div>
        </motion.div>
      ) : null}

      {/* CSV Export Section */}
      <div className="bg-white rounded-xl p-6 border border-delo-navy/10">
        <h2 className="font-bricolage font-semibold text-xl text-delo-navy mb-2">Export Orders</h2>

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
      <p className="text-description text-sm mb-6">
        Download order data as CSV for your records. Leave dates blank to export all orders.
      </p>

      {/* Date range inputs */}
      <div className="mb-6">
        <label className="block text-sm font-manrope font-semibold text-delo-navy/70 mb-2">
          Date Range (optional)
        </label>
        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <input
              ref={startDateRef}
              type="date"
              className="w-full px-4 py-3 border border-delo-navy/20 rounded-lg font-manrope text-base focus:outline-none focus:ring-2 focus:ring-delo-maroon/30 focus:border-delo-maroon date-input"
              aria-label="Start date"
            />
          </div>
          <span className="text-delo-navy/40 font-manrope">to</span>
          <div className="flex-1">
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
      <button
        onClick={handleDownload}
        disabled={isLoading}
        className="px-6 py-3 min-h-[44px] font-manrope font-semibold text-delo-cream bg-delo-maroon hover:bg-delo-maroon/90 disabled:bg-delo-maroon/50 disabled:cursor-not-allowed rounded-lg transition-colors"
      >
        {isLoading ? 'Downloading...' : 'Download CSV'}
      </button>
      </div>
    </div>
  )
}

// --- Subcomponents (modular for easy iteration) ---

/** Stats card showing order counts with status breakdown */
function StatsCard({ title, counts }: { title: string; counts: OrderCounts }) {
  return (
    <div className="bg-white rounded-xl p-6 border border-delo-navy/10">
      <h3 className="font-bricolage font-semibold text-sm uppercase tracking-wider text-delo-navy/60 mb-1">
        {title}
      </h3>
      <p className="font-bricolage font-bold text-4xl text-delo-maroon mb-3">
        {counts.total}
        <span className="text-lg font-semibold text-delo-navy/40 ml-2">orders</span>
      </p>
      <div className="flex gap-4 text-sm font-manrope">
        <span className="text-delo-navy/70">
          <span className="font-semibold text-[#C85A2E]">{counts.placed}</span> placed
        </span>
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
    <div className="bg-white rounded-xl p-6 border border-delo-navy/10">
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
              <span className="font-manrope font-semibold text-delo-maroon">{drink.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Modifier preferences with visual progress bars */
function ModifierPreferences({
  breakdown,
}: {
  breakdown: Record<string, ModifierOption[]>
}) {
  const categories = Object.entries(breakdown)

  if (categories.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 border border-delo-navy/10">
        <h3 className="font-bricolage font-semibold text-sm uppercase tracking-wider text-delo-navy/60 mb-4">
          Modifier Preferences
        </h3>
        <p className="text-description text-sm">No data yet</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl p-6 border border-delo-navy/10">
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
                  <span className="font-manrope font-semibold text-sm text-delo-navy w-10 text-right">
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
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-6 border border-delo-navy/10 h-32" />
        <div className="bg-white rounded-xl p-6 border border-delo-navy/10 h-32" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-6 border border-delo-navy/10 h-48" />
        <div className="bg-white rounded-xl p-6 border border-delo-navy/10 h-48" />
      </div>
    </div>
  )
}
