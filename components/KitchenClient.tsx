'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { Order, OrderStatus, supabase } from '@/lib/supabase'
import { isToday } from '@/lib/dateUtils'
import OrderCard from './OrderCard'
import KitchenTabs from './KitchenTabs'
import ConnectionStatus from './ConnectionStatus'
import NavMenu from './NavMenu'
import SplitQueueLayout from './SplitQueueLayout'
import ResponsiveModal from './ResponsiveModal'

interface KitchenClientProps {
  initialOrders: Order[]
}

type TabType = OrderStatus

export default function KitchenClient({ initialOrders }: KitchenClientProps) {
  // Multi-barista mode: detect via URL param
  const searchParams = useSearchParams()
  const baristaName = searchParams.get('barista') || ''
  const isMultiBarista = baristaName.length > 0

  // All orders (placed, ready, and canceled)
  const [orders, setOrders] = useState<Order[]>(initialOrders)

  // Track which order IDs arrived via realtime (for entrance animation)
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set())

  // Active tab
  const [activeTab, setActiveTab] = useState<TabType>('placed')

  // Date filter: show only today's orders by default (resets on page load)
  const [todayOnly, setTodayOnly] = useState(true)

  // Multi-barista: show only my in-progress drinks by default
  const [myDrinksOnly, setMyDrinksOnly] = useState(true)

  // Clear newOrderIds on tab change so realtime orders don't replay entrance animation
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab)
    setNewOrderIds(new Set())
  }, [])

  // Realtime connection status
  const [isConnected, setIsConnected] = useState(true)

  // Track which order is being updated (prevents double-taps)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)

  // Cancel confirmation modal
  const [confirmCancel, setConfirmCancel] = useState<Order | null>(null)

  // Error message
  const [error, setError] = useState<string | null>(null)

  // Shared clock for relative time display (1 timer instead of N per card)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(interval)
  }, [])

  // Apply date filter once, then split by status
  const visibleOrders = useMemo(
    () => (todayOnly ? orders.filter((o) => isToday(o.created_at)) : orders),
    [orders, todayOnly]
  )

  // Unclaimed orders (status = placed). In solo mode, fold in_progress into placed
  // so orders from a prior multi-barista session aren't invisible.
  const placedOrders = useMemo(
    () =>
      visibleOrders
        .filter((o) => o.status === 'placed' || (!isMultiBarista && o.status === 'in_progress'))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [visibleOrders, isMultiBarista]
  )

  // In-progress orders (claimed, multi-barista only)
  const inProgressOrders = useMemo(
    () =>
      visibleOrders
        .filter((o) => o.status === 'in_progress')
        .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()),
    [visibleOrders]
  )

  const readyOrders = useMemo(
    () =>
      visibleOrders
        .filter((o) => o.status === 'ready')
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [visibleOrders]
  )

  const canceledOrders = useMemo(
    () =>
      visibleOrders
        .filter((o) => o.status === 'canceled')
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [visibleOrders]
  )

  // Current tab's orders (memoized for referential stability)
  const currentOrders = useMemo(() => {
    const map: Record<OrderStatus, Order[]> = {
      placed: placedOrders,
      in_progress: inProgressOrders,
      ready: readyOrders,
      canceled: canceledOrders,
    }
    return map[activeTab]
  }, [placedOrders, inProgressOrders, readyOrders, canceledOrders, activeTab])

  // Counts for tabs — Queue count includes both placed + in_progress
  const placedCount = placedOrders.length + inProgressOrders.length
  const readyCount = readyOrders.length
  const cancelledCount = canceledOrders.length

  // Filtered in-progress orders for multi-barista "mine only" toggle
  const displayedInProgressOrders = useMemo(
    () =>
      myDrinksOnly && isMultiBarista
        ? inProgressOrders.filter((o) => o.claimed_by === baristaName)
        : inProgressOrders,
    [inProgressOrders, myDrinksOnly, isMultiBarista, baristaName]
  )

  /**
   * Realtime subscription for order updates
   */
  useEffect(() => {
    const channel = supabase
      .channel('kitchen-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newOrder = payload.new as Order
          setOrders((prev) => [...prev, newOrder])
          // Mark as new for animation
          setNewOrderIds((prev) => new Set(prev).add(newOrder.id))
        } else if (payload.eventType === 'UPDATE') {
          const updatedOrder = payload.new as Order
          const oldStatus = (payload.old as Partial<Order>).status
          setOrders((prev) => {
            const exists = prev.some((o) => o.id === updatedOrder.id)
            if (exists) {
              return prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
            } else {
              return [...prev, updatedOrder]
            }
          })
          // Only trigger entrance animation when status changed (order moves between tabs)
          if (oldStatus !== updatedOrder.status) {
            setNewOrderIds((prev) => new Set(prev).add(updatedOrder.id))
          }
        } else if (payload.eventType === 'DELETE') {
          const deletedId = payload.old.id as string
          setOrders((prev) => prev.filter((o) => o.id !== deletedId))
        }
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  /**
   * Update an order's status via API and optimistically update local state
   */
  const updateOrderStatus = useCallback(
    async (
      orderId: string,
      newStatus: OrderStatus,
      errorMessage: string,
      extraFields?: Record<string, unknown>
    ) => {
      setUpdatingOrderId(orderId)
      setError(null)

      try {
        const response = await fetch(`/api/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus, ...extraFields }),
        })

        if (!response.ok) {
          throw new Error('Failed to update')
        }

        const updatedOrder = await response.json()
        setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)))
      } catch {
        setError(errorMessage)
      } finally {
        setUpdatingOrderId(null)
      }
    },
    []
  )

  /**
   * Mark an order as ready
   */
  const handleMarkReady = useCallback(
    (orderId: string) =>
      updateOrderStatus(orderId, 'ready', "Couldn't update order. Please try again."),
    [updateOrderStatus]
  )

  /**
   * Move a ready order back to placed
   */
  const handleBackToPlaced = useCallback(
    (orderId: string) =>
      updateOrderStatus(orderId, 'placed', "Couldn't move order back. Please try again."),
    [updateOrderStatus]
  )

  /**
   * Mark an order as in-progress (multi-barista: claim it)
   */
  const handleMarkInProgress = useCallback(
    (orderId: string) =>
      updateOrderStatus(orderId, 'in_progress', "Couldn't claim order. Please try again.", {
        claimed_by: baristaName,
      }),
    [updateOrderStatus, baristaName]
  )

  /**
   * Un-claim: move an in-progress order back to placed
   */
  const handleBackToQueue = useCallback(
    (orderId: string) =>
      updateOrderStatus(orderId, 'placed', "Couldn't unclaim order. Please try again.", {
        claimed_by: null,
      }),
    [updateOrderStatus]
  )

  /**
   * Restore a cancelled order back to placed
   */
  const handleRestore = useCallback(
    async (orderId: string) => {
      await updateOrderStatus(orderId, 'placed', "Couldn't restore order. Please try again.")
      setActiveTab('placed')
    },
    [updateOrderStatus]
  )

  /**
   * Cancel an order (after confirmation)
   */
  const handleCancel = useCallback(
    async (orderId: string) => {
      await updateOrderStatus(orderId, 'canceled', "Couldn't cancel order. Please try again.")
      setConfirmCancel(null)
    },
    [updateOrderStatus]
  )

  /**
   * Clear error after a delay
   */
  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(null), 4000)
    return () => clearTimeout(timer)
  }, [error])

  return (
    <div className="min-h-screen bg-delo-cream">
      {/* Connection status banner */}
      <ConnectionStatus isConnected={isConnected} />

      {/* Header */}
      <header className="px-4 pt-4 pb-2 md:px-8 md:pt-8 md:pb-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <Link href="/" className="cursor-pointer">
            <h1 className="font-yatra text-2xl md:text-4xl text-delo-maroon">Delo Barista Bar</h1>
          </Link>
          <NavMenu />
        </div>
      </header>

      {/* Tabs */}
      <div className="px-4 md:px-8 max-w-4xl mx-auto">
        <KitchenTabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
          placedCount={placedCount}
          readyCount={readyCount}
          cancelledCount={cancelledCount}
          todayOnly={todayOnly}
          onTodayOnlyChange={setTodayOnly}
          isMultiBarista={isMultiBarista}
          myDrinksOnly={myDrinksOnly}
          onMyDrinksOnlyChange={setMyDrinksOnly}
        />
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="px-4 md:px-8 max-w-4xl mx-auto mt-4"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg font-manrope text-sm">
              {error}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order list */}
      <div className="px-4 py-4 md:px-8 md:py-6 max-w-4xl mx-auto">
        {/* Multi-barista split layout for the Queue tab */}
        {isMultiBarista && activeTab === 'placed' ? (
          <SplitQueueLayout
            placedOrders={placedOrders}
            inProgressOrders={displayedInProgressOrders}
            totalInProgressCount={inProgressOrders.length}
            myDrinksOnly={myDrinksOnly}
            baristaName={baristaName}
            now={now}
            onMarkReady={handleMarkReady}
            onMarkInProgress={handleMarkInProgress}
            onBackToQueue={handleBackToQueue}
            onCancelClick={(order) => setConfirmCancel(order)}
            updatingOrderId={updatingOrderId}
            newOrderIds={newOrderIds}
          />
        ) : currentOrders.length === 0 ? (
          <div className="text-center py-8 md:py-16">
            <p className="font-roboto-mono text-delo-navy/40 text-lg">
              {
                {
                  placed: todayOnly ? 'No orders waiting today' : 'No orders waiting',
                  in_progress: todayOnly ? 'No orders in progress today' : 'No orders in progress',
                  ready: todayOnly ? 'No orders ready today' : 'No orders ready yet',
                  canceled: todayOnly ? 'No cancelled orders today' : 'No cancelled orders',
                }[activeTab]
              }
            </p>
          </div>
        ) : (
          <div key={activeTab} className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <AnimatePresence mode="popLayout">
              {currentOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  now={now}
                  onMarkReady={handleMarkReady}
                  onBackToPlaced={handleBackToPlaced}
                  onRestore={handleRestore}
                  onCancelClick={() => setConfirmCancel(order)}
                  isUpdating={updatingOrderId === order.id}
                  isNew={newOrderIds.has(order.id)}
                  isMultiBarista={isMultiBarista}
                  currentBarista={baristaName}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Cancel confirmation modal */}
      <ResponsiveModal
        isOpen={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        title="Cancel this order?"
        size="sm"
      >
        {confirmCancel && (
          <>
            <p className="font-manrope text-delo-navy/70 mb-6">
              {confirmCancel.customer_name}&apos;s {confirmCancel.item}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmCancel(null)}
                className="btn-kitchen-secondary flex-1"
              >
                Keep Order
              </button>
              <button
                onClick={() => handleCancel(confirmCancel.id)}
                className="flex-1 py-3 px-4 rounded-lg bg-red-600 text-white font-manrope font-semibold transition-colors hover:bg-red-700 min-h-[44px]"
              >
                Yes, Cancel
              </button>
            </div>
          </>
        )}
      </ResponsiveModal>
    </div>
  )
}
