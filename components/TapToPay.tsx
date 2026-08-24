'use client'

import { motion, useReducedMotion } from 'framer-motion'
import QRCode from 'react-qr-code'
import { Order } from '@/lib/supabase'
import { getVenmoConfig, buildVenmoUrl } from '@/lib/venmo'

interface TapToPayProps {
  order: Order
  onDismiss: () => void
}

// Matches DrinkCard's entrance easing (see its SPRING PHYSICS GUIDE)
const smoothEase = [0.65, 0.05, 0, 1] as const

// reduceMotion is `boolean | null` — useReducedMotion returns null before it knows
const enter = (delay: number, reduceMotion: boolean | null) => ({
  initial: { opacity: 0, y: reduceMotion ? 0 : 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: smoothEase, delay },
})

/**
 * TapToPay — customer-facing payment screen (Square-terminal style)
 *
 * Shown inside the confirmation overlay when /order?pay=1 is active.
 * The order-taker flips their phone to face the customer. The tap cue
 * sits at the BOTTOM because the NFC sticker is on the lower back of
 * the phone — iPhones read NFC with their top edge, so the customer
 * slides their phone underneath, top edge first.
 */
export default function TapToPay({ order, onDismiss }: TapToPayProps) {
  const reduceMotion = useReducedMotion()
  const config = getVenmoConfig()
  if (!config) return null

  const qrUrl = buildVenmoUrl(config, `Delo Coffee – ${order.item}`)
  const modifierLine = [order.modifiers?.milk, order.modifiers?.temperature]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="w-full h-full flex flex-col items-center px-6 pt-3 pb-8 text-center">
      {/* Subtle dismiss — for the order-taker, tucked away from customer thumbs */}
      <div className="w-full flex justify-end">
        <motion.button
          onClick={onDismiss}
          whileTap={{ scale: 0.97 }}
          className="min-h-[44px] px-3 font-manrope text-sm text-delo-navy/50 hover:text-delo-navy transition-colors"
        >
          New order
        </motion.button>
      </div>

      {/* Order info — readable at arm's length */}
      <motion.div
        className="flex-1 flex flex-col items-center justify-center"
        {...enter(0, reduceMotion)}
      >
        <p className="text-description text-delo-navy/60 mb-3">On it!</p>
        <h1 className="font-bricolage font-bold text-2xl md:text-3xl text-delo-navy">
          {order.customer_name}
        </h1>
        <p className="font-bricolage font-semibold text-lg md:text-xl text-delo-navy mt-1">
          {order.item}
        </p>
        {modifierLine && (
          <p className="text-modifier-option text-delo-navy/80 mt-1">{modifierLine}</p>
        )}
      </motion.div>

      {/* QR fallback — secondary, above the tap zone */}
      <motion.div className="flex flex-col items-center" {...enter(0.1, reduceMotion)}>
        <div className="bg-white rounded-2xl p-3 shadow-[0_1px_2px_rgba(0,0,36,0.06),0_4px_12px_rgba(0,0,36,0.08)]">
          <QRCode
            value={qrUrl}
            size={112}
            fgColor="#000024"
            bgColor="#FFFFFF"
            role="img"
            aria-label="QR code to pay with Venmo"
          />
        </div>
        <p className="font-manrope text-sm text-delo-navy/50 mt-2">or scan to pay</p>
      </motion.div>

      {/* Tap hero — bottom, where the sticker physically lives */}
      <motion.div className="flex flex-col items-center mt-6" {...enter(0.2, reduceMotion)}>
        <p className="font-bricolage font-semibold text-xl md:text-2xl text-delo-navy">
          Tap your phone under here
        </p>
        <p className="font-manrope text-sm text-delo-navy/60 mt-1">
          slide it underneath — Venmo pops right up
        </p>
        <motion.div
          aria-hidden="true"
          className="mt-2"
          animate={reduceMotion ? undefined : { y: [0, 6, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg
            className="w-9 h-9 text-delo-maroon"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      </motion.div>
    </div>
  )
}
