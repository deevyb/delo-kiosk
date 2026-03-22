/**
 * Deterministic barista color assignment from a fixed pool.
 * Each barista name always maps to the same color across all tablets.
 * Pool of 6 supports up to 6 unique baristas (designed for 2-3).
 */

export interface BaristaColor {
  bg: string
  text: string
  border: string
  hex: string // Raw hex for inline styles (avoids Tailwind specificity issues)
}

const COLOR_POOL: BaristaColor[] = [
  { bg: 'bg-blue-900/15', text: 'text-blue-900', border: 'border-blue-900', hex: '#1e3a8a' },
  { bg: 'bg-orange-700/15', text: 'text-orange-700', border: 'border-orange-700', hex: '#c2410c' },
  { bg: 'bg-teal-700/15', text: 'text-teal-700', border: 'border-teal-700', hex: '#0f766e' },
  { bg: 'bg-violet-700/15', text: 'text-violet-700', border: 'border-violet-700', hex: '#6d28d9' },
  { bg: 'bg-amber-700/15', text: 'text-amber-700', border: 'border-amber-700', hex: '#b45309' },
  { bg: 'bg-rose-700/15', text: 'text-rose-700', border: 'border-rose-700', hex: '#be123c' },
]

/**
 * Simple string hash that produces a consistent positive integer.
 */
function hashName(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function getBaristaColor(name: string): BaristaColor {
  return COLOR_POOL[hashName(name.toLowerCase()) % COLOR_POOL.length]
}
