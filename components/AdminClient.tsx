'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AdminTabs, { AdminTab } from './AdminTabs'
import MenuItemsSection from './MenuItemsSection'
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
    setMenuItems((prev) =>
      prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
    )
  }

  // setModifiers will be used in Phase 4
  void setModifiers

  return (
    <main className="min-h-screen p-8 bg-delo-cream">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="font-yatra text-4xl text-delo-maroon mb-1">Delo Coffee Admin</h1>
            <p className="text-description">Manage your menu and view orders</p>
          </div>
          <button
            onClick={onLogout}
            className="text-delo-navy/50 hover:text-delo-maroon text-sm transition-colors"
          >
            Log out
          </button>
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
                />
              )}

              {activeTab === 'modifiers' && (
                <div className="bg-white rounded-xl p-8 border border-delo-navy/10">
                  <h2 className="font-bricolage font-semibold text-xl text-delo-navy mb-4">
                    Modifiers
                  </h2>
                  <p className="text-delo-navy/60">
                    Add, edit, or remove milk and temperature options. Coming in Phase 4...
                  </p>
                </div>
              )}

              {activeTab === 'export' && (
                <div className="bg-white rounded-xl p-8 border border-delo-navy/10">
                  <h2 className="font-bricolage font-semibold text-xl text-delo-navy mb-4">
                    Export Orders
                  </h2>
                  <p className="text-delo-navy/60">
                    Download order data as CSV. Coming in Phase 5...
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </main>
  )
}
