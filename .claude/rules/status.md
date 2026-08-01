# Project Status

> Last Updated: July 31, 2026 (session 9)

## Current State

| Route      | Status   | Notes                                                                                                                                                                                             |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`        | Complete | Landing page with navigation                                                                                                                                                                      |
| `/order`   | Complete | Full ordering flow with confirmation & auto-reset + **mobile responsive** (2-col grid, bottom sheet via vaul, responsive modifiers)                                                               |
| `/kitchen` | Complete | Real-time barista display + NavMenu + Ready/Cancelled tabs + Today-only filter + **Multi-barista mode** + **mobile responsive** (single-col cards, responsive tabs, cancel modal as bottom sheet) |
| `/admin`   | Complete | Passcode + tabs + menu items (edit name/desc, modifiers, archive, drag-to-reorder) + modifiers + dashboard with date picker + **mobile responsive** (condensed cards, full-sheet modals, stacked dashboard, native date picker, shared PillTabs) |

**Live App:** https://delo-kiosk-buwhagfrm-deevys-projects.vercel.app

## Backlog

| #   | Title                                | Type        | Description                                                                                                                                |
| --- | ------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Landing page revamp                  | Design      | Redesign the `/` landing page + make it mobile responsive (details TBD — may tie into visual direction choice)                             |
| 2   | Queue position & ETA on confirmation | Feature     | After placing an order, confirmation screen shows "You're #3 in line — ~6 min". Needs queue count from active orders + estimated prep time |
| 3   | Show ingredients on drink card       | Enhancement | Display ingredients as a subtitle on the drink selection card in `/order`, while keeping them inside the detail card too                   |

## Blockers

None.

## Changelog

- **Jul 31** — Repo cleanup: removed stale build caches (.next, tsbuildinfo, .DS_Store), completed multi-barista spec doc, unused `.cursor/rules`, dead `GITHUB_PAT` in `.env`, expired `.env.local`; gitignored browser-testing artifacts; README now points at `.env` (matching actual setup); `getTodayDateString` made module-private
- **Mar 23** — Admin mobile responsive: shared PillTabs component (used by admin + kitchen), condensed card layout, full-sheet bottom sheets for all admin modals (MenuItemEditor, NewMenuItemForm, ModifierForm), dashboard stacks vertically with native date picker on mobile, responsive export section, "Delo Admin" mobile title, compact tab labels ("Menu" / "Mods" / "Dashboard"), tabular-nums on stats, text-balance on headings, CSS-only responsive (no hydration mismatches)
- **Mar 22** — Prep time badge on Ready tab: today's ready orders show elapsed time (hourglass icon + "2m 30s" format) instead of relative time; past orders keep date badge; `formatPrepTime` utility in `dateUtils.ts`
- **Mar 22** — Mobile polish: Apple HIG bottom sheet close button (SVG xmark, grab handle row), drink card font bump, Drawer.Description for a11y
- **Mar 22** — Mobile compatibility for order + kitchen: vaul bottom sheet (customizer + cancel confirm), 2-col drink grid, single-col kitchen cards, responsive padding/typography/buttons, `useIsMobile` hook, `ResponsiveModal` component, modifier button overflow fix
- **Mar 22** — Multi-barista workflow: split Queue/In Progress layout, `?barista=` URL param, claim orders (Mark In Progress), barista identity badges (3-char, auto-color), modifier badges (Oat/Regular/Hot/Iced), "My drinks only" toggle, stacked button layout for in-progress cards, solo mode unchanged
- **Mar 22** — Kitchen defaults to today's orders with toggle in overflow menu; past orders show date badges
- **Mar 21** — Ready tab actions (Back to Placed, Cancel) + Cancelled tab with overflow menu and Restore
- **Mar 21** — Temp-locked drinks show correct temp; milk hidden when disabled
- **Mar 21** — Title links to homepage (branch cleaned up)
- **Mar 18** — Fix: Dashboard trends show all-time data when viewing today with 0 orders
- **Feb 15** — Dashboard date picker for past event stats; fix timezone bug in Today counter
- **Feb 14** — Kitchen stale data fix; edit item name/desc; drag-to-reorder; Americano description

## Infrastructure

- GitHub: deevyb/delo-kiosk
- Vercel: Auto-deploys on push to main
- Supabase: Database ready, menu seeded (7 drinks), realtime enabled
- Code Quality: Prettier, ESLint, Error Boundary, shared CSS classes
- Dependencies: react-day-picker (dashboard calendar), vaul (mobile bottom sheets, added session 6)
- DB Schema: orders table has `in_progress` status + `claimed_by` column (added session 5)
- Mobile: Responsive at `md:` (768px) breakpoint via Tailwind classes + `useIsMobile` hook for Modal/Drawer swap
- Shared Components: `PillTabs` (generic, CSS-only responsive labels) used by AdminTabs + KitchenTabs; `ResponsiveModal` (fullSheet prop for admin modals)
