import { useState, useEffect, useCallback } from 'react'
import { GetServerSideProps } from 'next'
import { getSession, useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { tipoPapelSchema } from '@/lib/validations/tipo-papel'
import type { TipoPapelInput } from '@/lib/validations/tipo-papel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { tiposPapelService } from '@/services/api'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/utils'
import type { TipoPapel } from '@/types'

function TipoPapelForm({ defaultValues, onSubmit, loading }: {
  defaultValues?: Partial<TipoPapelInput>
  onSubmit: (d: TipoPapelInput) => Promise<void>
  loading?: boolean
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<TipoPapelInput>({
    resolver: zodResolver(tipoPapelSchema),
    defaultValues: defaultValues ?? {},
  })
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="nome">Nome *</Label>
        <Input id="nome" {...register('nome')} placeholder="Ex: COUCHE BORRACHA" />
        {errors.nome && <p className="text-xs text-[var(--destructive)]">{errors.nome.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="fornecedor">Fornecedor</Label>
          <Input id="fornecedor" {...register('fornecedor')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="data_compra">Data de Compra</Label>
          <Input id="data_compra" type="date" {...register('data_compra')} />
        </div>
      </div>

      <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide pt-1">Precificação (R$/m²)</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="preco_m2">m² (preço base) *</Label>
          <Input id="preco_m2" type="number" step="0.0001" {...register('preco_m2', { valueAsNumber: true })} placeholder="0.0000" />
          {errors.preco_m2 && <p className="text-xs text-[var(--destructive)]">{errors.preco_m2.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pago">Pago (R$)</Label>
          <Input id="pago" type="number" step="0.0001" {...register('pago', { valueAsNumber: true })} placeholder="0.0000" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="icms">ICMS (%)</Label>
          <Input id="icms" type="number" step="0.01" {...register('icms', { valueAsNumber: true })} placeholder="0.00" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ipi">IPI (%)</Label>
          <Input id="ipi" type="number" step="0.01" {...register('ipi', { valueAsNumber: true })} placeholder="0.00" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="frete">Frete (R$)</Label>
          <Input id="frete" type="number" step="0.0001" {...register('frete', { valueAsNumber: true })} placeholder="0.0000" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="total">Total (R$)</Label>
          <Input id="total" type="number" step="0.0001" {...register('total', { valueAsNumber: true })} placeholder="0.0000" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="descricao">Descrição</Label>
        <Textarea id="descricao" {...register('descricao')} rows={2} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 size={14} className="animate-spin" />} Salvar
        </Button>
      </div>
    </form>
  )
}

export default function TiposPapelPage() {
  const { data: session } = useSession()
  const isAdmin = (session?.user as any)?.tipo === 'admin'
  const { toast } = useToast()
  const [tipos, setTipos] = useState<TipoPapel[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; tipo?: TipoPapel }>({ open: false })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await tiposPapelService.list(false)
      setTipos(data.data.data)
    } catch {
      toast({ title: 'Erro ao carregar', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave(d: TipoPapelInput) {
    setSaving(true)
    try {
      if (modal.tipo) await tiposPapelService.update(modal.tipo.id, d)
      else await tiposPapelService.create(d)
      toast({ title: modal.tipo ? 'Tipo atualizado' : 'Tipo criado' })
      setModal({ open: false })
      load()
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.response?.data?.error, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    try {
      await tiposPapelService.delete(id)
      toast({ title: 'Tipo removido' })
      setDeleteId(null)
      load()
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {isAdmin && (
          <Button onClick={() => setModal({ open: true })}>
            <Plus size={16} /> Novo Tipo de Papel
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden md:table-cell">Fornecedor</th>
              <th className="text-right px-4 py-3 font-medium text-[var(--muted-foreground)]">m²</th>
              <th className="text-right px-4 py-3 font-medium text-[var(--muted-foreground)] hidden lg:table-cell">Pago</th>
              <th className="text-right px-4 py-3 font-medium text-[var(--muted-foreground)] hidden lg:table-cell">ICMS%</th>
              <th className="text-right px-4 py-3 font-medium text-[var(--muted-foreground)] hidden lg:table-cell">IPI%</th>
              <th className="text-right px-4 py-3 font-medium text-[var(--muted-foreground)] hidden lg:table-cell">Frete</th>
              <th className="text-right px-4 py-3 font-medium text-[var(--muted-foreground)] hidden lg:table-cell">Total</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden xl:table-cell">Compra</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Status</th>
              {isAdmin && <th className="w-20" />}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} className="text-center py-12"><div className="h-5 w-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>}
            {!loading && tipos.length === 0 && <tr><td colSpan={10} className="text-center py-12 text-[var(--muted-foreground)]">Nenhum tipo cadastrado</td></tr>}
            {!loading && tipos.map((t) => (
              <tr key={t.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/30 transition-colors">
                <td className="px-4 py-3 font-medium">{t.nome}</td>
                <td className="px-4 py-3 text-[var(--muted-foreground)] hidden md:table-cell">{t.fornecedor ?? '—'}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(Number(t.preco_m2))}</td>
                <td className="px-4 py-3 text-right hidden lg:table-cell">{t.pago != null ? formatCurrency(Number(t.pago)) : '—'}</td>
                <td className="px-4 py-3 text-right hidden lg:table-cell">{t.icms != null ? `${Number(t.icms)}%` : '—'}</td>
                <td className="px-4 py-3 text-right hidden lg:table-cell">{t.ipi != null ? `${Number(t.ipi)}%` : '—'}</td>
                <td className="px-4 py-3 text-right hidden lg:table-cell">{t.frete != null ? formatCurrency(Number(t.frete)) : '—'}</td>
                <td className="px-4 py-3 text-right hidden lg:table-cell">{t.total != null ? formatCurrency(Number(t.total)) : '—'}</td>
                <td className="px-4 py-3 text-[var(--muted-foreground)] hidden xl:table-cell">{t.data_compra ? new Date(t.data_compra).toLocaleDateString('pt-BR') : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${t.ativo ? 'badge-aprovado' : 'badge-cancelado'}`}>
                    {t.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => setModal({ open: true, tipo: t })}><Pencil size={14} /></Button>
                      <Button variant="ghost" size="icon" className="text-[var(--destructive)]" onClick={() => setDeleteId(t.id)}><Trash2 size={14} /></Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={modal.open} onOpenChange={(o) => !o && setModal({ open: false })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{modal.tipo ? 'Editar Tipo de Papel' : 'Novo Tipo de Papel'}</DialogTitle></DialogHeader>
          <TipoPapelForm defaultValues={modal.tipo} onSubmit={handleSave} loading={saving} />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader>
          <p className="text-sm text-[var(--muted-foreground)]">Tem certeza que deseja desativar este tipo de papel?</p>
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
  const session = await getSession(ctx)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  return { props: {} }
}
