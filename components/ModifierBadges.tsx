/**
 * ModifierBadges - Colored pill badges for milk and temperature modifiers
 *
 * Semantic color mapping:
 *   Oat Milk  → warm amber (grain-colored)
 *   Whole Milk → neutral gray (dairy = neutral)
 *   Hot       → warm orange (heat)
 *   Iced      → cool blue (cold)
 *
 * Always shows both modifiers when present (even defaults).
 * Renders nothing if no modifiers are set.
 */

const MODIFIER_COLORS: Record<string, { bg: string; text: string }> = {
  // Milk options
  Oat: { bg: 'bg-amber-100', text: 'text-amber-800' },
  Regular: { bg: 'bg-gray-200', text: 'text-gray-700' },
  // Temperature options
  Hot: { bg: 'bg-red-100', text: 'text-red-700' },
  Iced: { bg: 'bg-sky-100', text: 'text-sky-700' },
}

const DEFAULT_COLOR = { bg: 'bg-gray-100', text: 'text-gray-600' }

interface ModifierBadgesProps {
  modifiers: { milk?: string; temperature?: string }
}

export default function ModifierBadges({ modifiers }: ModifierBadgesProps) {
  const badges = [modifiers?.milk, modifiers?.temperature].filter(Boolean) as string[]

  if (badges.length === 0) return null

  return (
    <div className="flex gap-2 mb-2">
      {badges.map((modifier, i) => {
        const colors = MODIFIER_COLORS[modifier] ?? DEFAULT_COLOR
        return (
          <span
            key={i}
            className={`${colors.bg} ${colors.text} rounded-full text-sm font-semibold px-3 py-1 font-manrope`}
          >
            {modifier}
          </span>
        )
      })}
    </div>
  )
}
