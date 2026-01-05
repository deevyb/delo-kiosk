'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

interface PasscodeGateProps {
  onSuccess: () => void
}

/**
 * PasscodeGate - Simple centered passcode input screen
 *
 * Warm Delo aesthetic with shake animation on wrong code
 */
export default function PasscodeGate({ onSuccess }: PasscodeGateProps) {
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [shake, setShake] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!passcode.trim()) {
      setError('Enter a passcode')
      return
    }

    setIsVerifying(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      })

      const data = await response.json()

      if (data.valid) {
        // Store in localStorage for session persistence
        localStorage.setItem('delo-admin-verified', 'true')
        onSuccess()
      } else {
        setError('Incorrect passcode')
        setShake(true)
        setTimeout(() => setShake(false), 500)
        setPasscode('')
      }
    } catch {
      setError('Could not verify. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-delo-cream p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{
          opacity: 1,
          y: 0,
          x: shake ? [0, -10, 10, -10, 10, 0] : 0,
        }}
        transition={shake ? { duration: 0.4 } : { type: 'spring', stiffness: 400, damping: 30 }}
        className="w-full max-w-sm"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-yatra text-4xl text-delo-maroon mb-2">Admin</h1>
          <p className="text-description">Enter passcode to continue</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Passcode"
              autoFocus
              className="w-full h-16 px-6 text-center text-modifier-option text-delo-navy bg-white rounded-xl border border-delo-navy/10 focus:border-delo-maroon focus:outline-none transition-colors"
            />
          </div>

          <motion.button
            type="submit"
            disabled={isVerifying}
            whileTap={{ scale: 0.97 }}
            className="btn-primary w-full"
          >
            {isVerifying ? 'Verifying...' : 'Enter'}
          </motion.button>

          {/* Error message */}
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-600 text-sm text-center"
            >
              {error}
            </motion.p>
          )}
        </form>

        {/* Back link */}
        <div className="text-center mt-8">
          <a
            href="/"
            className="text-delo-navy/50 hover:text-delo-maroon text-sm transition-colors"
          >
            ← Back to home
          </a>
        </div>
      </motion.div>
    </div>
  )
}
