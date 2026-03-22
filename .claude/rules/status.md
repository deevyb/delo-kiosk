# Project Status

> Last Updated: March 21, 2026

## Current State

| Route | Status | Notes |
|-------|--------|-------|
| `/` | Complete | Landing page with navigation |
| `/order` | Complete | Full ordering flow with confirmation & auto-reset |
| `/kitchen` | Complete | Real-time barista display + NavMenu + instant local state updates + polished tab/card animations |
| `/admin` | Complete | Passcode + tabs + menu items (edit name/desc, modifiers, archive, drag-to-reorder) + modifiers + dashboard with date picker |

**Live App:** https://delo-kiosk-buwhagfrm-deevys-projects.vercel.app

## What's Next

**Pending merge:** Branch `claude/plan-backlog-item-cqTKW` has backlog #1 (title links to homepage) — tested locally, ready to merge to main.

**After merge — Visual Personality — Pick a Direction:**
- Three layout options were explored (see TECHNICAL.md § Visual Direction Options)
- Owner needs to choose one (or mix elements)
- Then implement the chosen direction

| Option | Name | Feel |
|--------|------|------|
| A | The Courtyard | Warm, structured — category zones, corner ribbons |
| B | Playful Pop | Fun, delightful — drink icons, confetti confirmation |
| C | Editorial Elegance | Refined, confident — vertical labels, typography-focused |

## Backlog

| # | Title | Type | Description |
|---|-------|------|-------------|
| ~~1~~ | ~~Title links to homepage~~ | ~~Quick fix~~ | ~~Done — on branch `claude/plan-backlog-item-cqTKW`, pending merge~~ |
| 2 | Temp-locked drinks show correct temp on confirmation | Bug | Drinks locked to hot-only or iced-only should display the correct temperature on the confirmation screen |
| 3 | Ready tab: back-to-progress & cancel | Feature | Kitchen Ready tab gets buttons to move an order back to In Progress or cancel it entirely |
| 4 | View cancelled orders in kitchen | Feature | New "Cancelled" tab on kitchen display so baristas can see cancelled orders. Pairs with #3 |
| 5 | Kitchen tabs: default to today's orders | Enhancement | All kitchen tabs (Placed, In Progress, Ready) show only today's orders by default. Small "Show all" toggle to see past events if needed. Keeps kitchen clean during a rush |
| 6 | Multi-barista workflow | Feature | Two-barista mode via `?barista=` URL param: claim orders, in-progress status, barista identity badges, milk/temp modifier badges. Full spec in `Changes for Multi-Barista Workflow.md` |
| 7 | Queue position & ETA on confirmation | Feature | After placing an order, confirmation screen shows "You're #3 in line — ~6 min". Needs queue count from active orders + estimated prep time |
| 8 | Mobile compatibility (all screens) | Feature | All routes work on phone-sized screens so baristas can use any device when an iPad isn't available |
| 9 | Show ingredients on drink card | Enhancement | Display ingredients as a subtitle on the drink selection card in `/order`, while keeping them inside the detail card too |
| 10 | Landing page revamp | Design | Redesign the `/` landing page (details TBD — may tie into visual direction choice) |

## Blockers

- **Vercel preview deploys fail** — Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) likely only set for Production in Vercel. Need to enable for Preview environments too.

## Changelog

- **Mar 21** — Tested backlog #1 branch locally, confirmed ready to merge
- **Mar 19** — Backlog #1: Title links to homepage (Order, Kitchen, Admin titles wrapped in Link to `/`)
- **Mar 18** — Fix: Dashboard trends show all-time data when viewing today with 0 orders
- **Feb 15** — Dashboard date picker for past event stats; fix timezone bug in Today counter
- **Feb 14** — Kitchen stale data fix; edit item name/desc; drag-to-reorder; Americano description

## Infrastructure

- GitHub: deevyb/delo-kiosk
- Vercel: Auto-deploys on push to main
- Supabase: Database ready, menu seeded (7 drinks), realtime enabled
- Code Quality: Prettier, ESLint, Error Boundary, shared CSS classes
- Dependencies: react-day-picker (dashboard calendar)
