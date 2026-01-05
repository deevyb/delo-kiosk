'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Modifier } from '@/lib/supabase'
import ModifierRow from './ModifierRow'
import ModifierForm from './ModifierForm'

interface ModifiersSectionProps {
  modifiers: Modifier[]
  onUpdate: (updatedModifier: Modifier) => void
  onAdd: (newModifier: Modifier) => void
}

/**
 * ModifiersSection - Manage modifier options grouped by category
 *
 * Shows modifier options (e.g., Milk: Regular, Oat | Temperature: Hot, Iced)
 * Allows toggling active state and editing option names
 */
export default function ModifiersSection({ modifiers, onUpdate, onAdd }: ModifiersSectionProps) {
  const [editingModifier, setEditingModifier] = useState<Modifier | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Extract unique categories from modifiers (dynamic, not hardcoded)
  const categories = Array.from(new Set(modifiers.map((m) => m.category))).sort()

  // Group modifiers by category
  const modifiersByCategory: Record<string, Modifier[]> = {}
  categories.forEach((cat) => {
    modifiersByCategory[cat] = modifiers
      .filter((m) => m.category === cat)
      .sort((a, b) => a.display_order - b.display_order)
  })

  // Capitalize first letter for display
  const formatCategoryName = (cat: string) => {
    return cat.charAt(0).toUpperCase() + cat.slice(1)
  }

  const handleToggle = async (modifier: Modifier) => {
    setError(null)

    // Optimistic update
    const newActiveState = !modifier.is_active
    onUpdate({ ...modifier, is_active: newActiveState })

    try {
      const response = await fetch('/api/admin/modifiers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: modifier.id, is_active: newActiveState }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update')
      }

      const updatedModifier = await response.json()
      onUpdate(updatedModifier)
    } catch {
      // Revert on error
      onUpdate(modifier)
      setError('Failed to update. Please try again.')
      setTimeout(() => setError(null), 4000)
    }
  }

  const handleSaveModifier = async (category: string, option: string) => {
    setError(null)

    if (editingModifier) {
      // Edit mode: PATCH existing modifier
      try {
        const response = await fetch('/api/admin/modifiers', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingModifier.id, option }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to update')
        }

        const updatedModifier = await response.json()
        onUpdate(updatedModifier)
        setEditingModifier(null)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save. Please try again.'
        setError(message)
        setTimeout(() => setError(null), 4000)
        throw err // Re-throw so the form knows to keep showing
      }
    } else {
      // Add mode: POST new modifier
      try {
        const response = await fetch('/api/admin/modifiers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, option }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to create')
        }

        const newModifier = await response.json()
        onAdd(newModifier)
        setIsAdding(false)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save. Please try again.'
        setError(message)
        setTimeout(() => setError(null), 4000)
        throw err
      }
    }
  }

  const renderCategory = (category: string, items: Modifier[]) => {
    return (
      <div key={category} className="mb-8 last:mb-0">
        <h3 className="font-bricolage font-semibold text-base text-delo-navy/60 uppercase tracking-wide mb-3">
          {formatCategoryName(category)}
        </h3>
        <div className="space-y-2">
          {items.map((modifier) => (
            <ModifierRow
              key={modifier.id}
              modifier={modifier}
              onToggle={() => handleToggle(modifier)}
              onEdit={() => setEditingModifier(modifier)}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl p-6 border border-delo-navy/10">
      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header with Add button */}
      <div className="flex items-start justify-between mb-6">
        <p className="text-description text-sm">
          Add or edit milk and temperature options. Toggle to show or hide on the order screen.
        </p>
        <button
          onClick={() => setIsAdding(true)}
          className="shrink-0 ml-4 px-4 py-2 min-h-[44px] text-sm font-manrope font-semibold text-delo-cream bg-delo-maroon hover:bg-delo-maroon/90 rounded-lg transition-colors"
        >
          + Add
        </button>
      </div>

      {/* Categories */}
      {categories.length === 0 ? (
        <p className="text-delo-navy/40 text-sm py-8 text-center">
          No modifiers found. Add your first modifier option above.
        </p>
      ) : (
        categories.map((cat) => renderCategory(cat, modifiersByCategory[cat]))
      )}

      {/* Add/Edit modal */}
      <AnimatePresence>
        {(isAdding || editingModifier) && (
          <ModifierForm
            modifier={editingModifier || undefined}
            categories={categories}
            existingModifiers={modifiers}
            onSave={handleSaveModifier}
            onClose={() => {
              setIsAdding(false)
              setEditingModifier(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
