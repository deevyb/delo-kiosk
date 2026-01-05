'use client'

import { motion } from 'framer-motion'
import { MenuItem } from '@/lib/supabase'

interface DrinkCardProps {
  drink: MenuItem
  index: number
  isSelected: boolean
  onSelect: (drink: MenuItem) => void
}

/**
 * ANIMATION CONFIGURATION
 *
 * These values control how the card animations feel.
 * Feel free to tweak them - here's what each does:
 */

// Easing curve for entrance animation
// This one creates a smooth deceleration - fast start, gentle stop
const smoothEase = [0.65, 0.05, 0, 1] as const

// Entrance animation - how cards appear when page loads
const entranceVariants = {
  hidden: {
    opacity: 0,
    y: 40,
  },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      delay: index * 0.07,
      ease: smoothEase,
    },
  }),
}

/**
 * SPRING PHYSICS GUIDE (for whileTap)
 *
 * - stiffness: How snappy/fast the spring is (300-400 = responsive)
 * - damping: How much it resists/slows (25-35 = subtle bounce)
 *
 * Current: stiffness 400, damping 30 = responsive with minimal bounce
 */

export default function DrinkCard({ drink, index, isSelected, onSelect }: DrinkCardProps) {
  const isSoldOut = !drink.is_active

  const handleClick = () => {
    if (isSoldOut) return
    onSelect(drink)
  }

  return (
    <motion.div variants={entranceVariants} initial="hidden" animate="visible" custom={index}>
      <motion.button
        onClick={handleClick}
        whileTap={
          isSoldOut
            ? undefined
            : {
                scale: 0.97,
                y: 2,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                transition: {
                  type: 'spring',
                  stiffness: 400,
                  damping: 30,
                },
              }
        }
        className={`
          relative w-full aspect-square rounded-xl p-6
          flex flex-col items-center justify-center text-center
          ${isSoldOut ? 'item-unavailable cursor-not-allowed' : ''}
          ${isSelected && !isSoldOut ? 'border-2 border-delo-maroon' : 'border border-delo-navy/5'}
          ${!isSoldOut && !isSelected ? 'hover:border-delo-maroon/20' : ''}
        `}
        style={{
          backgroundColor: '#fff',
          boxShadow:
            isSelected && !isSoldOut
              ? '0 0 0 2px #921C12, 0 4px 12px rgba(0,0,0,0.1)'
              : '0 2px 8px rgba(0,0,0,0.06)',
        }}
        disabled={isSoldOut}
      >
        {/* Sold Out badge */}
        {isSoldOut && (
          <span className="absolute top-3 right-3 bg-delo-maroon text-delo-cream text-xs font-manrope font-semibold px-2 py-1 rounded-full">
            Sold Out
          </span>
        )}

        <span className="font-bricolage font-semibold text-2xl text-delo-navy leading-tight">
          {drink.name}
        </span>
      </motion.button>
    </motion.div>
  )
}
