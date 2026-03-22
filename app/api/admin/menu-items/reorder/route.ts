import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * PUT /api/admin/menu-items/reorder
 * Batch update display_order for menu items after drag-and-drop
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { items } = body

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items array is required' }, { status: 400 })
    }

    // Validate each item has id and display_order
    for (const item of items) {
      if (!item.id || typeof item.display_order !== 'number') {
        return NextResponse.json(
          { error: 'Each item must have id and display_order' },
          { status: 400 }
        )
      }
    }

    // Update all items in parallel
    const updates = items.map((item: { id: string; display_order: number }) =>
      supabase.from('menu_items').update({ display_order: item.display_order }).eq('id', item.id)
    )

    const results = await Promise.all(updates)

    // Check for errors
    const errors = results.filter((r) => r.error)
    if (errors.length > 0) {
      console.error(
        'Reorder errors:',
        errors.map((e) => e.error)
      )
      return NextResponse.json({ error: 'Failed to reorder some items' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering menu items:', error)
    return NextResponse.json({ error: 'Failed to reorder menu items' }, { status: 500 })
  }
}
