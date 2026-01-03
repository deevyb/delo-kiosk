import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { customer_name, item, modifiers } = body

    // Validate required fields
    if (!customer_name || typeof customer_name !== 'string' || !customer_name.trim()) {
      return NextResponse.json(
        { error: 'Customer name is required' },
        { status: 400 }
      )
    }

    if (!item || typeof item !== 'string' || !item.trim()) {
      return NextResponse.json(
        { error: 'Item is required' },
        { status: 400 }
      )
    }

    // Insert order into database
    const { data, error } = await supabase
      .from('orders')
      .insert({
        customer_name: customer_name.trim(),
        item: item.trim(),
        modifiers: modifiers || {},
        status: 'placed',
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create order' },
        { status: 500 }
      )
    }

    return NextResponse.json(data, { status: 201 })
  } catch {
    console.error('Request error')
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  }
}
