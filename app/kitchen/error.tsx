'use client'

import { useEffect } from 'react'
import ErrorFallback from '@/components/ErrorFallback'

/**
 * Last resort for the kitchen route.
 *
 * Deliberately cause-neutral. A Next segment boundary catches *every* render error here,
 * and since `page.tsx` degrades rather than throws, an unreachable database no longer
 * reaches this screen — the connection banner handles that. What's left is a genuine
 * crash, so the copy must not diagnose a network problem and send a barista to check a
 * router that's working fine.
 */
export default function KitchenError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error('Kitchen display crashed:', error)
  }, [error])

  return (
    <ErrorFallback
      // A full reload rather than Next's `reset()`: `reset()` only re-renders this
      // boundary's children, so anything baked into the payload it already has — or any
      // crash that reproduces on the same data — comes straight back. On a kiosk display
      // there's nothing worth preserving across a reload anyway.
      resetErrorBoundary={() => window.location.reload()}
      title="The display hit a problem"
      message="Every order is safe — nothing has been lost."
      actionLabel="Reload"
      footnote="Orders are still being taken. If a reload doesn't fix this, the app needs a look."
    />
  )
}
