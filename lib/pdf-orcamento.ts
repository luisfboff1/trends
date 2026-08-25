import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface PdfItemOption {
  quantidade: number
  quantidade_rolos?: number
  metragem_por_rolo?: number
  preco_unitario?: number
  preco_venda?: number
}

export interface PdfItem {
  faca_nome?: string
  tipo_produto?: string
  tipo_papel_nome: string
  largura_mm: number
  altura_mm: number
  colunas: number
  quantidade: number
  preco_m2?: number
  cor_nome?: string
  tubete_nome?: string
  acabamentos_nomes?: string[]
  observacoes?: string
  quantidade_rolos?: number
  metragem_por_rolo?: number
  preco_venda?: number
  preco_unitario?: number
  opcoes?: PdfItemOption[]
}

export interface PdfOrcamentoOptions {
  numero: string
  data: string
  status: string
  tipo_margem: string
  observacoes?: string
  valor_total: number
  frete_valor?: number
  frete_tipo?: string
  condicao_pagamento_nome?: string
  cliente: {
    razao_social: string
    cnpj: string
    email?: string
    telefone?: string
    endereco?: string
    cidade?: string
    estado?: string
  }
  vendedor?: string
  itens: PdfItem[]
}

const RED = [221, 38, 32] as const    // #dd2620
const BLACK = [0, 0, 0] as const
const GRAY = [96, 96, 96] as const
const LIGHT = [245, 245, 245] as const
const WHITE = [255, 255, 255] as const

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatCNPJ(cnpj: string) {
  const c = (cnpj || '').replace(/\D/g, '')
  if (c.length !== 14) return cnpj || '—'
  return `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12)}`
}

async function loadImageAsBase64(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    const { w, h } = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image()
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
      img.onerror = () => resolve({ w: 1, h: 1 })
      img.src = data
    })
    return { data, w, h }
  } catch {
    return null
  }
}

export async function gerarPdfOrcamento(opts: PdfOrcamentoOptions): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14
  let y = margin

  // ── Logo ────────────────────────────────────────────────────────────────────
  const logo = await loadImageAsBase64('/logo-sem-fundo.png')
  if (logo) {
    const maxW = 50
    const maxH = 18
    const ratio = Math.min(maxW / logo.w, maxH / logo.h)
    const imgW = logo.w * ratio
    const imgH = logo.h * ratio
    doc.addImage(logo.data, 'PNG', margin, y, imgW, imgH)
  } else {
    // Fallback: text logo
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.setTextColor(...RED)
    doc.text('Trends', margin, y + 10)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text('Soluções em Etiquetas', margin + 27, y + 10)
  }

  // ── Header right: document info ─────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...BLACK)
  doc.text('ORÇAMENTO', pageW - margin, y + 4, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text(`Nº ${opts.numero}`, pageW - margin, y + 10, { align: 'right' })
  doc.text(`Data: ${opts.data}`, pageW - margin, y + 15, { align: 'right' })
  doc.text(`Status: ${(opts.status || 'rascunho').toUpperCase()}`, pageW - margin, y + 20, { align: 'right' })

  y += 24

  // ── Red divider ─────────────────────────────────────────────────────────────
  doc.setDrawColor(...RED)
  doc.setLineWidth(0.6)
  doc.line(margin, y, pageW - margin, y)
  y += 6

  // ── Cliente ──────────────────────────────────────────────────────────────────
  const colMid = pageW / 2

  doc.setFillColor(...LIGHT)
  doc.setDrawColor(...LIGHT)
  doc.roundedRect(margin, y, pageW - margin * 2, 28, 2, 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...RED)
  doc.text('CLIENTE', margin + 4, y + 5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...BLACK)
  doc.text(opts.cliente.razao_social || 'Cliente não identificado', margin + 4, y + 11)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text(`CNPJ: ${formatCNPJ(opts.cliente.cnpj)}`, margin + 4, y + 17)

  const clienteRight: string[] = []
  if (opts.cliente.email) clienteRight.push(opts.cliente.email)
  if (opts.cliente.telefone) clienteRight.push(opts.cliente.telefone)
  if (opts.cliente.cidade && opts.cliente.estado)
    clienteRight.push(`${opts.cliente.cidade} / ${opts.cliente.estado}`)

  clienteRight.forEach((line, i) => {
    doc.text(line, colMid, y + 11 + i * 5, { align: 'left' })
  })

  if (opts.vendedor) {
    doc.setTextColor(...GRAY)
    doc.text(`Vendedor: ${opts.vendedor}`, margin + 4, y + 23)
  }

  y += 34

  // ── Itens table ──────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...RED)
  doc.text('ITENS E OPÇÕES DO ORÇAMENTO', margin, y)
  y += 4

  const rows: any[][] = []

  opts.itens.forEach((item, itemIdx) => {
    const itemPrefix = opts.itens.length > 1 ? `Item ${itemIdx + 1}: ` : ''
    const itemTitle = item.faca_nome ? `${itemPrefix}${item.faca_nome}` : `${itemPrefix}${item.tipo_papel_nome}`

    const details: string[] = [item.tipo_papel_nome]
    if (item.cor_nome) details.push(`Cor: ${item.cor_nome}`)
    if (item.tubete_nome) details.push(`Tubete: ${item.tubete_nome}`)
    if (item.acabamentos_nomes && item.acabamentos_nomes.length > 0) {
      details.push(`Acabamentos: ${item.acabamentos_nomes.join(', ')}`)
    }
    if (item.observacoes) details.push(`Obs: ${item.observacoes}`)

    const specFull = `${itemTitle}\n${details.join(' | ')}`
    const dimStr = `${item.largura_mm} × ${item.altura_mm} mm\n(${item.colunas} col)`

    const opcoes = item.opcoes && item.opcoes.length > 0
      ? item.opcoes
      : [{
          quantidade: item.quantidade,
          quantidade_rolos: item.quantidade_rolos,
          metragem_por_rolo: item.metragem_por_rolo,
          preco_unitario: item.preco_unitario,
          preco_venda: item.preco_venda,
        }]

    opcoes.forEach((op, opIdx) => {
      const isMultiOp = opcoes.length > 1
      const opLabel = isMultiOp ? ` [Opção ${opIdx + 1}]` : ''
      const specCell = opIdx === 0
        ? specFull
        : `↳ Opção ${opIdx + 1} (${itemTitle})`

      const rolosText = op.quantidade_rolos != null
        ? `${op.quantidade_rolos} ${op.quantidade_rolos === 1 ? 'rolo' : 'rolos'}`
        : '—'

      const metragemText = op.metragem_por_rolo != null
        ? `${Number(op.metragem_por_rolo).toFixed(1)} m`
        : '—'

      const precoUnitText = op.preco_unitario != null
        ? formatCurrency(op.preco_unitario)
        : '—'

      const precoVendaText = op.preco_venda != null
        ? formatCurrency(op.preco_venda)
        : '—'

      rows.push([
        specCell,
        dimStr,
        `${op.quantidade.toLocaleString('pt-BR')} un`,
        rolosText,
        metragemText,
        precoUnitText,
        precoVendaText,
      ])
    })
  })

  autoTable(doc, {
    startY: y,
    head: [['Item / Material', 'Dimensões', 'Qtd (un)', 'Rolos', 'Metragem', 'Preço/unid', 'Total']],
    body: rows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: {
      fillColor: [RED[0], RED[1], RED[2]],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [LIGHT[0], LIGHT[1], LIGHT[2]] },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 26, halign: 'center' },
      2: { cellWidth: 20, halign: 'right' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 24, halign: 'right' },
      6: { cellWidth: 26, halign: 'right' },
    },
    didDrawPage: (data) => {
      // Page number footer
      const pageCount = (doc.internal as any).getNumberOfPages()
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...GRAY)
      doc.text(
        `Página ${data.pageNumber} de ${pageCount}`,
        pageW / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      )
    },
  })

  const afterTable = (doc as any).lastAutoTable.finalY + 6

  // ── Total box ────────────────────────────────────────────────────────────────
  const boxW = 86
  const boxX = pageW - margin - boxW
  let boxY = afterTable

  if (opts.frete_valor && opts.frete_valor > 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text(`Frete: ${formatCurrency(opts.frete_valor)}`, boxX + 4, boxY + 5)
    boxY += 8
  }

  doc.setFillColor(RED[0], RED[1], RED[2])
  doc.roundedRect(boxX, boxY, boxW, 12, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...WHITE)
  doc.text('TOTAL BASE', boxX + 4, boxY + 8)
  doc.text(formatCurrency(opts.valor_total), boxX + boxW - 4, boxY + 8, { align: 'right' })

  // ── Info / conditions ────────────────────────────────────────────────────────
  let infoY = boxY + 18

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)

  if (opts.condicao_pagamento_nome) {
    doc.text(`Condição de pagamento: ${opts.condicao_pagamento_nome}`, margin, infoY)
    infoY += 5
  }

  if (opts.observacoes) {
    doc.setFont('helvetica', 'italic')
    doc.text(`Observações: ${opts.observacoes}`, margin, infoY, {
      maxWidth: pageW - margin * 2,
    })
    infoY += 6
  }

  // Validade + ±10% warning
  infoY += 2
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...RED)
  doc.text('Validade deste orçamento: 7 dias.', margin, infoY)
  infoY += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...GRAY)
  doc.text('Poderá haver variação de ±10% na quantidade entregue, conforme prática do segmento.', margin, infoY)
  infoY += 3
  doc.text('* Quando houver múltiplas opções de quantidade (rolos), o valor total acima refere-se à primeira opção de cada item.', margin, infoY)

  // ── Footer ───────────────────────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight()
  doc.setDrawColor(...LIGHT)
  doc.setLineWidth(0.3)
  doc.line(margin, pageH - 14, pageW - margin, pageH - 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...GRAY)
  doc.text('Trends Soluções em Etiquetas', margin, pageH - 9)
  doc.text('www.trends.com.br  |  (54) 3218-1700', pageW - margin, pageH - 9, { align: 'right' })

  doc.save(`orcamento-${opts.numero}.pdf`)
}
