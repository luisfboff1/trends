import React, { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, FileText, ShoppingCart,
  Layers, ChevronLeft, LogOut, Tag, X
} from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { useSidebarStore } from '@/store/sidebar'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/orcamentos', label: 'Orçamentos', icon: FileText },
  { href: '/pedidos', label: 'Pedidos', icon: ShoppingCart },
  { href: '/tipos-papel', label: 'Tipos de Papel', icon: Layers, adminOnly: true },
  { href: '/usuarios', label: 'Usuários', icon: Tag, adminOnly: true },
]

export function Sidebar() {
  const router = useRouter()
  const { data: session } = useSession()
  const { isCollapsed, toggleCollapsed, closeOnNavigate, setCollapsed } = useSidebarStore()
  const isAdmin = (session?.user as any)?.tipo === 'admin'

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin)

  // On mobile, start collapsed
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    if (mq.matches) setCollapsed(true)
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setCollapsed(true) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const isMobileOpen = !isCollapsed

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setCollapsed(true)}
          />
        )}
      </AnimatePresence>

      <motion.aside
        animate={{ width: isCollapsed ? 0 : 240 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="fixed left-0 top-0 h-full z-40 flex flex-col bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] overflow-hidden md:w-auto"
        style={{ minWidth: 0 }}
      >
        {/* Inner wrapper keeps layout at 240px; the outer clips */}
        <div className="w-[240px] flex flex-col h-full">
          {/* Logo / brand */}
          <div className="flex items-center justify-between h-14 px-4 border-b border-[var(--sidebar-border)] flex-shrink-0">
            <div className="flex items-center">
              <img src="/logo.webp" alt="Trends" className="h-8 w-auto object-contain" />
            </div>
            {/* Desktop collapse button — top-right corner of sidebar */}
            <button
              onClick={toggleCollapsed}
              className="hidden md:flex items-center justify-center w-7 h-7 rounded-md text-[var(--sidebar-text)] opacity-50 hover:opacity-100 hover:bg-white/10 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            {/* Mobile close button */}
            <button
              onClick={() => setCollapsed(true)}
              className="md:hidden text-[var(--sidebar-text)] opacity-60 hover:opacity-100 p-1"
            >
              <X size={16} />
            </button>
          </div>

          {/* Nav items */}
          <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
            {visibleItems.map(({ href, label, icon: Icon }) => {
              const active = router.pathname === href || router.pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => closeOnNavigate()}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors mb-0.5',
                    active
                      ? 'bg-[var(--sidebar-accent)] text-white'
                      : 'text-[var(--sidebar-text)] opacity-70 hover:opacity-100 hover:bg-white/10'
                  )}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  <span className="whitespace-nowrap font-medium">{label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Footer: user + logout */}
          <div className="border-t border-[var(--sidebar-border)] p-2 flex-shrink-0">
            {session?.user && (
              <div className="px-2 py-1.5 mb-1">
                <p className="text-xs text-[var(--sidebar-text)] opacity-60 truncate">{session.user.email}</p>
                <p className="text-xs text-[var(--sidebar-text)] opacity-40 capitalize">
                  {(session.user as any)?.tipo ?? 'vendedor'}
                </p>
              </div>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-3 px-2 py-2 w-full rounded-lg text-sm text-[var(--sidebar-text)] opacity-60 hover:opacity-100 hover:bg-white/10 transition-colors"
            >
              <LogOut size={16} className="flex-shrink-0" />
              <span className="text-xs">Sair</span>
            </button>
          </div>
        </div>
      </motion.aside>


    </>
  )
}
