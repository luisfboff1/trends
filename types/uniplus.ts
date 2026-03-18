// ─── UniPlus ERP Integration Types ──────────────────────────────────────────

// ─── API Response Types (from Yoda server) ──────────────────────────────────

export interface UniplusEntidade {
  identificacao: string        // "CL"
  tabela: string               // "entidade"
  descricaoLayout: string
  codigo: string               // chave primária no UniPlus
  nome: string
  razaoSocial: string
  cnpjCpf: string
  inscricaoEstadual: string
  rg: string
  endereco: string
  numeroEndereco: string
  complemento: string
  bairro: string
  cep: string
  telefone: string
  celular: string
  fax: string
  email: string
  limiteCredito: string
  nomeContato: string
  estadoCivil: number
  conjuge: string
  pai: string
  mae: string
  profissao: string
  renda: string
  tipo: string                 // "1" = cliente, "4" = vendedor
  observacao: string
  cidade: string
  estado: string
  contatoEntrega: string
  cepEntrega: string
  estadoEntrega: string
  cidadeEntrega: string
  enderecoEntrega: string
  numeroEntrega: string
  complementoEntrega: string
  bairroEntrega: string
  telefoneEntrega: string
  celularEntrega: string
  faxEntrega: string
  emailEntrega: string
  inativo: number              // 0 = ativo, 1 = inativo
  contatoCobranca: string
  cepCobranca: string
  estadoCobranca: string
  cidadeCobranca: string
  enderecoCobranca: string
  numeroCobranca: string
  complementoCobranca: string
  bairroCobranca: string
  telefoneCobranca: string
  celularCobranca: string
  emailCobranca: string
  extra1: string
  extra2: string
  extra3: string
  extra4: string
  extra5: string
  extra6: string
  cliente: number              // 1 = é cliente
  fornecedor: number           // 1 = é fornecedor
  creditoRestrito: number
  pautaPreco: number
  codigoCondicaoPagamento: string
  currentTimeMillis: number
  tipoPessoa: string           // "J" = jurídica, "F" = física
  codigoVendedor: string
  nomeVendedor: string
  codigoVendedor2: string
  nomeVendedor2: string
  codigoVendedor3: string
  nomeVendedor3: string
}

export interface UniplusProduto {
  identificacao: string        // "PR"
  tabela: string               // "produto"
  descricaoLayout: string
  codigo: string
  referencia: string
  ean: string
  inativo: number
  nome: string
  codigoFornecedor: string
  unidadeMedida: string
  lucroBruto: string
  preco: string
  peso: string
  numeroSerie: number
  tributacaoICMS: string
  aliquotaIPI: string
  situacaoTributaria: string
  custo: string
  iat: string
  ippt: string
  origem: number
  nomeGrupoProduto: string
  nomeFornecedor: string
  caminhoImagem: string
  aliquotaICMS: string
  tributacaoEspecial: string
  casasDecimais: string
  codigoGrupoProduto: string
  pesavel: number
  tipoProduto: string
  observacao: string
  precoPauta1: string
  precoPauta2: string
  precoPauta3: string
  precoPauta4: string
  ncm: string
  situacaoTributariaSN: string
  cstPisCofins: string
  aliquotaPis: string
  aliquotaCofins: string
  cest: string
  informacaoAdicional: string
  tributacaoSN: string
  custoMedioInicial: string
  enviarECommerce: number
  nomeEcf: string
  descricaoShop: string
  infoShop: string
  codigoFabricante: string
  pesoShop: string
  alturaShop: string
  larguraShop: string
  comprimentoShop: string
  tipoEmbalagemShop: number
  extra1: string
  extra2: string
  extra3: string
  extra4: string
  extra5: string
  extra6: string
  currentTimeMillis: number
  precos: UniplusProdutoPreco[]
  atributos: unknown[]
  tags: unknown[]
  imagens: unknown[]
  tipoVolume: number
  quantidadeVolume: number
  possuiVariacao: number
  possuiLote: number
  kit: number
  dataUltimaVenda: string
}

export interface UniplusProdutoPreco {
  identificacao: string
  tabela: string
  descricaoLayout: string
  filial: number
  preco: number
}

export interface UniplusVenda {
  identificacao: string        // "UND"
  tabela: string               // "vendas_cabecalho_view"
  descricaoLayout: string
  idVenda: number
  documento: string
  pdv: number
  codigoCliente: string
  nomeCliente: string
  nomeVendedor: string
  emissao: string              // "2019-01-14"
  dataHoraEmissao: string      // "2019-01-14T11:15:00"
  valorProdutos: string
  valorTotal: string
  desconto: string
  codigoFilial: number
  status: number
}

export interface UniplusVendaItem {
  idVenda: number
  codigoProduto: string
  descricaoProduto: string
  quantidade: number
  valorUnitario: string
  valorTotal: string
}

export interface UniplusCondicaoPagamento {
  id: string
  nome: string
  descricao: string
}

// ─── Internal Config & Sync Types ───────────────────────────────────────────

export interface UniplusConfig {
  id: number
  server_url: string
  auth_code: string
  user_id: string
  user_password: string
  ativo: boolean
  last_sync_at: string | null
  created_at: string
  updated_at: string
}

export interface UniplusSyncLog {
  id: number
  tipo: SyncTipo
  direcao: SyncDirection
  status: SyncStatus
  total_registros: number
  registros_criados: number
  registros_atualizados: number
  registros_erros: number
  erros: SyncError[] | null
  iniciado_por: number
  started_at: string
  finished_at: string | null
}

export interface UniplusToken {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
  jti: string
  obtained_at: number        // Date.now() when token was fetched
}

export interface SyncError {
  codigo: string
  campo?: string
  mensagem: string
}

export interface SyncResult {
  tipo: SyncTipo
  direcao: SyncDirection
  status: SyncStatus
  total_registros: number
  registros_criados: number
  registros_atualizados: number
  registros_erros: number
  erros: SyncError[]
}

export type SyncTipo = 'clientes' | 'produtos' | 'condicoes_pagamento' | 'vendas' | 'vendedores' | 'full'
export type SyncDirection = 'import' | 'export'
export type SyncStatus = 'running' | 'success' | 'error' | 'partial'
