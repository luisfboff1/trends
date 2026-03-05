import { useState, useEffect, useCallback } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { ArrowLeft, Plus, Trash2, Save, FileCheck2, Loader2, Printer, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { orcamentosService, clientesService, tiposPapelService } from '@/services/api'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatM2, formatLocalDate } from '@/lib/utils'
import { calcularItem } from '@/lib/pricing'
import { gerarPdfOrcamento } from '@/lib/pdf-orcamento'
import type { TipoPapel, Cliente } from '@/types'

interface ItemRow {
  id?: number
  tipo_papel_id: number
  tipo_papel_nome?: string
  preco_m2?: number
  largura_mm: number
  altura_mm: number
  colunas: number
  quantidade: number
  imagem_url: string
  observacoes: string
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

export default function OrcamentoDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const { toast } = useToast()
  const isNew = id === 'novo'

  const [orc, setOrc] = useState<any>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [tiposPapel, setTiposPapel] = useState<TipoPapel[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  // Form state
  const [clienteId, setClienteId] = useState<number | ''>('')
  const [tipoMargem, setTipoMargem] = useState<'vendedor' | 'revenda'>('vendedor')
  const [status, setStatus] = useState('rascunho')
  const [observacoes, setObservacoes] = useState('')
  const [itens, setItens] = useState<ItemRow[]>([])

  const loadDependencies = useCallback(async () => {
    const [c, t] = await Promise.all([
      clientesService.list({ limit: 500 }),
      tiposPapelService.list(true),
    ])
    setClientes(c.data.data.data)
    setTiposPapel(t.data.data.data)
  }, [])

  const loadOrcamento = useCallback(async () => {
    if (isNew) return
    setLoading(true)
    try {
      const { data } = await orcamentosService.get(Number(id))
      const d = data.data
      setOrc(d)
      setClienteId(d.cliente_id)
      setTipoMargem(d.tipo_margem)
      setStatus(d.status)
      setObservacoes(d.observacoes ?? '')
      setItens((d.itens ?? []).map((it: any) => ({
        id: it.id,
        tipo_papel_id: it.tipo_papel_id,
        tipo_papel_nome: it.tipo_papel_nome,
        preco_m2: Number(it.preco_m2),
        largura_mm: Number(it.largura_mm),
        altura_mm: Number(it.altura_mm),
        colunas: it.colunas,
        quantidade: it.quantidade,
        imagem_url: it.imagem_url ?? '',
        observacoes: it.observacoes ?? '',
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

  function addItem() {
    setItens(prev => [...prev, {
      tipo_papel_id: 0,
      largura_mm: 100,
      altura_mm: 100,
      colunas: 1,
      quantidade: 1000,
      imagem_url: '',
      observacoes: '',
    }])
  }

  function removeItem(idx: number) {
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof ItemRow, value: any) {
    setItens(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      if (field === 'tipo_papel_id') {
        const tp = tiposPapel.find(t => t.id === Number(value))
        next[idx].tipo_papel_nome = tp?.nome
        next[idx].preco_m2 = tp ? Number(tp.preco_m2) : undefined
      }
      return next
    })
  }

  // Compute totals
  const totals = itens.map(item => {
    if (!item.tipo_papel_id || !item.preco_m2) return null
    return calcularItem({
      largura_mm: item.largura_mm,
      altura_mm: item.altura_mm,
      colunas: item.colunas,
      quantidade: item.quantidade,
      preco_m2: item.preco_m2,
      tipo_margem: tipoMargem,
    })
  })

  const valorTotal = totals.reduce((sum, t) => sum + (t?.valor_total ?? 0), 0)

  async function handleSave() {
    if (!clienteId) return toast({ title: 'Selecione um cliente', variant: 'destructive' })
    if (itens.length === 0) return toast({ title: 'Adicione ao menos um item', variant: 'destructive' })
    const invalidItem = itens.find(i => !i.tipo_papel_id || !i.largura_mm || !i.altura_mm || !i.quantidade)
    if (invalidItem) return toast({ title: 'Preencha todos os campos dos itens', variant: 'destructive' })

    setSaving(true)
    try {
      const payload = {
        cliente_id: clienteId,
        tipo_margem: tipoMargem,
        status,
        observacoes,
        valor_total: valorTotal,
        itens: itens.map(i => ({
          tipo_papel_id: i.tipo_papel_id,
          largura_mm: i.largura_mm,
          altura_mm: i.altura_mm,
          colunas: i.colunas,
          quantidade: i.quantidade,
          imagem_url: i.imagem_url || null,
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
        tipo_margem: tipoMargem,
        observacoes: observacoes || undefined,
        valor_total: valorTotal,
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
          .filter(i => i.tipo_papel_id && i.preco_m2)
          .map(i => ({
            tipo_papel_nome: i.tipo_papel_nome ?? '',
            largura_mm: i.largura_mm,
            altura_mm: i.altura_mm,
            colunas: i.colunas,
            quantidade: i.quantidade,
            preco_m2: i.preco_m2!,
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

  return (
    <div className="space-y-6 max-w-5xl">
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
                <Label>Tipo de Margem</Label>
                <Select value={tipoMargem} onValueChange={(v: any) => setTipoMargem(v)} disabled={isReadonly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vendedor">Vendedor (180%)</SelectItem>
                    <SelectItem value="revenda">Revenda (110%)</SelectItem>
                  </SelectContent>
                </Select>
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
              <div className="flex justify-between font-semibold text-base pt-1 border-t border-[var(--border)]">
                <span>Total</span>
                <span className="text-[var(--primary)]">{formatCurrency(valorTotal)}</span>
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
              Nenhum item. Clique em "Adicionar Item" para começar.
            </div>
          )}

          {itens.map((item, idx) => {
            const calc = totals[idx]
            return (
              <Card key={idx} className="relative">
                <CardContent className="pt-4 space-y-4">
                  {!isReadonly && (
                    <button className="absolute top-3 right-3 text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors"
                      onClick={() => removeItem(idx)}>
                      <Trash2 size={14} />
                    </button>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-xs">Tipo de Papel *</Label>
                      <Select value={String(item.tipo_papel_id || '')} onValueChange={(v) => updateItem(idx, 'tipo_papel_id', Number(v))} disabled={isReadonly}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {tiposPapel.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Largura (mm) *</Label>
                      <Input type="number" className="h-8 text-xs" value={item.largura_mm}
                        onChange={(e) => updateItem(idx, 'largura_mm', Number(e.target.value))} disabled={isReadonly} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Altura (mm) *</Label>
                      <Input type="number" className="h-8 text-xs" value={item.altura_mm}
                        onChange={(e) => updateItem(idx, 'altura_mm', Number(e.target.value))} disabled={isReadonly} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Colunas</Label>
                      <Input type="number" min={1} max={10} className="h-8 text-xs" value={item.colunas}
                        onChange={(e) => updateItem(idx, 'colunas', Number(e.target.value))} disabled={isReadonly} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Quantidade *</Label>
                      <Input type="number" min={1} className="h-8 text-xs" value={item.quantidade}
                        onChange={(e) => updateItem(idx, 'quantidade', Number(e.target.value))} disabled={isReadonly} />
                    </div>
                  </div>

                  {/* Live calc results */}
                  {calc && (
                    <div className="space-y-2 text-xs">
                      {/* Row 1 — inputs */}
                      <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-[var(--muted)]/40">
                        <div>
                          <p className="text-[var(--muted-foreground)]">Papel/m²</p>
                          <p className="font-medium">{item.preco_m2 != null ? formatCurrency(item.preco_m2) : '—'}</p>
                        </div>
                        <div>
                          <p className="text-[var(--muted-foreground)]">Metros/mil</p>
                          <p className="font-medium">{calc.metros_por_mil.toFixed(2)} m</p>
                        </div>
                        <div>
                          <p className="text-[var(--muted-foreground)]">Área total</p>
                          <p className="font-medium">{formatM2(calc.m2_total)}</p>
                        </div>
                      </div>
                      {/* Row 2 — pricing stages */}
                      <div className="grid grid-cols-4 gap-2 p-3 rounded-lg bg-[var(--muted)]/40">
                        <div>
                          <p className="text-[var(--muted-foreground)]">Valor milheiro (base)</p>
                          <p className="font-medium">{formatCurrency(calc.custo_por_mil)}</p>
                        </div>
                        <div>
                          <p className="text-[var(--muted-foreground)]">Margem</p>
                          <p className="font-medium">{calc.margem_fator}×</p>
                        </div>
                        <div>
                          <p className="text-[var(--muted-foreground)]">Desconto</p>
                          <p className="font-medium text-green-600">{(calc.desconto_pct * 100).toFixed(0)}%</p>
                        </div>
                        <div>
                          <p className="text-[var(--muted-foreground)]">Preço/mil (c/ margem)</p>
                          <p className="font-semibold text-[var(--primary)]">{formatCurrency(calc.preco_por_mil)}</p>
                        </div>
                      </div>
                      {/* Footer */}
                      <div className="flex justify-between px-1">
                        <span className="text-[var(--muted-foreground)]">Altura total (c/ espaçamento): {calc.altura_total_mm}mm</span>
                        <span className="font-semibold">Total: {formatCurrency(calc.valor_total)}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs">Observações do item</Label>
                    <Input className="h-8 text-xs" value={item.observacoes}
                      onChange={(e) => updateItem(idx, 'observacoes', e.target.value)} disabled={isReadonly} />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession(ctx)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  return { props: {} }
}
