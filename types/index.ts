// ─── Domain Types — Trends Solutions ───────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ─── Usuarios ───────────────────────────────────────────────────────────────

export interface Usuario {
  id: number
  nome: string
  email: string
  tipo: 'admin' | 'vendedor'
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface UsuarioForm {
  nome: string
  email: string
  senha: string
  tipo: 'admin' | 'vendedor'
}

// ─── Clientes ───────────────────────────────────────────────────────────────

export interface Cliente {
  id: number
  razao_social: string
  cnpj: string
  email?: string
  telefone?: string
  endereco?: string
  cidade?: string
  estado?: string
  vendedor_id: number
  vendedor_nome?: string  // JOIN
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface ClienteForm {
  razao_social: string
  cnpj: string
  email?: string
  telefone?: string
  endereco?: string
  cidade?: string
  estado?: string
  vendedor_id: number
}

// ─── Tipos de Papel ─────────────────────────────────────────────────────────

export interface TipoPapel {
  id: number
  nome: string
  descricao?: string
  fornecedor?: string
  preco_m2: number
  pago?: number
  icms?: number
  ipi?: number
  frete?: number
  total?: number
  data_compra?: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface TipoPapelForm {
  nome: string
  descricao?: string
  fornecedor?: string
  preco_m2: number
  pago?: number
  icms?: number
  ipi?: number
  frete?: number
  total?: number
  data_compra?: string
}

// ─── Orçamentos ─────────────────────────────────────────────────────────────

export type TipoMargem = 'vendedor' | 'revenda'
export type OrcamentoStatus = 'rascunho' | 'enviado' | 'aprovado' | 'convertido'

export interface ItemOrcamento {
  id: number
  orcamento_id: number
  tipo_papel_id: number
  tipo_papel_nome?: string   // JOIN
  tipo_papel_preco_m2?: number // JOIN — current price
  largura_mm: number
  altura_mm: number
  colunas: number
  quantidade: number
  imagem_url?: string
  observacoes?: string
  created_at: string
  // Calculated fields (not in DB — computed on display)
  calc?: {
    altura_total_mm: number
    m2_por_mil: number
    m2_total: number
    custo_por_mil: number
    desconto_pct: number
    preco_por_mil: number
    valor_total: number
  }
}

export interface Orcamento {
  id: number
  numero: string
  cliente_id: number
  cliente_razao_social?: string   // JOIN
  cliente_cnpj?: string           // JOIN
  vendedor_id: number
  vendedor_nome?: string          // JOIN
  tipo_margem: TipoMargem
  status: OrcamentoStatus
  observacoes?: string
  valor_total?: number
  itens?: ItemOrcamento[]
  created_at: string
  updated_at: string
}

export interface OrcamentoForm {
  cliente_id: number
  tipo_margem: TipoMargem
  status: OrcamentoStatus
  observacoes?: string
  itens: ItemOrcamentoForm[]
}

export interface ItemOrcamentoForm {
  tipo_papel_id: number
  largura_mm: number
  altura_mm: number
  colunas: number
  quantidade: number
  imagem_url?: string
  observacoes?: string
}

// ─── Pedidos ────────────────────────────────────────────────────────────────

export type PedidoStatus = 'pendente' | 'producao' | 'entregue' | 'cancelado'

export interface Pedido {
  id: number
  numero: string
  orcamento_id: number
  orcamento_numero?: string   // JOIN
  cliente_id: number
  cliente_razao_social?: string // JOIN
  vendedor_id: number
  vendedor_nome?: string       // JOIN
  status: PedidoStatus
  observacoes?: string
  valor_total?: number
  data_entrega?: string
  created_at: string
  updated_at: string
}

// ─── Session Extension ──────────────────────────────────────────────────────

declare module 'next-auth' {
  interface User {
    id: string
    tipo: string
  }
  interface Session {
    user: {
      id: string
      name: string
      email: string
      tipo: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    tipo: string
  }
}
