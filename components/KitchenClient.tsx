'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { Order, OrderStatus, supabase } from '@/lib/supabase'
import OrderCard from './OrderCard'
import KitchenTabs from './KitchenTabs'
import ConnectionStatus from './ConnectionStatus'
import NavMenu from './NavMenu'

interface KitchenClientProps {
  initialOrders: Order[]
}

type TabType = OrderStatus

export default function KitchenClient({ initialOrders }: KitchenClientProps) {
  // All orders (placed, ready, and canceled)
  const [orders, setOrders] = useState<Order[]>(initialOrders)

  // Track which order IDs arrived via realtime (for entrance animation)
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set())

  // Active tab
  const [activeTab, setActiveTab] = useState<TabType>('placed')

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

  // Filter orders by status
  const placedOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'placed')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [orders]
  )

  const readyOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'ready')
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [orders]
  )

  const canceledOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'canceled')
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [orders]
  )

  // Current tab's orders
  const currentOrders =
    activeTab === 'placed'
      ? placedOrders
      : activeTab === 'ready'
        ? readyOrders
        : canceledOrders

  // Counts for tabs
  const placedCount = placedOrders.length
  const readyCount = readyOrders.length
  const cancelledCount = canceledOrders.length

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
    async (orderId: string, newStatus: OrderStatus, errorMessage: string) => {
      setUpdatingOrderId(orderId)
      setError(null)

      try {
        const response = await fetch(`/api/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
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
    (orderId: string) => updateOrderStatus(orderId, 'ready', "Couldn't update order. Please try again."),
    [updateOrderStatus]
  )

  /**
   * Move a ready order back to placed
   */
  const handleBackToPlaced = useCallback(
    (orderId: string) => updateOrderStatus(orderId, 'placed', "Couldn't move order back. Please try again."),
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
      setConfirmCancel(null) // Close modal
      await updateOrderStatus(orderId, 'canceled', "Couldn't cancel order. Please try again.")
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
      <header className="px-8 pt-8 pb-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <Link href="/" className="cursor-pointer"><h1 className="font-yatra text-4xl text-delo-maroon">Delo Barista Bar</h1></Link>
          <NavMenu />
        </div>
      </header>

      {/* Tabs */}
      <div className="px-8 max-w-4xl mx-auto">
        <KitchenTabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
          placedCount={placedCount}
          readyCount={readyCount}
          cancelledCount={cancelledCount}
        />
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="px-8 max-w-4xl mx-auto mt-4"
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
      <div className="px-8 py-6 max-w-4xl mx-auto">
        {currentOrders.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-roboto-mono text-delo-navy/40 text-lg">
              {activeTab === 'placed'
                ? 'No orders waiting'
                : activeTab === 'ready'
                  ? 'No orders ready yet'
                  : 'No cancelled orders'}
            </p>
          </div>
        ) : (
          <div key={activeTab} className="grid grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {currentOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onMarkReady={handleMarkReady}
                  onBackToPlaced={handleBackToPlaced}
                  onRestore={handleRestore}
                  onCancelClick={() => setConfirmCancel(order)}
                  isUpdating={updatingOrderId === order.id}
                  isNew={newOrderIds.has(order.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Cancel confirmation modal */}
      <AnimatePresence>
        {confirmCancel && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-delo-navy/30 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmCancel(null)}
            />
            {/* Modal */}
            <motion.div
              className="fixed inset-0 flex items-center justify-center z-50 p-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-white rounded-xl p-8 shadow-xl max-w-sm w-full"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              >
                <h2 className="font-bricolage font-bold text-2xl text-delo-navy mb-2">
                  Cancel this order?
                </h2>
                <p className="font-manrope text-delo-navy/70 mb-6">
                  {confirmCancel.customer_name}&apos;s {confirmCancel.item}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmCancel(null)}
                    className="flex-1 py-3 px-4 rounded-lg bg-delo-navy/10 text-delo-navy font-manrope font-semibold transition-colors hover:bg-delo-navy/15"
                  >
                    Keep Order
                  </button>
                  <button
                    onClick={() => handleCancel(confirmCancel.id)}
                    className="flex-1 py-3 px-4 rounded-lg bg-red-600 text-white font-manrope font-semibold transition-colors hover:bg-red-700"
                  >
                    Yes, Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
