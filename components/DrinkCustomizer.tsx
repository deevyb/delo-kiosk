'use client'

import { motion } from 'framer-motion'
import { MenuItem, Modifier } from '@/lib/supabase'
import ModifierSelector from './ModifierSelector'

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
}

/**
 * DrinkCustomizer - Floating modal for customizing a selected drink
 *
 * Animation: Slides up ~30px while fading in (iOS/Square style)
 *
 * Close behavior:
 * - X button in top-right corner
 * - Tap anywhere on the blurred backdrop
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
}: DrinkCustomizerProps) {
  const milkOptions = modifiers.filter((m) => m.category === 'milk')
  const temperatureOptions = modifiers.filter((m) => m.category === 'temperature')

  const showMilk = drink.modifier_config?.milk ?? false
  const showTemperature = drink.modifier_config?.temperature ?? false
  const hasAnyModifiers = showMilk || showTemperature

  return (
    <>
      {/* Backdrop with blur */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 bg-delo-navy/40 z-40"
        aria-label="Close modal"
      />

      {/* Modal - slides up + fades in */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 30,
        }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          className="bg-delo-cream rounded-xl shadow-2xl p-8 w-full max-w-lg relative"
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

          {/* Drink name and description */}
          <h1 className="font-bricolage font-bold text-4xl text-delo-maroon pr-12">
            {drink.name}
          </h1>
          {drink.description && (
            <p className="text-description mt-2 mb-8 pr-12">{drink.description}</p>
          )}
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
          ) : (
            <p className="text-description">No customization options for this drink.</p>
          )}

          {/* Name input */}
          <div className="mt-8">
            <label className="block label-modifier mb-3">Your Name</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Name"
              className="w-full h-16 px-6 text-modifier-option text-delo-navy bg-white rounded-xl border border-delo-navy/10 focus:border-delo-maroon focus:outline-none transition-colors"
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
          {error && (
            <p className="text-red-600 text-sm mt-3 text-center">{error}</p>
          )}
        </div>
      </motion.div>
    </>
  )
}
