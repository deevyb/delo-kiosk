'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { MenuItem } from '@/lib/supabase'
import ResponsiveModal from './ResponsiveModal'

interface NewMenuItemFormProps {
  categories: string[] // modifier categories from database
  existingCategories: string[] // menu item categories (Signature, Classics)
  onSave: (newItem: MenuItem) => void
  onClose: () => void
  isOpen: boolean
}

/**
 * NewMenuItemForm - Modal for creating a new menu item
 *
 * Uses shared Modal component and shared CSS classes for consistency.
 *
 * Form fields:
 * - Name (required)
 * - Description (optional)
 * - Category dropdown (Signature, Classics)
 * - Modifier config checkboxes
 */
export default function NewMenuItemForm({
  categories,
  existingCategories,
  onSave,
  onClose,
  isOpen,
}: NewMenuItemFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(existingCategories[0] || 'Signature')
  const [modifierConfig, setModifierConfig] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    categories.forEach((cat) => {
      initial[cat] = false
    })
    return initial
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleToggleModifier = (cat: string) => {
    setModifierConfig((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }))
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/menu-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          category,
          modifier_config: modifierConfig,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create')
      }

      const newItem = await response.json()
      onSave(newItem)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const formatCategoryName = (cat: string) => {
    return cat.charAt(0).toUpperCase() + cat.slice(1)
  }

  return (
    <ResponsiveModal isOpen={isOpen} onClose={onClose} size="lg" fullSheet>
      {/* Header */}
      <h2 className="modal-title">Add New Item</h2>
      <p className="modal-description">Create a new drink for the menu</p>

      {/* Error message */}
      {error && <div className="error-banner mb-4">{error}</div>}

      {/* Name field */}
      <div className="mb-4">
        <label className="label-modifier mb-3 block">Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Cardamom Latte"
          className="input-form"
        />
      </div>

      {/* Description field */}
      <div className="mb-4">
        <label className="label-modifier mb-3 block">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A short description (optional)"
          className="input-form"
        />
      </div>

      {/* Category dropdown */}
      <div className="mb-6">
        <label className="label-modifier mb-3 block">Category</label>
        <div className="relative">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="select-form"
          >
            {existingCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <svg
            className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-delo-navy/40 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Modifier config checkboxes */}
      {categories.length > 0 && (
        <fieldset className="mb-6">
          <legend className="label-modifier mb-4">Modifier Options</legend>
          <p className="text-description text-xs mb-3">
            Which modifiers can customers choose for this drink?
          </p>
          <div className="space-y-3">
            {categories.map((cat) => (
              <label key={cat} className="checkbox-label group">
                <input
                  type="checkbox"
                  checked={modifierConfig[cat] ?? false}
                  onChange={() => handleToggleModifier(cat)}
                  className="checkbox-form"
                />
                <span>{formatCategoryName(cat)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onClose} className="btn-secondary flex-1">
          Cancel
        </button>
        <motion.button
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          whileTap={{ scale: 0.97 }}
          className="btn-modal-action flex-1"
        >
          {isSaving ? 'Creating...' : 'Create Item'}
        </motion.button>
      </div>
    </ResponsiveModal>
  )
}
