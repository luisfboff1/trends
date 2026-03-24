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

// ── Fornecedores de Papel ─────────────────────────────────────────────────────
export const fornecedoresPapelService = {
  list: (tipoPapelId: number) => api.get(`/tipos-papel/${tipoPapelId}/fornecedores`),
  create: (tipoPapelId: number, data: unknown) => api.post(`/tipos-papel/${tipoPapelId}/fornecedores`, data),
  update: (tipoPapelId: number, fornecedorId: number, data: unknown) =>
    api.put(`/tipos-papel/${tipoPapelId}/fornecedores/${fornecedorId}`, data),
  delete: (tipoPapelId: number, fornecedorId: number) =>
    api.delete(`/tipos-papel/${tipoPapelId}/fornecedores/${fornecedorId}`),
}

// ── Facas ─────────────────────────────────────────────────────────────────────
export const facasService = {
  list: (tipo?: string) => api.get('/facas', { params: tipo ? { tipo } : {} }),
  get: (id: number) => api.get(`/facas/${id}`),
  create: (data: unknown) => api.post('/facas', data),
  update: (id: number, data: unknown) => api.put(`/facas/${id}`, data),
  delete: (id: number) => api.delete(`/facas/${id}`),
}

// ── Cores Pantone ─────────────────────────────────────────────────────────────
export const coresPantoneService = {
  list: () => api.get('/cores-pantone'),
  get: (id: number) => api.get(`/cores-pantone/${id}`),
  create: (data: unknown) => api.post('/cores-pantone', data),
  update: (id: number, data: unknown) => api.put(`/cores-pantone/${id}`, data),
  delete: (id: number) => api.delete(`/cores-pantone/${id}`),
}

// ── Tubetes ───────────────────────────────────────────────────────────────────
export const tubetesService = {
  list: () => api.get('/tubetes'),
  get: (id: number) => api.get(`/tubetes/${id}`),
  create: (data: unknown) => api.post('/tubetes', data),
  update: (id: number, data: unknown) => api.put(`/tubetes/${id}`, data),
  delete: (id: number) => api.delete(`/tubetes/${id}`),
}

// ── Acabamentos ───────────────────────────────────────────────────────────────
export const acabamentosService = {
  list: () => api.get('/acabamentos'),
  get: (id: number) => api.get(`/acabamentos/${id}`),
  create: (data: unknown) => api.post('/acabamentos', data),
  update: (id: number, data: unknown) => api.put(`/acabamentos/${id}`, data),
  delete: (id: number) => api.delete(`/acabamentos/${id}`),
}

// ── Condições de Pagamento ────────────────────────────────────────────────────
export const condicoesPagamentoService = {
  list: () => api.get('/condicoes-pagamento'),
  get: (id: number) => api.get(`/condicoes-pagamento/${id}`),
  create: (data: unknown) => api.post('/condicoes-pagamento', data),
  update: (id: number, data: unknown) => api.put(`/condicoes-pagamento/${id}`, data),
  delete: (id: number) => api.delete(`/condicoes-pagamento/${id}`),
}

// ── Tabelas de Margem ─────────────────────────────────────────────────────────
export const tabelasMargemService = {
  list: () => api.get('/tabelas-margem'),
  get: (id: number) => api.get(`/tabelas-margem/${id}`),
  create: (data: unknown) => api.post('/tabelas-margem', data),
  update: (id: number, data: unknown) => api.put(`/tabelas-margem/${id}`, data),
  delete: (id: number) => api.delete(`/tabelas-margem/${id}`),
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
  calcular: (id: number, data: unknown) => api.post(`/orcamentos/${id}/calcular`, data),
}

// ── Histórico de Frete ────────────────────────────────────────────────────────
export const historicoFreteService = {
  list: (clienteId: number) => api.get(`/historico-frete/${clienteId}`),
}

// ── Pedidos ───────────────────────────────────────────────────────────────────
export const pedidosService = {
  list: (params?: { page?: number; limit?: number; status?: string; origem?: string; exclude_origem?: string; tipo_producao?: string; material?: string; cliente?: string; mes?: string; ano?: string; mes_num?: string }) =>
    api.get('/pedidos', { params }),
  get: (id: number) => api.get(`/pedidos/${id}`),
  update: (id: number, data: unknown) => api.put(`/pedidos/${id}`, data),
  import: (records: unknown[], clearPrevious?: boolean) =>
    api.post('/pedidos/import', { records, clearPrevious }),
  clearImport: () => api.delete('/pedidos/import'),
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardService = {
  get: () => api.get('/dashboard'),
  charts: () => api.get('/dashboard-charts'),
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
  updateTabelaMargem: (id: number, tabela_margem_id: number) =>
    api.patch(`/usuarios/${id}`, { tabela_margem_id }),
  delete: (id: number) => api.delete(`/usuarios/${id}`),
}

// ── UniPlus ERP ───────────────────────────────────────────────────────────────
export const uniplusService = {
  getConfig: () => api.get('/uniplus/config'),
  saveConfig: (data: { server_url: string; auth_code: string; user_id: string; user_password: string }) =>
    api.post('/uniplus/config', data),
  testConnection: (data: { server_url: string; auth_code: string; user_id: string; user_password: string }) =>
    api.post('/uniplus/config?test=true', data),
  sync: (tipo: 'full' | 'clientes' | 'produtos' | 'condicoes_pagamento' | 'vendas' | 'vendedores') =>
    api.post('/uniplus/sync', { tipo, direcao: 'import' }),
  getStatus: () => api.get('/uniplus/status'),
  exportRecord: (tipo: 'cliente' | 'orcamento' | 'pedido', id: number) =>
    api.post('/uniplus/export', { tipo, id }),
  browse: (tipo: 'entidades' | 'produtos' | 'vendas', limit = 50, offset = 0) =>
    api.get('/uniplus/browse', { params: { tipo, limit, offset } }),
}

export default api
