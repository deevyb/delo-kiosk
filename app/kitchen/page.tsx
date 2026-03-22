import { supabase, Order } from '@/lib/supabase'
import KitchenClient from '@/components/KitchenClient'

// Force fresh data on each request
export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getOrders() {
  // Fetch all orders (placed, ready, and canceled)
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .in('status', ['placed', 'ready', 'canceled'])
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching orders:', error)
    throw new Error('Failed to load orders')
  }

  return (orders || []) as Order[]
}

export default async function KitchenPage() {
  const orders = await getOrders()

  return <KitchenClient initialOrders={orders} />
}
