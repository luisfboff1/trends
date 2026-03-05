import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { useSidebarStore } from '@/store/sidebar'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isCollapsed } = useSidebarStore()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // On mobile the sidebar is overlay — don't shift content
  const marginLeft = isMobile ? 0 : isCollapsed ? 0 : 240

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Sidebar />
      <Header />
      <motion.main
        animate={{ marginLeft }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="min-h-screen pt-14"
      >
        <div className="p-4 md:p-6">{children}</div>
      </motion.main>
    </div>
  )
}
