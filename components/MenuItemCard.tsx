'use client'

import { motion } from 'framer-motion'
import { MenuItem } from '@/lib/supabase'

interface MenuItemCardProps {
  item: MenuItem
  onToggle: () => void
  onEdit: () => void
}

/**
 * MenuItemCard - Compact row for a single menu item
 *
 * Shows: Drink name | modifier info | toggle | edit button
 */
export default function MenuItemCard({ item, onToggle, onEdit }: MenuItemCardProps) {
  const hasMilk = item.modifier_config?.milk ?? false
  const hasTemp = item.modifier_config?.temperature ?? false

  // Build modifier summary text
  const modifierParts: string[] = []
  if (hasMilk) modifierParts.push('Milk')
  if (hasTemp) modifierParts.push('Temp')
  const modifierSummary = modifierParts.length > 0 ? modifierParts.join(', ') : 'No modifiers'

  return (
    <motion.div
      layout
      className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
        item.is_active
          ? 'bg-delo-cream/50 border-delo-navy/10'
          : 'bg-delo-navy/5 border-delo-navy/5'
      }`}
    >
      {/* Left: Name and modifier info */}
      <div className="flex-1 min-w-0">
        <h4
          className={`font-bricolage font-semibold text-lg truncate ${
            item.is_active ? 'text-delo-navy' : 'text-delo-navy/40'
          }`}
        >
          {item.name}
        </h4>
        <p
          className={`text-sm ${
            item.is_active ? 'text-delo-navy/50' : 'text-delo-navy/30'
          }`}
        >
          {modifierSummary}
        </p>
      </div>

      {/* Right: Toggle and Edit */}
      <div className="flex items-center gap-4 ml-4">
        {/* Edit button - outline style with fill + border darken on hover */}
        <button
          onClick={onEdit}
          className="px-4 py-2 min-h-[44px] text-sm font-manrope font-semibold text-delo-navy/70 border border-delo-navy/20 hover:bg-delo-navy/5 hover:border-delo-maroon hover:text-delo-maroon rounded-lg transition-all duration-150"
        >
          Edit
        </button>

        {/* Toggle switch - slightly smaller for better proportion */}
        <button
          onClick={onToggle}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            item.is_active ? 'bg-delo-maroon' : 'bg-delo-navy/20'
          }`}
          aria-label={item.is_active ? 'Turn off' : 'Turn on'}
        >
          <motion.div
            layout
            className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
            animate={{ left: item.is_active ? '1.375rem' : '0.25rem' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        </button>
      </div>
    </motion.div>
  )
}
