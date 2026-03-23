'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Modifier } from '@/lib/supabase'
import ResponsiveModal from './ResponsiveModal'

interface ModifierFormProps {
  modifier?: Modifier // undefined = add mode, defined = edit mode
  categories: string[] // available categories from existing modifiers
  existingModifiers: Modifier[] // for duplicate validation
  onSave: (category: string, option: string) => Promise<void>
  onClose: () => void
  isOpen: boolean
}

/**
 * ModifierForm - Modal for adding or editing a modifier option
 *
 * Uses shared Modal component and shared CSS classes for consistency.
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
  isOpen,
}: ModifierFormProps) {
  const isEditing = !!modifier

  const [category, setCategory] = useState(modifier?.category || categories[0] || '')
  const [option, setOption] = useState(modifier?.option || '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Focus input on mount
  useEffect(() => {
    if (isOpen) {
      const input = document.getElementById('modifier-option-input')
      if (input) {
        input.focus()
      }
    }
  }, [isOpen])

  const formatCategoryName = (cat: string) => {
    return cat.charAt(0).toUpperCase() + cat.slice(1)
  }

  const validateOption = (): string | null => {
    const trimmed = option.trim()
    if (!trimmed) {
      return 'Option name is required'
    }

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
    <ResponsiveModal isOpen={isOpen} onClose={onClose} size="md" fullSheet>
      {/* Header */}
      <h2 className="modal-title">{isEditing ? 'Edit Modifier' : 'Add Modifier'}</h2>
      <p className="modal-description">
        {isEditing
          ? `Update the name for this ${formatCategoryName(modifier!.category)} option`
          : 'Create a new modifier option'}
      </p>

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="error-banner mb-4"
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
            {formatCategoryName(modifier!.category)}
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
          className="input-form"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onClose} className="btn-secondary flex-1">
          Cancel
        </button>
        <motion.button
          onClick={handleSave}
          disabled={isSaving}
          whileTap={{ scale: 0.97 }}
          className="btn-modal-action flex-1"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </motion.button>
      </div>
    </ResponsiveModal>
  )
}
