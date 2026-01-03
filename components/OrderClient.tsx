'use client'

import { useState, useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { MenuItem, Modifier, Order } from '@/lib/supabase'
import DrinkCard from './DrinkCard'
import DrinkCustomizer from './DrinkCustomizer'

interface OrderClientProps {
  menuItems: MenuItem[]
  modifiers: Modifier[]
}

type Screen = 'menu' | 'customize' | 'confirmed'

/**
 * OrderClient - Main controller for the ordering flow
 *
 * Manages which screen is shown (menu, customize, or confirmed)
 * and handles all state for the order in progress.
 *
 * Screen flow:
 * 1. Menu grid (select a drink)
 * 2. Customization modal overlays the menu (choose modifiers)
 * 3. Confirmation screen (after submit) - Phase 6
 *
 * When a drink is tapped, a modal slides up with a blur backdrop.
 */
export default function OrderClient({ menuItems, modifiers }: OrderClientProps) {
  // Current screen in the flow
  const [screen, setScreen] = useState<Screen>('menu')

  // Selected drink and its customization
  const [selectedDrink, setSelectedDrink] = useState<MenuItem | null>(null)
  const [selectedModifiers, setSelectedModifiers] = useState<{
    milk?: string
    temperature?: string
  }>({})
  const [customerName, setCustomerName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedOrder, setSubmittedOrder] = useState<Order | null>(null)

  /**
   * When a drink is tapped, select it and initialize modifiers with defaults
   */
  const handleSelectDrink = (drink: MenuItem) => {
    setSelectedDrink(drink)

    // Initialize modifiers with the drink's defaults
    setSelectedModifiers({
      milk: drink.default_modifiers?.milk ?? undefined,
      temperature: drink.default_modifiers?.temperature ?? undefined,
    })

    // Show the customization modal
    setScreen('customize')
  }

  /**
   * Update a modifier selection
   */
  const handleModifierChange = (
    category: 'milk' | 'temperature',
    value: string
  ) => {
    setSelectedModifiers((prev) => ({
      ...prev,
      [category]: value,
    }))
  }

  /**
   * Update customer name
   */
  const handleNameChange = (name: string) => {
    setCustomerName(name)
  }

  /**
   * Submit the order to the database
   */
  const handleSubmit = async () => {
    if (!selectedDrink || !customerName.trim() || isSubmitting) return

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          item: selectedDrink.name,
          modifiers: selectedModifiers,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to submit order')
      }

      const order: Order = await response.json()
      setSubmittedOrder(order)
      setScreen('confirmed')
    } catch (error) {
      console.error('Order submission failed:', error)
      // For now, just log the error - Phase 7 will add proper error handling
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * Close the customization modal
   */
  const handleCloseModal = () => {
    setScreen('menu')
    setCustomerName('') // Reset name for next order
    // Keep the drink selected briefly for visual continuity during close animation
    setTimeout(() => setSelectedDrink(null), 300)
  }

  // Whether the modal is open (for dimming effect)
  const isModalOpen = screen === 'customize' && selectedDrink !== null

  // Group menu items by category (Signature first, then Classics)
  const groupedMenu = useMemo(() => {
    const categories = ['Signature', 'Classics'] as const
    const grouped: { category: string; items: MenuItem[] }[] = []

    for (const category of categories) {
      const items = menuItems.filter((item) => item.category === category)
      if (items.length > 0) {
        grouped.push({ category, items })
      }
    }

    return grouped
  }, [menuItems])

  // Track running index for stagger animation across all categories
  let runningIndex = 0

  return (
    <>
      {/* Menu grid - always visible behind modal */}
      <div className="min-h-screen bg-delo-cream p-8">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="font-yatra text-5xl text-delo-maroon">
            Delo Coffee
          </h1>
        </header>

        {/* Menu by Category */}
        <div className="max-w-4xl mx-auto space-y-8">
          {groupedMenu.map(({ category, items }) => (
            <section key={category}>
              {/* Category header */}
              <h2 className="font-bricolage font-semibold text-base uppercase tracking-wider text-delo-navy/60 mb-4">
                {category}
              </h2>

              {/* Drink grid */}
              <div className="grid grid-cols-3 gap-6">
                {items.map((drink) => {
                  const index = runningIndex++
                  return (
                    <DrinkCard
                      key={drink.id}
                      drink={drink}
                      index={index}
                      isSelected={selectedDrink?.id === drink.id}
                      onSelect={handleSelectDrink}
                    />
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Customization modal - slides up with blur backdrop */}
      <AnimatePresence>
        {isModalOpen && (
          <DrinkCustomizer
            drink={selectedDrink}
            modifiers={modifiers}
            selectedModifiers={selectedModifiers}
            onModifierChange={handleModifierChange}
            customerName={customerName}
            onNameChange={handleNameChange}
            onSubmit={handleSubmit}
            onClose={handleCloseModal}
            isSubmitting={isSubmitting}
          />
        )}
      </AnimatePresence>

      {/* Phase 6 will add the confirmation screen here */}
    </>
  )
}
