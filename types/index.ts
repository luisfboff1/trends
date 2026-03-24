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
  tabela_margem_id?: number
  tabela_margem_nome?: string // JOIN
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
  celular?: string
  endereco?: string
  bairro?: string
  cep?: string
  cidade?: string
  estado?: string
  vendedor_id: number
  vendedor_nome?: string  // JOIN
  ativo: boolean
  uniplus_id?: string
  uniplus_updated_at?: string
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
  nome_simplificado?: string
  descricao?: string
  fornecedor?: string
  preco_m2: number
  preco_m2_medio?: number
  pago?: number
  icms?: number
  ipi?: number
  frete?: number
  total?: number
  data_compra?: string
  ativo: boolean
  uniplus_id?: string
  uniplus_updated_at?: string
  created_at: string
  updated_at: string
}

export interface TipoPapelForm {
  nome: string
  nome_simplificado?: string
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

// ─── Fornecedores de Papel ──────────────────────────────────────────────────

export interface FornecedorPapel {
  id: number
  tipo_papel_id: number
  fornecedor: string
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

export interface FornecedorPapelForm {
  tipo_papel_id: number
  fornecedor: string
  preco_m2: number
  pago?: number
  icms?: number
  ipi?: number
  frete?: number
  total?: number
  data_compra?: string
}

// ─── Facas ──────────────────────────────────────────────────────────────────

export type TipoFaca = 'rotativa_160' | 'rotativa_250' | 'batida'

export interface Faca {
  id: number
  nome: string
  tipo: TipoFaca
  largura_mm: number
  altura_mm: number
  largura_papel_mm?: number
  colunas: number
  maquina?: string
  percentual_adicional: number
  velocidade_multiplicador: number
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface FacaForm {
  nome: string
  tipo: TipoFaca
  largura_mm: number
  altura_mm: number
  largura_papel_mm?: number
  colunas: number
  maquina?: string
  percentual_adicional?: number
  velocidade_multiplicador?: number
}

// ─── Cores Pantone ──────────────────────────────────────────────────────────

export interface CorPantone {
  id: number
  codigo: string
  nome?: string
  custo_m2: number
  percentual_hora_separacao: number
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface CorPantoneForm {
  codigo: string
  nome?: string
  custo_m2?: number
  percentual_hora_separacao?: number
}

// ─── Tubetes ────────────────────────────────────────────────────────────────

export interface Tubete {
  id: number
  diametro_mm: number
  descricao?: string
  custo_unidade: number
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface TubeteForm {
  diametro_mm: number
  descricao?: string
  custo_unidade: number
}

// ─── Acabamentos ────────────────────────────────────────────────────────────

export interface Acabamento {
  id: number
  nome: string
  percentual_adicional: number
  descricao?: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface AcabamentoForm {
  nome: string
  percentual_adicional: number
  descricao?: string
}

// ─── Condições de Pagamento ─────────────────────────────────────────────────

export interface CondicaoPagamento {
  id: number
  nome: string
  descricao?: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface CondicaoPagamentoForm {
  nome: string
  descricao?: string
}

// ─── Tabelas de Margem ──────────────────────────────────────────────────────

export interface FaixaMargem {
  id: number
  tabela_margem_id: number
  min_rolos: number
  max_rolos: number | null
  percentual: number
}

export interface TabelaMargem {
  id: number
  nome: string
  descricao?: string
  ativo: boolean
  faixas?: FaixaMargem[]
  vendedores_count?: number
  created_at: string
  updated_at: string
}

export interface FaixaMargemForm {
  min_rolos: number
  max_rolos?: number | null
  percentual: number
}

export interface TabelaMargemForm {
  nome: string
  descricao?: string
  faixas: FaixaMargemForm[]
}

// ─── Orçamentos ─────────────────────────────────────────────────────────────

export type TipoMargem = 'vendedor' | 'revenda'
export type TipoProduto = 'etiqueta' | 'rotulo' | 'tag'
export type CorTipo = 'branca' | 'pantone'
export type FreteTipo = 'automatico' | 'manual' | 'historico'
export type OrcamentoStatus = 'rascunho' | 'enviado' | 'aprovado' | 'convertido'

export interface ItemOrcamento {
  id: number
  orcamento_id: number
  tipo_produto: TipoProduto
  tipo_papel_id: number
  tipo_papel_nome?: string        // JOIN
  tipo_papel_preco_m2?: number    // JOIN
  faca_id?: number
  faca_nome?: string              // JOIN
  largura_mm: number
  altura_mm: number
  colunas: number
  cor_tipo: CorTipo
  cor_pantone_id?: number
  cor_pantone_codigo?: string     // JOIN
  tubete_id?: number
  tubete_diametro_mm?: number     // JOIN
  acabamentos_ids: number[]
  quantidade: number
  quantidade_por_rolo?: number
  quantidade_rolos?: number
  metragem_linear?: number
  imagem_url?: string
  observacoes?: string
  created_at: string
  // Calculated fields (not in DB — computed on display)
  calc?: ItemCalcResult
}

export interface ItemCalcResult {
  altura_total_mm: number
  metragem_por_rolo: number
  quantidade_por_rolo: number
  quantidade_real: number
  quantidade_rolos: number
  metragem_total: number
  m2_total: number
  custo_material: number
  custo_cor: number
  custo_tubetes: number
  custo_acabamentos: number
  custo_maquina: number
  custo_total: number
  margem_percentual: number
  preco_venda: number
  preco_unitario: number
  avisos: string[]
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
  condicao_pagamento_id?: number
  condicao_pagamento_nome?: string // JOIN
  frete_tipo: FreteTipo
  frete_valor: number
  frete_percentual: number
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
  condicao_pagamento_id?: number
  frete_tipo?: FreteTipo
  frete_valor?: number
  frete_percentual?: number
  observacoes?: string
  itens: ItemOrcamentoForm[]
}

export interface ItemOrcamentoForm {
  tipo_produto?: TipoProduto
  tipo_papel_id: number
  faca_id?: number
  largura_mm: number
  altura_mm: number
  colunas: number
  cor_tipo?: CorTipo
  cor_pantone_id?: number
  tubete_id?: number
  acabamentos_ids?: number[]
  quantidade: number
  quantidade_por_rolo?: number
  imagem_url?: string
  observacoes?: string
}

// ─── Histórico de Frete ─────────────────────────────────────────────────────

export interface HistoricoFrete {
  id: number
  cliente_id: number
  valor: number
  data: string
  orcamento_id?: number
  orcamento_numero?: string // JOIN
  created_at: string
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
  cliente_nome?: string
  vendedor_id: number
  vendedor_nome?: string       // JOIN
  status: PedidoStatus
  observacoes?: string
  valor_total?: number
  data_entrega?: string
  // Production fields
  ordem_fabricacao?: string
  material?: string
  codigo_faca?: string
  etiqueta_dimensao?: string
  quantidade?: number
  produzido_por?: string
  tipo_producao?: string
  ordem_compra?: string
  data_producao?: string
  mes_referencia?: string
  origem?: string
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
