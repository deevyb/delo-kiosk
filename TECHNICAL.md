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
        /reorder  # PUT: Batch update display_order
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
  is_active BOOLEAN DEFAULT true,     -- false = "Sold Out" (visible but disabled)
  is_archived BOOLEAN DEFAULT false,  -- true = hidden from customers entirely
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
  status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'in_progress', 'ready', 'canceled')),
  claimed_by TEXT DEFAULT NULL,
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
- Status enum: `placed`, `in_progress`, `ready`, `canceled` — all transitions allowed
- `claimed_by` (nullable text) tracks which barista claimed an order in multi-barista mode (`/kitchen?barista=name`)

---

## API Endpoints

### GET /api/admin/stats

Query params:

- `timezone` (string, optional) — IANA timezone for date calculation, defaults to `America/Los_Angeles`
- `date` (string, optional) — `YYYY-MM-DD` to view stats for a specific date, defaults to today

Returns aggregated dashboard statistics:

```typescript
interface DashboardStats {
  today: OrderCounts // Orders on the target date (today or selected date)
  allTime: OrderCounts // Orders up to and including the target date
  popularDrinks: DrinkCount[] // Top 20 drinks on the target date
  modifierBreakdown: Record<string, ModifierOption[]> // Modifier stats for the target date
}

interface OrderCounts {
  total: number
  placed: number
  in_progress: number
  ready: number
  canceled: number
}

interface DrinkCount {
  name: string
  count: number
}

interface ModifierOption {
  option: string // e.g., "Oat"
  count: number // raw count
  percentage: number // 0-100
}
```

Uses `force-dynamic` for fresh data on every request.

### PATCH /api/admin/menu-items

Updates a menu item. Accepts any combination of fields:

- `name` (string, non-empty) — drink name
- `description` (string | null) — drink description, null to clear
- `is_active` (boolean) — sold out toggle
- `is_archived` (boolean) — archive/restore
- `modifier_config` (object) — which modifier categories apply
- `default_modifiers` (object) — default/locked values per category (e.g., `{ temperature: "Iced", milk: null }`)

### PUT /api/admin/menu-items/reorder

Batch updates `display_order` for drag-and-drop reordering:

```typescript
// Request body
{
  items: [{ id: string, display_order: number }]
}

// Category offsets: Signature = 0+, Classics = 1000+
```

---

## Realtime Strategy

### Kitchen Display Subscription

```typescript
supabase
  .channel('kitchen-orders')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handleOrderChange)
  .subscribe()
```

### Fallback Strategy

Realtime is treated as an optimisation, not the source of truth. It never delivers what
happened while the socket was down, and a socket can stay open while silently delivering
nothing (the usual outcome after an iPad sleeps or WiFi hands off). So the display also
re-reads the database on a fixed cadence, regardless of what realtime thinks its state is.

- **Every 30s** (`SYNC_INTERVAL_MS`), plus immediately whenever the screen becomes visible
  and whenever the channel reconnects. The interval is gated on `document.visibilityState`
  so a backgrounded display costs nothing.
- Each sync fetches the **newest 200 rows by `created_at`**, not a time window — a window
  would have to be measured against the iPad's clock, and a device with a badly-set clock
  would silently fetch nothing while looking healthy.
- Results go through `mergeOrders`, an id-keyed upsert shared by every write path
  (sync, realtime, and the response to a barista's own tap). One merge is what stops an
  order appearing twice when two paths deliver it.
- A 10s `AbortController` timeout means a hung request fails rather than stalling the net.
- Only one sync runs at a time. Overlapping syncs can land out of order and revert a card,
  and the write-generation guard cannot catch that — it only counts writes made on _this_
  iPad, and the case that matters is another barista's write during an outage.
- Orders persist in the database regardless; the sync is what makes them _visible_ again
  without anyone reloading the page.

### Connection Banner

Three states, because "realtime is down" no longer means "orders are missing":

| State         | Condition                       | What the barista sees                       |
| ------------- | ------------------------------- | ------------------------------------------- |
| `live`        | Connected                       | Nothing                                     |
| `delayed`     | Realtime down, syncs succeeding | Quiet notice: new orders may take up to 30s |
| `unreachable` | 2 consecutive sync failures     | Maroon warning + Try now                    |

Note when instrumenting this: a failed or aborted Supabase query **resolves with an
`error`** rather than rejecting, so failure counting belongs in the `if (error)` branch —
a `catch` block here is effectively dead code.

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

**There is no test framework installed, and that is a deliberate choice** — this is a small
app with one operator, and the cost of maintaining a suite has not been worth it. Earlier
versions of this document described a Vitest and Playwright setup that never existed; don't
plan work around it.

What substitutes for tests:

- **Reviews before merge.** Risky logic (anything touching order state or the sync) gets
  reviewed from several independent angles rather than once — the kitchen sync work found
  three separate defects that way, each caught by a different reviewer.
- **Throwaway assertion scripts.** For pure functions like `mergeOrders`, a plain Node
  script mirroring the logic is cheap and catches real bugs. Run it, read it, delete it.
- **Measured browser verification** rather than "looks right" — count network requests,
  time how long a recovery takes, and check the numbers instead of trusting a screenshot.

If a suite is ever added, the highest-value targets are `mergeOrders`, the sync's staleness
handling, and `dateUtils`.

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

| Element                  | Font        | Weight   | Size             |
| ------------------------ | ----------- | -------- | ---------------- |
| Page title "Delo Coffee" | Yatra One   | 400      | 48px (text-5xl)  |
| Category headers         | Bricolage   | SemiBold | 16px (text-base) |
| Drink names (cards)      | Bricolage   | SemiBold | 24px (text-2xl)  |
| Drink name (modal)       | Bricolage   | Bold     | 36px (text-4xl)  |
| Modifier labels          | Cooper      | Medium   | 14px (text-sm)   |
| Modifier buttons         | Manrope     | SemiBold | 18px (text-lg)   |
| Descriptions             | Roboto Mono | Regular  | 16px (text-base) |

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

### Archive vs Sold Out

Two separate states for menu items:

| State                                | Customer sees   | Admin sees                            |
| ------------------------------------ | --------------- | ------------------------------------- |
| `is_active=true, is_archived=false`  | Normal drink    | Toggle on                             |
| `is_active=false, is_archived=false` | "Sold Out"      | Toggle off                            |
| `is_archived=true`                   | Hidden entirely | In collapsed "Archived Items" section |

- **Sold Out (`is_active`)** — Used during events when a drink runs out
- **Archived (`is_archived`)** — Used between events to remove drinks not being served. Restorable from admin.

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

| Option | Name               | Feel               | Key Features                                                     |
| ------ | ------------------ | ------------------ | ---------------------------------------------------------------- |
| A      | The Courtyard      | Warm, structured   | Category zones with borders, corner ribbons, framed confirmation |
| B      | Playful Pop        | Fun, delightful    | Drink icons (cardamom, ginger), floating sections, confetti      |
| C      | Editorial Elegance | Refined, confident | Left-aligned header, vertical category labels, asymmetric        |

All options keep: Brand colors, fonts, existing animations.

### Files with Important Comments

- `components/DrinkCard.tsx` — ANIMATION CONFIGURATION guide and SPRING PHYSICS GUIDE

---

_Last updated: January 11, 2026 — Restructured CLAUDE.md, added Design Decisions_
