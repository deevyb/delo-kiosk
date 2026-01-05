import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { customer_name, item, modifiers } = body

    // Validate required fields
    if (!customer_name || typeof customer_name !== 'string' || !customer_name.trim()) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 })
    }

    if (!item || typeof item !== 'string' || !item.trim()) {
      return NextResponse.json({ error: 'Item is required' }, { status: 400 })
    }

    // Look up the menu item to get default modifiers
    const { data: menuItem } = await supabase
      .from('menu_items')
      .select('default_modifiers, modifier_config')
      .eq('name', item.trim())
      .single()

    // Apply defaults for any missing modifiers
    // Only apply defaults for modifier categories that are enabled for this drink
    const finalModifiers = { ...(modifiers || {}) }
    if (menuItem?.default_modifiers && menuItem?.modifier_config) {
      for (const [category, defaultValue] of Object.entries(menuItem.default_modifiers)) {
        // Only apply default if: category is enabled AND no value was provided
        if (menuItem.modifier_config[category] && !finalModifiers[category] && defaultValue) {
          finalModifiers[category] = defaultValue
        }
      }
    }

    // Insert order into database
    const { data, error } = await supabase
      .from('orders')
      .insert({
        customer_name: customer_name.trim(),
        item: item.trim(),
        modifiers: finalModifiers,
        status: 'placed',
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch {
    console.error('Request error')
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
