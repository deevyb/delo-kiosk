# Project Status

> Last Updated: February 14, 2026

## Current State

| Route | Status | Notes |
|-------|--------|-------|
| `/` | Complete | Landing page with navigation |
| `/order` | Complete | Full ordering flow with confirmation & auto-reset |
| `/kitchen` | Complete | Real-time barista display + NavMenu + instant local state updates + polished tab/card animations |
| `/admin` | Complete | Passcode + tabs + menu items (edit name/desc, modifiers, archive, drag-to-reorder) + modifiers + dashboard |

**Live App:** https://delo-kiosk-buwhagfrm-deevys-projects.vercel.app

## Recent Changes (Feb 14)

- **Fix: Kitchen stale data on refresh** — Supabase client now uses `cache: 'no-store'` on all fetch calls to prevent Next.js Data Cache from serving stale order data. Also added `revalidate = 0` to kitchen page. This fixes the bug where "Mark Ready" updated the DB but page refresh reverted orders to "Placed".
- **Edit item details:** Edit modal now has Name + Description fields above modifier checkboxes. All save together.
- **Drag-and-drop reorder:** Admin menu items have grip-dot handles. Drag within a category to reorder. Persists to `display_order` column. iPad-friendly (200ms touch delay).
- **New dependency:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- **New API endpoint:** `PUT /api/admin/menu-items/reorder` for batch display_order updates
- **Removed** "No customization options" message from order flow — unnecessary clutter
- **Added Americano description** in DB: "Espresso with hot water for a smooth, bold cup"

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

**After deploy, verify on live server:**
- Kitchen "Mark Ready" should persist through page refresh
- Test cancel as well

## Blockers

None currently.

## Infrastructure

- GitHub: deevyb/delo-kiosk
- Vercel: Auto-deploys on push to main
- Supabase: Database ready, menu seeded (7 drinks), realtime enabled
- Code Quality: Prettier, ESLint, Error Boundary, shared CSS classes
