import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for our database tables
export type OrderStatus = 'placed' | 'ready' | 'canceled'

export interface MenuItem {
  id: string
  name: string
  description: string | null
  image_url: string | null
  category: string
  is_active: boolean
  display_order: number
  modifier_config: {
    milk: boolean
    temperature: boolean
  }
  default_modifiers: {
    milk: string | null
    temperature: string | null
  }
  created_at: string
  updated_at: string
}

export interface Modifier {
  id: string
  category: 'milk' | 'temperature'
  option: string
  is_active: boolean
  display_order: number
  created_at: string
}

export interface Order {
  id: string
  customer_name: string
  item: string
  modifiers: {
    milk?: string
    temperature?: string
  }
  status: OrderStatus
  created_at: string
  updated_at: string
}
