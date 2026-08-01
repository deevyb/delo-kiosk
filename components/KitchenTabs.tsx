'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PillTabs, { PillTab } from './PillTabs'

/**
 * Tabs the kitchen display can actually show. Narrower than OrderStatus on purpose:
 * `in_progress` orders live inside the Queue tab (folded in solo mode, split out in
 * multi-barista mode) and are never a tab of their own.
 */
export type KitchenTab = 'placed' | 'ready' | 'canceled'

function DropdownToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full px-4 min-h-[44px] pb-2 flex items-center justify-between text-left font-manrope font-semibold text-base text-delo-navy/70 hover:bg-delo-navy/5 transition-colors"
    >
      <span>{label}</span>
      <div
        aria-hidden="true"
        className={`w-10 h-[22px] rounded-full relative transition-colors duration-150 ${
          checked ? 'bg-delo-maroon' : 'bg-delo-navy/20'
        }`}
      >
        <motion.div
          className="absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm"
          animate={{ left: checked ? 21 : 3 }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      </div>
    </motion.button>
  )
}

function DropdownSectionLabel({ label }: { label: string }) {
  return (
    <div className="px-4 pt-3 pb-1">
      <span className="font-cooper text-[10px] uppercase tracking-wider text-delo-navy/40">
        {label}
      </span>
    </div>
  )
}

interface KitchenTabsProps {
  activeTab: KitchenTab
  onTabChange: (tab: KitchenTab) => void
  placedCount: number
  readyCount: number
  cancelledCount: number
  todayOnly: boolean
  onTodayOnlyChange: (value: boolean) => void
  isMultiBarista?: boolean
  myDrinksOnly?: boolean
  onMyDrinksOnlyChange?: (value: boolean) => void
}

export default function KitchenTabs({
  activeTab,
  onTabChange,
  placedCount,
  readyCount,
  cancelledCount,
  todayOnly,
  onTodayOnlyChange,
  isMultiBarista = false,
  myDrinksOnly = true,
  onMyDrinksOnlyChange,
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

  const mainTabs: PillTab[] = [
    { id: 'placed', label: 'Queue', count: placedCount },
    { id: 'ready', label: 'Ready', count: readyCount },
  ]

  const isOverflowActive = activeTab === 'canceled'

  return (
    <div className="flex items-center gap-2">
      {/* Main tabs */}
      <PillTabs
        tabs={mainTabs}
        activeTab={activeTab}
        onTabChange={(id) => {
          onTabChange(id as KitchenTab)
          setDropdownOpen(false)
        }}
        layoutId="activeTab"
        className="flex-1"
      />

      {/* Overflow menu */}
      <div ref={overflowRef} className="relative">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setDropdownOpen((prev) => !prev)}
          className={`w-[44px] h-[44px] md:w-[52px] md:h-[52px] rounded-xl flex items-center justify-center font-bold text-xl transition-colors ${
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
              className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-lg border border-delo-navy/10 overflow-hidden z-20 min-w-[160px] md:min-w-[200px]"
            >
              {/* VIEW section */}
              <DropdownSectionLabel label="View" />
              <button
                onClick={() => {
                  onTabChange('canceled')
                  setDropdownOpen(false)
                }}
                className={`w-full px-4 min-h-[44px] flex items-center text-left font-manrope font-semibold text-base transition-colors ${
                  isOverflowActive
                    ? 'text-delo-maroon bg-delo-maroon/5'
                    : 'text-delo-navy/70 hover:bg-delo-navy/5'
                }`}
              >
                <span className="tabular-nums">Cancelled ({cancelledCount})</span>
              </button>

              {/* Divider */}
              <div className="mx-4 border-t border-delo-navy/10" />

              {/* FILTER section */}
              <DropdownSectionLabel label="Filter" />
              <DropdownToggle label="Today only" checked={todayOnly} onChange={onTodayOnlyChange} />
              {isMultiBarista && onMyDrinksOnlyChange && (
                <DropdownToggle
                  label="My drinks only"
                  checked={myDrinksOnly}
                  onChange={onMyDrinksOnlyChange}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
