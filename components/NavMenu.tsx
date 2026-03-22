'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavMenuProps {
  /** Optional logout handler - when provided, shows logout option in menu */
  onLogout?: () => void
}

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/kitchen', label: 'Kitchen' },
  { href: '/admin', label: 'Admin' },
]

/**
 * NavMenu - Dots icon with dropdown navigation
 *
 * Used on Kitchen and Admin pages for navigation between screens.
 * Shows 3x3 grid icon that opens a dropdown with page links.
 */
export default function NavMenu({ onLogout }: NavMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div ref={menuRef} className="relative">
      {/* Dots/Grid Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-delo-navy/5 transition-colors"
        aria-label="Navigation menu"
        aria-expanded={isOpen}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-delo-navy/70">
          {/* 3x3 Grid of dots */}
          <circle cx="6" cy="6" r="2" fill="currentColor" />
          <circle cx="12" cy="6" r="2" fill="currentColor" />
          <circle cx="18" cy="6" r="2" fill="currentColor" />
          <circle cx="6" cy="12" r="2" fill="currentColor" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
          <circle cx="18" cy="12" r="2" fill="currentColor" />
          <circle cx="6" cy="18" r="2" fill="currentColor" />
          <circle cx="12" cy="18" r="2" fill="currentColor" />
          <circle cx="18" cy="18" r="2" fill="currentColor" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-lg border border-delo-navy/10 overflow-hidden min-w-[160px] z-50"
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <nav className="py-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`
                      block px-4 py-2.5 font-manrope text-sm transition-colors
                      ${
                        isActive
                          ? 'bg-delo-maroon/10 text-delo-maroon font-semibold'
                          : 'text-delo-navy/70 hover:bg-delo-navy/5 hover:text-delo-navy'
                      }
                    `}
                  >
                    {item.label}
                  </Link>
                )
              })}

              {/* Logout option (only if handler provided) */}
              {onLogout && (
                <>
                  <div className="border-t border-delo-navy/10 my-2" />
                  <button
                    onClick={() => {
                      setIsOpen(false)
                      onLogout()
                    }}
                    className="w-full text-left px-4 py-2.5 font-manrope text-sm text-delo-navy/50 hover:text-delo-maroon hover:bg-delo-navy/5 transition-colors"
                  >
                    Log out
                  </button>
                </>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
