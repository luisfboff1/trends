import { useState, useEffect, useCallback } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { Eye, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { pedidosService } from '@/services/api'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatLocalDate } from '@/lib/utils'
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

export default function PedidosPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState<{ open: boolean; pedido?: Pedido }>({ open: false })
  const [newStatus, setNewStatus] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await pedidosService.list({ page, limit: 20, status: statusFilter === 'all' ? undefined : statusFilter })
      setPedidos(data.data.data)
      setTotal(data.data.total)
    } catch {
      toast({ title: 'Erro ao carregar pedidos', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => { load() }, [load])

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Número</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Cliente</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Status</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden md:table-cell">Valor</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden lg:table-cell">Data</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="text-center py-12"><div className="h-5 w-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>}
            {!loading && pedidos.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-[var(--muted-foreground)]">Nenhum pedido</td></tr>}
            {!loading && pedidos.map((p) => (
              <tr key={p.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs font-medium">{p.numero}</td>
                <td className="px-4 py-3">{(p as any).cliente_nome ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[p.status]}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {p.valor_total ? formatCurrency(Number(p.valor_total)) : '—'}
                </td>
                <td className="px-4 py-3 text-[var(--muted-foreground)] text-xs hidden lg:table-cell">
                  {formatLocalDate(p.created_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    {p.orcamento_id && (
                      <Button variant="ghost" size="icon" onClick={() => router.push(`/orcamentos/${p.orcamento_id}`)}>
                        <Eye size={14} />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => { setEditModal({ open: true, pedido: p }); setNewStatus(p.status) }}>
                      <Pencil size={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
          <DialogHeader><DialogTitle>Atualizar Status — {editModal.pedido?.numero}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.filter(s => s.value).map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditModal({ open: false })}>Cancelar</Button>
              <Button onClick={handleUpdateStatus} disabled={saving}>Salvar</Button>
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
