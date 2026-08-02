'use client'

interface ErrorFallbackProps {
  resetErrorBoundary: () => void
  /** Defaults speak to a customer; the barista-facing screens pass their own. */
  title?: string
  message?: string
  actionLabel?: string
  footnote?: string
}

export default function ErrorFallback({
  resetErrorBoundary,
  title = 'Something went wrong',
  message = "We hit a small bump. Don't worry — your order is safe. Let's try that again.",
  actionLabel = 'Try Again',
  footnote = 'If this keeps happening, please let a barista know.',
}: ErrorFallbackProps) {
  return (
    <div className="min-h-screen bg-delo-cream flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-6xl">☕</div>

        <h1 className="font-yatra text-3xl text-delo-maroon text-balance">{title}</h1>

        <p className="text-delo-navy/70 font-bricolage text-balance">{message}</p>

        <button
          onClick={resetErrorBoundary}
          className="bg-delo-maroon text-delo-cream px-8 min-h-[44px] rounded-lg font-bricolage font-semibold
                     hover:bg-delo-maroon/90 active:scale-[0.98] transition-[background-color,transform] duration-150
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-delo-maroon
                     focus-visible:ring-offset-2 focus-visible:ring-offset-delo-cream"
        >
          {actionLabel}
        </button>

        <p className="text-sm text-delo-navy/50 font-roboto-mono text-balance">{footnote}</p>
      </div>
    </div>
  )
}
