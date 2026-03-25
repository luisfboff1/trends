import { useSession } from 'next-auth/react'
import type { UserTipo } from '@/types'

export function usePermissions() {
  const { data: session } = useSession()
  const user = session?.user as any

  const tipo: UserTipo = user?.tipo ?? 'vendedor'
  const permissoes: Record<string, boolean> = user?.permissoes ?? {}

  const can = (feature: string): boolean => {
    if (tipo === 'admin') return true
    return permissoes[feature] === true
  }

  return {
    tipo,
    permissoes,
    can,
    isAdmin: tipo === 'admin',
    isOperador: tipo === 'operador',
    isVendedor: tipo === 'vendedor',
  }
}
