# Tap to Pay with Venmo — Design Spec

> Status: **Design finalized — ready to implement.** This spec is the output of a
> deep research pass (NFC feasibility, Venmo deep-link behavior) and a structured
> owner interview (Aug 23, 2026). Every direction decision below was made
> deliberately with the owner — **do not re-open them or re-run the interview.**
> Implement on a feature branch (e.g. `tap-to-pay`), follow the CLAUDE.md skill
> table, and pause for the owner's manual testing before committing.

## The experience

At events, a team member takes the customer's order on their own iPhone via
`/order`. A passive NFC sticker on the **lower back** of that phone holds a static
Venmo payment link. After submitting an order, the team member **flips their phone
around to face the customer**. The confirmation screen is customer-facing: it shows
the order, the price, and — Square-terminal style — an animated cue telling the
customer to tap their phone **underneath** the order-taker's phone. The tap pops an
iOS banner (or opens directly on Android) → Venmo opens with handle, amount, and
note prefilled → customer hits Pay. An on-screen QR of the same link is the
fallback for taps that fail. Some events are free coffee, so the whole payment
screen is toggled per event; free events keep today's confirmation exactly.

## Research facts to respect (verified Aug 2026 — do not re-litigate)

- A web app on iPhone **cannot** emit or emulate NFC (no Safari NFC API; Apple's
  tag-emulation entitlements are banks/transit only). The sticker is the only
  "tap my phone" mechanism, and it is a deliberate choice, not a fallback.
- The link on the sticker AND in the QR must be an **https venmo.com universal
  link**: `https://venmo.com/u/<handle>?txn=pay&amount=<price>&note=<encoded>` —
  two-decimal amount, no `$`, bare handle without `@`, `encodeURIComponent`'d
  note. Never `venmo://` in a tag or QR (iOS background NFC reading and camera
  QR scanning both ignore custom schemes). With the venmo.com link on the tag,
  an iPhone banner tap opens the Venmo app directly — no Safari step.
- Venmo's prefill params are **undocumented** (they broke once in Mar 2024 and
  recovered). Degradation mode = the profile opens with nothing prefilled, so
  the screen must show drink + price as human-readable text near the QR, and the
  setup guide mandates a real-device test before each event.
- iPhones read NFC with their **top edge**; the sticker sits on the **lower
  back** of the order-taker's phone (the iPhone's own NFC antenna is top-rear —
  lower placement avoids interference). That geometry is why the customer slides
  their phone **under, not on top**: top edge first, it lands on the sticker.
- No prices go into the menu system or schema — the flat price lives in env
  config only. Payment *processing* stays out of scope; the app only links out.
- Venmo handle is swappable config (owner may later create a business profile —
  personal profiles carry seller-pattern freeze risk; rewriting a tag takes 30s).

## Decisions (owner-approved)

1. **Static sticker → Venmo directly.** No dynamic per-order redirect page; a
   browser hop would break the instant app-open.
2. **One flat event price** baked into the link (`amount=6.00` style). Customers
   can still edit the number in Venmo — prefill is convenience, not a charge.
3. **Handle-agnostic config**: `NEXT_PUBLIC_VENMO_HANDLE` +
   `NEXT_PUBLIC_VENMO_PRICE` env vars, set in Vercel.
4. **Per-event toggle** via URL param `?pay=1` on `/order` (mirrors the existing
   `?barista=` pattern in `KitchenClient.tsx`). Plain `/order` = today's
   confirmation byte-for-byte. `?pay=1` without env vars safely does nothing.
5. **Customer-facing confirmation** with Square-style tap guidance (below).
6. **Entry points** for both modes on the landing page and the nine-dot NavMenu.

## Build

### 1. `lib/venmo.ts` (new, ~15 lines)

- `getVenmoConfig()` reads both env vars; returns `null` if either is missing
  (feature off).
- `buildVenmoUrl(note?)` returns the canonical URL (format above). Single source
  of truth for the QR and for the sticker URL in the setup guide.

### 2. `components/TapToPay.tsx` (new) — customer-facing payment block

Rendered inside the existing confirmation overlay in `OrderClient.tsx`
(currently ~lines 255–303, the `fixed inset-0` non-scrolling cream overlay).
Design it like Square's customer-facing tap terminal, on-brand (warm/playful
copy; Bricolage/Cooper/Manrope per existing usage; maroon on cream):

- **Top/middle** — same info as today's confirmation (customer name, drink,
  modifiers) plus the flat price, sized to read at arm's length.
- **Bottom hero** — animated **downward-pointing arrow** (gentle Framer Motion
  bounce/pulse consistent with the app's feel) with copy like "Tap your phone
  under here". It sits at the bottom of the screen because that is physically
  where the sticker is (lower back). The copy must convey: slide your phone
  **under** this one, not on top.
- **Secondary fallback** above the tap zone, visually smaller: "or scan" + QR of
  `buildVenmoUrl("Delo Coffee – " + order.item)` — the QR gets a per-order note
  (free dynamism the static sticker can't have; the sticker's note stays
  "Delo Coffee"). QR via the `react-qr-code` package (SVG, tiny — first new
  runtime dependency), on a **white rounded card** (quiet zone — cream `#F9F6EE`
  alone hurts scan contrast). Everything must fit the overlay on a phone with no
  scrolling.

### 3. `components/OrderClient.tsx` — confirmation flow change

- Payment step renders ONLY when `getVenmoConfig()` is non-null AND the page was
  opened with `?pay=1` (`useSearchParams`, mirroring `?barista=`).
- When active: replace the 3000 ms auto-reset (effect at ~lines 49–63) with a
  **subtle dismiss** — small "New order" text button in a top corner (customers
  facing the screen must not fat-finger it) — plus a **60 s safety auto-reset**
  so a forgotten screen can't strand the flow mid-rush.
- When inactive (plain `/order`, or env unset): today's behavior exactly —
  3 s auto-reset, no payment UI.

### 4. Entry points

- Landing page `/`: add navigation to "Order" (plain `/order`) and
  "Order · Tap to Pay" (`/order?pay=1`), styled with the existing landing nav.
- Shared nine-dot NavMenu (currently Home / Kitchen / Admin): same two entries.
- Both places: hide the Tap to Pay entry when `getVenmoConfig()` is null
  (`NEXT_PUBLIC_*` vars are client-readable), so free-only deployments never
  show a dead mode.

### 5. Config + docs

- `.env.example`: add both vars with comments (owner sets real values in
  Vercel; placeholders keep dev running).
- `docs/tap-to-pay-setup.md` (new) — the hardware guide:
  - Buy **NTAG213** round stickers, **25 mm or larger**, standard (not
    on-metal) unless the case contains metal. One identical sticker per team
    phone — multiple simultaneous order-takers need no routing.
  - Write the URL with the free **NFC Tools** app (URL record, exact template
    from `lib/venmo.ts`); optionally lock read-only after the handle is final.
  - Placement: **lower back** of the phone or case (iPhone's own antenna is
    top-rear — no interference).
  - The two entry points: `/order?pay=1` for paid events, `/order` for free.
  - Customer coaching line: "slide your phone under mine, screen on."
  - Swap-to-business-handle procedure: rewrite tag + update env vars.
  - **Pre-event test checklist**: iPhone tap → banner → Venmo opens with
    amount+note prefilled; Android tap; camera scan of the on-screen QR; a
    no-Venmo-app phone lands on the venmo.com profile. Re-test every event —
    the params are unofficial.
- `CLAUDE.md` "Out of Scope": change "Payments" to "payment processing"
  (payment prompts are now in scope; processing still isn't).
- `.claude/rules/status.md`: changelog entry; note that backlog item #7 (queue
  position on confirmation) now composes with a dismissible confirmation
  instead of fighting a 3 s timer.

## Files touched

`package.json` (+`react-qr-code`) · `lib/venmo.ts` (new) ·
`components/TapToPay.tsx` (new) · `components/OrderClient.tsx` ·
landing page + NavMenu components · `.env.example` ·
`docs/tap-to-pay-setup.md` (new) · `CLAUDE.md` · `.claude/rules/status.md` ·
`Delo Coffee Ordering App – MVP Spec.md` (one line)

Not touched: no schema changes, no API routes, no prices in the menu system, no
new admin UI. Kitchen display unaffected.

## Verification

1. `npm run build` + lint pass.
2. `/order?pay=1` with env set: submit → customer-facing screen (order info,
   price, animated tap-under arrow at the bottom, QR fallback); corner
   "New order" resets; 60 s safety reset fires. Decode the rendered QR with any
   scanner and confirm it byte-matches `buildVenmoUrl` output.
3. Plain `/order`, or env unset: identical to current production; Tap to Pay
   entries hidden from `/` and the NavMenu.
4. Landing + NavMenu entries navigate correctly on mobile and desktop.
5. Quality passes per CLAUDE.md (`/simplify`, `/react-best-practices`, etc.).
6. **Stop and ask the owner to test on a real phone before committing**
   (CLAUDE.md requirement). Full sticker test once tags arrive: writing
   `https://venmo.com/u/<handle>?txn=pay&amount=<price>&note=Delo%20Coffee` to a
   tag needs no code and can be tested independently.
