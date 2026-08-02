'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { Order, OrderStatus, supabase } from '@/lib/supabase'
import { isToday } from '@/lib/dateUtils'
import OrderCard from './OrderCard'
import KitchenTabs, { KitchenTab } from './KitchenTabs'
import ConnectionStatus, { type KitchenConnection } from './ConnectionStatus'
import NavMenu from './NavMenu'
import SplitQueueLayout from './SplitQueueLayout'
import ResponsiveModal from './ResponsiveModal'

interface KitchenClientProps {
  initialOrders: Order[]
  /** The server couldn't reach the database, so `initialOrders` is empty but not truthful. */
  initialLoadFailed?: boolean
}

/** How often the display re-checks the database, regardless of realtime's state. */
const SYNC_INTERVAL_MS = 30_000
/** Comfortably more than one event's orders, so the newest rows are always covered. */
const SYNC_ROW_LIMIT = 200
/** A hung request has to fail rather than silently stall the safety net. */
const SYNC_TIMEOUT_MS = 10_000
/**
 * Consecutive failed syncs before the banner escalates from "delayed" to "offline".
 * Two — 30s apart, so ~30-40s of no contact once a hung request has timed out — separates
 * "realtime dropped but orders are still arriving" from "nothing is getting through". One
 * failure alone is too twitchy on venue WiFi to alarm anyone with.
 */
const SYNC_FAILURES_BEFORE_ALARM = 2

/** Parse defensively: an unrecognised shape is passed through rather than thrown on. */
function toIso(value: string): string {
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? value : new Date(parsed).toISOString()
}

/**
 * Put a realtime row's timestamps into the ISO form every other path already delivers.
 *
 * Realtime passes `timestamptz` through as raw Postgres text (`2026-08-01 19:16:56+00`)
 * where PostgREST renders ISO — realtime-js routes `timestamptz` to its `noop` branch on
 * purpose. Parsing that raw form is implementation-defined, and it reaches `new Date()`
 * in the sorts, `isToday`, and `formatPrepTime`. A value that parsed to `NaN` would throw
 * a RangeError out of `Intl.DateTimeFormat` inside a `useMemo` — an error boundary and a
 * dead kitchen screen mid-rush. Converting once, here, keeps that off every other path.
 */
function normalizeRealtimeRow(row: Order): Order {
  return { ...row, created_at: toIso(row.created_at), updated_at: toIso(row.updated_at) }
}

/**
 * Upsert incoming rows into the current list, keyed by id.
 *
 * The single write path for every source — the background sync, realtime, and the
 * response to a barista's own tap. Routing all three through one function is what
 * stops an order appearing twice when a sync and a delayed realtime INSERT both
 * deliver it.
 *
 * Returns `prev` untouched when nothing changed, so React skips the render entirely.
 * That's why a quiet sync (the common case) costs nothing.
 *
 * `updated_at` is compared as an instant, not as a string. The column is `timestamptz(6)`,
 * so PostgREST renders microseconds (`…:56.05063+00:00`) while anything that has passed
 * through a JS `Date` carries milliseconds (`…:56.050Z`). Those never match as text, and
 * treating every realtime-touched row as changed would rebuild the list — and re-render
 * all ~150 cards — on every single sync.
 *
 * `status` and `claimed_by` are compared alongside it because `updated_at` alone is not a
 * version: it's millisecond precision written from the API route's clock
 * (`app/api/orders/[id]/route.ts`), and two Vercel instances drift. Two baristas claiming
 * the same order can land on the same value, and skipping on that collision would drop the
 * change on every future sync too — permanently, not just once. Those three fields are the
 * only ones the PATCH route mutates, so comparing them is exhaustive.
 *
 * Never compares by ordering: `updated_at` comes from Postgres on insert but from a
 * function's clock on update, so "newer" isn't reliably orderable across the two.
 */
function mergeOrders(prev: Order[], incoming: Order[]): Order[] {
  // Map preserves insertion order, and re-setting an existing key keeps its position,
  // so this both replaces in place and appends new rows at the end.
  const byId = new Map(prev.map((order) => [order.id, order]))
  let changed = false

  for (const row of incoming) {
    const current = byId.get(row.id)
    if (
      current &&
      Date.parse(current.updated_at) === Date.parse(row.updated_at) &&
      current.status === row.status &&
      current.claimed_by === row.claimed_by
    ) {
      continue
    }
    byId.set(row.id, row)
    changed = true
  }

  return changed ? Array.from(byId.values()) : prev
}

export default function KitchenClient({
  initialOrders,
  initialLoadFailed = false,
}: KitchenClientProps) {
  // Multi-barista mode: detect via URL param
  const searchParams = useSearchParams()
  const baristaName = searchParams.get('barista') || ''
  const isMultiBarista = baristaName.length > 0

  // All orders (placed, ready, and canceled)
  const [orders, setOrders] = useState<Order[]>(initialOrders)

  // Active tab
  const [activeTab, setActiveTab] = useState<KitchenTab>('placed')

  // Date filter: show only today's orders by default (resets on page load)
  const [todayOnly, setTodayOnly] = useState(true)

  // Multi-barista: show only my in-progress drinks by default
  const [myDrinksOnly, setMyDrinksOnly] = useState(true)

  // Realtime connection status
  const [isConnected, setIsConnected] = useState(true)

  /**
   * Consecutive failed syncs, capped at SYNC_FAILURES_BEFORE_ALARM.
   *
   * Starts at the threshold when the server's own fetch failed, so the banner is already
   * up on the first paint rather than the display quietly claiming an empty queue. The
   * mount sync clears it the moment the database answers.
   */
  const [syncFailures, setSyncFailures] = useState(
    initialLoadFailed ? SYNC_FAILURES_BEFORE_ALARM : 0
  )

  // Track which order is being updated (prevents double-taps)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)

  /**
   * Counts every fresher row applied from any source — a barista's tap, or realtime.
   *
   * A sync reads this before fetching and throws its result away if it moved while the
   * request was in flight: that snapshot was taken before the newer write and would
   * revert the card. Guards the read rather than the write, which is what makes it
   * cover the whole race — a tap can start and finish inside one sync round trip.
   *
   * A ref rather than state so `syncOrders` keeps a stable identity; otherwise every tap
   * would restart the 30s timer and the reconnect catch-up, both of which depend on it.
   * (The realtime channel is safe either way — its effect keeps an empty dependency list
   * on purpose, precisely so nothing can tear the socket down.)
   */
  const writeGenerationRef = useRef(0)

  /**
   * The sync currently in flight: the promise so a second caller joins it rather than
   * starting another, and the controller so unmount can abort it. One ref for one
   * operation, so "is a sync running?" has a single answer.
   */
  const syncRef = useRef<{ promise: Promise<void>; controller: AbortController } | null>(null)

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
    const map: Record<KitchenTab, Order[]> = {
      placed: placedOrders,
      ready: readyOrders,
      canceled: canceledOrders,
    }
    return map[activeTab]
  }, [placedOrders, readyOrders, canceledOrders, activeTab])

  // Queue count covers placed + in_progress. In solo mode placedOrders already folds
  // in_progress in, so adding them again would double-count.
  const placedCount = isMultiBarista
    ? placedOrders.length + inProgressOrders.length
    : placedOrders.length
  const readyCount = readyOrders.length
  const cancelledCount = canceledOrders.length

  // Realtime dropping on its own is no longer worth alarming anyone about — the sync
  // covers it. Only repeated sync failures mean orders could genuinely be missing.
  const connectionStatus: KitchenConnection =
    syncFailures >= SYNC_FAILURES_BEFORE_ALARM ? 'unreachable' : isConnected ? 'live' : 'delayed'

  // Filtered in-progress orders for multi-barista "mine only" toggle
  const displayedInProgressOrders = useMemo(
    () =>
      myDrinksOnly && isMultiBarista
        ? inProgressOrders.filter((o) => o.claimed_by === baristaName)
        : inProgressOrders,
    [inProgressOrders, myDrinksOnly, isMultiBarista, baristaName]
  )

  /**
   * Refetch recent orders and merge them in — the safety net.
   *
   * Realtime never delivers what happened while the socket was down, and a socket can
   * stay open while silently delivering nothing at all (the usual outcome after an iPad
   * sleeps, or when WiFi hands off to another access point). Running this on a fixed
   * cadence is what lets the display recover with nobody watching it.
   *
   * Deliberately has no dependencies: everything it reads lives in a ref or module scope,
   * so its identity is stable and the interval below never restarts.
   */
  const syncOrders = useCallback((): Promise<void> => {
    // One sync at a time. Without this, an older response can land after a newer one and
    // revert a card — and the generation guard below structurally cannot catch that,
    // because it only counts writes made on *this* iPad. Another barista's write arrives
    // through neither channel while realtime is down, which is exactly when this runs.
    // It also stops the three triggers stacking on a wake-up, when the link is weakest.
    //
    // A second caller gets back the attempt already running rather than nothing, so the
    // banner's Retry waits for a real result instead of resolving instantly and looking
    // dead — a failing sync can hold this slot for the full 10s timeout.
    if (syncRef.current) return syncRef.current.promise

    // AbortController rather than AbortSignal.timeout — the latter is Safari 16+ and
    // would throw on every tick on an older iPad, silently disabling the safety net.
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS)

    const run = async () => {
      const generation = writeGenerationRef.current

      try {
        // Newest rows by count, not by a time window: a window would have to be measured
        // from the iPad's clock against timestamps written by the server, so a device with
        // a badly-set clock could quietly fetch nothing at all and still look healthy.
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(SYNC_ROW_LIMIT)
          .abortSignal(controller.signal)

        // An aborted or failed request resolves here with `error` set — the Supabase
        // client converts rejections into a result — so this, not the `catch` below, is
        // the branch that actually runs when the network is down.
        if (error || !data) {
          // Saturates at the threshold: nothing reads the count beyond the comparison
          // below, and letting it climb would re-render every card on each failed sync,
          // for no visual change, throughout the outage.
          setSyncFailures((n) => Math.min(n + 1, SYNC_FAILURES_BEFORE_ALARM))
          return
        }
        setSyncFailures(0)

        const rows = data as Order[]
        // A tap or realtime update landed while this was in flight, so rows we already
        // hold may predate it and would revert a card. Rows we've never seen can't revert
        // anything, so they still get applied — otherwise a busy rush, where taps are
        // constant, is exactly when the safety net stops delivering missed orders.
        const stale = writeGenerationRef.current !== generation
        setOrders((prev) => {
          if (!stale) return mergeOrders(prev, rows)
          const known = new Set(prev.map((order) => order.id))
          return mergeOrders(
            prev,
            rows.filter((row) => !known.has(row.id))
          )
        })
      } catch {
        // Defensive only — the client resolves rather than rejects on network failure.
      } finally {
        clearTimeout(timeout)
      }
    }

    // Cleared in a chained `.finally` rather than inside `run` so the assignment below
    // always happens first, whatever `run` does before its first await.
    const promise = run().finally(() => {
      syncRef.current = null
    })
    syncRef.current = { promise, controller }
    return promise
  }, [])

  /**
   * Realtime subscription for order updates
   */
  useEffect(() => {
    const channel = supabase
      .channel('kitchen-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        // Any realtime row is fresher than a sync already in flight.
        writeGenerationRef.current++

        if (payload.eventType === 'DELETE') {
          const deletedId = payload.old.id as string
          setOrders((prev) => prev.filter((o) => o.id !== deletedId))
          return
        }
        // INSERT and UPDATE go through the same upsert as the sync, so an order
        // delivered by both paths can never appear twice.
        const row = normalizeRealtimeRow(payload.new as Order)
        setOrders((prev) => mergeOrders(prev, [row]))
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
    // Deliberately empty, and it must stay that way: anything reactive in here tears the
    // channel down and rejoins it. The catch-up sync lives in its own effect below rather
    // than in the callback above so that this list can never grow.
  }, [])

  /**
   * Fixed-cadence sync, plus an immediate catch-up whenever the screen comes back into
   * view — iOS freezes timers while the iPad is asleep or the tab is backgrounded, so
   * the visibility trigger is the real recovery path after a screen lock.
   */
  useEffect(() => {
    // Runs on mount, and again every time the channel comes back after a drop: whatever
    // happened while it was down was never delivered, so catch up. Driven off the
    // connection state rather than the subscribe callback so the channel effect above
    // can keep an empty dependency list.
    if (isConnected) syncOrders()
  }, [isConnected, syncOrders])

  useEffect(() => {
    const syncIfVisible = () => {
      if (document.visibilityState === 'visible') syncOrders()
    }

    const interval = setInterval(syncIfVisible, SYNC_INTERVAL_MS)
    document.addEventListener('visibilitychange', syncIfVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', syncIfVisible)
      syncRef.current?.controller.abort()
    }
  }, [syncOrders])

  /**
   * Update an order's status via the API, then apply the row the server sends back.
   */
  const updateOrderStatus = useCallback(
    async (
      orderId: string,
      newStatus: OrderStatus,
      errorMessage: string,
      extraFields?: Record<string, unknown>
    ) => {
      setUpdatingOrderId(orderId)
      // Bumped at the start so a sync already in flight is invalidated the moment the
      // barista taps, and again after the response so one that read before this write
      // committed is invalidated too. Together they cover the full round trip.
      writeGenerationRef.current++
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

        const updatedOrder: Order = await response.json()
        writeGenerationRef.current++
        setOrders((prev) => mergeOrders(prev, [updatedOrder]))
      } catch {
        setError(errorMessage)
      } finally {
        // Only clear if this order is still the one showing a spinner — a tap on a second
        // order takes the slot, and clearing it blindly would re-enable that card's
        // buttons while its own request was still in flight.
        setUpdatingOrderId((current) => (current === orderId ? null : current))
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
      <ConnectionStatus status={connectionStatus} onRetry={syncOrders} />

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
          onTabChange={setActiveTab}
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
            baristaName={baristaName}
            now={now}
            onMarkReady={handleMarkReady}
            onMarkInProgress={handleMarkInProgress}
            onBackToQueue={handleBackToQueue}
            onCancelClick={(order) => setConfirmCancel(order)}
            updatingOrderId={updatingOrderId}
          />
        ) : currentOrders.length === 0 ? (
          <div className="text-center py-8 md:py-16">
            <p className="font-roboto-mono text-delo-navy/40 text-lg">
              {
                {
                  placed: todayOnly ? 'No orders waiting today' : 'No orders waiting',
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
