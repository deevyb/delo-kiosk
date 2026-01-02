'use client'

import { motion } from 'framer-motion'
import { MenuItem, Modifier } from '@/lib/supabase'
import ModifierSelector from './ModifierSelector'

interface DrinkCustomizerProps {
  drink: MenuItem
  modifiers: Modifier[]
  selectedModifiers: { milk?: string; temperature?: string }
  onModifierChange: (category: 'milk' | 'temperature', value: string) => void
  onBack: () => void
}

/**
 * DrinkCustomizer - Full-screen view for customizing a selected drink
 *
 * Shows the drink name prominently, with modifier options below.
 * Only shows modifier categories that apply to this drink (based on modifier_config).
 *
 * Uses layoutId="drink-title" for Netflix-style shared element transition
 * from the drink card to this full-screen view.
 */
export default function DrinkCustomizer({
  drink,
  modifiers,
  selectedModifiers,
  onModifierChange,
  onBack,
}: DrinkCustomizerProps) {
  // Filter modifiers by category
  const milkOptions = modifiers.filter((m) => m.category === 'milk')
  const temperatureOptions = modifiers.filter((m) => m.category === 'temperature')

  // Check which modifiers apply to this drink
  const showMilk = drink.modifier_config?.milk ?? false
  const showTemperature = drink.modifier_config?.temperature ?? false
  const hasAnyModifiers = showMilk || showTemperature

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-delo-cream p-8"
    >
      {/* Back button */}
      <motion.button
        onClick={onBack}
        whileTap={{ scale: 0.97 }}
        className="flex items-center gap-2 text-delo-navy/70 hover:text-delo-navy mb-8 font-bricolage"
      >
        <span className="text-xl">←</span>
        <span>Back</span>
      </motion.button>

      {/* Drink name - uses layoutId for shared element transition */}
      <motion.h1
        layoutId={`drink-${drink.id}`}
        className="font-yatra text-5xl text-delo-maroon mb-12"
      >
        {drink.name}
      </motion.h1>

      {/* Modifier selectors */}
      {hasAnyModifiers ? (
        <div className="max-w-xl">
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
        <p className="font-roboto-mono text-delo-navy/60">
          No customization options for this drink.
        </p>
      )}
    </motion.div>
  )
}
