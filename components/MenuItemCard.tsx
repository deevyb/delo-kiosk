'use client'

import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { MenuItem } from '@/lib/supabase'
import { DraggableAttributes } from '@dnd-kit/core'
import { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'

interface MenuItemCardProps {
  item: MenuItem
  onToggle: () => void
  onEdit: () => void
  dragListeners?: SyntheticListenerMap
  dragAttributes?: DraggableAttributes
  isDragging?: boolean
  style?: React.CSSProperties
}

/**
 * MenuItemCard - Compact row for a single menu item
 *
 * Same single-row layout on mobile and desktop, just condensed sizing on mobile.
 */
const MenuItemCard = forwardRef<HTMLDivElement, MenuItemCardProps>(function MenuItemCard(
  { item, onToggle, onEdit, dragListeners, dragAttributes, isDragging, style },
  ref
) {
  const hasMilk = item.modifier_config?.milk ?? false
  const hasTemp = item.modifier_config?.temperature ?? false

  const modifierParts: string[] = []
  if (hasMilk) modifierParts.push('Milk')
  if (hasTemp) modifierParts.push('Temp')
  const modifierSummary = modifierParts.length > 0 ? modifierParts.join(', ') : 'No modifiers'

  return (
    <motion.div
      ref={ref}
      layout={!isDragging}
      style={style}
      className={`flex items-center justify-between p-3 md:p-4 rounded-xl border transition-colors ${
        item.is_active
          ? 'bg-delo-cream/50 border-delo-navy/10'
          : 'bg-delo-navy/5 border-delo-navy/5'
      } ${isDragging ? 'shadow-lg z-50 relative' : ''}`}
    >
      {/* Drag handle */}
      {dragListeners && (
        <button
          className="flex items-center justify-center w-8 h-8 -ml-1 mr-2 cursor-grab active:cursor-grabbing touch-none text-delo-navy/30 hover:text-delo-navy/50 transition-colors"
          {...dragListeners}
          {...dragAttributes}
          aria-label="Drag to reorder"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.5" />
            <circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" />
            <circle cx="11" cy="13" r="1.5" />
          </svg>
        </button>
      )}

      {/* Left: Name and modifier info */}
      <div className="flex-1 min-w-0">
        <h4
          className={`font-bricolage font-semibold text-base md:text-lg truncate ${
            item.is_active ? 'text-delo-navy' : 'text-delo-navy/40'
          }`}
        >
          {item.name}
        </h4>
        <p
          className={`text-xs md:text-sm ${item.is_active ? 'text-delo-navy/50' : 'text-delo-navy/30'}`}
        >
          {modifierSummary}
        </p>
      </div>

      {/* Right: Edit and Toggle */}
      <div className="flex items-center gap-3 md:gap-4 ml-3 md:ml-4">
        <motion.button
          onClick={onEdit}
          whileTap={{ scale: 0.97 }}
          className="px-3 md:px-4 py-1.5 md:py-2 min-h-[36px] md:min-h-[44px] text-sm font-manrope font-semibold text-delo-navy/70 border border-delo-navy/20 hover:bg-delo-navy/5 hover:border-delo-maroon hover:text-delo-maroon rounded-lg transition-all duration-150"
        >
          Edit
        </motion.button>

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
})

export default MenuItemCard
