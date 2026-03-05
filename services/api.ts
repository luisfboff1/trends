import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

// ── Clientes ──────────────────────────────────────────────────────────────────
export const clientesService = {
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get('/clientes', { params }),
  get: (id: number) => api.get(`/clientes/${id}`),
  create: (data: unknown) => api.post('/clientes', data),
  update: (id: number, data: unknown) => api.put(`/clientes/${id}`, data),
  delete: (id: number) => api.delete(`/clientes/${id}`),
  lookupCnpj: (cnpj: string) => api.get(`/cnpj/${cnpj.replace(/\D/g, '')}`),
}

// ── Tipos de Papel ────────────────────────────────────────────────────────────
export const tiposPapelService = {
  list: (apenasAtivos = true) => api.get('/tipos-papel', { params: { ativo: apenasAtivos } }),
  get: (id: number) => api.get(`/tipos-papel/${id}`),
  create: (data: unknown) => api.post('/tipos-papel', data),
  update: (id: number, data: unknown) => api.put(`/tipos-papel/${id}`, data),
  delete: (id: number) => api.delete(`/tipos-papel/${id}`),
}

// ── Orçamentos ────────────────────────────────────────────────────────────────
export const orcamentosService = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get('/orcamentos', { params }),
  get: (id: number) => api.get(`/orcamentos/${id}`),
  create: (data: unknown) => api.post('/orcamentos', data),
  update: (id: number, data: unknown) => api.put(`/orcamentos/${id}`, data),
  delete: (id: number) => api.delete(`/orcamentos/${id}`),
  converter: (id: number) => api.post(`/orcamentos/${id}/converter`),
}

// ── Pedidos ───────────────────────────────────────────────────────────────────
export const pedidosService = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get('/pedidos', { params }),
  get: (id: number) => api.get(`/pedidos/${id}`),
  update: (id: number, data: unknown) => api.put(`/pedidos/${id}`, data),
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardService = {
  get: () => api.get('/dashboard'),
}

// ── Usuários ──────────────────────────────────────────────────────────────────
export const usuariosService = {
  list: (status?: 'pendente' | 'ativo' | 'todos') =>
    api.get('/usuarios', { params: { status } }),
  listVendedores: () => api.get('/usuarios', { params: { role: 'vendedores' } }),
  create: (data: unknown) => api.post('/usuarios', data),
  approve: (id: number) => api.patch(`/usuarios/${id}`, { ativo: true }),
  reject: (id: number) => api.patch(`/usuarios/${id}`, { ativo: false }),
  updateTipo: (id: number, tipo: string) => api.patch(`/usuarios/${id}`, { tipo }),
  delete: (id: number) => api.delete(`/usuarios/${id}`),
}

export default api
