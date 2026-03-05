import { create } from 'zustand'
import type { Session } from 'next-auth'

interface AuthStore {
  session: Session | null
  isLoading: boolean
  setSession: (session: Session | null) => void
  setLoading: (loading: boolean) => void
  clear: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  isLoading: true,
  setSession: (session) => set({ session, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  clear: () => set({ session: null, isLoading: false }),
}))
