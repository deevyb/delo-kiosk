'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Modifier } from '@/lib/supabase'

interface ModifierFormProps {
  modifier?: Modifier // undefined = add mode, defined = edit mode
  categories: string[] // available categories from existing modifiers
  existingModifiers: Modifier[] // for duplicate validation
  onSave: (category: string, option: string) => Promise<void>
  onClose: () => void
}

/**
 * ModifierForm - Modal for adding or editing a modifier option
 *
 * Add mode: select category + enter option name
 * Edit mode: category locked, can only change option name
 */
export default function ModifierForm({
  modifier,
  categories,
  existingModifiers,
  onSave,
  onClose,
}: ModifierFormProps) {
  const isEditing = !!modifier

  const [category, setCategory] = useState(modifier?.category || categories[0] || '')
  const [option, setOption] = useState(modifier?.option || '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Focus input on mount
  useEffect(() => {
    const input = document.getElementById('modifier-option-input')
    if (input) {
      input.focus()
    }
  }, [])

  // Capitalize first letter for display
  const formatCategoryName = (cat: string) => {
    return cat.charAt(0).toUpperCase() + cat.slice(1)
  }

  const validateOption = (): string | null => {
    const trimmed = option.trim()
    if (!trimmed) {
      return 'Option name is required'
    }

    // Check for duplicates within the same category (excluding self if editing)
    const duplicate = existingModifiers.find(
      (m) =>
        m.category === category &&
        m.option.toLowerCase() === trimmed.toLowerCase() &&
        m.id !== modifier?.id
    )

    if (duplicate) {
      return `This option already exists in ${formatCategoryName(category)}`
    }

    return null
  }

  const handleSave = async () => {
    setError(null)

    if (!category) {
      setError('Please select a category')
      return
    }

    const validationError = validateOption()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSaving(true)
    try {
      await onSave(category, option.trim())
    } catch {
      setError('Failed to save. Please try again.')
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSaving) {
      e.preventDefault()
      handleSave()
    }
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
            {isEditing ? 'Edit Modifier' : 'Add Modifier'}
          </h2>
          <p className="text-description text-sm mb-6">
            {isEditing
              ? `Update the name for this ${formatCategoryName(modifier.category)} option`
              : 'Create a new modifier option'}
          </p>

          {/* Error message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm"
            >
              {error}
            </motion.div>
          )}

          {/* Category selector (only in add mode) */}
          {!isEditing && categories.length > 0 && (
            <div className="mb-6">
              <label className="label-modifier mb-2 block">Category</label>
              <div className="flex gap-3">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`flex-1 h-12 rounded-xl font-manrope font-semibold transition-all ${
                      category === cat
                        ? 'bg-delo-maroon text-delo-cream'
                        : 'bg-delo-navy/5 text-delo-navy/60 hover:bg-delo-navy/10'
                    }`}
                  >
                    {formatCategoryName(cat)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Show category badge in edit mode */}
          {isEditing && (
            <div className="mb-6">
              <label className="label-modifier mb-2 block">Category</label>
              <span className="inline-block px-4 py-2 bg-delo-navy/5 text-delo-navy/60 font-manrope font-semibold rounded-lg">
                {formatCategoryName(modifier.category)}
              </span>
            </div>
          )}

          {/* Option name input */}
          <div className="mb-6">
            <label htmlFor="modifier-option-input" className="label-modifier mb-2 block">
              Option Name
            </label>
            <input
              id="modifier-option-input"
              type="text"
              value={option}
              onChange={(e) => setOption(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`e.g. "${category === 'milk' ? 'Almond' : 'Extra Hot'}"`}
              className="w-full h-12 px-4 rounded-xl border border-delo-navy/20 bg-white font-manrope text-delo-navy placeholder:text-delo-navy/30 focus:outline-none focus:border-delo-maroon focus:ring-1 focus:ring-delo-maroon transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
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
