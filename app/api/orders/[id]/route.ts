import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, claimed_by } = body

    // Validate status
    if (!status || !['placed', 'in_progress', 'ready', 'canceled'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "placed", "in_progress", "ready", or "canceled"' },
        { status: 400 }
      )
    }

    // Build update object
    const updateFields: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    }

    // Handle claimed_by: set when provided, clear when returning to placed
    if (claimed_by !== undefined) {
      updateFields.claimed_by = claimed_by
    } else if (status === 'placed') {
      updateFields.claimed_by = null
    }

    // Update order in database
    const { data, error } = await supabase
      .from('orders')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Request error:', error)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
