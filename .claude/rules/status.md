# Project Status

> Last Updated: July 31, 2026 (session 9)

## Current State

| Route      | Status   | Notes                                                                                                                                                                                                                                            |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`        | Complete | Landing page with navigation                                                                                                                                                                                                                     |
| `/order`   | Complete | Full ordering flow with confirmation & auto-reset + **mobile responsive** (2-col grid, bottom sheet via vaul, responsive modifiers)                                                                                                              |
| `/kitchen` | Complete | Real-time barista display + NavMenu + Ready/Cancelled tabs + Today-only filter + **Multi-barista mode** + **mobile responsive** (single-col cards, responsive tabs, cancel modal as bottom sheet)                                                |
| `/admin`   | Complete | Passcode + tabs + menu items (edit name/desc, modifiers, archive, drag-to-reorder) + modifiers + dashboard with date picker + **mobile responsive** (condensed cards, full-sheet modals, stacked dashboard, native date picker, shared PillTabs) |

**Live App:** https://delo-kiosk-buwhagfrm-deevys-projects.vercel.app

## Backlog

Items 1–4 came out of the July 31 review pass and are event-critical. Items 8–9 are housekeeping.

| #   | Title                                | Type        | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Realtime reconnect gap               | Reliability | **Threatens "zero lost orders."** `TECHNICAL.md:220-225` claims a 5s polling fallback + auto-reconnect refetch. Neither exists — the only `setInterval` in the app is the 60s clock at `KitchenClient.tsx:64`. On a realtime drop, `KitchenClient.tsx:166-167` only toggles the `ConnectionStatus` banner; nothing refetches, so orders placed during an outage stay invisible until reload. Fix: refetch on `SUBSCRIBED` after a disconnect (and/or poll while disconnected), then correct the doc.                                                               |
| 2   | Kitchen performance during rush      | Performance | Three compounding costs on the display, worst late in an event (~150 cards). (a) `app/kitchen/page.tsx:11-15` selects `*` across all statuses with no date bound or limit, then `KitchenClient.tsx:38` filters to today client-side — bound the query to a recent window. (b) `dateUtils.ts:31-33` `isToday` recomputes today per element, so the `KitchenClient.tsx:70` filter does 2 `Intl` formats per order on every realtime event; the sorts at `:76-107` re-parse dates inside comparators. (c) 60s tick re-renders every card; `OrderCard` isn't `memo`'d. |
| 3   | Dead code removal                    | Cleanup     | Do alongside #2 — same files, one test pass on the kitchen screen. `isNew` is declared (`OrderCard.tsx:18,48`) but never read; the whole `newOrderIds` chain feeding it is dead (`KitchenClient.tsx:32,43-47,145,157-159,344,372`, `SplitQueueLayout.tsx:19,39,65,101`). Also: `TabType = OrderStatus` is too wide so `in_progress` branches at `KitchenClient.tsx:113,352` are unreachable; `myDrinksOnly` guard at `SplitQueueLayout.tsx:79` is a no-op; `baristaColors.ts` `border` field unused; unused `GET` handlers in both admin API routes.               |
| 4   | Parallel data loading                | Performance | Best effort-to-payoff on the list. `app/order/page.tsx:10-28` awaits `menu_items` then `modifiers` sequentially though they're independent — and both are uncached (`force-dynamic` + `no-store`), so every kiosk load pays both round trips to us-west-2 in series. `Promise.all` halves it. Same pattern at `app/admin/page.tsx:35-46`.                                                                                                                                                                                                                          |
| 5   | Landing page revamp                  | Design      | Redesign the `/` landing page + make it mobile responsive (details TBD — may tie into visual direction choice)                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 6   | Queue position & ETA on confirmation | Feature     | After placing an order, confirmation screen shows "You're #3 in line — ~6 min". Needs queue count from active orders + estimated prep time                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 7   | Show ingredients on drink card       | Enhancement | Display ingredients as a subtitle on the drink selection card in `/order`, while keeping them inside the detail card too                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 8   | Doc accuracy pass                    | Docs        | Docs describe an older build and will mislead future sessions. README feature list (`:18-30`) omits kitchen tabs, multi-barista mode, the admin dashboard, archive/restore, drag-to-reorder, and all mobile work; tech-stack table omits `@dnd-kit`/`vaul`/`react-day-picker`. `TECHNICAL.md` documents a Vitest/Playwright strategy (`:291-318`) with no test framework installed, hooks that don't exist (`:73`), `Modal.tsx` as the modal in use (`:483-493`) when all five call sites now use `ResponsiveModal`, and a stale footer date (`:540`).             |
| 9   | Shared abstractions / dedupe         | Refactor    | No user-visible change; real maintenance savings. The admin fetch + error + 4s-clear block is written 9× (`MenuItemsSection`, `ModifiersSection`, `NewMenuItemForm`) and has already drifted — extract `lib/api.ts` + a `useAutoClearError` hook (`KitchenClient.tsx:275-279` already does it correctly with cleanup). Also: click-outside `useEffect` 3× → hook; toggle switch 3×; `formatCategoryName` 4×; the `bg-white rounded-xl … border-delo-navy/10` card shell 11× → a `.card-admin` class; 3 inline error banners that duplicate `.error-banner`.        |

## Blockers

None.

## Changelog

- **Jul 31** — Review pass across reuse / simplification / efficiency / altitude. Clean bill on leak risk: every Supabase channel, `setInterval`, and event listener is cleaned up. Findings filed as prioritized backlog items above, with file:line references so they can be picked up cold.
- **Jul 31** — Repo cleanup: removed stale build caches (.next, tsbuildinfo, .DS_Store), completed multi-barista spec doc, unused `.cursor/rules`, dead `GITHUB_PAT` in `.env`, expired `.env.local`; gitignored browser-testing artifacts and `.claude/settings.local.json` (was only protected by a machine-local git config); README now points at `.env` (matching actual setup); `DashboardSection` now calls the cached `getTodayDateString()` instead of rebuilding two `Intl.DateTimeFormat` objects every render
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
