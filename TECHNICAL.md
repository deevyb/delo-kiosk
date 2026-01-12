# Technical Documentation

> This document is for developers. The project owner doesn't need to read this.

## Stack Decisions

### Frontend: Next.js 14+ (App Router)

**Why:**

- Industry standard, excellent documentation, large community
- App Router provides modern React patterns (Server Components, Streaming)
- Built-in routing matches our 3-route architecture perfectly
- Vercel deployment is seamless

### Styling: Tailwind CSS

**Why:**

- Utility-first approach speeds up development
- Easy to implement custom color palette (Delo brand colors)
- Excellent responsive design primitives
- No CSS file management overhead

### Animations: Framer Motion

**Why:**

- Owner explicitly requested "silky smooth" animations
- Gold standard for React animations
- Declarative API, easy to maintain
- Handles gesture interactions well (important for iPad touch)

### Database: Supabase (PostgreSQL)

**Why:**

- Built-in Realtime subscriptions (critical for kitchen display)
- PostgreSQL reliability
- Simple REST API + generated TypeScript types
- Row Level Security for future auth needs
- Generous free tier for MVP

### Hosting: Vercel

**Why:**

- Zero-config Next.js deployment
- Edge functions for low latency
- Excellent reliability (critical given crash concerns)
- Preview deployments for testing

---

## Architecture

```
/app
  /order          # Customer-facing menu and ordering
  /kitchen        # Real-time kitchen display
  /admin          # Passcode-protected admin panel
  /api
    /orders       # POST: Create order, PATCH: Update status
    /admin
      /stats      # GET: Dashboard statistics
      /menu-items # GET/POST/PATCH: Menu management
      /modifiers  # GET/POST/PATCH: Modifier management
      /orders     # GET: Export orders (CSV)
      /verify     # POST: Passcode verification
/components       # Shared UI components
/lib              # Utilities, Supabase client, types
/hooks            # Custom React hooks (useOrders, useRealtime, etc.)
```

### Data Flow

1. **Customer submits order** → API route → Supabase INSERT
2. **Supabase Realtime** → Pushes to kitchen display via WebSocket
3. **Barista updates status** → API route → Supabase UPDATE → Realtime broadcast
4. **Admin toggles menu** → API route → Supabase UPDATE → Reflected on next /order load

---

## Database Schema

```sql
-- Menu items (drinks)
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  category TEXT DEFAULT 'Classics',  -- 'Signature' or 'Classics'
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  modifier_config JSONB DEFAULT '{"milk": true, "temperature": true}',
  default_modifiers JSONB DEFAULT '{"milk": "Regular", "temperature": "Hot"}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Modifier options (milk types, temperatures)
CREATE TABLE modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('milk', 'temperature')),
  option TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  item TEXT NOT NULL,
  modifiers JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'ready', 'canceled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_menu_items_active ON menu_items(is_active) WHERE is_active = true;
```

### Schema Notes

- `modifier_config` on menu_items controls which modifier categories apply to each drink
- `modifiers` JSONB on orders stores selected choices: `{"milk": "Oat", "temperature": "Iced"}`
- Denormalized item name in orders for simplicity and historical accuracy
- Status enum is strict: only `placed`, `ready`, `canceled`

---

## API Endpoints

### GET /api/admin/stats

Returns aggregated dashboard statistics:

```typescript
interface DashboardStats {
  today: OrderCounts      // Orders from today
  allTime: OrderCounts    // All orders ever
  popularDrinks: DrinkCount[]  // Top 20 drinks by count
  modifierBreakdown: Record<string, ModifierOption[]>  // e.g., { milk: [...], temperature: [...] }
}

interface OrderCounts {
  total: number
  placed: number
  ready: number
  canceled: number
}

interface DrinkCount {
  name: string
  count: number
}

interface ModifierOption {
  option: string      // e.g., "Oat"
  count: number       // raw count
  percentage: number  // 0-100
}
```

Uses `force-dynamic` for fresh data on every request.

---

## Realtime Strategy

### Kitchen Display Subscription

```typescript
supabase
  .channel('orders')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handleOrderChange)
  .subscribe()
```

### Fallback Strategy

- If WebSocket disconnects, show "Reconnecting..." banner
- Fall back to polling every 5 seconds
- Auto-reconnect when connection restored
- Never lose orders — they persist in database regardless

---

## Authentication

### Admin Passcode

- Simple client-side passcode check for MVP
- Passcode stored in environment variable: `ADMIN_PASSCODE`
- No session management — passcode checked on each admin page load
- Stored in localStorage after successful entry (clears on browser close)

### Future Considerations

- Could upgrade to Supabase Auth if multi-user admin needed
- Row Level Security already possible with current schema

---

## Error Handling

### Customer-Facing Errors

- Never show technical errors
- Friendly messages only: "Something went wrong. Please try again."
- Automatic retry for transient failures
- Always allow fallback to paper if needed

### Kitchen Display Errors

- "Offline — reconnecting..." banner (non-blocking)
- Orders persist locally until connection restored
- Manual refresh always available

### Admin Errors

- More detailed errors acceptable (wrong passcode, export failed, etc.)
- Still human-readable, not technical

---

## Animation Guidelines

Using Framer Motion throughout for consistency:

### Micro-interactions

- Button press: subtle scale (0.98) + background shift
- Card appear: fade in + slide up (200-300ms)
- Card remove: fade out + slide (200ms)
- Modal: backdrop fade + content scale from 0.95

### Page Transitions

- Cross-fade between states (300ms)
- No jarring jumps

### Performance

- Use `layout` prop for smooth layout shifts
- Avoid animating expensive properties (width, height when possible)
- Use `transform` and `opacity` primarily

---

## Testing Strategy

### Unit Tests (Vitest)

- Utility functions
- Data transformations
- Validation logic

### Integration Tests

- API routes
- Database operations
- Realtime subscriptions (mocked)

### E2E Tests (Playwright)

- Complete customer order flow
- Kitchen status updates
- Admin menu management

### Manual Testing Checklist

- [ ] Full order flow on actual iPad
- [ ] Multiple concurrent orders
- [ ] WiFi disconnect/reconnect
- [ ] All modifier combinations
- [ ] Admin passcode flow
- [ ] CSV export with date ranges

---

## Performance Targets

- First Contentful Paint: < 1.5s
- Time to Interactive: < 2s
- Order submission: < 500ms perceived
- Realtime update latency: < 200ms typical

---

## Environment Variables

```env
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://wryykcdqojftbqgtxpgu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

# Admin (Required)
ADMIN_PASSCODE=<your-passcode>

# Optional
SUPABASE_SERVICE_ROLE_KEY=<for-server-side-operations>
NEXT_PUBLIC_APP_URL=https://delo-kiosk-buwhagfrm-deevys-projects.vercel.app
```

**Note:** Actual keys are stored in Vercel environment variables and local `.env` file (not committed to git).

---

## Deployment

### Current Production

- **Vercel:** https://delo-kiosk-buwhagfrm-deevys-projects.vercel.app
- **GitHub:** https://github.com/deevyb/delo-kiosk
- **Supabase:** Project `wryykcdqojftbqgtxpgu` (us-west-2)

### Vercel Setup ✅ Complete

1. ~~Connect GitHub repository~~ — Connected to `deevyb/delo-kiosk`
2. ~~Set environment variables~~ — SUPABASE_URL, ANON_KEY, ADMIN_PASSCODE
3. ~~Deploy~~ — Auto-deploys on push to main

### Supabase Setup ✅ Complete

1. ~~Create project~~ — `delo-kiosk` in us-west-2
2. ~~Run migrations~~ — 4 migrations applied (tables + realtime)
3. ~~Enable Realtime on `orders` table~~ — Enabled via migration
4. ~~Copy connection credentials to Vercel~~ — Done

### Pre-Launch Checklist

- [x] All env vars set in Vercel
- [x] Supabase Realtime enabled
- [x] Menu items seeded (7 drinks)
- [x] Modifiers seeded (Regular/Oat milk, Hot/Iced)
- [ ] Test order on production
- [ ] Test kitchen display updates
- [ ] Test admin access
- [ ] iPad configured for kiosk mode (Guided Access)

---

## Known Limitations (MVP)

1. **Single passcode for all admins** — acceptable for 2-person team
2. **No offline order queue** — requires internet to submit
3. **No order editing** — customer must place new order if mistake
4. **No analytics** — CSV export only for post-event analysis
5. **No photo upload UI** — images require URL input

---

## Future Improvements (Post-MVP)

- Order search/filter on kitchen display
- Photo upload for menu items
- Multiple modifier categories (size, extras)
- Order history/analytics dashboard
- Multi-location support
- Staff roles and permissions

---

## Design Decisions

### Animation Style

**References:** Superpower.com, Netflix iOS, landonorris.com

**Entrance Animation (Coordinated Fade-Slide):**
- Custom easing curve: `[0.65, 0.05, 0, 1]` (smooth deceleration)
- Cards slide up 40px while fading in
- 70ms stagger between cards
- Duration: 0.5s

**Press Effect (Press-In):**
- Scale to 0.97
- Move down 2px (pressing "into" screen)
- Shadow reduces on press
- Spring physics: stiffness 400, damping 30 (minimal bounce)

**Customization Modal (Square-style):**
- Floating panel over softly dimmed menu grid (no blur)
- Slide-up + fade-in transition
- Both X button AND backdrop tap to close
- Spring physics: stiffness 400, damping 30
- Corner radius: `rounded-xl` (matches drink cards)

### Typography System

| Element | Font | Weight | Size |
|---------|------|--------|------|
| Page title "Delo Coffee" | Yatra One | 400 | 48px (text-5xl) |
| Category headers | Bricolage | SemiBold | 16px (text-base) |
| Drink names (cards) | Bricolage | SemiBold | 24px (text-2xl) |
| Drink name (modal) | Bricolage | Bold | 36px (text-4xl) |
| Modifier labels | Cooper | Medium | 14px (text-sm) |
| Modifier buttons | Manrope | SemiBold | 18px (text-lg) |
| Descriptions | Roboto Mono | Regular | 16px (text-base) |

### Menu Categories

- **Signature:** Elaichi Latte, Ginger Slap Latte, Tubo Latte
- **Classics:** Latte, Cortado, Macchiato, Espresso
- Stored in `category` column on `menu_items` table

### Shared CSS Classes (globals.css)

**Text & Labels:**
- `.label-modifier` — Modifier labels (Milk, Temperature, Your Name)
- `.text-modifier-option` — Text inside modifier buttons/inputs (Manrope SemiBold 18px)
- `.text-description` — Small descriptive text

**Buttons:**
- `.btn-primary` — Maroon submit buttons, h-16 (with disabled state)
- `.btn-secondary` — Cancel buttons, h-12, gray background
- `.btn-modal-action` — Modal save/create buttons, h-12, maroon
- `.btn-admin-add` — Admin "+ Add" buttons with press animation

**Form Elements:**
- `.input-form` — Standard form input (h-16, rounded-xl)
- `.select-form` — Dropdown select with same styling
- `.checkbox-form` — Checkbox input styling
- `.checkbox-label` — Checkbox row wrapper with hover

**Modal Elements:**
- `.modal-title` — Modal header (h2, text-2xl, maroon)
- `.modal-description` — Subtitle text below title
- `.error-banner` — Error message display

**State:**
- `.item-unavailable` — 50% opacity for sold-out items

### Shared Modal Component

All form modals use `Modal.tsx`:
- Backdrop: bg-delo-navy/40, click-to-close
- Panel: bg-delo-cream, rounded-xl, shadow-2xl, p-8
- X close button with hover animation
- Spring animations (stiffness 400, damping 30)
- Size prop: sm, md, lg

Used by: DrinkCustomizer, NewMenuItemForm, ModifierForm, MenuItemEditor

### Sold-Out Display

Items toggled OFF in admin appear on `/order` with:
- 50% opacity (faded)
- "Sold Out" maroon pill badge
- Tap disabled, cursor not-allowed

### Unavailable Modifier Display

Modifiers toggled OFF appear in customizer modal:
- Faded button with dashed border
- "Sold Out" label below (maroon, semibold)
- Auto-selects first available option if default unavailable

### Visual Direction Options (Explored)

| Option | Name | Feel | Key Features |
|--------|------|------|--------------|
| A | The Courtyard | Warm, structured | Category zones with borders, corner ribbons, framed confirmation |
| B | Playful Pop | Fun, delightful | Drink icons (cardamom, ginger), floating sections, confetti |
| C | Editorial Elegance | Refined, confident | Left-aligned header, vertical category labels, asymmetric |

All options keep: Brand colors, fonts, existing animations.

### Files with Important Comments

- `components/DrinkCard.tsx` — ANIMATION CONFIGURATION guide and SPRING PHYSICS GUIDE

---

_Last updated: January 11, 2026 — Restructured CLAUDE.md, added Design Decisions_
