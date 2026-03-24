import { useState, useEffect, useCallback, useRef } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { Pencil, Upload, Search, X, Package, Hash, Layers, Factory } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { pedidosService } from '@/services/api'
import { useToast } from '@/hooks/use-toast'
import { formatLocalDate } from '@/lib/utils'
import type { Pedido } from '@/types'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'producao', label: 'Produção' },
  { value: 'entregue', label: 'Entregue' },
  { value: 'cancelado', label: 'Cancelado' },
]

const STATUS_BADGE: Record<string, string> = {
  pendente: 'badge-pendente', producao: 'badge-producao',
  entregue: 'badge-entregue', cancelado: 'badge-cancelado',
}

const TIPO_PRODUCAO_OPTIONS = [
  { value: 'all', label: 'Todos os Tipos' },
  { value: 'GRAFICAS', label: 'Gráficas' },
  { value: 'FLEXO', label: 'Flexo' },
  { value: 'LASER', label: 'Laser' },
  { value: 'PERSONALIZAR', label: 'Personalizar' },
  { value: 'LABEL', label: 'Label' },
]

const YEAR_OPTIONS = [
  { value: 'all', label: 'Todos os Anos' },
  ...Array.from({ length: 8 }, (_, i) => ({ value: String(2019 + i), label: String(2019 + i) })),
]

const MONTH_OPTIONS = [
  { value: 'all', label: 'Todos os Meses' },
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' }, { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' }, { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
]

interface PedidoMonthStats { totalMes: number; quantidadeMes: number }

export default function PedidosPage() {
  const { toast } = useToast()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [total, setTotal] = useState(0)
  const [monthStats, setMonthStats] = useState<PedidoMonthStats>({ totalMes: 0, quantidadeMes: 0 })
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [tipoProducaoFilter, setTipoProducaoFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const [clienteSearch, setClienteSearch] = useState('')
  const [clienteQuery, setClienteQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState<{ open: boolean; pedido?: Pedido }>({ open: false })
  const [newStatus, setNewStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [importModal, setImportModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const searchTimeout = useRef<NodeJS.Timeout>(undefined)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await pedidosService.list({
        page, limit: 20,
        status: statusFilter === 'all' ? undefined : statusFilter,
        tipo_producao: tipoProducaoFilter === 'all' ? undefined : tipoProducaoFilter,
        cliente: clienteQuery || undefined,
        exclude_origem: 'uniplus',
        ano: yearFilter === 'all' ? undefined : yearFilter,
        mes_num: monthFilter === 'all' ? undefined : monthFilter,
      })
      setPedidos(data.data.data)
      setTotal(data.data.total)
    } catch {
      toast({ title: 'Erro ao carregar pedidos', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, tipoProducaoFilter, clienteQuery, yearFilter, monthFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    pedidosService.stats().then(r => setMonthStats(r.data.data.pedidos)).catch(() => {})
  }, [])

  function handleClienteSearch(val: string) {
    setClienteSearch(val)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setClienteQuery(val)
      setPage(1)
    }, 400)
  }

  async function handleUpdateStatus() {
    if (!editModal.pedido || !newStatus) return
    setSaving(true)
    try {
      await pedidosService.update(editModal.pedido.id, { status: newStatus })
      toast({ title: 'Status atualizado' })
      setEditModal({ open: false })
      load()
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleImport() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const records = JSON.parse(text)
      if (!Array.isArray(records)) throw new Error('JSON inválido')

      // Send in chunks of 500 to avoid request size limits
      const chunkSize = 500
      let totalInserted = 0
      let totalErrors = 0

      for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize)
        const { data } = await pedidosService.import(chunk, i === 0)
        totalInserted += data.data?.inserted || 0
        totalErrors += data.data?.errors || 0
      }

      toast({ title: `Importação concluída: ${totalInserted} pedidos inseridos` })
      setImportModal(false)
      load()
    } catch (err: any) {
      toast({ title: `Erro na importação: ${err.message}`, variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Total Pedidos</p>
                <p className="text-xl font-bold mt-0.5">{total}</p>
              </div>
              <div className="p-2 rounded-lg bg-orange-50"><Package size={16} className="text-orange-600" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Pedidos do Mês</p>
                <p className="text-xl font-bold mt-0.5">{monthStats.totalMes}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-50"><Hash size={16} className="text-blue-600" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Qtd. Produzida (mês)</p>
                <p className="text-xl font-bold mt-0.5">{Number(monthStats.quantidadeMes).toLocaleString('pt-BR')}</p>
              </div>
              <div className="p-2 rounded-lg bg-purple-50"><Layers size={16} className="text-purple-600" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Qtd. Total (página)</p>
                <p className="text-xl font-bold mt-0.5">{pedidos.reduce((s, p) => s + (Number(p.quantidade) || 0), 0).toLocaleString('pt-BR')}</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50"><Factory size={16} className="text-emerald-600" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={tipoProducaoFilter} onValueChange={(v) => { setTipoProducaoFilter(v); setPage(1) }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tipo Produção" /></SelectTrigger>
          <SelectContent>
            {TIPO_PRODUCAO_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={(v) => { setYearFilter(v); setPage(1) }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Ano" /></SelectTrigger>
          <SelectContent>
            {YEAR_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={monthFilter} onValueChange={(v) => { setMonthFilter(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Mês" /></SelectTrigger>
          <SelectContent>
            {MONTH_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input
            placeholder="Buscar cliente..."
            value={clienteSearch}
            onChange={(e) => handleClienteSearch(e.target.value)}
            className="pl-9 w-52"
          />
          {clienteSearch && (
            <button onClick={() => { setClienteSearch(''); setClienteQuery(''); setPage(1) }} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={() => setImportModal(true)}>
            <Upload size={14} className="mr-2" /> Importar Excel
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--card)]">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">OF</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Cliente</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden md:table-cell">Material</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden md:table-cell">Faca</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden lg:table-cell">Etiqueta</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden lg:table-cell">Qtd</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden xl:table-cell">Produzido</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden lg:table-cell">Data</th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} className="text-center py-12"><div className="h-5 w-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>}
            {!loading && pedidos.length === 0 && <tr><td colSpan={10} className="text-center py-12 text-[var(--muted-foreground)]">Nenhum pedido</td></tr>}
            {!loading && pedidos.map((p) => (
              <tr key={p.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs font-medium">
                  {p.ordem_fabricacao || '—'}
                </td>
                <td className="px-4 py-3 text-sm">{p.cliente_nome ?? '—'}</td>
                <td className="px-4 py-3">
                  {p.tipo_producao ? (
                    <span className="inline-flex items-center rounded-md bg-[var(--muted)] px-2 py-0.5 text-xs">{p.tipo_producao}</span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-xs">{p.material ?? '—'}</td>
                <td className="px-4 py-3 hidden md:table-cell text-xs font-mono">{p.codigo_faca ?? '—'}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-xs font-mono">{p.etiqueta_dimensao ?? '—'}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-xs">{p.quantidade != null ? Number(p.quantidade).toLocaleString('pt-BR') : '—'}</td>
                <td className="px-4 py-3 hidden xl:table-cell text-xs">{p.produzido_por ?? '—'}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-xs text-[var(--muted-foreground)]">
                  {p.data_producao ? formatLocalDate(p.data_producao) : p.data_entrega ? formatLocalDate(p.data_entrega) : '—'}
                </td>
                <td className="px-4 py-3">
                  <Button variant="ghost" size="icon" onClick={() => { setEditModal({ open: true, pedido: p }); setNewStatus(p.status) }}>
                    <Pencil size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {total > 20 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
            <span className="text-xs text-[var(--muted-foreground)]">{total} pedidos</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Próximo</Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={editModal.open} onOpenChange={(o) => !o && setEditModal({ open: false })}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Atualizar Status — {editModal.pedido?.ordem_fabricacao ? `OF-${editModal.pedido.ordem_fabricacao}` : editModal.pedido?.numero}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.filter(s => s.value !== 'all').map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditModal({ open: false })}>Cancelar</Button>
              <Button onClick={handleUpdateStatus} disabled={saving}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={importModal} onOpenChange={setImportModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Importar Pedidos do Excel</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted-foreground)]">
              Selecione o arquivo <code>pedidos_import.json</code> gerado pelo script de importação.
              Dados importados anteriormente serão substituídos.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[var(--primary)] file:text-[var(--primary-foreground)] hover:file:opacity-80"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setImportModal(false)}>Cancelar</Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? 'Importando...' : 'Importar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession(ctx)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  return { props: {} }
}
