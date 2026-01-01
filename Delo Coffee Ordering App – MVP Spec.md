
## TL;DR

Delo Coffee needs a minimal iPad ordering system for single-item pop-up orders. Customers place one drink order at a time using their name (no order numbers). Baristas see orders appear in real-time and mark them ready or canceled. Admin can manage the menu and export order data. No payments, no multi-item carts, no verbal callouts. Three routes, three tables, one item per order.

---

## Goals

### Business Goals

* Launch working MVP for next pop-up event

* Reduce order chaos and staff confusion during rush periods

* Capture structured order data (customer name, item, modifiers, timestamp, status) for post-event CSV export

* Zero payment processing—payment happens offline at pickup

### User Goals

* **Customers:** Browse menu, customize one drink, submit order with their name, see brief confirmation, done.

* **Baristas:** See incoming orders in real-time, mark orders ready or canceled with one tap, no order numbers to call out.

* **Admin:** Toggle menu items on/off, export order CSV for a date range, access gated by single shared passcode.

### Non-Goals (Out of Scope)

* Order numbers, verbal callouts, or "we'll call your number" flow

* Multi-item orders, shopping carts, order editing, or customer order history

* Prices, totals, payments, POS integration, or revenue tracking

* Customer accounts, login, or profiles

* Staff roles, permissions, or multi-user admin

* Complex dashboards, analytics visualizations, or average prep time charts

* Shipping, delivery, or any fulfillment beyond in-person pickup

---

## User Stories

### Customer

* As a customer, I want to tap one menu item, choose modifiers, enter my name, and submit—so I can order quickly without staff assistance.

* As a customer, I want a brief "Your order has been sent" confirmation—so I know my order went through.

* As a customer, I want the screen to reset immediately after—so the next person can order without confusion.

### Barista

* As a barista, I want to see new orders appear automatically with customer name, item, and modifiers—so I know what to make.

* As a barista, I want to mark orders "Ready" or "Canceled" with one tap—so I can keep the queue moving.

* As a barista, I want orders listed chronologically—so I work in the right sequence.

* As a barista, I do NOT want order numbers or callout prompts—we hand drinks directly to customers by name.

### Admin

* As an admin, I want to toggle menu items on/off instantly—so I can respond to inventory changes during the event.

* As an admin, I want to export order data as CSV for a date range—so I can analyze sales after the event.

* As an admin, I want a single passcode to access the admin panel—no complex auth.

---

## Functional Requirements

### Customer Ordering Route (`/order`) – Critical

* **One-Screen Flow:** Customer sees full menu as a grid of item cards (name, photo). No scrolling if possible; simple vertical scroll if needed.

* **Item Selection:** Tap one item → modifier selection screen appears.

* **Modifier Selection:**

  * Two categories: **Milk**, **Temperature**.

  * Single-select per category (radio buttons or button group).

  * Only applicable modifiers shown per item (e.g., pastries skip milk/temperature).

  * Items can opt out of entire modifier categories

* **Customer Name Input:** Free text field for customer to enter their name (required).

* **Submit CTA:** Large button labeled **"Send"**. Tap writes order to Supabase.

* **Confirmation State:** Brief full-screen message: "Your order has been sent". Auto-reset to initial menu after 3 seconds.

* **No Cart:** Single item per order only. No multi-item support, no cart icon, no order editing.

### Kitchen Display Route (`/kitchen`) – Critical

* **Main Section – Placed Orders:** Real-time list of orders with `status = 'placed'`, displayed in chronological order (oldest first) with a timestamp of how long ago it was placed in minutes.

* **Order Cards:** Each card shows:

  * Customer name (large, prominent)

  * Item name

  * Selected modifiers (flavor, milk, temperature—only show non-default choices)

  * Timestamp as minutes since order placed

* **Status Update:** Tap any order card to open simple action menu: "Mark Ready" or "Cancel". Tap updates status in Supabase; card moves/disappears accordingly.

* **Secondary Section – Ready Orders:** Separate area (tab, section, or column) showing orders with `status = 'ready'`.

* **Canceled Orders:** Orders marked `canceled` remain stored in database but hidden from kitchen UI. Still can be accessed but not visible by default.

* **Real-Time Sync:** Supabase Realtime subscription keeps display updated as new orders arrive or statuses change.

* **No Auto-Removal:** Orders remain visible in their status section until staff explicitly updates them.

### Admin Route (`/admin`) – High Priority

* **Passcode Gate:** Single shared passcode (hardcoded or env var). Simple prompt, no session management.

* **Single Page with Three Sections:**

  1. **Menu Items:** List all items with toggle switch (active/inactive). Ability to set default modifiers per item (simple text input or form—minimal CRUD).

  2. **Modifiers:** List all global modifier options within the categories (Milk, Temperature). CRUD: add/edit/delete modifier options. Basic form interface.

  3. **Orders Export:** Date range picker (start date, end date) + "Export CSV" button. CSV includes: `customer_name`, `item`, `modifiers`, `status`, `timestamp`.

* **No Advanced Features:** No staff roles, no real-time dashboards, no analytics visualizations.

### Data Model – Critical

**Three Tables Only:**

1. `menu_items`

  * `id` (UUID, primary key)

  * `name` (text, required)

  * `image_url` (text, optional)

  * `is_active` (boolean, default true)

  * `default_modifiers`

  * Example default modifiers: Milk -> Regular, Temperature -> Hot.

2. `modifiers`

  * `id` (UUID, primary key)

  * `category` (text, enum: `milk_type`, `temperature`)

  * `option` (text, e.g., "Oat", "Iced")

  * `is_active` (boolean, default true)

3. `orders`

  * `id` (UUID, primary key)

  * `customer_name` (text, required)

  * `item` (text, required—denormalized item name for simplicity)

  * `modifiers` 

  * `status` (text, enum: `placed`, `ready`, `canceled`)

  * `timestamp` (timestamptz, default now())

### Status Lifecycle – Critical

* New orders created with `status = 'placed'`.

* Barista marks order `ready` or `canceled`.

* **Status enum exactly:** `placed`, `ready`, `canceled`. No other statuses.

* Orders never deleted from database during event; cleanup happens post-event via admin or manual query.

---

## User Experience

### Design Aesthetic – Implementation Guidance

* **iPad Landscape Only:** App locked to landscape orientation.

* **Large Tap Targets:** Minimum 60x60 points for all interactive elements (buttons, cards).

* **Color Palette:** Delo warm earthy tones (browns, creams, muted greens). Use for accents and branding, not primary UI elements.

* **Frosted Glass / Blur Effects:** Subtle background blur or frosted glass aesthetic for modals and overlays. Keep contrast high for readability.

* **Simple Card Layouts:** Orders and menu items displayed as cards with clear borders or shadows. No complex nested layouts.

* **Minimal Animation:** Simple 200-300ms transitions for modals and status changes. No elaborate animations or loading spinners unless necessary.

* **Typography:** Large, readable sans-serif font. Minimum 18pt body text, 28pt+ for customer names and item names.

### Customer Flow (`/order`)

1. **Land on menu screen.** Grid of item cards (name + photo).

2. **Tap one item.** Modal or new screen shows modifier options (Flavor, Milk Type, Temperature—only applicable categories).

3. **Choose modifiers.** Single-select buttons per category. Defaults pre-selected.

4. **Enter name.** Text input field labeled "Your Name" (required).

5. **Tap "Send".** Brief loading state (0.5s), then confirmation: "Your order has been sent" full-screen message.

6. **Auto-reset to menu after 3 seconds.** Ready for next customer.

**Edge Cases:**

* If customer taps Send without entering name, show inline validation error: "Please enter your name."

* If database write fails, show error message: "Something went wrong. Please try again."

### Kitchen Flow (`/kitchen`)

1. **Main section shows all** `placed` **orders** in chronological list (oldest at top or left).

2. **Tap any order card** to reveal action buttons: "Mark Ready" / "Cancel Order".

3. **Tap "Mark Ready"** → status updates to `ready`, card moves to "Ready" section.

4. **Tap "Cancel Order"** → status updates to `canceled`, card disappears from view (but stays in database).

5. **Orders remain visible until staff updates them.** No auto-removal, no timers.

**Edge Cases:**

* If Wi-Fi drops, display non-intrusive banner: "Offline – reconnecting…"

* If real-time sync fails, fall back to polling every 5 seconds.

### Admin Flow (`/admin`)

1. **Passcode prompt.** Single input field, submit button. Incorrect passcode shows error.

2. **Admin page loads** with three sections stacked vertically or in tabs.

3. **Menu Items Section:** List of items with toggle switches. Click toggle to activate/deactivate. Optional: click item name to edit modifiers.

4. **Modifiers Section:** List of all modifiers grouped by category. "Add Modifier" button opens simple form (category dropdown, option text input). Edit/delete icons per row.

5. **Orders Export Section:** Two date pickers (start, end) + "Export CSV" button. Click downloads CSV of orders in range.

**Edge Cases:**

* If no orders in date range, CSV is empty with headers only.

* If passcode is forgotten, require manual env var change and redeploy (acceptable for MVP).

---

## Narrative

It's Saturday morning at the Delo Coffee pop-up. A customer walks up to the counter iPad, sees the menu, taps "Iced Oat Milk Latte," chooses oat milk and iced, types "Sarah" in the name field, and taps Send. The screen briefly confirms "Your order has been sent," then resets to the menu.

Behind the bar, the kitchen iPad shows Sarah's order instantly: "Sarah – Iced Oat Milk Latte – Oat, Iced." The barista makes the drink, taps the order card, and marks it ready. Sarah hears her name called (no order number), picks up her drink, and leaves happy.

At the end of the day, the manager opens `/admin`, enters the passcode, and exports a CSV of all 150 orders. Next pop-up, they'll stock more oat milk based on the data.

---

## Tentative / Proposed Technical Considerations

### Stack

* **Frontend:** Next.js, React, Tailwind CSS

* **Backend/Database:** Supabase (PostgreSQL + Realtime + REST API)

* **Hosting:** Vercel (Next.js app), Supabase Cloud (database)

* **Auth:** Simple passcode check for `/admin` (middleware or client-side)

### Architecture

* **Three Routes:**

  1. `/order` – Customer-facing menu and order submission (client-side interactivity)

  2. `/kitchen` – Real-time order display for baristas

  3. `/admin` – Passcode-gated menu/modifier management and CSV export (server actions for export)

* **Data Flow:**

  * Customer submits order → Next.js API route writes to `orders` table

  * Supabase Realtime pushes new order to `/kitchen` clients via WebSocket

  * Admin toggles menu item → Next.js API route updates `menu_items` table → change reflects on `/order` next load

### Key Implementation Details

* **Modifier Logic:** `/order` route fetches `menu_items` with `default_modifiers`. For each item, render only applicable modifier categories.

* **Order Identification:** No order number generation. Orders identified by `customer_name` + `timestamp`. Baristas read customer name from card.

* **Real-Time Sync:** Use Supabase. Filter by `status = 'placed'` for main section, `status = 'ready'` for ready section, and `status = 'canceled'` for canceled section.

* **CSV Export:** Server action queries `orders` table with date range filter, formats as CSV string, returns as downloadable file.

### Potential Challenges

* **Real-Time Reliability:** If Wi-Fi unstable, Realtime connection may drop. Mitigation: implement 5-second polling fallback + "Offline" banner.

* **Concurrent Orders:** Two customers submitting simultaneously will create separate order rows (no conflict). Database handles concurrency.

* **iPad Screen Lock:** Prevent iPad from sleeping. Configure device settings for "Never" auto-lock during events.

* **Passcode Security:** Single shared passcode is low-security but acceptable for MVP. Store in env var, never commit to repo.

**Not in MVP:** Payment integration, POS sync, advanced analytics, customer accounts, staff role management.