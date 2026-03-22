'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ReactNode } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
}

/**
 * Modal - Shared modal wrapper component
 *
 * Provides consistent styling across all form modals:
 * - Backdrop: bg-delo-navy/40 with click-to-close
 * - Panel: bg-delo-cream rounded-xl shadow-2xl p-8
 * - Animation: Spring physics (stiffness 400, damping 30)
 * - Close button: X in top-right corner
 *
 * Usage:
 * <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Add Item" size="lg">
 *   <form>...</form>
 * </Modal>
 */
export default function Modal({ isOpen, onClose, title, size = 'lg', children }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-delo-navy/40 z-40"
            aria-label="Close modal"
          />

          {/* Modal container - handles centering and click-outside */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 30,
            }}
            onClick={onClose}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            {/* Panel */}
            <div
              className={`bg-delo-cream rounded-xl shadow-2xl p-8 w-full ${sizeClasses[size]} relative max-h-[90vh] overflow-y-auto`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* X close button */}
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-delo-navy/5 hover:bg-delo-navy/10 transition-colors"
                aria-label="Close"
              >
                <span className="text-delo-navy/60 text-xl leading-none">×</span>
              </motion.button>

              {/* Optional title */}
              {title && (
                <h2 className="font-bricolage font-bold text-4xl text-delo-maroon pr-12 mb-6">
                  {title}
                </h2>
              )}

              {/* Content */}
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
