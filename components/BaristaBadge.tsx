import { getBaristaColor } from '@/lib/baristaColors'

interface BaristaBadgeProps {
  name: string
}

/**
 * Small colored pill showing a barista's name.
 * Color is deterministically assigned from the barista color pool.
 * Truncates names longer than 8 characters.
 */
export default function BaristaBadge({ name }: BaristaBadgeProps) {
  const colors = getBaristaColor(name)
  const displayName = name.slice(0, 3).toUpperCase()

  return (
    <span
      className={`${colors.bg} ${colors.text} rounded-full text-xs font-bold px-2.5 py-1 font-manrope flex-shrink-0 tracking-wide`}
    >
      {displayName}
    </span>
  )
}
