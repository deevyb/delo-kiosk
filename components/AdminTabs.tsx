'use client'

import PillTabs, { PillTab } from './PillTabs'

export type AdminTab = 'menu' | 'modifiers' | 'dashboard'

interface AdminTabsProps {
  activeTab: AdminTab
  onTabChange: (tab: AdminTab) => void
}

const tabs: PillTab<AdminTab>[] = [
  { id: 'menu', label: 'Menu Items', mobileLabel: 'Menu' },
  { id: 'modifiers', label: 'Modifiers', mobileLabel: 'Mods' },
  { id: 'dashboard', label: 'Dashboard' },
]

/**
 * AdminTabs - Three-tab navigation for admin panel
 *
 * Uses shared PillTabs component for consistent responsive behavior with KitchenTabs.
 */
export default function AdminTabs({ activeTab, onTabChange }: AdminTabsProps) {
  return (
    <PillTabs
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      layoutId="adminActiveTab"
    />
  )
}
