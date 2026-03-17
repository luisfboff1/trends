import { useState, useEffect, useCallback } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { ArrowLeft, Plus, Trash2, Save, FileCheck2, Loader2, FileDown, AlertTriangle, Calculator } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  orcamentosService, clientesService, tiposPapelService,
  facasService, coresPantoneService, tubetesService,
  acabamentosService, condicoesPagamentoService, historicoFreteService,
} from '@/services/api'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatLocalDate } from '@/lib/utils'
import { gerarPdfOrcamento } from '@/lib/pdf-orcamento'
import type { TipoPapel, Cliente, Faca, CorPantone, Tubete, Acabamento, CondicaoPagamento, ItemCalcResult, FreteTipo, CorTipo, HistoricoFrete } from '@/types'

interface ItemRow {
  id?: number
  tipo_produto: string
  faca_id: number | null
  tipo_papel_id: number
  cor_tipo: CorTipo
  cor_pantone_id: number | null
  tubete_id: number | null
  acabamentos_ids: number[]
  quantidade_por_rolo: number
  quantidades: number[] // multiple quantity options
  observacoes: string
  // auto-filled from faca
  largura_mm: number
  altura_mm: number
  colunas: number
  // calc results per quantity
  calcResults: (ItemCalcResult | null)[]
}

const STATUS_OPTIONS = [
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'aprovado', label: 'Aprovado' },
]

const STATUS_BADGE: Record<string, string> = {
  rascunho: 'badge-rascunho', enviado: 'badge-enviado',
  aprovado: 'badge-aprovado', convertido: 'badge-convertido',
}

const TIPOS_PRODUTO = [
  { value: 'etiqueta', label: 'Etiqueta' },
  { value: 'rotulo', label: 'Rótulo' },
  { value: 'tag', label: 'Tag' },
]

function emptyItem(): ItemRow {
  return {
    tipo_produto: 'etiqueta',
    faca_id: null,
    tipo_papel_id: 0,
    cor_tipo: 'branca',
    cor_pantone_id: null,
    tubete_id: null,
    acabamentos_ids: [],
    quantidade_por_rolo: 1000,
    quantidades: [1000],
    observacoes: '',
    largura_mm: 0,
    altura_mm: 0,
    colunas: 1,
    calcResults: [null],
  }
}

export default function OrcamentoDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const { toast } = useToast()
  const isNew = id === 'novo'

  // Data deps
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [tiposPapel, setTiposPapel] = useState<TipoPapel[]>([])
  const [facas, setFacas] = useState<Faca[]>([])
  const [coresPantone, setCoresPantone] = useState<CorPantone[]>([])
  const [tubetes, setTubetes] = useState<Tubete[]>([])
  const [acabamentos, setAcabamentos] = useState<Acabamento[]>([])
  const [condicoesPagamento, setCondicoesPagamento] = useState<CondicaoPagamento[]>([])
  const [historicoFrete, setHistoricoFrete] = useState<HistoricoFrete[]>([])

  const [orc, setOrc] = useState<any>(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [calculating, setCalculating] = useState<number | null>(null)

  // Form state
  const [clienteId, setClienteId] = useState<number | ''>('')
  const [status, setStatus] = useState('rascunho')
  const [observacoes, setObservacoes] = useState('')
  const [condicaoPagamentoId, setCondicaoPagamentoId] = useState<number | ''>('')
  const [freteTipo, setFreteTipo] = useState<FreteTipo>('automatico')
  const [freteValor, setFreteValor] = useState<number>(0)
  const [fretePercentual, setFretePercentual] = useState<number>(3)
  const [itens, setItens] = useState<ItemRow[]>([])

  const loadDependencies = useCallback(async () => {
    const [c, t, f, cp, tb, ac, cond] = await Promise.all([
      clientesService.list({ limit: 500 }),
      tiposPapelService.list(true),
      facasService.list(),
      coresPantoneService.list(),
      tubetesService.list(),
      acabamentosService.list(),
      condicoesPagamentoService.list(),
    ])
    setClientes(c.data.data.data)
    setTiposPapel(t.data.data.data ?? t.data.data)
    setFacas(f.data.data.data ?? f.data.data)
    setCoresPantone(cp.data.data.data ?? cp.data.data)
    setTubetes(tb.data.data.data ?? tb.data.data)
    setAcabamentos(ac.data.data.data ?? ac.data.data)
    setCondicoesPagamento(cond.data.data.data ?? cond.data.data)
  }, [])

  const loadOrcamento = useCallback(async () => {
    if (isNew) return
    setLoading(true)
    try {
      const { data } = await orcamentosService.get(Number(id))
      const d = data.data
      setOrc(d)
      setClienteId(d.cliente_id)
      setStatus(d.status)
      setObservacoes(d.observacoes ?? '')
      setCondicaoPagamentoId(d.condicao_pagamento_id ?? '')
      setFreteTipo(d.frete_tipo ?? 'automatico')
      setFreteValor(d.frete_valor ? Number(d.frete_valor) : 0)
      setFretePercentual(d.frete_percentual ? Number(d.frete_percentual) : 3)
      setItens((d.itens ?? []).map((it: any) => ({
        id: it.id,
        tipo_produto: it.tipo_produto ?? 'etiqueta',
        faca_id: it.faca_id ?? null,
        tipo_papel_id: it.tipo_papel_id,
        cor_tipo: it.cor_tipo ?? 'branca',
        cor_pantone_id: it.cor_pantone_id ?? null,
        tubete_id: it.tubete_id ?? null,
        acabamentos_ids: it.acabamentos_ids ?? [],
        quantidade_por_rolo: it.quantidade_por_rolo ?? it.quantidade ?? 1000,
        quantidades: [it.quantidade ?? 1000],
        observacoes: it.observacoes ?? '',
        largura_mm: Number(it.largura_mm),
        altura_mm: Number(it.altura_mm),
        colunas: it.colunas ?? 1,
        calcResults: [null],
      })))
    } catch {
      toast({ title: 'Erro ao carregar orçamento', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [id, isNew])

  useEffect(() => {
    loadDependencies()
    loadOrcamento()
  }, [loadDependencies, loadOrcamento])

  // Load freight history when client changes
  useEffect(() => {
    if (clienteId) {
      historicoFreteService.list(Number(clienteId))
        .then(({ data }) => setHistoricoFrete(data.data ?? []))
        .catch(() => {})
    }
  }, [clienteId])

  function addItem() {
    setItens(prev => [...prev, emptyItem()])
  }

  function removeItem(idx: number) {
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, updates: Partial<ItemRow>) {
    setItens(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], ...updates }
      return next
    })
  }

  function handleFacaChange(idx: number, facaId: number) {
    const faca = facas.find(f => f.id === facaId)
    if (faca) {
      updateItem(idx, {
        faca_id: facaId,
        largura_mm: Number(faca.largura_mm),
        altura_mm: Number(faca.altura_mm),
        colunas: faca.colunas,
      })
    }
  }

  function addQuantidade(idx: number) {
    setItens(prev => {
      const next = [...prev]
      const item = { ...next[idx] }
      item.quantidades = [...item.quantidades, item.quantidades[item.quantidades.length - 1] || 1000]
      item.calcResults = [...item.calcResults, null]
      next[idx] = item
      return next
    })
  }

  function removeQuantidade(idx: number, qIdx: number) {
    setItens(prev => {
      const next = [...prev]
      const item = { ...next[idx] }
      item.quantidades = item.quantidades.filter((_, i) => i !== qIdx)
      item.calcResults = item.calcResults.filter((_, i) => i !== qIdx)
      next[idx] = item
      return next
    })
  }

  function updateQuantidade(idx: number, qIdx: number, value: number) {
    setItens(prev => {
      const next = [...prev]
      const item = { ...next[idx] }
      item.quantidades = [...item.quantidades]
      item.quantidades[qIdx] = value
      next[idx] = item
      return next
    })
  }

  async function handleCalcular(idx: number) {
    const item = itens[idx]
    if (!item.faca_id || !item.tipo_papel_id) {
      toast({ title: 'Selecione faca e material', variant: 'destructive' })
      return
    }

    setCalculating(idx)
    try {
      const payload = {
        itens: [{
          faca_id: item.faca_id,
          tipo_papel_id: item.tipo_papel_id,
          cor_tipo: item.cor_tipo,
          cor_pantone_id: item.cor_pantone_id,
          tubete_id: item.tubete_id,
          acabamentos_ids: item.acabamentos_ids,
          quantidade_por_rolo: item.quantidade_por_rolo,
          quantidades: item.quantidades,
        }],
      }

      const orcId = isNew ? 0 : Number(id)
      const { data } = await orcamentosService.calcular(orcId, payload)
      const result = data.data?.[0]

      if (result?.quantidades) {
        updateItem(idx, { calcResults: result.quantidades })
      } else if (result?.calc) {
        updateItem(idx, { calcResults: [result.calc] })
      }
    } catch (err: any) {
      toast({ title: 'Erro no cálculo', description: err.response?.data?.error, variant: 'destructive' })
    } finally {
      setCalculating(null)
    }
  }

  // Compute total from first quantity of each item
  const valorTotal = itens.reduce((sum, item) => {
    const firstCalc = item.calcResults[0]
    return sum + (firstCalc?.preco_venda ?? 0)
  }, 0)

  const valorFrete = freteTipo === 'automatico' ? valorTotal * fretePercentual / 100 : freteValor

  async function handleSave() {
    if (!clienteId) return toast({ title: 'Selecione um cliente', variant: 'destructive' })
    if (itens.length === 0) return toast({ title: 'Adicione ao menos um item', variant: 'destructive' })

    setSaving(true)
    try {
      const payload = {
        cliente_id: clienteId,
        status,
        observacoes,
        condicao_pagamento_id: condicaoPagamentoId || null,
        frete_tipo: freteTipo,
        frete_valor: freteTipo === 'manual' ? freteValor : null,
        frete_percentual: freteTipo === 'automatico' ? fretePercentual : null,
        valor_total: valorTotal + valorFrete,
        itens: itens.map(i => ({
          tipo_papel_id: i.tipo_papel_id,
          tipo_produto: i.tipo_produto,
          faca_id: i.faca_id,
          cor_tipo: i.cor_tipo,
          cor_pantone_id: i.cor_pantone_id,
          tubete_id: i.tubete_id,
          acabamentos_ids: i.acabamentos_ids,
          largura_mm: i.largura_mm,
          altura_mm: i.altura_mm,
          colunas: i.colunas,
          quantidade: i.quantidades[0] ?? 1000,
          quantidade_por_rolo: i.quantidade_por_rolo,
          quantidade_rolos: i.calcResults[0]?.quantidade_rolos ?? null,
          metragem_linear: i.calcResults[0]?.metragem_por_rolo ?? null,
          observacoes: i.observacoes || null,
        }))
      }

      if (isNew) {
        const { data } = await orcamentosService.create(payload)
        toast({ title: 'Orçamento criado' })
        router.replace(`/orcamentos/${data.data.id}`)
      } else {
        await orcamentosService.update(Number(id), payload)
        toast({ title: 'Orçamento salvo' })
        loadOrcamento()
      }
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.response?.data?.error, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleConverter() {
    setConverting(true)
    try {
      await orcamentosService.converter(Number(id))
      toast({ title: 'Convertido em pedido!' })
      router.push('/pedidos')
    } catch (err: any) {
      toast({ title: 'Erro ao converter', description: err.response?.data?.error, variant: 'destructive' })
    } finally {
      setConverting(false)
    }
  }

  async function handleExportPdf() {
    if (!orc) return
    setExportingPdf(true)
    try {
      const cliente = clientes.find(c => c.id === orc.cliente_id) ?? orc.cliente
      await gerarPdfOrcamento({
        numero: orc.numero,
        data: new Date(orc.created_at).toLocaleDateString('pt-BR'),
        status: orc.status,
        tipo_margem: 'vendedor',
        observacoes: observacoes || undefined,
        valor_total: valorTotal + valorFrete,
        cliente: {
          razao_social: cliente?.razao_social ?? '',
          cnpj: cliente?.cnpj ?? '',
          email: cliente?.email,
          telefone: cliente?.telefone,
          endereco: cliente?.endereco,
          cidade: cliente?.cidade,
          estado: cliente?.estado,
        },
        itens: itens
          .filter(i => i.tipo_papel_id)
          .map(i => ({
            tipo_papel_nome: tiposPapel.find(t => t.id === i.tipo_papel_id)?.nome ?? '',
            largura_mm: i.largura_mm,
            altura_mm: i.altura_mm,
            colunas: i.colunas,
            quantidade: i.quantidades[0] ?? 0,
            preco_m2: Number(tiposPapel.find(t => t.id === i.tipo_papel_id)?.preco_m2 ?? 0),
            observacoes: i.observacoes,
          })),
      })
    } catch {
      toast({ title: 'Erro ao gerar PDF', variant: 'destructive' })
    } finally {
      setExportingPdf(false)
    }
  }

  const isReadonly = !isNew && orc?.status === 'convertido'

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-6 w-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" /></div>
  }

  // Filter facas by tipo_produto for a given item
  function getFacasForItem(item: ItemRow) {
    return facas.filter(f => f.ativo !== false)
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/orcamentos')}>
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h2 className="text-base font-semibold">
              {isNew ? 'Novo Orçamento' : orc?.numero}
            </h2>
            {!isNew && orc && (
              <p className="text-xs text-[var(--muted-foreground)]">{formatLocalDate(orc.created_at)}</p>
            )}
          </div>
          {!isNew && orc && (
            <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[orc.status]}`}>
              {orc.status}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {!isReadonly && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salvar
            </Button>
          )}
          {!isNew && orc?.status === 'aprovado' && (
            <Button variant="outline" onClick={handleConverter} disabled={converting}>
              {converting ? <Loader2 size={14} className="animate-spin" /> : <FileCheck2 size={14} />}
              Converter em Pedido
            </Button>
          )}
          {!isNew && orc && (
            <Button variant="outline" onClick={handleExportPdf} disabled={exportingPdf}>
              {exportingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              Exportar PDF
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: config */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Configuração</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Cliente *</Label>
                <Select value={String(clienteId)} onValueChange={(v) => setClienteId(Number(v))} disabled={isReadonly}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {clientes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.razao_social}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Condição de Pagamento</Label>
                <Select value={String(condicaoPagamentoId)} onValueChange={(v) => setCondicaoPagamentoId(v ? Number(v) : '')} disabled={isReadonly}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma</SelectItem>
                    {condicoesPagamento.filter(c => c.ativo).map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Freight */}
              <div className="space-y-2">
                <Label>Frete</Label>
                <div className="flex gap-1 p-1 bg-[var(--muted)] rounded-lg">
                  {(['automatico', 'manual', 'historico'] as FreteTipo[]).map(ft => (
                    <button key={ft} onClick={() => !isReadonly && setFreteTipo(ft)}
                      className={`flex-1 px-2 py-1 text-xs rounded-md transition-colors font-medium ${
                        freteTipo === ft ? 'bg-[var(--card)] shadow-sm' : 'text-[var(--muted-foreground)]'
                      }`}>
                      {ft === 'automatico' ? 'Auto %' : ft === 'manual' ? 'Manual' : 'Histórico'}
                    </button>
                  ))}
                </div>
                {freteTipo === 'automatico' && (
                  <div className="flex items-center gap-2">
                    <Input type="number" step="0.1" className="h-8 text-xs w-20" value={fretePercentual}
                      onChange={(e) => setFretePercentual(Number(e.target.value))} disabled={isReadonly} />
                    <span className="text-xs text-[var(--muted-foreground)]">% do total = {formatCurrency(valorFrete)}</span>
                  </div>
                )}
                {freteTipo === 'manual' && (
                  <Input type="number" step="0.01" className="h-8 text-xs" value={freteValor} placeholder="R$ valor do frete"
                    onChange={(e) => setFreteValor(Number(e.target.value))} disabled={isReadonly} />
                )}
                {freteTipo === 'historico' && (
                  <div className="text-xs space-y-1">
                    {historicoFrete.length === 0
                      ? <p className="text-[var(--muted-foreground)]">Nenhum frete registrado para este cliente</p>
                      : historicoFrete.slice(0, 3).map((h, i) => (
                        <div key={i} className="flex justify-between text-[var(--muted-foreground)] bg-[var(--muted)]/40 rounded px-2 py-1">
                          <span>ORC-{h.orcamento_numero}</span>
                          <span>{formatCurrency(Number(h.valor))}</span>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>

              {!isNew && (
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus} disabled={isReadonly}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} disabled={isReadonly} />
              </div>
            </CardContent>
          </Card>

          {/* Totals summary */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Resumo</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Itens</span>
                <span>{itens.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Subtotal</span>
                <span>{formatCurrency(valorTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Frete</span>
                <span>{formatCurrency(valorFrete)}</span>
              </div>
              <div className="flex justify-between font-semibold text-base pt-1 border-t border-[var(--border)]">
                <span>Total</span>
                <span className="text-[var(--primary)]">{formatCurrency(valorTotal + valorFrete)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: items */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Itens do Orçamento</h3>
            {!isReadonly && (
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus size={14} /> Adicionar Item
              </Button>
            )}
          </div>

          {itens.length === 0 && (
            <div className="rounded-xl border border-dashed border-[var(--border)] py-12 text-center text-sm text-[var(--muted-foreground)]">
              Nenhum item. Clique em &quot;Adicionar Item&quot; para começar.
            </div>
          )}

          {itens.map((item, idx) => (
            <Card key={idx} className="relative">
              <CardContent className="pt-4 space-y-4">
                {!isReadonly && (
                  <button className="absolute top-3 right-3 text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors"
                    onClick={() => removeItem(idx)}>
                    <Trash2 size={14} />
                  </button>
                )}

                {/* Row 1: Tipo Produto + Faca */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo Produto</Label>
                    <Select value={item.tipo_produto} onValueChange={(v) => updateItem(idx, { tipo_produto: v })} disabled={isReadonly}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_PRODUTO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">Faca *</Label>
                    <Select value={String(item.faca_id ?? '')} onValueChange={(v) => handleFacaChange(idx, Number(v))} disabled={isReadonly}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione faca..." /></SelectTrigger>
                      <SelectContent>
                        {getFacasForItem(item).map(f => (
                          <SelectItem key={f.id} value={String(f.id)}>
                            {f.nome} ({Number(f.largura_mm)}×{Number(f.altura_mm)}mm, {f.colunas}col)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Material *</Label>
                    <Select value={String(item.tipo_papel_id || '')} onValueChange={(v) => updateItem(idx, { tipo_papel_id: Number(v) })} disabled={isReadonly}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Papel..." /></SelectTrigger>
                      <SelectContent>
                        {tiposPapel.filter(t => t.ativo).map(t => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.nome} ({formatCurrency(Number((t as any).preco_m2_medio ?? t.preco_m2))}/m²)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 2: Auto-filled dimensions (readonly) + Cor + Tubete */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[var(--muted-foreground)]">Largura</Label>
                    <Input type="number" className="h-8 text-xs bg-[var(--muted)]/30" value={item.largura_mm} readOnly />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[var(--muted-foreground)]">Altura</Label>
                    <Input type="number" className="h-8 text-xs bg-[var(--muted)]/30" value={item.altura_mm} readOnly />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[var(--muted-foreground)]">Colunas</Label>
                    <Input type="number" className="h-8 text-xs bg-[var(--muted)]/30" value={item.colunas} readOnly />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Cor</Label>
                    <Select value={item.cor_tipo} onValueChange={(v) => updateItem(idx, { cor_tipo: v as CorTipo, cor_pantone_id: v === 'branca' ? null : item.cor_pantone_id })} disabled={isReadonly}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="branca">Branca</SelectItem>
                        <SelectItem value="pantone">Pantone</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {item.cor_tipo === 'pantone' ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Cor Pantone</Label>
                      <Select value={String(item.cor_pantone_id ?? '')} onValueChange={(v) => updateItem(idx, { cor_pantone_id: Number(v) })} disabled={isReadonly}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Cor..." /></SelectTrigger>
                        <SelectContent>
                          {coresPantone.filter(c => c.ativo !== false).map(c => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.codigo} (+{formatCurrency(Number(c.custo_m2))}/m²)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : <div />}

                  <div className="space-y-1.5">
                    <Label className="text-xs">Tubete</Label>
                    <Select value={String(item.tubete_id ?? '')} onValueChange={(v) => updateItem(idx, { tubete_id: v ? Number(v) : null })} disabled={isReadonly}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tubete..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Nenhum</SelectItem>
                        {tubetes.filter(t => t.ativo !== false).map(t => (
                          <SelectItem key={t.id} value={String(t.id)}>{t.diametro_mm}mm</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 3: Acabamentos + Qtd por rolo */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Acabamentos</Label>
                    <div className="flex flex-wrap gap-2">
                      {acabamentos.filter(a => a.ativo !== false).map(a => {
                        const checked = item.acabamentos_ids.includes(a.id)
                        return (
                          <label key={a.id} className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs cursor-pointer transition-colors ${
                            checked ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-[var(--border)] hover:bg-[var(--muted)]/30'
                          }`}>
                            <input type="checkbox" className="sr-only" checked={checked} disabled={isReadonly}
                              onChange={() => {
                                const ids = checked ? item.acabamentos_ids.filter(id => id !== a.id) : [...item.acabamentos_ids, a.id]
                                updateItem(idx, { acabamentos_ids: ids })
                              }} />
                            {a.nome} ({Number(a.percentual_adicional)}%)
                          </label>
                        )
                      })}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Qtd por Rolo</Label>
                    <Input type="number" className="h-8 text-xs" value={item.quantidade_por_rolo}
                      onChange={(e) => updateItem(idx, { quantidade_por_rolo: Number(e.target.value) })} disabled={isReadonly} />
                  </div>
                </div>

                {/* Row 4: Quantidades (multiple) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Opções de Quantidade</Label>
                    <div className="flex gap-2">
                      {!isReadonly && item.quantidades.length < 5 && (
                        <Button type="button" variant="outline" size="sm" className="h-6 text-xs" onClick={() => addQuantidade(idx)}>
                          <Plus size={12} /> Opção
                        </Button>
                      )}
                      <Button type="button" size="sm" className="h-6 text-xs" onClick={() => handleCalcular(idx)} disabled={calculating === idx}>
                        {calculating === idx ? <Loader2 size={12} className="animate-spin" /> : <Calculator size={12} />}
                        Calcular
                      </Button>
                    </div>
                  </div>
                  {item.quantidades.map((qty, qIdx) => (
                    <div key={qIdx} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Input type="number" min={1} className="h-8 text-xs flex-1" value={qty}
                          onChange={(e) => updateQuantidade(idx, qIdx, Number(e.target.value))} disabled={isReadonly}
                          placeholder="Quantidade desejada" />
                        {item.quantidades.length > 1 && !isReadonly && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-[var(--destructive)]"
                            onClick={() => removeQuantidade(idx, qIdx)}>
                            <Trash2 size={12} />
                          </Button>
                        )}
                      </div>
                      {/* Calc results */}
                      {item.calcResults[qIdx] && (
                        <CalcResultRow calc={item.calcResults[qIdx]!} />
                      )}
                    </div>
                  ))}
                </div>

                {/* Observações do item */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Observações do item</Label>
                  <Input className="h-8 text-xs" value={item.observacoes}
                    onChange={(e) => updateItem(idx, { observacoes: e.target.value })} disabled={isReadonly} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Calc Result Display ───────────────────────────────────────────────────────

function CalcResultRow({ calc }: { calc: ItemCalcResult }) {
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 p-2 rounded-lg bg-[var(--muted)]/40 text-xs">
        <div>
          <p className="text-[var(--muted-foreground)]">Qtd Real</p>
          <p className="font-medium">{calc.quantidade_real?.toLocaleString('pt-BR') ?? '—'}</p>
        </div>
        <div>
          <p className="text-[var(--muted-foreground)]">Rolos</p>
          <p className="font-medium">{calc.quantidade_rolos ?? '—'}</p>
        </div>
        <div>
          <p className="text-[var(--muted-foreground)]">Metragem/rolo</p>
          <p className="font-medium">{calc.metragem_por_rolo ? `${Number(calc.metragem_por_rolo).toFixed(2)}m` : '—'}</p>
        </div>
        <div>
          <p className="text-[var(--muted-foreground)]">m² total</p>
          <p className="font-medium">{calc.m2_total ? `${Number(calc.m2_total).toFixed(4)}` : '—'}</p>
        </div>
        <div>
          <p className="text-[var(--muted-foreground)]">Margem</p>
          <p className="font-medium">{calc.margem_percentual ? `${Number(calc.margem_percentual)}%` : '—'}</p>
        </div>
        <div>
          <p className="text-[var(--muted-foreground)]">Preço Venda</p>
          <p className="font-semibold text-[var(--primary)]">{calc.preco_venda ? formatCurrency(calc.preco_venda) : '—'}</p>
        </div>
      </div>
      {/* Detailed cost breakdown */}
      <div className="grid grid-cols-4 md:grid-cols-7 gap-2 p-2 rounded-lg bg-[var(--muted)]/20 text-xs">
        <div>
          <p className="text-[var(--muted-foreground)]">Custo Material</p>
          <p className="font-medium">{calc.custo_material ? formatCurrency(calc.custo_material) : '—'}</p>
        </div>
        <div>
          <p className="text-[var(--muted-foreground)]">Custo Cor</p>
          <p className="font-medium">{calc.custo_cor ? formatCurrency(calc.custo_cor) : '—'}</p>
        </div>
        <div>
          <p className="text-[var(--muted-foreground)]">Custo Tubete</p>
          <p className="font-medium">{calc.custo_tubetes ? formatCurrency(calc.custo_tubetes) : '—'}</p>
        </div>
        <div>
          <p className="text-[var(--muted-foreground)]">Custo Máquina</p>
          <p className="font-medium">{calc.custo_maquina ? formatCurrency(calc.custo_maquina) : '—'}</p>
        </div>
        <div>
          <p className="text-[var(--muted-foreground)]">Custo Acabamento</p>
          <p className="font-medium">{calc.custo_acabamentos ? formatCurrency(calc.custo_acabamentos) : '—'}</p>
        </div>
        <div>
          <p className="text-[var(--muted-foreground)]">Custo Total</p>
          <p className="font-medium">{calc.custo_total ? formatCurrency(calc.custo_total) : '—'}</p>
        </div>
        <div>
          <p className="text-[var(--muted-foreground)]">Preço/unid</p>
          <p className="font-medium">{calc.preco_unitario ? formatCurrency(calc.preco_unitario) : '—'}</p>
        </div>
      </div>
      {/* Warnings */}
      {calc.avisos && calc.avisos.length > 0 && (
        <div className="space-y-1">
          {calc.avisos.map((aviso, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
              <AlertTriangle size={12} />
              <span>{aviso}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession(ctx)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  return { props: {} }
}
