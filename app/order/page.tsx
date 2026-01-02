import { supabase, MenuItem, Modifier } from '@/lib/supabase'
import OrderClient from '@/components/OrderClient'

async function getMenuData() {
  // Fetch active menu items, sorted by display order
  const { data: menuItems, error: menuError } = await supabase
    .from('menu_items')
    .select('*')
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
