import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Menu, Sun, Moon } from 'lucide-react'
import { useThemeStore } from '@/store/theme'
import { useSidebarStore } from '@/store/sidebar'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/clientes': 'Clientes',
  '/orcamentos': 'Orçamentos',
  '/pedidos': 'Pedidos',
  '/tipos-papel': 'Tipos de Papel',
  '/usuarios': 'Usuários',
}

export function Header() {
  const router = useRouter()
  const { theme, toggleTheme } = useThemeStore()
  const { toggleCollapsed, isCollapsed } = useSidebarStore()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // On mobile sidebar is overlay — header always starts at 0
  // On desktop sidebar pushes header — match sidebar width
  const marginLeft = isMobile ? 0 : isCollapsed ? 0 : 240

  const title = PAGE_TITLES[router.pathname] ??
    (router.pathname.startsWith('/orcamentos/') ? 'Orçamento' :
      router.pathname.startsWith('/pedidos/') ? 'Pedido' : 'Trends')

  return (
    <motion.header
      animate={{ left: marginLeft }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="fixed top-0 right-0 h-14 z-30 flex items-center gap-3 px-4 bg-[var(--background)] border-b border-[var(--border)]"
      style={{ left: marginLeft }}
    >
      {/* Mobile hamburger */}
      <Button variant="ghost" size="icon" onClick={toggleCollapsed} className="md:hidden">
        <Menu size={18} />
      </Button>
      {/* Desktop expand button — only visible when sidebar is collapsed */}
      {isCollapsed && (
        <Button variant="ghost" size="icon" onClick={toggleCollapsed} className="hidden md:flex">
          <Menu size={18} />
        </Button>
      )}

      <h1 className="text-sm font-semibold text-[var(--foreground)] flex-1">{title}</h1>

      <Button variant="ghost" size="icon" onClick={toggleTheme} title="Alternar tema">
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </Button>
    </motion.header>
  )
}
