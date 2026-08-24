export interface VenmoConfig {
  handle: string
  price: string // two-decimal, e.g. "6.00"
}

/**
 * Payment config lives in env only — no prices in the menu system.
 * Both vars must be set (and the price a positive, finite number) or the feature is off
 * everywhere (?pay=1 safely does nothing, entry points hide).
 *
 * NEXT_PUBLIC_ vars are inlined into the client bundle at build time,
 * which only works for literal static reads like the ones below —
 * never process.env[name] or destructuring.
 */
export function getVenmoConfig(): VenmoConfig | null {
  const handle = process.env.NEXT_PUBLIC_VENMO_HANDLE?.trim()
  const price = process.env.NEXT_PUBLIC_VENMO_PRICE
  const amount = Number(price)
  if (!handle || !price || !Number.isFinite(amount) || amount <= 0) return null
  return { handle: handle.replace(/^@/, ''), price: amount.toFixed(2) }
}

/**
 * The URL format the on-screen QR encodes. Physical NFC stickers are
 * hand-written to the same format in a third-party app (see
 * docs/tap-to-pay-setup.md) — nothing in code links them, only
 * convention, so changing this format means rewriting every sticker.
 * Must stay an https venmo.com link: iOS background NFC reading and
 * camera QR scanning both ignore venmo:// schemes.
 */
export function buildVenmoUrl(config: VenmoConfig, note = 'Delo Coffee'): string {
  return `https://venmo.com/u/${config.handle}?txn=pay&amount=${config.price}&note=${encodeURIComponent(note)}`
}
