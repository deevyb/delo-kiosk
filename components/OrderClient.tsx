'use client'

import { useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { MenuItem, Modifier } from '@/lib/supabase'
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
 * 2. Customization screen (choose modifiers)
 * 3. Confirmation screen (after submit) - Phase 6
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

    // Transition to customize screen
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
   * Go back to menu from customization screen
   */
  const handleBack = () => {
    setScreen('menu')
    // Keep the drink selected so the card stays highlighted briefly
    // Clear it after a short delay for visual continuity
    setTimeout(() => setSelectedDrink(null), 300)
  }

  return (
    <LayoutGroup>
      <AnimatePresence mode="wait">
        {screen === 'menu' && (
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="min-h-screen bg-delo-cream p-8"
          >
            {/* Header */}
            <header className="text-center mb-8">
              <h1 className="font-yatra text-4xl text-delo-maroon">
                What are you having?
              </h1>
            </header>

            {/* Menu Grid */}
            <div className="grid grid-cols-3 gap-6 max-w-4xl mx-auto">
              {menuItems.map((drink, index) => (
                <DrinkCard
                  key={drink.id}
                  drink={drink}
                  index={index}
                  isSelected={selectedDrink?.id === drink.id}
                  onSelect={handleSelectDrink}
                />
              ))}
            </div>
          </motion.div>
        )}

        {screen === 'customize' && selectedDrink && (
          <DrinkCustomizer
            key="customize"
            drink={selectedDrink}
            modifiers={modifiers}
            selectedModifiers={selectedModifiers}
            onModifierChange={handleModifierChange}
            onBack={handleBack}
          />
        )}

        {/* Phase 6 will add the confirmation screen here */}
      </AnimatePresence>
    </LayoutGroup>
  )
}
