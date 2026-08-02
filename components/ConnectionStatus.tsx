'use client'

import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

/**
 * What the display can currently promise the barista.
 *
 * `delayed` exists because realtime dropping is no longer the same as losing orders —
 * the background sync still brings them in. Saying "Offline" in that state would send a
 * barista looking for a problem that isn't there, mid-rush.
 */
export type KitchenConnection = 'live' | 'delayed' | 'unreachable'

interface ConnectionStatusProps {
  status: KitchenConnection
  onRetry: () => Promise<void>
}

export default function ConnectionStatus({ status, onRetry }: ConnectionStatusProps) {
  const [checking, setChecking] = useState(false)
  const reduceMotion = useReducedMotion()
  const unreachable = status === 'unreachable'

  const handleRetry = async () => {
    setChecking(true)
    try {
      await onRetry()
    } finally {
      setChecking(false)
    }
  }

  // No `initial={false}`: the status is always `live` on first render, so the banner is
  // never present then and every appearance it can actually have is a real event.
  return (
    <AnimatePresence>
      {status !== 'live' && (
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -40 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          role={unreachable ? 'alert' : 'status'}
          aria-live={unreachable ? 'assertive' : 'polite'}
          className={
            unreachable
              ? 'bg-delo-maroon/10 border-b border-delo-maroon/25 px-4 py-3'
              : 'bg-delo-navy/[0.04] border-b border-delo-navy/10 px-4 py-2.5'
          }
        >
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            {/* The two states use different markers rather than stacking them: a breathing
                dot means the display is still checking on a rhythm, and the warning mark
                replaces it when nothing is getting through. Which glyph appears is the
                status — a barista only ever sees one of them. */}
            {!unreachable ? (
              <motion.span
                aria-hidden="true"
                className="w-2 h-2 rounded-full flex-shrink-0 bg-delo-terracotta"
                animate={reduceMotion ? { opacity: 1 } : { opacity: [1, 0.25, 1] }}
                transition={
                  reduceMotion ? undefined : { duration: 2, repeat: Infinity, ease: 'easeInOut' }
                }
              />
            ) : (
              <svg
                className="w-4 h-4 text-delo-maroon flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            )}

            <p
              className={`font-manrope text-sm text-balance ${
                unreachable ? 'text-delo-maroon' : 'text-delo-navy/70'
              }`}
            >
              {unreachable ? (
                <>
                  <span className="font-semibold">Offline</span> — new orders aren&apos;t coming
                  through
                </>
              ) : (
                <>
                  <span className="font-semibold">Updates delayed</span> — new orders may take up to
                  30 seconds
                </>
              )}
            </p>

            {unreachable && (
              <motion.button
                onClick={handleRetry}
                disabled={checking}
                whileTap={{ scale: 0.97 }}
                // 44px minimum: this is the one control a barista reaches for in a hurry.
                className="ml-auto flex-shrink-0 font-manrope text-sm font-semibold min-h-[44px] px-4 rounded-lg
                           bg-delo-maroon text-delo-cream transition-colors hover:bg-delo-maroon/90
                           disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2
                           focus-visible:ring-delo-maroon focus-visible:ring-offset-1
                           focus-visible:ring-offset-delo-cream"
              >
                {checking ? 'Checking…' : 'Retry'}
              </motion.button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
