'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MenuItem, Modifier } from '@/lib/supabase'
import MenuItemCard from './MenuItemCard'
import MenuItemEditor from './MenuItemEditor'
import NewMenuItemForm from './NewMenuItemForm'

interface MenuItemsSectionProps {
  menuItems: MenuItem[]
  modifiers: Modifier[]
  onUpdate: (updatedItem: MenuItem) => void
  onAdd: (newItem: MenuItem) => void
  onReorder: (items: MenuItem[]) => void
}

/**
 * MenuItemsSection - List of menu items with toggle and edit
 *
 * Grouped by category (Signature, Classics)
 */
// Wrapper that makes a MenuItemCard sortable via dnd-kit
function SortableMenuItemCard({
  item,
  onToggle,
  onEdit,
}: {
  item: MenuItem
  onToggle: () => void
  onEdit: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <MenuItemCard
      ref={setNodeRef}
      item={item}
      onToggle={onToggle}
      onEdit={onEdit}
      dragListeners={listeners}
      dragAttributes={attributes}
      isDragging={isDragging}
      style={style}
    />
  )
}

export default function MenuItemsSection({
  menuItems,
  modifiers,
  onUpdate,
  onAdd,
  onReorder,
}: MenuItemsSectionProps) {
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // DnD sensors — distance threshold for pointer, delay for touch (iPad)
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  const sensors = useSensors(pointerSensor, touchSensor)

  // Get unique modifier categories from the database
  const modifierCategories = Array.from(new Set(modifiers.map((m) => m.category)))

  // Split into active and archived
  const activeItems = menuItems.filter((item) => !item.is_archived)
  const archivedItems = menuItems.filter((item) => item.is_archived)

  // Group active items by category
  const signatureItems = activeItems.filter((item) => item.category === 'Signature')
  const classicItems = activeItems.filter((item) => item.category === 'Classics')

  const handleToggle = async (item: MenuItem) => {
    setError(null)

    // Optimistic update
    const newActiveState = !item.is_active
    onUpdate({ ...item, is_active: newActiveState })

    try {
      const response = await fetch('/api/admin/menu-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, is_active: newActiveState }),
      })

      if (!response.ok) {
        throw new Error('Failed to update')
      }

      const updatedItem = await response.json()
      onUpdate(updatedItem)
    } catch {
      // Revert on error
      onUpdate(item)
      setError('Failed to update. Please try again.')
      setTimeout(() => setError(null), 4000)
    }
  }

  const handleSaveItem = async (
    item: MenuItem,
    updates: {
      name: string
      description: string | null
      modifier_config: Record<string, boolean>
      default_modifiers: Record<string, string | null>
    }
  ) => {
    setError(null)

    try {
      const response = await fetch('/api/admin/menu-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          name: updates.name,
          description: updates.description,
          modifier_config: updates.modifier_config,
          default_modifiers: updates.default_modifiers,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update')
      }

      const updatedItem = await response.json()
      onUpdate(updatedItem)
      setEditingItem(null)
    } catch {
      setError('Failed to save. Please try again.')
      setTimeout(() => setError(null), 4000)
    }
  }

  const handleRemove = async (item: MenuItem) => {
    setError(null)
    try {
      const response = await fetch('/api/admin/menu-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, is_archived: true }),
      })
      if (!response.ok) throw new Error('Failed to remove')
      const updatedItem = await response.json()
      onUpdate(updatedItem)
      setEditingItem(null)
    } catch {
      setError('Failed to remove item. Please try again.')
      setTimeout(() => setError(null), 4000)
    }
  }

  const handleRestore = async (item: MenuItem) => {
    setError(null)
    try {
      const response = await fetch('/api/admin/menu-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, is_archived: false }),
      })
      if (!response.ok) throw new Error('Failed to restore')
      const updatedItem = await response.json()
      onUpdate(updatedItem)
    } catch {
      setError('Failed to restore item. Please try again.')
      setTimeout(() => setError(null), 4000)
    }
  }

  // Category offsets so global display_order stays correct across categories
  const CATEGORY_OFFSETS: Record<string, number> = { Signature: 0, Classics: 1000 }

  const handleDragEnd = async (
    event: DragEndEvent,
    categoryItems: MenuItem[],
    category: string
  ) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = categoryItems.findIndex((item) => item.id === active.id)
    const newIndex = categoryItems.findIndex((item) => item.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(categoryItems, oldIndex, newIndex)
    const offset = CATEGORY_OFFSETS[category] ?? 0

    // Assign new display_order values
    const updatedCategoryItems = reordered.map((item, i) => ({
      ...item,
      display_order: offset + i,
    }))

    // Optimistic update — replace the category's items in the full list
    const otherItems = menuItems.filter((item) => item.category !== category || item.is_archived)
    onReorder(
      [...otherItems, ...updatedCategoryItems].sort(
        (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
      )
    )

    // Persist to API
    try {
      const response = await fetch('/api/admin/menu-items/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: updatedCategoryItems.map((item) => ({
            id: item.id,
            display_order: item.display_order,
          })),
        }),
      })

      if (!response.ok) throw new Error('Failed to reorder')
    } catch {
      setError('Failed to save new order. Please try again.')
      setTimeout(() => setError(null), 4000)
    }
  }

  const renderCategory = (title: string, items: MenuItem[]) => {
    if (items.length === 0) return null

    return (
      <div className="mb-8 last:mb-0">
        <h3 className="font-bricolage font-semibold text-sm md:text-base text-delo-navy/60 uppercase tracking-wide mb-3 text-balance">
          {title}
        </h3>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => handleDragEnd(event, items, title)}
        >
          <SortableContext
            items={items.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {items.map((item) => (
                <SortableMenuItemCard
                  key={item.id}
                  item={item}
                  onToggle={() => handleToggle(item)}
                  onEdit={() => setEditingItem(item)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl p-4 md:p-6 border border-delo-navy/10">
      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header with Add button */}
      <div className="flex justify-between items-start mb-4 md:mb-6">
        <p className="text-description text-xs md:text-sm text-pretty">
          Toggle drinks on or off. Tap Edit to change details. Drag to reorder.
        </p>
        <motion.button
          onClick={() => setShowNewForm(true)}
          whileTap={{ scale: 0.97 }}
          className="btn-compact ml-4"
        >
          + Add Item
        </motion.button>
      </div>

      {/* Categories */}
      {renderCategory('Signature', signatureItems)}
      {renderCategory('Classics', classicItems)}

      {/* Removed Items - collapsible section */}
      {archivedItems.length > 0 && (
        <div className="mt-8 pt-6 border-t border-delo-navy/10">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 font-bricolage font-semibold text-base text-delo-navy/40 hover:text-delo-navy/60 transition-colors mb-3"
          >
            <motion.span
              animate={{ rotate: showArchived ? 90 : 0 }}
              transition={{ duration: 0.2 }}
              className="inline-block text-sm"
            >
              ▶
            </motion.span>
            Archived Items ({archivedItems.length})
          </button>
          <AnimatePresence>
            {showArchived && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-2 overflow-hidden"
              >
                {archivedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 md:p-4 rounded-xl border bg-delo-navy/5 border-delo-navy/5"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bricolage font-semibold text-base md:text-lg text-delo-navy/40 truncate">
                        {item.name}
                      </h4>
                      <p className="text-sm text-delo-navy/30">{item.category}</p>
                    </div>
                    <motion.button
                      onClick={() => handleRestore(item)}
                      whileTap={{ scale: 0.97 }}
                      className="px-4 py-2 min-h-[44px] text-sm font-manrope font-semibold text-delo-maroon border border-delo-maroon/30 hover:bg-delo-maroon/5 rounded-lg transition-colors ml-4"
                    >
                      Restore
                    </motion.button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Edit modal - uses shared Modal component */}
      {editingItem && (
        <MenuItemEditor
          item={editingItem}
          categories={modifierCategories}
          onSave={(updates) => handleSaveItem(editingItem, updates)}
          onRemove={() => handleRemove(editingItem)}
          onClose={() => setEditingItem(null)}
          isOpen={!!editingItem}
        />
      )}

      {/* New item modal - uses shared Modal component */}
      <NewMenuItemForm
        categories={modifierCategories}
        existingCategories={['Signature', 'Classics']}
        onSave={(newItem) => {
          onAdd(newItem)
          setShowNewForm(false)
        }}
        onClose={() => setShowNewForm(false)}
        isOpen={showNewForm}
      />
    </div>
  )
}
