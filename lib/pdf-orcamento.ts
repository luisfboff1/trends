import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { calcularItem } from './pricing'
import type { TipoMargem } from './pricing'

export interface PdfItem {
  tipo_papel_nome: string
  largura_mm: number
  altura_mm: number
  colunas: number
  quantidade: number
  preco_m2: number
  observacoes?: string
}

export interface PdfOrcamentoOptions {
  numero: string
  data: string
  status: string
  tipo_margem: TipoMargem
  observacoes?: string
  valor_total: number
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
  const c = cnpj.replace(/\D/g, '')
  if (c.length !== 14) return cnpj
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
  const logo = await loadImageAsBase64('/logo.webp')
  if (logo) {
    const maxW = 50
    const maxH = 18
    const ratio = Math.min(maxW / logo.w, maxH / logo.h)
    const imgW = logo.w * ratio
    const imgH = logo.h * ratio
    doc.addImage(logo.data, 'WEBP', margin, y, imgW, imgH)
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
  doc.text(`Status: ${opts.status.toUpperCase()}`, pageW - margin, y + 20, { align: 'right' })

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
  doc.text(opts.cliente.razao_social, margin + 4, y + 11)

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
  doc.text('ITENS DO ORÇAMENTO', margin, y)
  y += 4

  const rows = opts.itens.map((item) => {
    const calc = calcularItem({
      largura_mm: item.largura_mm,
      altura_mm: item.altura_mm,
      colunas: item.colunas,
      quantidade: item.quantidade,
      preco_m2: item.preco_m2,
      tipo_margem: opts.tipo_margem,
    })
    return [
      item.tipo_papel_nome,
      `${item.largura_mm} × ${item.altura_mm} mm`,
      String(item.colunas),
      item.quantidade.toLocaleString('pt-BR'),
      calc.desconto_pct > 0 ? `-${(calc.desconto_pct * 100).toFixed(0)}%` : '—',
      formatCurrency(calc.preco_por_mil),
      formatCurrency(calc.valor_total),
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [['Tipo de Papel', 'Dimensões', 'Col.', 'Qtd.', 'Desconto', 'Preço/Mil', 'Total']],
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
      0: { cellWidth: 42 },
      1: { cellWidth: 28 },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 28, halign: 'right' },
      6: { cellWidth: 28, halign: 'right' },
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
  const boxW = 70
  const boxX = pageW - margin - boxW

  doc.setFillColor(RED[0], RED[1], RED[2])
  doc.roundedRect(boxX, afterTable, boxW, 12, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...WHITE)
  doc.text('TOTAL', boxX + 4, afterTable + 8)
  doc.text(formatCurrency(opts.valor_total), boxX + boxW - 4, afterTable + 8, { align: 'right' })

  // ── Margem / condições ───────────────────────────────────────────────────────
  let infoY = afterTable + 18

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text(
    `Tipo de margem: ${opts.tipo_margem === 'vendedor' ? 'Vendedor (180%)' : 'Revenda (110%)'}`,
    margin,
    infoY
  )

  if (opts.observacoes) {
    infoY += 6
    doc.setFont('helvetica', 'italic')
    doc.text(`Observações: ${opts.observacoes}`, margin, infoY, {
      maxWidth: pageW - margin * 2,
    })
  }

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
