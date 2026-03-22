'use client'

import { AnimatePresence } from 'framer-motion'
import { Order } from '@/lib/supabase'
import OrderCard from './OrderCard'

interface SplitQueueLayoutProps {
  placedOrders: Order[]
  inProgressOrders: Order[] // Already filtered by myDrinksOnly in KitchenClient
  totalInProgressCount: number // Total across all baristas (for "2/5" display)
  myDrinksOnly: boolean
  baristaName: string
  now: number
  onMarkReady: (orderId: string) => void
  onMarkInProgress: (orderId: string) => void
  onBackToQueue: (orderId: string) => void
  onCancelClick: (order: Order) => void
  updatingOrderId: string | null
  newOrderIds: Set<string>
}

/**
 * Split panel layout for multi-barista mode (Queue tab).
 * Landscape (≥768px): side-by-side columns — Queue left, In Progress right.
 * Portrait (<768px): stacked — In Progress on top, Queue below.
 */
export default function SplitQueueLayout({
  placedOrders,
  inProgressOrders,
  totalInProgressCount,
  myDrinksOnly,
  baristaName,
  now,
  onMarkReady,
  onMarkInProgress,
  onBackToQueue,
  onCancelClick,
  updatingOrderId,
  newOrderIds,
}: SplitQueueLayoutProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left panel: Queue (unclaimed) — swaps to bottom on mobile */}
      <div className="order-2 md:order-1">
        <h2 className="font-manrope font-semibold text-sm text-delo-navy/60 mb-3 tabular-nums">
          Queue ({placedOrders.length})
        </h2>
        {placedOrders.length === 0 ? (
          <div className="text-center py-8 md:py-12">
            <p className="font-roboto-mono text-delo-navy/40 text-sm">No orders waiting</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {placedOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  now={now}
                  onMarkReady={onMarkReady}
                  onMarkInProgress={onMarkInProgress}
                  onBackToQueue={onBackToQueue}
                  onCancelClick={() => onCancelClick(order)}
                  isUpdating={updatingOrderId === order.id}
                  isNew={newOrderIds.has(order.id)}
                  isMultiBarista={true}
                  currentBarista={baristaName}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Right panel: In Progress — swaps to top on mobile */}
      <div className="order-1 md:order-2">
        <h2 className="font-manrope font-semibold text-sm text-delo-navy/60 mb-3 tabular-nums">
          In Progress (
          {myDrinksOnly && inProgressOrders.length < totalInProgressCount
            ? `${inProgressOrders.length}/${totalInProgressCount}`
            : totalInProgressCount}
          )
        </h2>
        {inProgressOrders.length === 0 ? (
          <div className="text-center py-8 md:py-12">
            <p className="font-roboto-mono text-delo-navy/40 text-sm">No drinks in progress</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {inProgressOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  now={now}
                  onMarkReady={onMarkReady}
                  onMarkInProgress={onMarkInProgress}
                  onBackToQueue={onBackToQueue}
                  onCancelClick={() => onCancelClick(order)}
                  isUpdating={updatingOrderId === order.id}
                  isNew={newOrderIds.has(order.id)}
                  isMultiBarista={true}
                  currentBarista={baristaName}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
