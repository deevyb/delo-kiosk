'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { OrderStatus } from '@/lib/supabase'

type MainTab = 'placed' | 'ready'

interface KitchenTabsProps {
  activeTab: OrderStatus
  onTabChange: (tab: OrderStatus) => void
  placedCount: number
  readyCount: number
  cancelledCount: number
}

export default function KitchenTabs({
  activeTab,
  onTabChange,
  placedCount,
  readyCount,
  cancelledCount,
}: KitchenTabsProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const overflowRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    function handleClick(e: MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  const mainTabs: { id: MainTab; label: string; count: number }[] = [
    { id: 'placed', label: 'Placed', count: placedCount },
    { id: 'ready', label: 'Ready', count: readyCount },
  ]

  const isOverflowActive = activeTab === 'canceled'

  return (
    <div className="flex items-center gap-2">
      {/* Main tabs */}
      <div className="flex gap-1 bg-delo-navy/5 p-1 rounded-xl flex-1">
        {mainTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              onTabChange(tab.id)
              setDropdownOpen(false)
            }}
            className={`relative flex-1 py-3 px-6 rounded-lg font-manrope font-semibold text-base transition-colors min-h-[52px] ${
              activeTab === tab.id ? 'text-delo-maroon' : 'text-delo-navy/50 hover:text-delo-navy/70'
            }`}
          >
            {/* Active tab background — only for main tabs */}
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-white rounded-lg shadow-sm"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}

            {/* Tab label with count */}
            <span className="relative z-10 tabular-nums">
              {tab.label} ({tab.count})
            </span>
          </button>
        ))}
      </div>

      {/* Overflow menu */}
      <div ref={overflowRef} className="relative">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setDropdownOpen((prev) => !prev)}
          className={`w-[52px] h-[52px] rounded-xl flex items-center justify-center font-bold text-xl transition-colors ${
            isOverflowActive
              ? 'bg-white text-delo-maroon shadow-sm'
              : 'bg-delo-navy/5 text-delo-navy/40 hover:text-delo-navy/60'
          }`}
        >
          ⋯
        </motion.button>

        {/* Dropdown */}
        <AnimatePresence>
          {dropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-lg border border-delo-navy/10 overflow-hidden z-20 min-w-[180px]"
            >
              <button
                onClick={() => {
                  onTabChange('canceled')
                  setDropdownOpen(false)
                }}
                className={`w-full px-4 py-3 text-left font-manrope font-semibold text-base transition-colors ${
                  isOverflowActive
                    ? 'text-delo-maroon bg-delo-maroon/5'
                    : 'text-delo-navy/70 hover:bg-delo-navy/5'
                }`}
              >
                <span className="tabular-nums">Cancelled ({cancelledCount})</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
