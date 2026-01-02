'use client'

import { motion } from 'framer-motion'
import { Modifier } from '@/lib/supabase'

interface ModifierSelectorProps {
  category: 'milk' | 'temperature'
  options: Modifier[]
  selected: string | null
  onSelect: (option: string) => void
}

/**
 * ModifierSelector - Toggle button group for selecting milk type or temperature
 *
 * Displays a row of buttons where only one can be selected at a time.
 * The selected option gets the maroon background, others are white.
 *
 * Props:
 * - category: 'milk' or 'temperature' (determines the label shown)
 * - options: Array of modifier options from the database
 * - selected: Currently selected option string (e.g., "Oat" or "Iced")
 * - onSelect: Callback when user taps an option
 */
export default function ModifierSelector({
  category,
  options,
  selected,
  onSelect,
}: ModifierSelectorProps) {
  // Display label for the category
  const categoryLabel = category === 'milk' ? 'Milk' : 'Temperature'

  return (
    <div className="mb-8">
      {/* Category label */}
      <p className="font-roboto-mono text-sm text-delo-navy/60 uppercase tracking-wide mb-3">
        {categoryLabel}
      </p>

      {/* Button group */}
      <div className="flex gap-3">
        {options.map((option) => {
          const isSelected = selected === option.option

          return (
            <motion.button
              key={option.id}
              onClick={() => onSelect(option.option)}
              whileTap={{ scale: 0.97 }}
              className={`
                px-8 py-4 rounded-xl font-bricolage font-medium text-lg
                transition-colors duration-200
                min-w-[120px]
                ${
                  isSelected
                    ? 'bg-delo-maroon text-delo-cream'
                    : 'bg-white text-delo-navy border border-delo-navy/10 hover:border-delo-maroon/30'
                }
              `}
            >
              {option.option}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
