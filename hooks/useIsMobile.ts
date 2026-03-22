'use client'

import { useState, useEffect } from 'react'

const MOBILE_BREAKPOINT = 768 // Tailwind md: breakpoint

/**
 * SSR-safe hook that returns true when viewport is below md: breakpoint (768px).
 * Uses matchMedia for efficient listener (no resize debounce needed).
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches
  })

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)

    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isMobile
}
