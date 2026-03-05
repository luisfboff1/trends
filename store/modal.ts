import { create } from 'zustand'

type ModalId =
  | 'cliente'
  | 'tipo-papel'
  | 'usuario'
  | 'pedido-detail'
  | 'orcamento-item'
  | 'confirm-delete'

interface ModalState {
  id: ModalId | null
  data?: unknown
  isOpen: boolean
}

interface ModalStore extends ModalState {
  open: (id: ModalId, data?: unknown) => void
  close: () => void
  setData: (data: unknown) => void
}

export const useModalStore = create<ModalStore>((set) => ({
  id: null,
  data: undefined,
  isOpen: false,
  open: (id, data) => set({ id, data, isOpen: true }),
  close: () => set({ id: null, data: undefined, isOpen: false }),
  setData: (data) => set((state) => ({ ...state, data })),
}))
