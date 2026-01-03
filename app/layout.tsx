import type { Metadata, Viewport } from 'next'
import './globals.css'
import ErrorBoundary from '@/components/ErrorBoundary'

export const metadata: Metadata = {
  title: 'Delo Coffee',
  description: 'Where Every Cup Brings People Together',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Prevent zooming on iPad for kiosk mode
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700&family=Manrope:wght@400;500;600&family=Roboto+Mono:wght@400;500&family=Yatra+One&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-delo-cream antialiased">
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  )
}
