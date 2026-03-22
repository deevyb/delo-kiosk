'use client'

import { ReactNode } from 'react'
import { Drawer } from 'vaul'
import { motion } from 'framer-motion'
import { useIsMobile } from '@/hooks/useIsMobile'
import Modal from './Modal'

interface ResponsiveModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

/**
 * ResponsiveModal - Renders a vaul Drawer on mobile, existing Modal on desktop.
 *
 * Mobile (<768px): Bottom sheet with drag handle, swipe-to-dismiss, snap points.
 * Desktop (≥768px): Centered Framer Motion modal (unchanged behavior).
 *
 * Same props interface as Modal — drop-in replacement.
 */
export default function ResponsiveModal({
  isOpen,
  onClose,
  title,
  size = 'lg',
  children,
}: ResponsiveModalProps) {
  const isMobile = useIsMobile()

  if (!isMobile) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={title} size={size}>
        {children}
      </Modal>
    )
  }

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      dismissible={true}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-delo-navy/40 z-40" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-delo-cream max-h-[92vh]">
          <div className="mx-auto mt-3 mb-1 h-1.5 w-10 rounded-full bg-delo-navy/20 flex-shrink-0" />

          <div className="flex items-start justify-between px-6 pt-2 pb-1 flex-shrink-0">
            {title ? (
              <Drawer.Title className="font-bricolage font-bold text-2xl text-delo-maroon pr-10">
                {title}
              </Drawer.Title>
            ) : (
              <Drawer.Title className="sr-only">Dialog</Drawer.Title>
            )}
            <motion.button
              onClick={onClose}
              whileTap={{ scale: 0.95 }}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-delo-navy/5 hover:bg-delo-navy/10 transition-colors flex-shrink-0 -mt-1"
              aria-label="Close"
            >
              <span className="text-delo-navy/60 text-xl leading-none">×</span>
            </motion.button>
          </div>

          <div className="px-6 pb-8 overflow-y-auto flex-1">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
