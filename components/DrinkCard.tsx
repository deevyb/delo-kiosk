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

export default function DrinkCard({
  drink,
  index,
  isSelected,
  onSelect,
}: DrinkCardProps) {
  return (
    <motion.div
      variants={entranceVariants}
      initial="hidden"
      animate="visible"
      custom={index}
    >
      <motion.button
        onClick={() => onSelect(drink)}
        whileTap={{
          scale: 0.97,
          y: 2,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          transition: {
            type: 'spring',
            stiffness: 400,
            damping: 30,
          },
        }}
        className={`
          w-full aspect-square rounded-xl p-6
          flex flex-col items-center justify-center text-center
          ${
            isSelected
              ? 'border-2 border-delo-maroon'
              : 'border border-delo-navy/5 hover:border-delo-maroon/20'
          }
        `}
        style={{
          backgroundColor: '#fff',
          boxShadow: isSelected
            ? '0 0 0 2px #921C12, 0 4px 12px rgba(0,0,0,0.1)'
            : '0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <span className="font-bricolage font-semibold text-2xl text-delo-navy leading-tight">
          {drink.name}
        </span>
      </motion.button>
    </motion.div>
  )
}
