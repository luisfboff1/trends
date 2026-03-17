/**
 * Pricing Engine — Trends Solutions
 *
 * New system (Fase 1):
 * - Margem por tabela configurável no banco (por quantidade de ROLOS)
 * - Metragem linear: (altura + 3mm) / 1000 × quantidade_por_rolo
 * - Arredondamento: CEIL(qtd_desejada / qtd_por_rolo) — nunca para baixo
 * - Custos: material + cor Pantone + tubete + máquina + acabamentos
 * - Buffer papel: +5% sobre custo m²
 * - Espaçamento: +3mm automático na altura
 *
 * Legacy support: calcularItemLegacy() mantém cálculo antigo para orçamentos existentes
 */

import type { ItemCalcResult, FaixaMargem } from '@/types'

// ─── Constants ──────────────────────────────────────────────────────────────

const BUFFER_PAPEL = 0.05        // +5% wastage
const ESPACAMENTO_ALTURA_MM = 3  // mm entre etiquetas (vertical)
const ESPACAMENTO_LARGURA_MM = 5 // mm entre colunas (horizontal) — gap entre etiquetas lado a lado
const METRAGEM_IDEAL_MIN = 40    // metros mínimo ideal por rolo
const METRAGEM_IDEAL_MAX = 46    // metros máximo ideal por rolo
const MINIMO_ROLOS = 4           // mínimo recomendado de rolos

// ─── Fallback margens fixas (usado enquanto vendedor não tem tabela) ────────

export type TipoMargem = 'vendedor' | 'revenda'

const MARGEM_FALLBACK: Record<TipoMargem, number> = {
  vendedor: 2.8,
  revenda: 2.1,
}

// ─── Legacy discount table (mantida para compatibilidade) ──────────────────

const DESCONTO_TABLE: Array<{ min: number; max: number; pct: number }> = [
  { min: 1,       max: 4_999,     pct: 0 },
  { min: 5_000,   max: 9_999,     pct: 0.02 },
  { min: 10_000,  max: 14_999,    pct: 0.03 },
  { min: 15_000,  max: 19_999,    pct: 0.04 },
  { min: 20_000,  max: 49_999,    pct: 0.05 },
  { min: 50_000,  max: 99_999,    pct: 0.10 },
  { min: 100_000, max: 199_999,   pct: 0.15 },
  { min: 200_000, max: 299_999,   pct: 0.20 },
  { min: 300_000, max: 499_999,   pct: 0.25 },
  { min: 500_000, max: Infinity,  pct: 0.28 },
]

export function getDesconto(quantidade: number): number {
  const entry = DESCONTO_TABLE.find(d => quantidade >= d.min && quantidade <= d.max)
  return entry?.pct ?? 0
}

export function getDescontoLabel(pct: number): string {
  if (pct === 0) return '—'
  return `-${(pct * 100).toFixed(0)}%`
}

export const DESCONTO_RANGES = DESCONTO_TABLE

// ─── New Pricing Engine ─────────────────────────────────────────────────────

export interface CalcItemParams {
  // From faca (or manual input)
  largura_mm: number
  altura_mm: number
  colunas: number
  // Paper
  preco_m2: number
  // Quantity
  quantidade_desejada: number
  quantidade_por_rolo?: number   // if known; otherwise will calculate
  // Color
  cor_tipo: 'branca' | 'pantone'
  cor_custo_m2?: number          // custo adicional por m² da cor (default 0.30)
  cor_percentual_separacao?: number // % hora separação
  // Tubete
  tubete_custo_unidade?: number
  // Machine / faca type
  velocidade_multiplicador?: number
  percentual_adicional_faca?: number
  // Acabamentos (array de percentuais)
  acabamentos_percentuais?: number[]
  // Margin (from tabela_margem)
  faixas_margem?: FaixaMargem[]
  tipo_margem_fallback?: TipoMargem  // usado se não tem tabela
}

/**
 * Busca o percentual de margem aplicável para a quantidade de rolos dada
 */
export function buscarMargemPorRolos(faixas: FaixaMargem[], rolos: number): number {
  for (const faixa of faixas) {
    const inMin = rolos >= faixa.min_rolos
    const inMax = faixa.max_rolos === null || rolos <= faixa.max_rolos
    if (inMin && inMax) return faixa.percentual
  }
  // Se nenhuma faixa encontrada, usar a última (maior)
  if (faixas.length > 0) return faixas[faixas.length - 1].percentual
  return 180 // fallback
}

/**
 * Calcula todos os valores de um item de orçamento
 */
export function calcularItem(params: CalcItemParams): ItemCalcResult {
  const {
    largura_mm,
    altura_mm,
    colunas,
    preco_m2,
    quantidade_desejada,
    cor_tipo,
    cor_custo_m2 = 0.30,
    cor_percentual_separacao = 0,
    tubete_custo_unidade = 0,
    velocidade_multiplicador = 1.0,
    percentual_adicional_faca = 0,
    acabamentos_percentuais = [],
    faixas_margem,
    tipo_margem_fallback = 'vendedor',
  } = params

  const avisos: string[] = []

  // 1. Altura total com espaçamento automático
  const altura_total_mm = altura_mm + ESPACAMENTO_ALTURA_MM

  // 2. Metragem linear por rolo
  // Padrão: se não fornecido, calcular quantidade por rolo para ~40m de metragem
  let quantidade_por_rolo = params.quantidade_por_rolo ?? 0
  if (quantidade_por_rolo <= 0) {
    // Calcular quantidade ideal por rolo (~40m)
    const metros_por_etiqueta = altura_total_mm / 1000 / colunas
    quantidade_por_rolo = Math.floor(METRAGEM_IDEAL_MIN / metros_por_etiqueta)
    if (quantidade_por_rolo < 1) quantidade_por_rolo = 1
  }

  const metragem_por_rolo = (altura_total_mm / 1000) * (quantidade_por_rolo / colunas)

  // Aviso metragem fora do ideal
  if (metragem_por_rolo > METRAGEM_IDEAL_MAX) {
    avisos.push(`Metragem por rolo (${metragem_por_rolo.toFixed(2)}m) acima do ideal (${METRAGEM_IDEAL_MAX}m)`)
  }

  // 3. Arredondamento: CEIL para múltiplo do rolo (nunca para baixo)
  const quantidade_rolos = Math.max(1, Math.ceil(quantidade_desejada / quantidade_por_rolo))
  const quantidade_real = quantidade_rolos * quantidade_por_rolo

  // Aviso mínimo de rolos
  if (quantidade_rolos < MINIMO_ROLOS) {
    avisos.push(`Abaixo do mínimo recomendado de ${MINIMO_ROLOS} rolos (${quantidade_rolos} rolos)`)
  }

  // 4. Metragem total e m² total
  const metragem_total = metragem_por_rolo * quantidade_rolos
  // Largura total do papel = colunas × (largura etiqueta + gap) - gap_último
  const largura_total_mm = colunas * (largura_mm + ESPACAMENTO_LARGURA_MM) - ESPACAMENTO_LARGURA_MM
  const m2_total = (largura_total_mm / 1000) * metragem_total

  // 5. Custo base material (papel + buffer)
  const custo_material = m2_total * preco_m2 * (1 + BUFFER_PAPEL)

  // 6. Custo cor Pantone
  let custo_cor = 0
  if (cor_tipo === 'pantone') {
    custo_cor = m2_total * cor_custo_m2
    // Hora de separação: % sobre custo material
    custo_cor += custo_material * (cor_percentual_separacao / 100)
  }

  // 7. Custo tubetes
  const custo_tubetes = tubete_custo_unidade * quantidade_rolos

  // 8. Custo máquina (multiplicador de velocidade + % adicional da faca)
  const custo_base_producao = custo_material + custo_cor
  const custo_maquina = custo_base_producao * (velocidade_multiplicador - 1) +
    custo_base_producao * (percentual_adicional_faca / 100)

  // 9. Subtotal antes de acabamentos
  let custo_total = custo_material + custo_cor + custo_tubetes + custo_maquina

  // 10. Acabamentos: cada um adiciona % ao custo total
  let custo_acabamentos = 0
  for (const pct of acabamentos_percentuais) {
    custo_acabamentos += custo_total * (pct / 100)
  }
  custo_total += custo_acabamentos

  // 11. Margem (por quantidade de rolos)
  let margem_percentual: number
  if (faixas_margem && faixas_margem.length > 0) {
    margem_percentual = buscarMargemPorRolos(faixas_margem, quantidade_rolos)
  } else {
    // Fallback para margens fixas (vendedor ou revenda)
    margem_percentual = (MARGEM_FALLBACK[tipo_margem_fallback] - 1) * 100
  }

  // Preço de venda = custo × (1 + margem/100)
  const preco_venda = custo_total * (1 + margem_percentual / 100)

  // Preço unitário por etiqueta
  const preco_unitario = quantidade_real > 0 ? preco_venda / quantidade_real : 0

  return {
    altura_total_mm,
    metragem_por_rolo,
    quantidade_por_rolo,
    quantidade_real,
    quantidade_rolos,
    metragem_total,
    m2_total,
    custo_material,
    custo_cor,
    custo_tubetes,
    custo_acabamentos,
    custo_maquina,
    custo_total,
    margem_percentual,
    preco_venda,
    preco_unitario,
    avisos,
  }
}

/**
 * Calcula múltiplas opções de quantidade para o mesmo item
 * (vendedor escolhe quais quantidades apresentar no PDF)
 */
export function calcularMultiplasQuantidades(
  baseParams: Omit<CalcItemParams, 'quantidade_desejada'>,
  quantidades: number[],
): ItemCalcResult[] {
  return quantidades.map(qtd =>
    calcularItem({ ...baseParams, quantidade_desejada: qtd })
  )
}

// ─── Legacy support ─────────────────────────────────────────────────────────

export interface LegacyCalcParams {
  largura_mm: number
  altura_mm: number
  colunas: number
  quantidade: number
  preco_m2: number
  tipo_margem: TipoMargem
}

export interface LegacyCalcResult {
  altura_total_mm: number
  metros_por_mil: number
  m2_por_mil: number
  m2_total: number
  custo_por_mil: number
  desconto_pct: number
  margem_fator: number
  preco_por_mil: number
  valor_total: number
}

export function calcularItemLegacy(params: LegacyCalcParams): LegacyCalcResult {
  const { largura_mm, altura_mm, colunas, quantidade, preco_m2, tipo_margem } = params

  const altura_total_mm = altura_mm + ESPACAMENTO_ALTURA_MM
  const metros_por_mil = (altura_total_mm / colunas)
  const m2_por_mil = metros_por_mil * (colunas * largura_mm) / 1_000
  const m2_total = m2_por_mil * quantidade / 1000

  const custo_por_mil = m2_por_mil * preco_m2 * (1 + BUFFER_PAPEL)
  const desconto_pct = getDesconto(quantidade)
  const margem_fator = MARGEM_FALLBACK[tipo_margem]
  const preco_por_mil = custo_por_mil * margem_fator * (1 - desconto_pct)
  const valor_total = preco_por_mil * quantidade / 1000

  return {
    altura_total_mm,
    metros_por_mil,
    m2_por_mil,
    m2_total,
    custo_por_mil,
    desconto_pct,
    margem_fator,
    preco_por_mil,
    valor_total,
  }
}
