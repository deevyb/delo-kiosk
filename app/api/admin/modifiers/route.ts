import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/admin/modifiers
 * Fetch all modifiers (including inactive) for admin management
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('modifiers')
      .select('*')
      .order('category')
      .order('display_order')

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching modifiers:', error)
    return NextResponse.json({ error: 'Failed to fetch modifiers' }, { status: 500 })
  }
}

/**
 * POST /api/admin/modifiers
 * Create a new modifier
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { category, option } = body

    // Validation
    if (!category || !option) {
      return NextResponse.json({ error: 'Category and option are required' }, { status: 400 })
    }

    const trimmedOption = option.trim()
    if (!trimmedOption) {
      return NextResponse.json({ error: 'Option name is required' }, { status: 400 })
    }

    // Check for duplicate option within category
    const { data: existing } = await supabase
      .from('modifiers')
      .select('id')
      .eq('category', category)
      .ilike('option', trimmedOption)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: `This option already exists in ${category}` },
        { status: 400 }
      )
    }

    // Get max display_order for this category
    const { data: maxOrderData } = await supabase
      .from('modifiers')
      .select('display_order')
      .eq('category', category)
      .order('display_order', { ascending: false })
      .limit(1)
      .single()

    const nextOrder = (maxOrderData?.display_order ?? -1) + 1

    // Create the modifier
    const { data, error } = await supabase
      .from('modifiers')
      .insert({
        category,
        option: trimmedOption,
        is_active: true,
        display_order: nextOrder,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating modifier:', error)
    return NextResponse.json({ error: 'Failed to create modifier' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/modifiers
 * Update a modifier (toggle active, rename)
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, option, is_active } = body

    if (!id) {
      return NextResponse.json({ error: 'Modifier ID required' }, { status: 400 })
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {}

    if (typeof is_active === 'boolean') {
      updates.is_active = is_active
    }

    if (option !== undefined) {
      const trimmedOption = option.trim()
      if (!trimmedOption) {
        return NextResponse.json({ error: 'Option name is required' }, { status: 400 })
      }

      // Get current modifier to check category
      const { data: current } = await supabase
        .from('modifiers')
        .select('category')
        .eq('id', id)
        .single()

      if (!current) {
        return NextResponse.json({ error: 'Modifier not found' }, { status: 404 })
      }

      // Check for duplicate option within category (excluding self)
      const { data: existing } = await supabase
        .from('modifiers')
        .select('id')
        .eq('category', current.category)
        .ilike('option', trimmedOption)
        .neq('id', id)
        .single()

      if (existing) {
        return NextResponse.json(
          { error: `This option already exists in ${current.category}` },
          { status: 400 }
        )
      }

      updates.option = trimmedOption
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('modifiers')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    if (!data) {
      return NextResponse.json({ error: 'Modifier not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating modifier:', error)
    return NextResponse.json({ error: 'Failed to update modifier' }, { status: 500 })
  }
}
