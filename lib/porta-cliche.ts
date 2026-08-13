/**
 * Porta Clichê — cálculo de Z (número de dentes) e espaçamento real por faca.
 *
 * Reverso-projetado a partir do sistema "Calcula Melhor opção Porta Clichês"
 * (CalculosFlexo.jar) usado na produção. Fórmula e limiares de qualidade
 * confirmados batendo 71 valores reais (Z 30–100, altura 40mm e 50mm, 1/8CP)
 * e cruzados com as constantes numéricas achadas no bytecode da classe
 * `com.flexonews.calcula.calculaPC`.
 *
 * IMPORTANTE: só 1/8CP está confirmado. M1 e Helicoidal 20° Módulo 1 usam a
 * fórmula padrão de engrenagem (circular pitch = π × módulo, ajustado pelo
 * ângulo no caso helicoidal) como hipótese — as constantes π=3.14159 e
 * 20°=0.3490658503988659rad apareceram no bytecode ao lado da constante
 * confirmada 3.175 (1/8CP), mas nunca testamos contra um valor real de
 * Montagem/Espaçamento pra M1 ou Helicoidal. Não usar essas duas em produção
 * sem confirmar antes. Ver Docs/BUGS.md.
 */

export type TipoEngrenagem = 'M1' | '1/8CP' | 'HELICOIDAL_20_M1'

export const ENGRENAGENS_CONFIRMADAS: TipoEngrenagem[] = ['1/8CP']

const GRAUS_HELICOIDAL = 20
const RAD_HELICOIDAL = (GRAUS_HELICOIDAL * Math.PI) / 180 // = 0.3490658503988659, achado no bytecode

/** Passo circular (mm) por dente, por tipo de engrenagem. */
const PASSO_MM: Record<TipoEngrenagem, number> = {
  '1/8CP': 3.175, // 1/8 polegada — CONFIRMADO (71/71 valores reais batendo)
  'M1': Math.PI, // módulo 1mm × π — HIPÓTESE, não confirmado
  'HELICOIDAL_20_M1': Math.PI / Math.cos(RAD_HELICOIDAL), // HIPÓTESE, não confirmado
}

export interface OpcaoZ {
  z: number
  montagem: number
  espacamento: number
  qualidade: 'pequeno' | 'aceitavel' | 'bom' | 'grande'
  qualidadeLabel: string
}

/** Classifica o espaçamento — limiares confirmados no bytecode (2.0 / 2.5 / 4.0). */
export function classificarEspacamento(espacamento: number): { qualidade: OpcaoZ['qualidade']; label: string } {
  if (espacamento < 2.0) return { qualidade: 'pequeno', label: 'Espaçamento pequeno' }
  if (espacamento < 2.5) return { qualidade: 'aceitavel', label: 'ACEITÁVEL' }
  if (espacamento < 4.0) return { qualidade: 'bom', label: 'BOM' }
  return { qualidade: 'grande', label: 'Espaçamento grande' }
}

/**
 * Calcula Montagem e Espaçamento pra um Z específico, dada a altura da etiqueta.
 * circunferência = Z × passo
 * montagem = quantas vezes a etiqueta repete inteira ao redor da faca
 * espaçamento = folga distribuída igualmente entre as `montagem` repetições
 */
export function calcularZ(z: number, alturaEtiquetaMm: number, tipoEngrenagem: TipoEngrenagem): OpcaoZ {
  const passo = PASSO_MM[tipoEngrenagem]
  const circunferencia = z * passo
  const montagem = Math.max(1, Math.floor(circunferencia / alturaEtiquetaMm))
  const espacamento = circunferencia / montagem - alturaEtiquetaMm
  const { qualidade, label } = classificarEspacamento(espacamento)
  return { z, montagem, espacamento, qualidade, qualidadeLabel: label }
}

/** Varre uma faixa de Z e retorna todas as opções, igual à tela "Calcula Melhor opção Porta Clichês". */
export function buscarOpcoesZ(
  alturaEtiquetaMm: number,
  tipoEngrenagem: TipoEngrenagem,
  zMin = 30,
  zMax = 100,
): OpcaoZ[] {
  const opcoes: OpcaoZ[] = []
  for (let z = zMin; z <= zMax; z++) opcoes.push(calcularZ(z, alturaEtiquetaMm, tipoEngrenagem))
  return opcoes
}

/** Espaçamento de uma faca já cadastrada (Z + engrenagem fixos), pra usar no motor de precificação. */
export function espacamentoDaFaca(
  numeroDentes: number | null | undefined,
  tipoEngrenagem: string | null | undefined,
  alturaEtiquetaMm: number,
): number | null {
  if (!numeroDentes || !tipoEngrenagem) return null
  if (!ENGRENAGENS_CONFIRMADAS.includes(tipoEngrenagem as TipoEngrenagem)) return null
  return calcularZ(numeroDentes, alturaEtiquetaMm, tipoEngrenagem as TipoEngrenagem).espacamento
}
