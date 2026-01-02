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
// Format: [x1, y1, x2, y2] - it's a bezier curve
// Try: [0.25, 0.1, 0.25, 1] for a more standard ease-out
const smoothEase = [0.65, 0.05, 0, 1] as const

// Entrance animation - how cards appear when page loads
const cardVariants = {
  hidden: {
    opacity: 0,
    y: 40, // Start 40px below final position. Try 20 for subtler, 60 for more dramatic
  },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5, // How long the animation takes (in seconds). Try 0.3 for snappier
      delay: index * 0.07, // Stagger: each card waits 70ms after the previous. Try 0.05 for faster cascade
      ease: smoothEase,
    },
  }),
}

/**
 * SPRING PHYSICS GUIDE (for whileTap and other spring animations)
 *
 * Springs feel more natural than timed animations because they simulate physics.
 * Two main knobs to adjust:
 *
 * - stiffness: How snappy/fast the spring is
 *   Low (100-200): Sluggish, lazy movement
 *   Medium (300-400): Responsive, natural feel
 *   High (500+): Very snappy, almost instant
 *
 * - damping: How much the spring resists/slows down (controls bounciness)
 *   Low (10-20): Very bouncy, oscillates multiple times
 *   Medium (25-35): Subtle bounce, settles quickly
 *   High (40+): No bounce, just smooth deceleration
 *
 * Current values: stiffness 400, damping 30 = responsive with minimal bounce
 */

export default function DrinkCard({
  drink,
  index,
  isSelected,
  onSelect,
}: DrinkCardProps) {
  return (
    <motion.button
      onClick={() => onSelect(drink)}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      custom={index}
      // Press-in effect: makes the card feel like a physical button being pushed
      whileTap={{
        scale: 0.97, // Shrink to 97% size. Try 0.95 for more dramatic, 0.98 for subtler
        y: 2, // Move down 2px (pressing "into" the screen). Try 3-4 for more depth
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)', // Flatter shadow = pressed down look
        transition: {
          type: 'spring',
          stiffness: 400, // See guide above
          damping: 30, // See guide above. Was 25 (bouncier), now 30 (subtler)
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
        // Selected state uses a "ring" shadow effect (the 0 0 0 2px part creates a border-like ring)
        boxShadow: isSelected
          ? '0 0 0 2px #921C12, 0 4px 12px rgba(0,0,0,0.1)' // Maroon ring + soft shadow
          : '0 2px 8px rgba(0,0,0,0.06)', // Just a soft shadow
      }}
    >
      {/* layoutId creates shared element transition with DrinkCustomizer */}
      <motion.h2
        layoutId={`drink-${drink.id}`}
        className="font-yatra text-2xl text-delo-navy leading-tight"
      >
        {drink.name}
      </motion.h2>
    </motion.button>
  )
}
