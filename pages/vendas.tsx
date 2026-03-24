import { useState, useEffect, useCallback, useRef } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { Search, X, ShoppingCart, DollarSign, TrendingUp, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { pedidosService } from '@/services/api'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatLocalDate } from '@/lib/utils'
import type { Pedido } from '@/types'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' },
]

const STATUS_BADGE: Record<string, string> = {
  pendente: 'badge-pendente',
  em_producao: 'badge-producao',
  concluido: 'badge-entregue',
  cancelado: 'badge-cancelado',
}

export default function VendasPage() {
  const { toast } = useToast()
  const [vendas, setVendas] = useState<Pedido[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [clienteSearch, setClienteSearch] = useState('')
  const [clienteQuery, setClienteQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const searchTimeout = useRef<NodeJS.Timeout>(undefined)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await pedidosService.list({
        page, limit: 20,
        status: statusFilter === 'all' ? undefined : statusFilter,
        cliente: clienteQuery || undefined,
        origem: 'uniplus',
      })
      setVendas(data.data.data)
      setTotal(data.data.total)
    } catch {
      toast({ title: 'Erro ao carregar vendas', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, clienteQuery])

  useEffect(() => { load() }, [load])

  function handleClienteSearch(val: string) {
    setClienteSearch(val)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setClienteQuery(val)
      setPage(1)
    }, 400)
  }

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Total Vendas</p>
                <p className="text-xl font-bold mt-0.5">{total}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-50"><ShoppingCart size={16} className="text-blue-600" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Valor Total</p>
                <p className="text-xl font-bold mt-0.5">{formatCurrency(vendas.reduce((s, v) => s + (Number(v.valor_total) || 0), 0))}</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50"><DollarSign size={16} className="text-emerald-600" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Ticket Médio</p>
                <p className="text-xl font-bold mt-0.5">
                  {vendas.length > 0
                    ? formatCurrency(vendas.reduce((s, v) => s + (Number(v.valor_total) || 0), 0) / vendas.length)
                    : 'R$ 0'}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-purple-50"><TrendingUp size={16} className="text-purple-600" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Nesta Página</p>
                <p className="text-xl font-bold mt-0.5">{vendas.length}</p>
              </div>
              <div className="p-2 rounded-lg bg-orange-50"><Hash size={16} className="text-orange-600" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
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
        <span className="ml-auto text-xs text-[var(--muted-foreground)]">
          Dados sincronizados do UniPlus
        </span>
      </div>

      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--card)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Documento</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Status</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden md:table-cell">Vendedor</th>
                <th className="text-right px-4 py-3 font-medium text-[var(--muted-foreground)]">Valor</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden md:table-cell">Data</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="text-center py-12">
                  <div className="h-5 w-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
                </td></tr>
              )}
              {!loading && vendas.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-[var(--muted-foreground)]">
                  Nenhuma venda encontrada. Sincronize os dados na aba UniPlus.
                </td></tr>
              )}
              {!loading && vendas.map((v) => (
                <tr key={v.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{v.numero}</td>
                  <td className="px-4 py-3 text-sm">{v.cliente_razao_social ?? v.cliente_nome ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[v.status] || ''}`}>
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-sm">{v.vendedor_nome ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    {v.valor_total ? formatCurrency(Number(v.valor_total)) : '—'}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-[var(--muted-foreground)]">
                    {v.data_entrega ? formatLocalDate(v.data_entrega) : v.created_at ? formatLocalDate(v.created_at) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > 20 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
            <span className="text-xs text-[var(--muted-foreground)]">{total} vendas</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Próximo</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession(ctx)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  return { props: {} }
}
