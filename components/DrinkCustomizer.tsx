'use client'

import { motion } from 'framer-motion'
import { MenuItem, Modifier } from '@/lib/supabase'
import ModifierSelector from './ModifierSelector'
import Modal from './Modal'

interface DrinkCustomizerProps {
  drink: MenuItem
  modifiers: Modifier[]
  selectedModifiers: { milk?: string; temperature?: string }
  onModifierChange: (category: 'milk' | 'temperature', value: string) => void
  customerName: string
  onNameChange: (name: string) => void
  onSubmit: () => void
  onClose: () => void
  isSubmitting: boolean
  error: string | null
  isOpen: boolean
}

/**
 * DrinkCustomizer - Floating modal for customizing a selected drink
 *
 * Uses shared Modal component for consistent styling.
 * Animation: Slides up ~30px while fading in (iOS/Square style)
 *
 * Close behavior:
 * - X button in top-right corner
 * - Tap anywhere on the backdrop
 */
export default function DrinkCustomizer({
  drink,
  modifiers,
  selectedModifiers,
  onModifierChange,
  customerName,
  onNameChange,
  onSubmit,
  onClose,
  isSubmitting,
  error,
  isOpen,
}: DrinkCustomizerProps) {
  const milkOptions = modifiers.filter((m) => m.category === 'milk')
  const temperatureOptions = modifiers.filter((m) => m.category === 'temperature')

  const showMilk = drink.modifier_config?.milk ?? false
  const showTemperature = drink.modifier_config?.temperature ?? false
  const hasAnyModifiers = showMilk || showTemperature

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      {/* Drink name and description */}
      <h1 className="font-bricolage font-bold text-4xl text-delo-maroon pr-12">{drink.name}</h1>
      {drink.description && <p className="text-description mt-2 mb-8 pr-12">{drink.description}</p>}
      {!drink.description && <div className="mb-8" />}

      {/* Modifier selectors */}
      {hasAnyModifiers ? (
        <div className="space-y-2">
          {showMilk && milkOptions.length > 0 && (
            <ModifierSelector
              category="milk"
              options={milkOptions}
              selected={selectedModifiers.milk ?? null}
              onSelect={(value) => onModifierChange('milk', value)}
            />
          )}

          {showTemperature && temperatureOptions.length > 0 && (
            <ModifierSelector
              category="temperature"
              options={temperatureOptions}
              selected={selectedModifiers.temperature ?? null}
              onSelect={(value) => onModifierChange('temperature', value)}
            />
          )}
        </div>
      ) : null}

      {/* Name input */}
      <div className="mt-8">
        <label className="block label-modifier mb-3">Your Name</label>
        <input
          type="text"
          value={customerName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Name"
          className="input-form"
        />
      </div>

      {/* Submit button */}
      <motion.button
        onClick={onSubmit}
        disabled={!customerName.trim() || isSubmitting}
        whileTap={{ scale: 0.97 }}
        className="btn-primary mt-6 w-full"
      >
        {isSubmitting ? 'Sending...' : 'Submit'}
      </motion.button>

      {/* Error message */}
      {error && <p className="text-red-600 text-sm mt-3 text-center">{error}</p>}
    </Modal>
  )
}
