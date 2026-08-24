import { createClient } from '@supabase/supabase-js'

import type { TimingSummary } from './orderTiming'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (url, options = {}) => {
      return fetch(url, { ...options, cache: 'no-store' })
    },
  },
})

// Types for our database tables
export type OrderStatus = 'placed' | 'in_progress' | 'ready' | 'canceled'

export interface MenuItem {
  id: string
  name: string
  description: string | null
  image_url: string | null
  category: string
  is_active: boolean
  is_archived: boolean
  display_order: number
  // Dynamic modifier config - keys are modifier categories (e.g., "milk", "temperature")
  modifier_config: Record<string, boolean>
  default_modifiers: Record<string, string | null>
  created_at: string
  updated_at: string
}

export interface Modifier {
  id: string
  category: string // Dynamic - could be "milk", "temperature", or any future category
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
  claimed_by: string | null
  created_at: string
  updated_at: string
  /** Set by DB trigger on first claim (multi-barista only); cleared on return to queue. */
  started_at: string | null
  /** Set by DB trigger when marked ready; cleared on return to queue. Source of truth for wait timing. */
  ready_at: string | null
}

// Dashboard stats types
export interface OrderCounts {
  total: number
  placed: number
  in_progress: number
  ready: number
  canceled: number
}

export interface DrinkCount {
  name: string
  count: number
}

export interface ModifierOption {
  option: string
  count: number
  percentage: number
}

export interface TimingStats extends TimingSummary {
  previousEvent: { date: string; p90Seconds: number } | null
}

export interface DashboardStats {
  today: OrderCounts
  allTime: OrderCounts
  popularDrinks: DrinkCount[]
  modifierBreakdown: Record<string, ModifierOption[]>
  timing: TimingStats | null
}
