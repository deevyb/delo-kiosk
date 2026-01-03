# Delo Coffee Kiosk - Project Guide

## Who I'm Building For

**Owner:** Non-technical founder who knows exactly what they want — and wants to understand what's being built. They don't need to make technical decisions, but they want to be an informed partner who learns along the way.

**Communication Rules:**

- Explain technical concepts in plain, accessible language — like talking to a smart friend who doesn't work in tech
- Use judgment on what's worth explaining — focus on meaningful learning moments, not every tiny choice
- When a decision has real trade-offs, share the options, implications, and my recommendation
- Make real-world implications clear: "This means the app will load faster" not "This reduces bundle size"
- The goal is education and transparency, not overwhelm

---

## Context Preservation (Important!)

This project uses documentation as persistent memory across Claude Code sessions. Auto-compaction and session breaks can lose context, so **these docs are the source of truth**.

### At Session Start

1. Read this entire file (CLAUDE.md)
2. Check the **Current Status** section (bottom of this file) for what's done and what's next
3. If needed, read TECHNICAL.md for implementation details

### At Meaningful Milestones — Update Docs Before Stopping

**What counts as a milestone:**

- Completing a major feature or screen
- Finishing setup/infrastructure work
- Making significant architectural decisions
- Any stopping point where context would be lost

**What to update:**

1. **CLAUDE.md → Current Status section** — Update route statuses, what's done, what's next
2. **TECHNICAL.md** — If any technical details changed (schema, deployment, etc.)
3. **Commit and push** — So updates survive and are visible on GitHub

### Quick Status Update Template

When updating the Current Status section, include:

- Which routes/features are complete vs. in-progress vs. pending
- Any blockers or decisions that need user input
- What the next session should pick up on

---

## The Business

**Delo Coffee** runs pop-up coffee events 1-2 times per month, serving 100-150 customers per event. Currently using paper order cards where customers circle their choices — it works, but cards get lost or shuffled during busy periods.

**The Problem:** Physical cards get mixed up, leading to order mistakes and confusion about whose drink is whose.

**The Solution:** iPad-based ordering system where customers tap their order, it appears instantly on the kitchen display in perfect order, and nothing can get lost or shuffled.

---

## The Brand

Delo Coffee is inspired by the _delo_ — a traditional Indian courtyard where strangers become friends and everyone belongs. The brand is:

- **Warm & cozy** — like being welcomed into someone's home
- **Playful** — not stuffy or pretentious
- **Heritage-rooted** — honors tradition without being dated

**Colors:**

- Maroon: `#921C12` (primary accent)
- Cream: `#F9F6EE` (backgrounds)
- Dark Navy: `#000024` (text)
- Terracotta: `#C85A2E` (supporting warmth)

**Typography:**

- Yatra One — bold headers, brand name
- Bricolage Grotesque — drink names, buttons
- Roboto Mono — descriptions, details

**Design Principles:**

- Generous white space (like the open courtyard)
- Large tap targets (60x60pt minimum)
- Natural, warm aesthetic
- No generic "café app" look

---

## The Menu

**Current drinks (editable from admin):**

| Drink             | Milk Options | Temperature Options |
| ----------------- | ------------ | ------------------- |
| Elaichi Latte     | Regular, Oat | Hot, Iced           |
| Ginger Slap Latte | Regular, Oat | Hot, Iced           |
| Tubo Latte        | Regular, Oat | Hot, Iced           |
| Latte             | Regular, Oat | Hot, Iced           |
| Cortado           | Regular, Oat | —                   |
| Macchiato         | —            | —                   |
| Espresso          | —            | —                   |

**Milk options:** Regular, Oat (binary choice)
**Temperature options:** Hot, Iced (binary choice)

---

## The Experience

### Customer Flow (`/order`)

1. See all drinks as a clean grid (no photos for now — elegant text cards)
2. Tap a drink → see applicable modifier options
3. Select modifiers (pre-selected defaults)
4. Enter name (required)
5. Tap "Send"
6. See confirmation with their full order: e.g. "Sarah: Elaichi Latte, Oat Milk, Iced"
7. Screen auto-resets after 3 seconds

### Kitchen Flow (`/kitchen`)

1. Orders appear in real-time, oldest first
2. Each card shows: customer name, drink, modifiers, time since ordered
3. Show counts: "Placed: 5 | Ready: 12"
4. Tap card → "Mark Ready" or "Cancel"
5. Ready orders accumulate in separate section (no need to clear)

### Admin Flow (`/admin`)

1. Enter passcode (owner chooses their own)
2. Three sections:
   - **Menu Items:** Toggle drinks on/off, edit modifiers per item
   - **Modifiers:** Add/edit/delete milk and temperature options
   - **Export:** Download CSV of orders by date range

---

## Critical Requirements

### Must-Haves

- **Stability above all** — biggest fear is crashes/freezes during rush
- **Beautiful, silky animations** — Framer Motion-style polish throughout
- **Real-time sync** — orders appear instantly on kitchen display
- **Fully editable menu** — nothing hardcoded, everything from admin
- **iPad landscape only** — optimized for this single use case
- **Offline resilience** — graceful handling if WiFi hiccups

### Nice-to-Haves (Later)

- Search/filter on kitchen display
- Drink photos
- More modifier categories

### Out of Scope

- Payments, prices, or totals
- Order numbers or verbal callouts
- Multi-item orders or carts
- Customer accounts or login
- Complex analytics or dashboards

---

## Timeline

**Deadline:** Less than 2 weeks for upcoming pop-up event

**Setup:**

- One iPad for customer ordering
- One iPad/display for kitchen
- 2-person team (owner + helper)
- WiFi usually reliable at venues

---

## When to Involve the Owner

**Explain and educate when:**

- Making a meaningful technical choice that has real trade-offs worth understanding
- The decision affects what they'll see, feel, or experience
- It's a good learning moment that helps them understand how the app works
- They'd benefit from knowing why something is built a certain way

**Just handle it when:**

- It's a routine technical choice with an obvious right answer
- The decision is purely implementation detail with no user-facing impact
- Explaining it would add complexity without adding understanding

**When presenting decisions:**

- Explain in plain language what each option means
- Make the real-world implications clear
- Give a clear recommendation with reasoning
- Make it easy to say "go with your recommendation" — but also easy to ask questions

---

## Using Specialized Plugins

Two plugins are installed that can help with certain tasks. **Proactively suggest these when they'd add value, and explain why.**

### `/frontend-design`
**What it does:** Generates polished, creative UI components with high design quality.

**When to suggest it:**
- Building a new screen or component from scratch where visual creativity matters
- When the owner wants to see multiple design directions
- For UI that needs extra polish beyond the established patterns

**When NOT to use it:** For incremental changes to existing components, or when following established design patterns.

### `/feature-dev`
**What it does:** Deep codebase analysis before implementation — maps architecture, traces dependencies, plans multi-file changes.

**When to suggest it:**
- Starting a major new route (`/kitchen`, `/admin`)
- Features that touch many files or require understanding the whole system
- Complex features where architectural planning prevents mistakes

**When NOT to use it:** For focused, single-component work or when the scope is already clear.

---

## Success Criteria

The owner will know this project succeeded when:

1. They get through their next pop-up with zero lost orders
2. The app never crashes or freezes during the rush
3. Customers find it intuitive (no explanation needed)
4. It looks and feels like a natural extension of Delo's brand
5. Every interaction feels smooth and polished

---

## Current Status

> **Last Updated:** January 2, 2025 (evening)
>
> **Next Up:** Phase 4 - Add customer name input to customization modal

**Live App:** https://delo-kiosk-buwhagfrm-deevys-projects.vercel.app

| Route      | Status         | Description                                    |
| ---------- | -------------- | ---------------------------------------------- |
| `/`        | ✅ Deployed    | Landing page with navigation                   |
| `/order`   | 🚧 In Progress | Menu grid + customization modal done, name input next |
| `/kitchen` | 🚧 Placeholder | Kitchen display (after /order complete)        |
| `/admin`   | 🚧 Placeholder | Admin panel (after /kitchen)                   |

**Infrastructure:** All complete

- GitHub: [deevyb/delo-kiosk](https://github.com/deevyb/delo-kiosk)
- Vercel: Auto-deploys on push to main
- Supabase: Database ready, menu seeded (7 drinks), realtime enabled
- Code Quality: Prettier formatting, ESLint, Error Boundary for crash prevention

---

## /order Build Progress (7 Phases)

| Phase | Status | Description |
|-------|--------|-------------|
| 1. Menu Grid | ✅ Done | Drink cards in 3-column grid, fetches from Supabase |
| 2. Animations | ✅ Done | Entrance animations, press-in effect, selection state |
| 3. Customization | ✅ Done | Floating modal, blur backdrop, X button, click-outside-to-close, drink descriptions |
| 4. Name Input | ⏳ Pending | Customer name field |
| 5. Submit Order | ⏳ Pending | API route, database write |
| 6. Confirmation | ⏳ Pending | Success screen with order summary |
| 7. Auto-Reset | ⏳ Pending | 3-second reset, error handling |

---

## Key Design Decisions Made

### Animation Style (Reference: Superpower.com, Netflix iOS, landonorris.com)

**Entrance Animation (Option B - Coordinated Fade-Slide):**
- Custom easing curve: `[0.65, 0.05, 0, 1]` (smooth deceleration)
- Cards slide up 40px while fading in
- 70ms stagger between cards
- Duration: 0.5s

**Press Effect (Option B - Press-In):**
- Scale to 0.97
- Move down 2px (pressing "into" screen)
- Shadow reduces on press
- Spring physics: stiffness 400, damping 30 (minimal bounce)

**Customization Screen (Square-style modal):**
- **Layout:** Floating modal panel over dimmed menu grid
- **Transition:** Slide-up + fade-in with blur backdrop (Square approach, not Netflix layoutId)
- **Close:** Both X button in corner AND backdrop tap to close
- **Animation:** Spring physics (stiffness 400, damping 30) for snappy, minimal-bounce feel
- **Descriptions:** Each drink shows its description below the name (stored in DB)

**Database Schema Update:**
- Added `description` column to `menu_items` table (text, nullable)

### Files with Important Comments

- `components/DrinkCard.tsx` - Contains detailed ANIMATION CONFIGURATION guide and SPRING PHYSICS GUIDE explaining how to tweak animation values

---

## What To Do Next Session

1. Read this file (CLAUDE.md)
2. **Start Phase 4:** Add customer name input to customization modal
   - Create `NameInput` component (large, clear text field)
   - Add to `DrinkCustomizer` below modifiers
   - Make it a required field with validation
   - Show error message if empty on submit attempt
3. Test the name input interaction
4. Then continue to Phase 5 (Submit Order)

**Blockers:** None

---

## Reference Documents

- `Delo Coffee Ordering App – MVP Spec.md` — detailed functional requirements
- `Delo Coffee Brand Identity.md` — brand story, colors, typography, voice
- `TECHNICAL.md` — architecture, schema, deployment details
- `README.md` — project overview for GitHub

---

_This file guides all work on this project. Detailed technical decisions are documented in TECHNICAL.md — written for future developers, but you're welcome to peek if you're curious!_
