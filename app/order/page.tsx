import { supabase, MenuItem, Modifier } from '@/lib/supabase'
import OrderClient from '@/components/OrderClient'

// Force fresh data on each request - critical for admin toggles to take effect immediately
export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getMenuData() {
  // Fetch active menu items, sorted by display order
  const { data: menuItems, error: menuError } = await supabase
    .from('menu_items')
    .select(
      'id, name, description, image_url, category, is_active, display_order, modifier_config, default_modifiers, created_at, updated_at'
    )
    .eq('is_active', true)
    .order('display_order')

  if (menuError) {
    console.error('Error fetching menu items:', menuError)
    throw new Error('Failed to load menu')
  }

  // Fetch active modifiers, sorted by category and display order
  const { data: modifiers, error: modifierError } = await supabase
    .from('modifiers')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('display_order')

  if (modifierError) {
    console.error('Error fetching modifiers:', modifierError)
    throw new Error('Failed to load modifiers')
  }

  return {
    menuItems: (menuItems || []) as MenuItem[],
    modifiers: (modifiers || []) as Modifier[],
  }
}

export default async function OrderPage() {
  const { menuItems, modifiers } = await getMenuData()

  return <OrderClient menuItems={menuItems} modifiers={modifiers} />
}
