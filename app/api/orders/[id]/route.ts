import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status } = body

    // Validate status
    if (!status || !['placed', 'ready', 'canceled'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "placed", "ready", or "canceled"' },
        { status: 400 }
      )
    }

    // Update order in database
    const { data, error } = await supabase
      .from('orders')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
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
