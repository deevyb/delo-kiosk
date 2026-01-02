# Delo Coffee `/order` Page Implementation Plan

## Overview

Build the customer ordering screen in **7 testable phases**. Each phase ends with something you can see and test before moving on.

**Design Decision:** Full-screen flow - tapping a drink transitions to a focused view for customization.

**Flow:** Menu Grid → (tap drink) → Customization Screen → (tap Send) → Confirmation → (3 sec) → Menu Grid

---

## Phase 1: Display the Menu Grid

**Goal:** Show all drinks as beautiful cards in a grid.

**Build:**
- `DrinkCard` component - displays drink name with warm Delo styling
- Update `/app/order/page.tsx` to fetch menu items from Supabase
- Responsive grid layout (3 columns on iPad landscape)
- Loading and error states

**Test:** Open `/order` → see all 7 drinks as cards in a grid

**Files:**
- `app/order/page.tsx` (modify)
- `components/DrinkCard.tsx` (create)
- `components/OrderClient.tsx` (create - client component for interactivity)

---

## Phase 2: Drink Selection with Animation

**Goal:** Tapping a drink gives satisfying visual feedback.

**Build:**
- Framer Motion animations: press (scale 0.98), selection border
- Track selected drink in state
- Staggered entrance animation for cards on page load

**Test:** Tap drinks → cards respond with press animation, selected drink shows maroon border

**Files:**
- `components/DrinkCard.tsx` (modify)
- `components/OrderClient.tsx` (modify)

---

## Phase 3: Customization Screen

**Goal:** Floating modal for customizing the selected drink (like Square's approach).

**Design Decisions:**
- **Layout:** Floating modal panel over dimmed menu grid (not full-screen)
- **Transition:** Netflix/iOS folder style - card expands into centered modal using Framer Motion's `layoutId`
- **Close behavior:** Both X button in corner AND backdrop tap to close

**Build:**
- `DrinkCustomizer` component - floating modal showing:
  - X close button in top-right corner
  - Selected drink name prominently displayed
  - `ModifierSelector` with button groups for milk/temperature
  - Only shows applicable modifiers (based on modifier_config)
  - Pre-selects defaults from the drink's default_modifiers
- Dimmed backdrop overlay (click to close)
- Shared element transition using `layoutId` - card morphs into modal
- Menu grid stays visible but dimmed in background

**Test:**
- Tap "Elaichi Latte" → card expands into floating modal, menu dims behind
- "Regular" and "Hot" are pre-selected
- Tap X or backdrop → modal closes, card animates back
- Tap "Espresso" → modal shows "No customization options"
- Tap "Cortado" → only Milk options appear

**Files:**
- `components/DrinkCustomizer.tsx` (modify - convert to modal)
- `components/ModifierSelector.tsx` (already created)
- `components/OrderClient.tsx` (modify - add backdrop, change layout)
- `components/DrinkCard.tsx` (already has layoutId)

---

## Phase 4: Name Input

**Goal:** Add name input to the customization screen.

**Build:**
- `NameInput` component - large, clear text field
- Add to `DrinkCustomizer` below modifiers
- Required field validation
- Error message if empty on submit attempt

**Test:** On customization screen, type name → text appears clearly, field is easy to use

**Files:**
- `components/NameInput.tsx` (create)
- `components/DrinkCustomizer.tsx` (modify)

---

## Phase 5: Submit Order

**Goal:** Tapping "Send" creates an order in the database.

**Build:**
- `SendButton` component - large maroon button
- API route `app/api/orders/route.ts` to create order in Supabase
- Loading state during submission
- Disabled when name is empty

**Test:** Complete order → check Supabase dashboard for new order

**Files:**
- `components/SendButton.tsx` (create)
- `app/api/orders/route.ts` (create)
- `components/OrderClient.tsx` (modify)

---

## Phase 6: Confirmation Screen

**Goal:** Show satisfying confirmation after order submits.

**Build:**
- `OrderConfirmation` component - full screen with order summary
- Shows: "Sarah: Elaichi Latte, Oat Milk, Iced"
- Smooth fade transition from menu to confirmation

**Test:** Submit order → confirmation appears with your name and order details

**Files:**
- `components/OrderConfirmation.tsx` (create)
- `components/OrderClient.tsx` (modify)

---

## Phase 7: Auto-Reset and Polish

**Goal:** Screen resets for next customer, everything feels polished.

**Build:**
- Auto-reset after 3 seconds on confirmation
- Reset all state (drink, modifiers, name)
- Network error handling with friendly message
- Double-tap protection on Send button

**Test:**
- Wait 3 seconds after confirmation → screen resets to menu
- Complete 5+ orders in a row → smooth every time
- Turn off wifi → friendly error message appears

**Files:**
- `components/OrderClient.tsx` (modify)

---

## Component Structure

```
/app/order/page.tsx          (fetches data, renders OrderClient)
/components/
  OrderClient.tsx            (state management, screen transitions)
  DrinkCard.tsx              (individual drink card in menu grid)
  DrinkCustomizer.tsx        (full-screen customization view)
  ModifierSelector.tsx       (milk/temp button groups)
  NameInput.tsx              (customer name field)
  SendButton.tsx             (submit button)
  OrderConfirmation.tsx      (success screen)
```

**Screen Flow:**
1. `OrderClient` shows menu grid with `DrinkCard` components
2. Tap drink → transitions to `DrinkCustomizer` (full screen)
3. `DrinkCustomizer` contains `ModifierSelector`, `NameInput`, `SendButton`
4. Submit → transitions to `OrderConfirmation`
5. Auto-reset → back to menu grid

---

## State (in OrderClient.tsx)

```typescript
screen: 'menu' | 'customize' | 'confirmed'  // Which screen to show
selectedDrink: MenuItem | null               // The drink being customized
modifiers: { milk?: string; temperature?: string }
customerName: string
isSubmitting: boolean                        // Loading state for submit
error: string | null                         // Error message if any
```

---

## Animation Timing

| Animation | Duration |
|-----------|----------|
| Card entrance | 300ms (staggered 50ms) |
| Card press | 150ms |
| Selection border | 200ms |
| Panel slide in | 250ms |
| Confirmation fade | 300ms |
| Reset transition | 300ms |
