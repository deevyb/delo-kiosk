'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AdminTabs, { AdminTab } from './AdminTabs'
import MenuItemsSection from './MenuItemsSection'
import ModifiersSection from './ModifiersSection'
import DashboardSection from './DashboardSection'
import NavMenu from './NavMenu'
import Link from 'next/link'
import { MenuItem, Modifier } from '@/lib/supabase'

interface AdminClientProps {
  initialMenuItems: MenuItem[]
  initialModifiers: Modifier[]
  onLogout: () => void
}

/**
 * AdminClient - Main admin panel with tabbed navigation
 *
 * Manages state for menu items and modifiers
 */
export default function AdminClient({
  initialMenuItems,
  initialModifiers,
  onLogout,
}: AdminClientProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('menu')
  const [menuItems, setMenuItems] = useState(initialMenuItems)
  const [modifiers, setModifiers] = useState(initialModifiers)

  // Update a menu item in local state (called after API success)
  const handleMenuItemUpdate = (updatedItem: MenuItem) => {
    setMenuItems((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)))
  }

  // Update a modifier in local state (called after API success)
  const handleModifierUpdate = (updatedModifier: Modifier) => {
    setModifiers((prev) =>
      prev.map((mod) => (mod.id === updatedModifier.id ? updatedModifier : mod))
    )
  }

  // Add a new modifier to local state (called after API success)
  const handleModifierAdd = (newModifier: Modifier) => {
    setModifiers((prev) => [...prev, newModifier])
  }

  // Add a new menu item to local state (called after API success)
  const handleMenuItemAdd = (newItem: MenuItem) => {
    setMenuItems((prev) => [...prev, newItem])
  }

  // Replace full menu items array (used for drag-and-drop reorder)
  const handleMenuItemsReorder = (reorderedItems: MenuItem[]) => {
    setMenuItems(reorderedItems)
  }

  return (
    <main className="min-h-screen p-8 bg-delo-cream">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <Link href="/" className="cursor-pointer"><h1 className="font-yatra text-4xl text-delo-maroon mb-1">Delo Coffee Admin</h1></Link>
            <p className="text-description">Manage your menu and view orders</p>
          </div>
          <NavMenu onLogout={onLogout} />
        </div>

        {/* Tabs */}
        <AdminTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        <div className="mt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'menu' && (
                <MenuItemsSection
                  menuItems={menuItems}
                  modifiers={modifiers}
                  onUpdate={handleMenuItemUpdate}
                  onAdd={handleMenuItemAdd}
                  onReorder={handleMenuItemsReorder}
                />
              )}

              {activeTab === 'modifiers' && (
                <ModifiersSection
                  modifiers={modifiers}
                  onUpdate={handleModifierUpdate}
                  onAdd={handleModifierAdd}
                />
              )}

              {activeTab === 'dashboard' && <DashboardSection />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </main>
  )
}
