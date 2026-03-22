import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/admin/orders
 * Fetch orders with optional date range filtering
 * Query params: startDate, endDate (ISO format: YYYY-MM-DD)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query = supabase.from('orders').select('*').order('created_at', { ascending: false })

    // Apply date filters if provided
    if (startDate) {
      // Start of the day in local time
      query = query.gte('created_at', `${startDate}T00:00:00`)
    }

    if (endDate) {
      // End of the day in local time
      query = query.lte('created_at', `${endDate}T23:59:59`)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}
