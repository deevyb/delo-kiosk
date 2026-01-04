'use client'

import { motion } from 'framer-motion'

export type AdminTab = 'menu' | 'modifiers' | 'export'

interface AdminTabsProps {
  activeTab: AdminTab
  onTabChange: (tab: AdminTab) => void
}

/**
 * AdminTabs - Three-tab navigation for admin panel
 *
 * Same animated pill pattern as KitchenTabs for consistency
 */
export default function AdminTabs({ activeTab, onTabChange }: AdminTabsProps) {
  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'menu', label: 'Menu Items' },
    { id: 'modifiers', label: 'Modifiers' },
    { id: 'export', label: 'Export' },
  ]

  return (
    <div className="flex gap-1 bg-delo-navy/5 p-1 rounded-xl">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`relative flex-1 py-3 px-6 rounded-lg font-manrope font-semibold text-base transition-colors min-h-[52px] ${
            activeTab === tab.id ? 'text-delo-maroon' : 'text-delo-navy/50 hover:text-delo-navy/70'
          }`}
        >
          {/* Active tab background - animates between tabs */}
          {activeTab === tab.id && (
            <motion.div
              layoutId="adminActiveTab"
              className="absolute inset-0 bg-white rounded-lg shadow-sm"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}

          {/* Tab label */}
          <span className="relative z-10">{tab.label}</span>
        </button>
      ))}
    </div>
  )
}
