/**
 * Pricing Engine — Trends Solutions
 * Based on PRECOS spreadsheet analysis
 *
 * Margem vendedor: custo × 2.8 (180% markup)
 * Margem revenda:  custo × 2.1 (110% markup)
 * Buffer papel:    +5% sobre custo m²
 * Espaçamento:     +3mm automático na altura
 */

export type TipoMargem = 'vendedor' | 'revenda'

const MARGEM: Record<TipoMargem, number> = {
  vendedor: 2.8,
  revenda: 2.1,
}

const BUFFER_PAPEL = 0.05 // +5%
const ESPACAMENTO_MM = 3  // mm entre etiquetas

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

export interface CalcParams {
  largura_mm: number
  altura_mm: number    // WITHOUT +3mm — added automatically
  colunas: number
  quantidade: number
  preco_m2: number
  tipo_margem: TipoMargem
}

export interface CalcResult {
  altura_total_mm: number  // altura_mm + 3
  metros_por_mil: number   // linear meters of paper per 1000 labels
  m2_por_mil: number       // m² per 1000 labels
  m2_total: number         // total m² for the order
  custo_por_mil: number    // cost per 1000 labels
  desconto_pct: number     // e.g., 0.05 = 5%
  margem_fator: number     // 2.8 or 2.1
  preco_por_mil: number    // selling price per 1000 labels
  valor_total: number      // total order value
}

export function calcularItem(params: CalcParams): CalcResult {
  const { largura_mm, altura_mm, colunas, quantidade, preco_m2, tipo_margem } = params

  const altura_total_mm = altura_mm + ESPACAMENTO_MM
  // linear meters of paper for 1000 labels: (1000/cols) * height_mm / 1000
  const metros_por_mil = (altura_total_mm / colunas)
  // m² per 1000 labels: metros × (total_width_m) = metros × (cols × largura_mm / 1000)
  const m2_por_mil = metros_por_mil * (colunas * largura_mm) / 1_000
  const m2_total = m2_por_mil * quantidade / 1000

  const custo_por_mil = m2_por_mil * preco_m2 * (1 + BUFFER_PAPEL)
  const desconto_pct = getDesconto(quantidade)
  const margem_fator = MARGEM[tipo_margem]
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

export function getDescontoLabel(pct: number): string {
  if (pct === 0) return '—'
  return `-${(pct * 100).toFixed(0)}%`
}

export const DESCONTO_RANGES = DESCONTO_TABLE
