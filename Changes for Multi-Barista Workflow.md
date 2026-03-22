## Problem Statement

- **Core problem:** At pop-up events with two baristas, the existing `/kitchen` queue has no concept of who is making which drink. With 10+ drinks in queue, both baristas risk pulling the same order simultaneously, wasting time and ingredients and creating customer confusion.
- **Secondary problem:** When multiple completed drinks are sitting out for pickup, there is no way to know which cup contains what (milk type, temperature) without relying on memory — this breaks down fast during a rush.
- **Why it matters:** Operational clarity is the entire point of the kiosk system. Without it, two baristas makes things *more* chaotic, not less.

---

## Guiding Principles for These Changes

- Keep the solo barista experience (current `/kitchen` behavior) completely intact — no regressions for single-barista events
- Avoid over-engineering: no user accounts, no login, no roles system
- Prefer solutions that work with verbal coordination as a complement, not a replacement
- Badge/visual systems must remain legible at a glance during a rush — avoid badge inflation

---

## Change 1: New "In Progress" Order Status

- **What:** Add a third status value `in_progress` between `placed` and `ready`
- **Why:** "Placed" and "Ready" leave a blind spot — there's no way to know if a drink is actively being made or just sitting unclaimed in the queue. With two baristas, this is where doubles happen.
- **Behavior:**
  - When a barista claims an order (see Change 2), its status automatically moves from `placed` → `in_progress`
  - In progress orders are visually separated from placed (unclaimed) orders within the Placed tab — not a new tab, but a clear visual split/section within the same view
  - In progress orders remain visible to both baristas in real-time via Supabase
  - Status lifecycle becomes: `placed` → `in_progress` → `ready` or `canceled`
- **Data model change:** Add `in_progress` to the `status` enum on the `orders` table
- **Solo mode behavior:** In solo mode (no barista URL param), the claim action doesn't exist — barista taps card to mark ready or cancel as before. `in_progress` status is not surfaced in solo mode to avoid unnecessary complexity. *(Pending decision: whether to expose in_progress in solo mode at all, or gate it entirely behind two-barista mode)*

---

## Change 2: Barista Identity via URL Parameter

- **What:** `/kitchen` accepts an optional `?barista=` URL param (e.g. `/kitchen?barista=dee`, `/kitchen?barista=maya`)
- **Why:** The app has no user accounts and doesn't need them. Identity only matters on `/kitchen`, only during two-barista events, and only to tag claimed drinks. A URL param is the simplest possible solution — stored as a bookmark on each tablet.
- **Behavior:**
  - If no `?barista=` param: solo mode, no claiming UI rendered (current behavior preserved exactly)
  - If `?barista=` param present: two-barista mode activates — claim button appears on each order card
  - The param value (e.g. `"dee"`) is used to tag the `claimed_by` field on the order when claimed
  - No login, no session management, no database table for users
- **Database change:** Add `claimed_by` field (nullable text) to the `orders` table — null means unclaimed
- **Resilience:** If a barista closes and reopens their tab, the URL param re-establishes their identity instantly. No lost state.

---

## Change 3: Claim Action on Order Cards

- **What:** In two-barista mode, each unclaimed order card in the `placed` section shows a **"Claim"** button
- **Why:** Deliberate claiming gives each barista explicit ownership of a drink, preventing doubles. It's intentional (not automatic) to allow real-time flexibility — either barista can claim any drink regardless of type, preserving the ability to handle overflow verbally and dynamically.
- **Behavior:**
  - Tapping "Claim" on an unclaimed card: sets `claimed_by` = this barista's name, moves order to `in_progress`, immediately reflected on both tablets via Supabase Realtime
  - Once claimed, the card no longer shows a "Claim" button — it shows the claiming barista's name badge instead
  - Claimed cards are not locked from the other barista — either barista can still mark any drink ready or canceled. This is intentional: flexibility over enforcement.
  - _(Pending decision: whether to allow "un-claiming" a drink if a barista grabs one by mistake)_
- **Verbal protocol complement:** Since claiming is deliberate, the agreed verbal habit is: call out the drink name when you grab it. The app confirms the claim visually; the verbal call is the human safety net.

---

## Change 4: Barista Identity Badge on In-Progress Cards

- **What:** In-progress order cards display a small badge showing which barista claimed the drink
- **Why:** Even with Supabase Realtime syncing claims instantly, a persistent visual indicator on each card means both baristas can scan the board at any moment and know exactly who has what — no memory required
- **Behavior:**
  - Badge displays the barista's name or initials (derived from the `claimed_by` field)
  - Badge is color-coded per barista to allow faster visual scanning without reading text
  - Badge sits in a consistent position on every card *(pending decision: exact position on card)*
  - Colors are distinct from milk/temp badge colors (see Change 5) to avoid confusion *(pending decision: specific colors — constrained to Delo brand palette: Maroon #921C12, Cream #F9F6EE, Navy #000024)*
  - In solo mode: no badge rendered anywhere

---

## Change 5: Milk & Temperature Modifier Badges on All Order Cards

- **What:** Milk type and temperature are displayed as small colored badges on every order card (both in placed and in progress sections), rather than plain text
- **Why:** When 5+ completed drinks are sitting out, and during active making, a barista needs to confirm cup contents at a glance without reading. Color-coded badges enable pattern recognition faster than text parsing.
- **Rationale for badges over bold text:** The menu will always have max 2 milk options and max 2 temperature options — a total of 4 badge types. This is a small enough set that the color meanings become memorized quickly (after ~10 drinks), eliminating the main con of color-coded systems. Bold text was the safer choice for a larger modifier set; badges are the better choice here.
- **Behavior:**
  - Each modifier (milk type, temperature) gets its own badge with a distinct color
  - Only non-default modifiers are shown, consistent with current card behavior *(pending decision: whether to always show both modifiers regardless of default status, for cup-labeling clarity)*
  - Badges appear on cards in both `placed` and `in_progress` sections
  - _(Pending decision: exact badge colors for each milk option and each temperature option)_
  - _(Pending decision: badge position on card — suggested: bottom row of card, separate from barista identity badge)_

---

## What Is Explicitly Not Changing

- **`/order` (customer screen):** No changes
- **`/admin`:** No changes
- **Solo barista flow:** `/kitchen` with no URL param behaves exactly as today — no claim UI, no identity badges, no `in_progress` state surfaced
- **No user accounts, login, or roles system** — out of scope and unnecessary for this use case
- **Auto-routing by drink type:** Considered and rejected. Verbal coordination + deliberate claiming provides the same benefit with less complexity and more flexibility.
