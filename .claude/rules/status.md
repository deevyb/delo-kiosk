# Project Status

> Last Updated: February 15, 2026

## Current State

| Route | Status | Notes |
|-------|--------|-------|
| `/` | Complete | Landing page with navigation |
| `/order` | Complete | Full ordering flow with confirmation & auto-reset |
| `/kitchen` | Complete | Real-time barista display + NavMenu + instant local state updates + polished tab/card animations |
| `/admin` | Complete | Passcode + tabs + menu items (edit name/desc, modifiers, archive, drag-to-reorder) + modifiers + dashboard with date picker |

**Live App:** https://delo-kiosk-buwhagfrm-deevys-projects.vercel.app

## Recent Changes (Feb 15)

- **Dashboard date picker** — Pick any past event date to view that day's stats. Uses `react-day-picker` library styled with Delo brand colors (maroon selected day, Bricolage month header, Manrope day numbers). The stats API accepts an optional `?date=YYYY-MM-DD` param. When a date is selected: first card shows that day's orders, second card shows cumulative orders up to that date, popular drinks and modifier preferences are scoped to that date only. "Reset" link returns to today's view. Files changed: `app/api/admin/stats/route.ts`, `components/DashboardSection.tsx`, `app/globals.css`, `TECHNICAL.md`.
- **Fix: Dashboard "Today" counter timezone bug** — The stats API was computing "today" in UTC, which meant after ~4 PM Pacific the counter thought it was already tomorrow and showed 0 orders. Now the client sends its local timezone to the API, and each order's timestamp is converted to that timezone before comparing.

## Previous Changes (Feb 14)

- **Fix: Kitchen stale data on refresh** — Supabase client uses `cache: 'no-store'` on all fetch calls
- **Edit item details:** Edit modal with Name + Description fields above modifier checkboxes
- **Drag-and-drop reorder:** Admin menu items with grip-dot handles, persists to `display_order`
- **Removed** "No customization options" message from order flow
- **Added Americano description** in DB

## What's Next

**Visual Personality — Pick a Direction:**
- Three layout options were explored (see TECHNICAL.md § Visual Direction Options)
- Owner needs to choose one (or mix elements)
- Then implement the chosen direction

| Option | Name | Feel |
|--------|------|------|
| A | The Courtyard | Warm, structured — category zones, corner ribbons |
| B | Playful Pop | Fun, delightful — drink icons, confetti confirmation |
| C | Editorial Elegance | Refined, confident — vertical labels, typography-focused |

## Blockers

None currently.

## Infrastructure

- GitHub: deevyb/delo-kiosk
- Vercel: Auto-deploys on push to main
- Supabase: Database ready, menu seeded (7 drinks), realtime enabled
- Code Quality: Prettier, ESLint, Error Boundary, shared CSS classes
- Dependencies: react-day-picker (dashboard calendar)
