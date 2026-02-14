'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MenuItem } from '@/lib/supabase'
import Modal from './Modal'

interface MenuItemEditorProps {
  item: MenuItem
  categories: string[]
  onSave: (updates: { name: string; description: string | null; modifier_config: Record<string, boolean> }) => void
  onRemove: () => void
  onClose: () => void
  isOpen: boolean
}

/**
 * MenuItemEditor - Modal for editing which modifiers apply to a drink
 *
 * Uses shared Modal component and shared CSS classes for consistency.
 *
 * Dynamically renders checkboxes based on available modifier categories
 * (e.g., "milk", "temperature" — or whatever categories exist in the database)
 */
export default function MenuItemEditor({
  item,
  categories,
  onSave,
  onRemove,
  onClose,
  isOpen,
}: MenuItemEditorProps) {
  const [name, setName] = useState(item.name)
  const [description, setDescription] = useState(item.description || '')

  // Initialize state from the item's current config, defaulting to false for each category
  const [config, setConfig] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    categories.forEach((cat) => {
      initial[cat] = item.modifier_config?.[cat] ?? false
    })
    return initial
  })
  const [isSaving, setIsSaving] = useState(false)
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  const nameIsValid = name.trim().length > 0

  const handleToggle = (category: string) => {
    setConfig((prev) => ({
      ...prev,
      [category]: !prev[category],
    }))
  }

  const handleSave = async () => {
    if (!nameIsValid) return
    setIsSaving(true)
    await onSave({
      name: name.trim(),
      description: description.trim() || null,
      modifier_config: config,
    })
    setIsSaving(false)
  }

  const formatCategoryName = (cat: string) => {
    return cat.charAt(0).toUpperCase() + cat.slice(1)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      {/* Header */}
      <h2 className="modal-title">Edit Item</h2>

      {/* Name & Description */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="label-modifier mb-1.5 block">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-delo-navy/20 bg-white font-bricolage text-delo-navy text-base focus:outline-none focus:border-delo-maroon focus:ring-1 focus:ring-delo-maroon/30 transition-colors"
            placeholder="Drink name"
          />
          {!nameIsValid && name !== item.name && (
            <p className="text-red-500 text-xs mt-1 font-manrope">Name is required</p>
          )}
        </div>
        <div>
          <label className="label-modifier mb-1.5 block">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2.5 rounded-lg border border-delo-navy/20 bg-white font-manrope text-delo-navy text-sm focus:outline-none focus:border-delo-maroon focus:ring-1 focus:ring-delo-maroon/30 transition-colors resize-none"
            placeholder="Optional description"
          />
        </div>
      </div>

      {/* Modifier checkboxes */}
      <fieldset>
        <legend className="label-modifier mb-4">Available Options</legend>
        <div className="space-y-3">
          {categories.map((category) => (
            <label key={category} className="checkbox-label group">
              <input
                type="checkbox"
                checked={config[category] ?? false}
                onChange={() => handleToggle(category)}
                className="checkbox-form"
              />
              <span>{formatCategoryName(category)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {categories.length === 0 && (
        <p className="text-delo-navy/40 text-sm">No modifier categories have been created yet.</p>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-8">
        <button onClick={onClose} className="btn-secondary flex-1">
          Cancel
        </button>
        <motion.button
          onClick={handleSave}
          disabled={isSaving || !nameIsValid}
          whileTap={{ scale: 0.97 }}
          className={`btn-modal-action flex-1 ${!nameIsValid ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </motion.button>
      </div>

      {/* Remove from Menu */}
      <div className="mt-6 pt-6 border-t border-delo-navy/10">
        <AnimatePresence mode="wait">
          {!confirmingRemove ? (
            <motion.button
              key="remove-btn"
              onClick={() => setConfirmingRemove(true)}
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-10 rounded-lg font-manrope font-semibold text-sm text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              Archive from Menu
            </motion.button>
          ) : (
            <motion.div
              key="remove-confirm"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <p className="font-manrope text-sm text-delo-navy/70 mb-3">
                Archive <span className="font-semibold">{item.name}</span> from the menu?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmingRemove(false)}
                  className="btn-secondary flex-1 text-sm"
                >
                  Cancel
                </button>
                <motion.button
                  onClick={onRemove}
                  whileTap={{ scale: 0.97 }}
                  className="flex-1 h-12 rounded-xl font-manrope font-semibold text-sm text-white bg-red-500 hover:bg-red-600 transition-colors"
                >
                  Yes, Archive
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  )
}
