'use client'

import { useEffect } from 'react'
import ErrorFallback from '@/components/ErrorFallback'

/**
 * Catches failures in the kitchen route itself — including the server-side order fetch in
 * `page.tsx`, which throws when the database can't be reached. The client ErrorBoundary in
 * the root layout can't catch those, so without this a barista gets an unstyled Next.js
 * error page on an iPad with no obvious way back.
 */
export default function KitchenError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error('Kitchen display failed to load:', error)
  }, [error])

  return (
    <ErrorFallback
      error={error}
      // Next's `reset()` only re-renders this boundary on the client — it does not re-run
      // the server fetch that failed, so it would recur instantly and the button would
      // read as dead. A full reload is what actually retries, and on a kiosk display
      // there's nothing worth preserving across it.
      resetErrorBoundary={() => window.location.reload()}
      title="Offline"
      message="Every order is still saved — nothing has been lost."
      actionLabel="Reload"
      footnote="Customers can keep ordering. Their orders will be here when connection restores."
    />
  )
}
