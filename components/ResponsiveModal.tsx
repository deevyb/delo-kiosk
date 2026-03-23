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
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-delo-navy/40 z-40" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-delo-cream max-h-[92vh]">
          <div className="relative flex-shrink-0 pt-3 pb-2">
            <div className="mx-auto h-1.5 w-9 rounded-full bg-delo-navy/15" />
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.96 }}
              className="absolute right-3 top-1.5 w-[30px] h-[30px] flex items-center justify-center rounded-full bg-delo-navy/[0.07] hover:bg-delo-navy/10 transition-colors before:content-[''] before:absolute before:inset-[-7px] before:rounded-full"
              aria-label="Close"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 12 12"
                fill="none"
                className="text-delo-navy/50"
              >
                <path
                  d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </motion.button>
          </div>

          {title ? (
            <Drawer.Title className="font-bricolage font-bold text-2xl text-delo-maroon px-6 pb-1 flex-shrink-0">
              {title}
            </Drawer.Title>
          ) : (
            <Drawer.Title className="sr-only">Dialog</Drawer.Title>
          )}
          <Drawer.Description className="sr-only">{title || 'Dialog'}</Drawer.Description>

          <div className="px-6 pb-8 overflow-y-auto flex-1">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
