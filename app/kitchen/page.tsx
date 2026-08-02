import { Suspense } from 'react'
import { supabase, Order } from '@/lib/supabase'
import KitchenClient from '@/components/KitchenClient'

// Force fresh data on each request
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Degrades rather than throws.
 *
 * The client re-syncs itself every 30s and immediately on mount, so an unreachable
 * database doesn't have to take the whole screen down — the display can come up empty and
 * fill itself in the moment the database answers. Throwing here would hand the same
 * condition to `error.tsx` instead, giving one outage two completely different screens
 * depending on whether it started before or after the page mounted, which is a distinction
 * that means nothing to the barista holding the iPad.
 *
 * The failure is passed to the client so the banner can say so on the first paint —
 * otherwise the display would show "No orders waiting" and a healthy status while the
 * database was down, which is worse than saying nothing.
 */
async function getOrders(): Promise<{ orders: Order[]; loadFailed: boolean }> {
  // Fetch all orders (placed, in_progress, ready, and canceled)
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .in('status', ['placed', 'in_progress', 'ready', 'canceled'])
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching orders:', error)
    return { orders: [], loadFailed: true }
  }

  return { orders: (orders || []) as Order[], loadFailed: false }
}

export default async function KitchenPage() {
  const { orders, loadFailed } = await getOrders()

  return (
    <Suspense>
      <KitchenClient initialOrders={orders} initialLoadFailed={loadFailed} />
    </Suspense>
  )
}
