import { useState, useEffect, useCallback } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { Plus, Search, Eye, Trash2, FileCheck2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { orcamentosService } from '@/services/api'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatLocalDate } from '@/lib/utils'
import type { Orcamento } from '@/types'

const STATUS_BADGE: Record<string, string> = {
  rascunho: 'badge-rascunho', enviado: 'badge-enviado',
  aprovado: 'badge-aprovado', convertido: 'badge-convertido',
}
const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado', convertido: 'Convertido',
}

export default function OrcamentosPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await orcamentosService.list({ page, limit: 20 })
      setOrcamentos(data.data.data)
      setTotal(data.data.total)
    } catch {
      toast({ title: 'Erro ao carregar orçamentos', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  async function handleDelete(id: number) {
    try {
      await orcamentosService.delete(id)
      toast({ title: 'Orçamento removido' })
      setDeleteId(null)
      load()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.response?.data?.error ?? 'Não foi possível remover', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => router.push('/orcamentos/novo')}>
          <Plus size={16} /> Novo Orçamento
        </Button>
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
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="text-center py-12"><div className="h-5 w-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>}
            {!loading && orcamentos.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-[var(--muted-foreground)]">Nenhum orçamento</td></tr>}
            {!loading && orcamentos.map((o) => (
              <tr key={o.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/30 cursor-pointer transition-colors"
                onClick={() => router.push(`/orcamentos/${o.id}`)}>
                <td className="px-4 py-3 font-mono font-medium text-xs">{o.numero}</td>
                <td className="px-4 py-3">{(o as any).cliente_nome ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[o.status]}`}>
                    {STATUS_LABEL[o.status]}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {o.valor_total ? formatCurrency(Number(o.valor_total)) : '—'}
                </td>
                <td className="px-4 py-3 text-[var(--muted-foreground)] text-xs hidden lg:table-cell">
                  {formatLocalDate(o.created_at)}
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => router.push(`/orcamentos/${o.id}`)}>
                      <Eye size={14} />
                    </Button>
                    {o.status === 'rascunho' && (
                      <Button variant="ghost" size="icon" className="text-[var(--destructive)]" onClick={() => setDeleteId(o.id)}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {total > 20 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
            <span className="text-xs text-[var(--muted-foreground)]">{total} orçamentos</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Próximo</Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader>
          <p className="text-sm text-[var(--muted-foreground)]">Tem certeza que deseja remover este orçamento?</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Excluir</Button>
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
