import { useState, useEffect, useCallback } from 'react'
import { GetServerSideProps } from 'next'
import { getSession, useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useForm } from 'react-hook-form'
import { Check, X, Trash2, Plus, Loader2, UserCheck, UserX, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { usuariosService, tabelasMargemService } from '@/services/api'
import type { TabelaMargem } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { formatLocalDate } from '@/lib/utils'

interface UsuarioRow {
  id: number
  nome: string
  email: string
  tipo: string
  ativo: boolean
  google_id: string | null
  avatar_url: string | null
  created_at: string
  aprovado_em: string | null
  tabela_margem_id: number | null
  tabela_margem_nome?: string
}

const TABS = [
  { value: 'pendente', label: 'Pendentes' },
  { value: 'ativo', label: 'Ativos' },
  { value: 'todos', label: 'Todos' },
]

export default function UsuariosPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const isAdmin = (session?.user as any)?.tipo === 'admin'

  const [tab, setTab] = useState<'pendente' | 'ativo' | 'todos'>('pendente')
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([])
  const [loading, setLoading] = useState(true)
  const [createModal, setCreateModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [tabelasMargem, setTabelasMargem] = useState<TabelaMargem[]>([])

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<{
    nome: string; email: string; senha: string; tipo: string
  }>({ defaultValues: { tipo: 'vendedor' } })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await usuariosService.list(tab)
      setUsuarios(data.data)
    } catch {
      toast({ title: 'Erro ao carregar usuários', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    if (!isAdmin) { router.push('/dashboard'); return }
    load()
    tabelasMargemService.list().then(({ data }) => setTabelasMargem(data.data.data ?? data.data)).catch(() => {})
  }, [load, isAdmin])

  async function handleApprove(id: number) {
    try {
      await usuariosService.approve(id)
      toast({ title: 'Usuário aprovado' })
      load()
    } catch {
      toast({ title: 'Erro ao aprovar', variant: 'destructive' })
    }
  }

  async function handleReject(id: number) {
    try {
      await usuariosService.reject(id)
      toast({ title: 'Acesso revogado' })
      load()
    } catch {
      toast({ title: 'Erro', variant: 'destructive' })
    }
  }

  async function handleChangeTipo(id: number, tipo: string) {
    try {
      await usuariosService.updateTipo(id, tipo)
      toast({ title: 'Tipo atualizado' })
      load()
    } catch {
      toast({ title: 'Erro', variant: 'destructive' })
    }
  }

  async function handleChangeTabelaMargem(id: number, tabela_margem_id: number | null) {
    try {
      await usuariosService.updateTabelaMargem(id, tabela_margem_id as number)
      toast({ title: 'Tabela de margem atualizada' })
      load()
    } catch {
      toast({ title: 'Erro', variant: 'destructive' })
    }
  }

  async function handleDelete(id: number) {
    try {
      await usuariosService.delete(id)
      toast({ title: 'Usuário removido' })
      setDeleteId(null)
      load()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.response?.data?.error, variant: 'destructive' })
    }
  }

  async function handleCreate(d: { nome: string; email: string; senha: string; tipo: string }) {
    setSaving(true)
    try {
      await usuariosService.create(d)
      toast({ title: 'Usuário criado' })
      setCreateModal(false)
      reset()
      load()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.response?.data?.error, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const pendingCount = tab === 'todos' ? usuarios.filter(u => !u.ativo).length : 0

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1 p-1 bg-[var(--muted)] rounded-lg">
          {TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setTab(t.value as any)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors font-medium ${
                tab === t.value ? 'bg-[var(--card)] shadow-sm' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Button onClick={() => setCreateModal(true)}>
          <Plus size={16} /> Novo Usuário
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Usuário</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden md:table-cell">Email</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden lg:table-cell">Tabela Margem</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Status</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden lg:table-cell">Cadastro</th>
              <th className="w-28" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="text-center py-12">
                <div className="h-5 w-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
              </td></tr>
            )}
            {!loading && usuarios.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-[var(--muted-foreground)]">
                {tab === 'pendente' ? 'Nenhum usuário aguardando aprovação' : 'Nenhum usuário encontrado'}
              </td></tr>
            )}
            {!loading && usuarios.map((u) => (
              <tr key={u.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt={u.nome} className="w-7 h-7 rounded-full object-cover" />
                      : <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-xs font-bold text-[var(--primary)]">
                          {u.nome.charAt(0).toUpperCase()}
                        </div>
                    }
                    <span className="font-medium">{u.nome}</span>
                    {u.google_id && (
                      <span className="text-xs text-[var(--muted-foreground)] border border-[var(--border)] rounded px-1 py-0.5">Google</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-[var(--muted-foreground)] hidden md:table-cell">{u.email}</td>
                <td className="px-4 py-3">
                  <Select value={u.tipo} onValueChange={(v) => handleChangeTipo(u.id, v)}>
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vendedor">Vendedor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  {u.ativo && (
                    <Select value={u.tabela_margem_id?.toString() ?? 'none'} onValueChange={(v) => handleChangeTabelaMargem(u.id, v === 'none' ? null : Number(v))}>
                      <SelectTrigger className="h-7 w-32 text-xs">
                        <SelectValue placeholder="Sem tabela" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem tabela</SelectItem>
                        {tabelasMargem.filter(t => t.ativo).map(t => (
                          <SelectItem key={t.id} value={t.id.toString()}>{t.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </td>
                <td className="px-4 py-3">
                  {u.ativo
                    ? <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold badge-aprovado">
                        <UserCheck size={12} /> Ativo
                      </span>
                    : <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold badge-pendente">
                        <UserX size={12} /> Pendente
                      </span>
                  }
                </td>
                <td className="px-4 py-3 text-[var(--muted-foreground)] text-xs hidden lg:table-cell">
                  {formatLocalDate(u.created_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    {!u.ativo && (
                      <Button variant="ghost" size="icon" className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        title="Aprovar" onClick={() => handleApprove(u.id)}>
                        <Check size={14} />
                      </Button>
                    )}
                    {u.ativo && Number(u.id) !== Number((session?.user as any)?.id) && (
                      <Button variant="ghost" size="icon" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        title="Revogar acesso" onClick={() => handleReject(u.id)}>
                        <X size={14} />
                      </Button>
                    )}
                    {Number(u.id) !== Number((session?.user as any)?.id) && (
                      <Button variant="ghost" size="icon" className="text-[var(--destructive)] hover:text-[var(--destructive)]"
                        title="Remover" onClick={() => setDeleteId(u.id)}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create user modal */}
      <Dialog open={createModal} onOpenChange={(o) => { if (!o) { setCreateModal(false); reset() } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo Usuário</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input {...register('nome', { required: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" {...register('email', { required: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Senha *</Label>
              <Input type="password" {...register('senha', { required: true, minLength: 6 })} />
              {errors.senha && <p className="text-xs text-[var(--destructive)]">Mínimo 6 caracteres</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={watch('tipo')} onValueChange={(v) => setValue('tipo', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => { setCreateModal(false); reset() }}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 size={14} className="animate-spin" />} Criar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader>
          <p className="text-sm text-[var(--muted-foreground)]">Tem certeza que deseja remover este usuário permanentemente?</p>
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
