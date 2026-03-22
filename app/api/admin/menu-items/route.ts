import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/admin/menu-items
 * Fetch all menu items (including inactive) for admin management
 */
export async function GET() {
  try {
    const { data, error } = await supabase.from('menu_items').select('*').order('display_order')

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching menu items:', error)
    return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 })
  }
}

/**
 * POST /api/admin/menu-items
 * Create a new menu item
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, description, category, modifier_config } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Get max display_order to append new item at end
    const { data: existingItems } = await supabase
      .from('menu_items')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)

    const maxOrder = existingItems?.[0]?.display_order ?? 0
    const newDisplayOrder = maxOrder + 1

    // Create the new item
    const { data, error } = await supabase
      .from('menu_items')
      .insert({
        name: name.trim(),
        description: description || null,
        category: category || 'Signature',
        modifier_config: modifier_config || {},
        default_modifiers: {},
        is_active: true,
        display_order: newDisplayOrder,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating menu item:', error)
    return NextResponse.json({ error: 'Failed to create menu item' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/menu-items
 * Update a menu item (toggle active, change modifier config)
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, name, description, is_active, is_archived, modifier_config, default_modifiers } = body

    if (!id) {
      return NextResponse.json({ error: 'Item ID required' }, { status: 400 })
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {}
    if (typeof name === 'string') {
      if (!name.trim()) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
      }
      updates.name = name.trim()
    }
    if (description !== undefined) {
      updates.description = description === null || description === '' ? null : description
    }
    if (typeof is_active === 'boolean') {
      updates.is_active = is_active
    }
    if (typeof is_archived === 'boolean') {
      updates.is_archived = is_archived
    }
    if (modifier_config !== undefined) {
      updates.modifier_config = modifier_config
    }
    if (default_modifiers !== undefined) {
      updates.default_modifiers = default_modifiers
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
