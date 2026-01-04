import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/admin/menu-items
 * Fetch all menu items (including inactive) for admin management
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('display_order')

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching menu items:', error)
    return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/menu-items
 * Update a menu item (toggle active, change modifier config)
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, is_active, modifier_config } = body

    if (!id) {
      return NextResponse.json({ error: 'Item ID required' }, { status: 400 })
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {}
    if (typeof is_active === 'boolean') {
      updates.is_active = is_active
    }
    if (modifier_config !== undefined) {
      updates.modifier_config = modifier_config
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('menu_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    if (!data) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating menu item:', error)
    return NextResponse.json({ error: 'Failed to update menu item' }, { status: 500 })
  }
}
