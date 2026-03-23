'use client'

import { motion } from 'framer-motion'
import { Order } from '@/lib/supabase'
import { isToday, formatShortDate, formatPrepTime } from '@/lib/dateUtils'
import ModifierBadges from './ModifierBadges'
import BaristaBadge from './BaristaBadge'
import { getBaristaColor } from '@/lib/baristaColors'

interface OrderCardProps {
  order: Order
  now: number
  onMarkReady: (orderId: string) => void
  onBackToPlaced?: (orderId: string) => void
  onRestore?: (orderId: string) => void
  onCancelClick: () => void
  isUpdating: boolean
  isNew?: boolean
  // Multi-barista props
  isMultiBarista?: boolean
  currentBarista?: string
  onMarkInProgress?: (orderId: string) => void
  onBackToQueue?: (orderId: string) => void
}

/**
 * Format time difference as relative string
 */
function getRelativeTime(timestamp: string, now: number): string {
  const diff = now - new Date(timestamp).getTime()
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) return 'Just now'
  if (minutes === 1) return '1 min'
  return `${minutes} min`
}

const springConfig = { stiffness: 400, damping: 30 }

export default function OrderCard({
  order,
  now,
  onMarkReady,
  onBackToPlaced,
  onRestore,
  onCancelClick,
  isUpdating,
  isNew = false,
  isMultiBarista = false,
  currentBarista,
  onMarkInProgress,
  onBackToQueue,
}: OrderCardProps) {
  // Ready + today: show elapsed prep time (placed → ready). Others: relative time or date.
  const isReadyToday = order.status === 'ready' && isToday(order.updated_at)
  const relevantTimestamp = order.status === 'canceled' ? order.updated_at : order.created_at
  const timeBadge = isReadyToday
    ? formatPrepTime(order.created_at, order.updated_at)
    : isToday(relevantTimestamp)
      ? getRelativeTime(relevantTimestamp, now)
      : formatShortDate(relevantTimestamp)

  // Barista highlight: thick left border + tinted background for current barista's orders
  const isMyOrder =
    isMultiBarista &&
    currentBarista &&
    order.claimed_by === currentBarista &&
    order.status !== 'canceled'
  const showBaristaBadge = isMultiBarista && order.claimed_by && order.status !== 'canceled'
  const baristaColors = isMyOrder ? getBaristaColor(currentBarista!) : null
  const cardClasses = 'bg-white rounded-xl p-4 md:p-6 shadow-sm border border-delo-navy/5'

  const cardStyle = isMyOrder ? { borderLeft: `6px solid ${baristaColors!.hex}` } : undefined

  return (
    <motion.div
      layout
      layoutId={isMultiBarista ? order.id : undefined}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -100, scale: 0.95, transition: { duration: 0.15, ease: 'easeIn' } }}
      transition={{ type: 'spring', ...springConfig }}
      className={cardClasses}
      style={cardStyle}
    >
      {/* Top row: Drink name, time badge, and barista badge */}
      <div className="flex items-start justify-between mb-1">
        <h3 className="font-bricolage font-bold text-xl md:text-2xl text-delo-navy">
          {order.item}
        </h3>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {showBaristaBadge && <BaristaBadge name={order.claimed_by!} />}
          <span className="inline-flex items-center gap-1.5 font-roboto-mono text-sm text-delo-navy/50 bg-delo-navy/5 px-2 py-1 rounded">
            {isReadyToday && (
              <svg
                aria-hidden="true"
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 3h14M5 21h14M7 3v2a5 5 0 005 5 5 5 0 005-5V3M7 21v-2a5 5 0 015-5 5 5 0 015 5v2"
                />
              </svg>
            )}
            {timeBadge}
          </span>
        </div>
      </div>

      {/* Modifier badges */}
      <ModifierBadges modifiers={order.modifiers} />

      {/* Customer name */}
      <p className="font-manrope font-medium text-base text-delo-navy/50">{order.customer_name}</p>

      {/* Placed (or in_progress in solo mode): Mark Ready + Cancel, Multi = Mark In Progress + Cancel */}
      {(order.status === 'placed' || (order.status === 'in_progress' && !isMultiBarista)) && (
        <div className="flex gap-2 mt-3 md:gap-3 md:mt-5">
          {isMultiBarista && onMarkInProgress ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => onMarkInProgress(order.id)}
              disabled={isUpdating}
              className="btn-kitchen-action"
            >
              {isUpdating ? 'Updating...' : 'Mark In Progress'}
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => onMarkReady(order.id)}
              disabled={isUpdating}
              className="btn-kitchen-action"
            >
              {isUpdating ? 'Updating...' : 'Mark Ready'}
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onCancelClick}
            disabled={isUpdating}
            className="btn-kitchen-secondary"
          >
            Cancel
          </motion.button>
        </div>
      )}

      {/* In Progress (multi-barista only): Mark Ready (full width) on top, secondary row below */}
      {order.status === 'in_progress' && isMultiBarista && (
        <div className="mt-3 md:mt-5 space-y-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onMarkReady(order.id)}
            disabled={isUpdating}
            className="btn-kitchen-action w-full"
          >
            {isUpdating ? 'Updating...' : 'Mark Ready'}
          </motion.button>
          <div className="flex gap-3">
            {onBackToQueue && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => onBackToQueue(order.id)}
                disabled={isUpdating}
                className="btn-kitchen-secondary flex-1"
              >
                Back to Queue
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onCancelClick}
              disabled={isUpdating}
              className="btn-kitchen-secondary flex-1"
            >
              Cancel
            </motion.button>
          </div>
        </div>
      )}

      {/* Ready: Badge + Back to Queue/Placed + Cancel */}
      {order.status === 'ready' && (
        <div className="mt-3 md:mt-5 flex flex-wrap items-center gap-2 md:gap-3">
          <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-manrope font-semibold text-sm">Ready</span>
          </div>
          <div className="flex gap-2 md:gap-3 ml-auto">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => onBackToPlaced?.(order.id)}
              disabled={isUpdating}
              className="btn-kitchen-secondary"
            >
              {isUpdating ? 'Updating...' : isMultiBarista ? 'Back to Queue' : 'Back to Placed'}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onCancelClick}
              disabled={isUpdating}
              className="btn-kitchen-secondary"
            >
              Cancel
            </motion.button>
          </div>
        </div>
      )}

      {/* Cancelled: Badge + Restore button in one row */}
      {order.status === 'canceled' && (
        <div className="mt-3 md:mt-5 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="font-manrope font-semibold text-sm">Cancelled</span>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onRestore?.(order.id)}
            disabled={isUpdating}
            className="btn-kitchen-secondary"
          >
            {isUpdating ? 'Restoring...' : 'Restore'}
          </motion.button>
        </div>
      )}
    </motion.div>
  )
}
