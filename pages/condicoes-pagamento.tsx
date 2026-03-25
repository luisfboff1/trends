import { useState, useEffect, useCallback } from 'react'
import { GetServerSideProps } from 'next'
import { getSession, useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { condicoesPagamentoService } from '@/services/api'
import { useToast } from '@/hooks/use-toast'
import type { CondicaoPagamento } from '@/types'

export default function CondicoesPagamentoPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const isAdmin = (session?.user as any)?.tipo === 'admin'

  const [items, setItems] = useState<CondicaoPagamento[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; item?: CondicaoPagamento }>({ open: false })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  useEffect(() => {
    if (session && !isAdmin) router.push('/dashboard')
  }, [session, isAdmin])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await condicoesPagamentoService.list()
      setItems(data.data.data ?? data.data)
    } catch {
      toast({ title: 'Erro ao carregar', variant: 'destructive' })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave(d: { nome: string; descricao?: string }) {
    setSaving(true)
    try {
      if (modal.item) await condicoesPagamentoService.update(modal.item.id, d)
      else await condicoesPagamentoService.create(d)
      toast({ title: modal.item ? 'Condição atualizada' : 'Condição criada' })
      setModal({ open: false }); load()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.response?.data?.error, variant: 'destructive' })
    } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    try {
      await condicoesPagamentoService.delete(id)
      toast({ title: 'Condição removida' }); setDeleteId(null); load()
    } catch { toast({ title: 'Erro ao remover', variant: 'destructive' }) }
  }

  if (!isAdmin) return null

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setModal({ open: true })}><Plus size={16} /> Nova Condição</Button>
      </div>

      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Descrição</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Status</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} className="text-center py-12">
                <div className="h-5 w-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
              </td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={4} className="text-center py-12 text-[var(--muted-foreground)]">Nenhuma condição cadastrada</td></tr>
            )}
            {!loading && items.map((c) => (
              <tr key={c.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/30 transition-colors">
                <td className="px-4 py-3 font-medium">{c.nome}</td>
                <td className="px-4 py-3 text-[var(--muted-foreground)]">{c.descricao ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${c.ativo ? 'badge-aprovado' : 'badge-cancelado'}`}>
                    {c.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => setModal({ open: true, item: c })}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" className="text-[var(--destructive)]" onClick={() => setDeleteId(c.id)}><Trash2 size={14} /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form modal */}
      <Dialog open={modal.open} onOpenChange={(o) => !o && setModal({ open: false })}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{modal.item ? 'Editar Condição' : 'Nova Condição de Pagamento'}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            handleSave({ nome: fd.get('nome') as string, descricao: (fd.get('descricao') as string) || undefined })
          }} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input name="nome" defaultValue={modal.item?.nome ?? ''} required placeholder="Ex: 30/60/90 dias" />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input name="descricao" defaultValue={modal.item?.descricao ?? ''} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 size={14} className="animate-spin" />} Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader>
          <p className="text-sm text-[var(--muted-foreground)]">Desativar esta condição de pagamento?</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Desativar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { requireFeature } = await import('@/lib/require-feature')
  const guard = await requireFeature(ctx, 'condicoes_pagamento')
  if (guard) return guard
  return { props: {} }
}
