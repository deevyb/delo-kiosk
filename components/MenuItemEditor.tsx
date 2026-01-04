'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { MenuItem } from '@/lib/supabase'

interface MenuItemEditorProps {
  item: MenuItem
  categories: string[]
  onSave: (modifierConfig: Record<string, boolean>) => void
  onClose: () => void
}

/**
 * MenuItemEditor - Modal for editing which modifiers apply to a drink
 *
 * Dynamically renders checkboxes based on available modifier categories
 * (e.g., "milk", "temperature" — or whatever categories exist in the database)
 */
export default function MenuItemEditor({ item, categories, onSave, onClose }: MenuItemEditorProps) {
  // Initialize state from the item's current config, defaulting to false for each category
  const [config, setConfig] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    categories.forEach((cat) => {
      initial[cat] = item.modifier_config?.[cat] ?? false
    })
    return initial
  })
  const [isSaving, setIsSaving] = useState(false)

  const handleToggle = (category: string) => {
    setConfig((prev) => ({
      ...prev,
      [category]: !prev[category],
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    await onSave(config)
    setIsSaving(false)
  }

  // Capitalize first letter for display (e.g., "milk" → "Milk")
  const formatCategoryName = (cat: string) => {
    return cat.charAt(0).toUpperCase() + cat.slice(1)
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 bg-delo-navy/40 z-40"
        aria-label="Close modal"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          className="bg-delo-cream rounded-xl shadow-2xl p-8 w-full max-w-md relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* X close button */}
          <motion.button
            onClick={onClose}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-delo-navy/5 hover:bg-delo-navy/10 transition-colors"
            aria-label="Close"
          >
            <span className="text-delo-navy/60 text-xl leading-none">×</span>
          </motion.button>

          {/* Header */}
          <h2 className="font-bricolage font-bold text-2xl text-delo-maroon pr-12 mb-2">
            {item.name}
          </h2>
          <p className="text-description text-sm mb-6">
            Choose which modifier options customers can select
          </p>

          {/* Dynamic checkboxes */}
          <fieldset>
            <legend className="label-modifier mb-4">Available Options</legend>
            <div className="space-y-3">
              {categories.map((category) => (
                <label
                  key={category}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={config[category] ?? false}
                    onChange={() => handleToggle(category)}
                    className="w-[18px] h-[18px] rounded border-2 border-delo-navy/20 text-delo-maroon focus:ring-delo-maroon focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="font-manrope font-semibold text-base text-delo-navy group-hover:text-delo-maroon transition-colors">
                    {formatCategoryName(category)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {categories.length === 0 && (
            <p className="text-delo-navy/40 text-sm">
              No modifier categories have been created yet.
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-8">
            <button
              onClick={onClose}
              className="flex-1 h-12 rounded-xl font-manrope font-semibold text-delo-navy/60 bg-delo-navy/5 hover:bg-delo-navy/10 transition-colors"
            >
              Cancel
            </button>
            <motion.button
              onClick={handleSave}
              disabled={isSaving}
              whileTap={{ scale: 0.97 }}
              className="flex-1 h-12 rounded-xl font-manrope font-semibold text-delo-cream bg-delo-maroon hover:bg-delo-maroon/90 disabled:bg-delo-navy/20 disabled:text-delo-navy/40 transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </>
  )
}
