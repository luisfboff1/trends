import React from 'react'
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

  const title = PAGE_TITLES[router.pathname] ??
    (router.pathname.startsWith('/orcamentos/') ? 'Orçamento' :
      router.pathname.startsWith('/pedidos/') ? 'Pedido' : 'Trends')

  return (
    <header className="fixed top-0 right-0 left-0 h-14 z-50 flex items-center gap-3 px-4 bg-[var(--background)] border-b border-[var(--border)]">
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
    </header>
  )
}
