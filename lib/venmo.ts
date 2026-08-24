export interface VenmoConfig {
  handle: string
  price: string // two-decimal, e.g. "6.00"
}

/**
 * Payment config lives in env only — no prices in the menu system.
 * Both vars must be set (and the price numeric) or the feature is off
 * everywhere (?pay=1 safely does nothing, entry points hide).
 *
 * NEXT_PUBLIC_ vars are inlined into the client bundle at build time,
 * which only works for literal static reads like the ones below —
 * never process.env[name] or destructuring.
 */
export function getVenmoConfig(): VenmoConfig | null {
  const handle = process.env.NEXT_PUBLIC_VENMO_HANDLE
  const price = process.env.NEXT_PUBLIC_VENMO_PRICE
  if (!handle || !price || isNaN(Number(price))) return null
  return { handle: handle.replace(/^@/, ''), price: Number(price).toFixed(2) }
}

/**
 * Canonical Venmo universal link — single source of truth for the
 * on-screen QR and the URL written to the NFC stickers (see
 * docs/tap-to-pay-setup.md). Must stay an https venmo.com link:
 * iOS background NFC reading and camera QR scanning both ignore
 * venmo:// schemes.
 */
export function buildVenmoUrl(config: VenmoConfig, note = 'Delo Coffee'): string {
  return `https://venmo.com/u/${config.handle}?txn=pay&amount=${config.price}&note=${encodeURIComponent(note)}`
}
