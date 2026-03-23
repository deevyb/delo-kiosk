'use client'

import { motion } from 'framer-motion'

export interface PillTab<T extends string = string> {
  id: T
  label: string
  mobileLabel?: string
  count?: number
}

interface PillTabsProps<T extends string> {
  tabs: PillTab<T>[]
  activeTab: T
  onTabChange: (id: T) => void
  layoutId: string
  className?: string
}

/**
 * PillTabs - Shared animated pill tab component
 *
 * Used by AdminTabs and KitchenTabs for consistent responsive behavior.
 * Labels swap via CSS (no JS listener needed) to avoid hydration mismatches.
 */
export default function PillTabs<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  layoutId,
  className = '',
}: PillTabsProps<T>) {
  return (
    <div className={`flex gap-1 bg-delo-navy/5 p-1 rounded-xl ${className}`}>
      {tabs.map((tab) => (
        <motion.button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          whileTap={{ scale: 0.97 }}
          className={`relative flex-1 py-2 px-3 md:py-3 md:px-6 rounded-lg font-manrope font-semibold text-sm md:text-base transition-colors min-h-[44px] md:min-h-[52px] ${
            activeTab === tab.id ? 'text-delo-maroon' : 'text-delo-navy/50 hover:text-delo-navy/70'
          }`}
        >
          {activeTab === tab.id && (
            <motion.div
              layoutId={layoutId}
              className="absolute inset-0 bg-white rounded-lg shadow-sm"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}

          <span className="relative z-10 tabular-nums">
            {tab.mobileLabel && <span className="md:hidden">{tab.mobileLabel}</span>}
            <span className={tab.mobileLabel ? 'hidden md:inline' : ''}>{tab.label}</span>
            {tab.count !== undefined ? ` (${tab.count})` : ''}
          </span>
        </motion.button>
      ))}
    </div>
  )
}
