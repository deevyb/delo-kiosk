import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Disable caching for fresh stats on every request
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/stats
 * Returns dashboard statistics:
 * - Order counts (today + all-time) with status breakdown
 * - Popular drinks (top 20)
 * - Modifier preferences with percentages
 */
export async function GET() {
  try {
    // Fetch all orders for aggregation
    const { data: orders, error } = await supabase
      .from('orders')
      .select('item, modifiers, status, created_at')

    if (error) throw error

    const allOrders = orders || []

    // Get today's date in YYYY-MM-DD format (UTC)
    const today = new Date().toISOString().split('T')[0]

    // Filter today's orders
    const todayOrders = allOrders.filter((o) => o.created_at.startsWith(today))

    // Count orders by status
    const countByStatus = (orderList: typeof allOrders) => {
      return orderList.reduce(
        (acc, order) => {
          acc.total++
          if (order.status === 'placed') acc.placed++
          else if (order.status === 'ready') acc.ready++
          else if (order.status === 'canceled') acc.canceled++
          return acc
        },
        { total: 0, placed: 0, ready: 0, canceled: 0 }
      )
    }

    // Popular drinks - group by item name, sort by count
    const drinkCounts: Record<string, number> = {}
    for (const order of allOrders) {
      drinkCounts[order.item] = (drinkCounts[order.item] || 0) + 1
    }

    const popularDrinks = Object.entries(drinkCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)

    // Modifier breakdown - dynamic categories
    const modifierCounts: Record<string, Record<string, number>> = {}

    for (const order of allOrders) {
      if (!order.modifiers) continue

      for (const [category, option] of Object.entries(order.modifiers)) {
        if (!option) continue // Skip null/undefined values

        if (!modifierCounts[category]) modifierCounts[category] = {}
        modifierCounts[category][option as string] =
          (modifierCounts[category][option as string] || 0) + 1
      }
    }

    // Convert to array with percentages
    const modifierBreakdown: Record<
      string,
      { option: string; count: number; percentage: number }[]
    > = {}

    for (const [category, options] of Object.entries(modifierCounts)) {
      const total = Object.values(options).reduce((a, b) => a + b, 0)

      modifierBreakdown[category] = Object.entries(options)
        .map(([option, count]) => ({
          option,
          count,
          percentage: Math.round((count / total) * 100),
        }))
        .sort((a, b) => b.count - a.count)
    }

    return NextResponse.json({
      today: countByStatus(todayOrders),
      allTime: countByStatus(allOrders),
      popularDrinks,
      modifierBreakdown,
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
