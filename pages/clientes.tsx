import { useState, useEffect, useCallback } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { Plus, Search, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ClienteForm } from '@/components/forms/cliente-form'
import { clientesService } from '@/services/api'
import { useToast } from '@/hooks/use-toast'
import { formatCNPJ } from '@/lib/utils'
import type { Cliente } from '@/types'

export default function ClientesPage() {
  const { toast } = useToast()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; cliente?: Cliente }>({ open: false })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const loadClientes = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await clientesService.list({ page, limit: 20, search })
      setClientes(data.data.data)
      setTotal(data.data.total)
    } catch {
      toast({ title: 'Erro ao carregar clientes', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { loadClientes() }, [loadClientes])

  async function handleSave(formData: any) {
    setSaving(true)
    try {
      if (modal.cliente) {
        await clientesService.update(modal.cliente.id, formData)
        toast({ title: 'Cliente atualizado' })
      } else {
        await clientesService.create(formData)
        toast({ title: 'Cliente criado' })
      }
      setModal({ open: false })
      loadClientes()
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.response?.data?.error ?? 'Tente novamente', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    try {
      await clientesService.delete(id)
      toast({ title: 'Cliente removido' })
      setDeleteId(null)
      loadClientes()
    } catch {
      toast({ title: 'Erro ao remover cliente', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input
            placeholder="Buscar por nome ou CNPJ..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <Button onClick={() => setModal({ open: true })}>
          <Plus size={16} /> Novo Cliente
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Razão Social</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">CNPJ</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden md:table-cell">Cidade/UF</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden lg:table-cell">Vendedor</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="text-center py-12 text-[var(--muted-foreground)]">
                <div className="h-5 w-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
              </td></tr>
            )}
            {!loading && clientes.length === 0 && (
              <tr><td colSpan={5} className="text-center py-12 text-[var(--muted-foreground)]">
                Nenhum cliente encontrado
              </td></tr>
            )}
            {!loading && clientes.map((c) => (
              <tr key={c.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/30 transition-colors">
                <td className="px-4 py-3 font-medium">{c.razao_social}</td>
                <td className="px-4 py-3 text-[var(--muted-foreground)]">{formatCNPJ(c.cnpj)}</td>
                <td className="px-4 py-3 text-[var(--muted-foreground)] hidden md:table-cell">
                  {c.cidade && c.estado ? `${c.cidade}/${c.estado}` : '—'}
                </td>
                <td className="px-4 py-3 text-[var(--muted-foreground)] hidden lg:table-cell">
                  {(c as any).vendedor_nome ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => setModal({ open: true, cliente: c })}>
                      <Pencil size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-[var(--destructive)] hover:text-[var(--destructive)]"
                      onClick={() => setDeleteId(c.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
            <span className="text-xs text-[var(--muted-foreground)]">{total} clientes</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Próximo</Button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={modal.open} onOpenChange={(o) => !o && setModal({ open: false })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{modal.cliente ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          </DialogHeader>
          <ClienteForm
            defaultValues={modal.cliente}
            onSubmit={handleSave}
            loading={saving}
          />
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Modal */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--muted-foreground)]">
            Tem certeza que deseja remover este cliente?
          </p>
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
  const { requireFeature } = await import('@/lib/require-feature')
  const guard = await requireFeature(ctx, 'clientes')
  if (guard) return guard
  return { props: {} }
}
