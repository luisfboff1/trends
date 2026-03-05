import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

type Device = 'desktop' | 'tablet' | 'mobile'

interface SidebarState {
  isOpen: boolean
  isCollapsed: boolean
  device: Device
}

interface SidebarStore extends SidebarState {
  setOpen: (open: boolean) => void
  open: () => void
  close: () => void
  toggle: () => void
  setCollapsed: (collapsed: boolean) => void
  toggleCollapsed: () => void
  setDevice: (device: Device) => void
  closeOnNavigate: () => void
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set, get) => ({
      isOpen: true,
      isCollapsed: false,
      device: 'desktop' as Device,

      setOpen: (open) => set({ isOpen: open }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
      toggleCollapsed: () => set((s) => ({ isCollapsed: !s.isCollapsed })),
      setDevice: (device) => set({ device }),
      closeOnNavigate: () => {
        if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
          set({ isCollapsed: true })
        }
      },
    }),
    {
      name: 'trends-sidebar-store',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined') return localStorage
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      }),
      partialize: (state) => ({ isCollapsed: state.isCollapsed }),
    }
  )
)
