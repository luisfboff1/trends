import { useState, useEffect, useCallback } from 'react'
import { GetServerSideProps } from 'next'
import { getSession, useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronRight, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { tabelasMargemService } from '@/services/api'
import { useToast } from '@/hooks/use-toast'
import type { TabelaMargem, FaixaMargem } from '@/types'

interface TabelaComFaixas extends TabelaMargem {
  faixas: FaixaMargem[]
  vendedores_count?: number
}

export default function TabelasMargemPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const isAdmin = (session?.user as any)?.tipo === 'admin'

  const [tabelas, setTabelas] = useState<TabelaComFaixas[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [createModal, setCreateModal] = useState(false)
  const [editModal, setEditModal] = useState<TabelaComFaixas | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  useEffect(() => {
    if (session && !isAdmin) router.push('/dashboard')
  }, [session, isAdmin])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await tabelasMargemService.list()
      setTabelas(data.data.data ?? data.data)
    } catch {
      toast({ title: 'Erro ao carregar', variant: 'destructive' })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function loadTabela(id: number) {
    try {
      const { data } = await tabelasMargemService.get(id)
      const t = data.data
      setTabelas(prev => prev.map(tab => tab.id === id ? { ...tab, ...t } : tab))
    } catch { /* silent */ }
  }

  function toggleExpand(id: number) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    loadTabela(id)
  }

  async function handleDelete(id: number) {
    try {
      await tabelasMargemService.delete(id)
      toast({ title: 'Tabela removida' }); setDeleteId(null); load()
    } catch { toast({ title: 'Erro', variant: 'destructive' }) }
  }

  if (!isAdmin) return null

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateModal(true)}><Plus size={16} /> Nova Tabela</Button>
      </div>

      <div className="space-y-3">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-5 w-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && tabelas.length === 0 && (
          <div className="text-center py-12 text-[var(--muted-foreground)]">Nenhuma tabela de margem cadastrada</div>
        )}
        {!loading && tabelas.map(t => (
          <div key={t.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[var(--muted)]/30 transition-colors"
              onClick={() => toggleExpand(t.id)}
            >
              <div className="flex items-center gap-3">
                {expanded === t.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span className="font-medium">{t.nome}</span>
                {t.descricao && <span className="text-sm text-[var(--muted-foreground)]">— {t.descricao}</span>}
              </div>
              <div className="flex items-center gap-3">
                {t.vendedores_count != null && t.vendedores_count > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                    <Users size={12} /> {t.vendedores_count} vendedor{t.vendedores_count > 1 ? 'es' : ''}
                  </span>
                )}
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${t.ativo ? 'badge-aprovado' : 'badge-cancelado'}`}>
                  {t.ativo ? 'Ativo' : 'Inativo'}
                </span>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" onClick={() => { loadTabela(t.id); setEditModal(t) }}><Pencil size={14} /></Button>
                  <Button variant="ghost" size="icon" className="text-[var(--destructive)]" onClick={() => setDeleteId(t.id)}><Trash2 size={14} /></Button>
                </div>
              </div>
            </div>

            {/* Expanded faixas */}
            {expanded === t.id && (
              <div className="border-t border-[var(--border)] px-4 py-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[var(--muted-foreground)] text-xs">
                      <th className="text-left pb-2 font-medium">Mínimo Rolos</th>
                      <th className="text-left pb-2 font-medium">Máximo Rolos</th>
                      <th className="text-right pb-2 font-medium">Margem (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(t.faixas ?? []).length === 0 && (
                      <tr><td colSpan={3} className="text-center py-4 text-[var(--muted-foreground)] text-xs">Nenhuma faixa definida</td></tr>
                    )}
                    {(t.faixas ?? []).map((f, i) => (
                      <tr key={f.id ?? i} className="border-t border-[var(--border)] border-dashed">
                        <td className="py-2">{f.min_rolos}</td>
                        <td className="py-2">{f.max_rolos ?? 'Sem limite'}</td>
                        <td className="py-2 text-right font-mono font-medium">{Number(f.percentual)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create modal */}
      <TabelaMargemFormModal
        open={createModal}
        onClose={() => setCreateModal(false)}
        onSaved={() => { setCreateModal(false); load() }}
      />

      {/* Edit modal */}
      {editModal && (
        <TabelaMargemFormModal
          open={true}
          tabela={editModal}
          onClose={() => setEditModal(null)}
          onSaved={() => { setEditModal(null); load() }}
        />
      )}

      {/* Delete confirm */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader>
          <p className="text-sm text-[var(--muted-foreground)]">Desativar esta tabela de margem?</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Desativar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Form Modal with dynamic faixas ────────────────────────────────────────────

function TabelaMargemFormModal({ open, tabela, onClose, onSaved }: {
  open: boolean; tabela?: TabelaComFaixas; onClose: () => void; onSaved: () => void
}) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [nome, setNome] = useState(tabela?.nome ?? '')
  const [descricao, setDescricao] = useState(tabela?.descricao ?? '')
  const [faixas, setFaixas] = useState<{ min_rolos: number; max_rolos: number | null; percentual: number }[]>(
    tabela?.faixas?.map(f => ({ min_rolos: f.min_rolos, max_rolos: f.max_rolos, percentual: Number(f.percentual) })) ?? [
      { min_rolos: 1, max_rolos: 3, percentual: 250 },
      { min_rolos: 4, max_rolos: 9, percentual: 220 },
      { min_rolos: 10, max_rolos: 19, percentual: 200 },
      { min_rolos: 20, max_rolos: null, percentual: 180 },
    ]
  )

  // Reset when tabela changes
  useEffect(() => {
    setNome(tabela?.nome ?? '')
    setDescricao(tabela?.descricao ?? '')
    setFaixas(
      tabela?.faixas?.map(f => ({ min_rolos: f.min_rolos, max_rolos: f.max_rolos, percentual: Number(f.percentual) })) ?? [
        { min_rolos: 1, max_rolos: 3, percentual: 250 },
        { min_rolos: 4, max_rolos: 9, percentual: 220 },
        { min_rolos: 10, max_rolos: 19, percentual: 200 },
        { min_rolos: 20, max_rolos: null, percentual: 180 },
      ]
    )
  }, [tabela])

  function addFaixa() {
    const lastMax = faixas.length > 0 ? (faixas[faixas.length - 1].max_rolos ?? faixas[faixas.length - 1].min_rolos) : 0
    setFaixas([...faixas, { min_rolos: lastMax + 1, max_rolos: null, percentual: 100 }])
  }

  function removeFaixa(i: number) {
    setFaixas(faixas.filter((_, idx) => idx !== i))
  }

  function updateFaixa(i: number, field: string, value: number | null) {
    setFaixas(faixas.map((f, idx) => idx === i ? { ...f, [field]: value } : f))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) { toast({ title: 'Nome obrigatório', variant: 'destructive' }); return }
    if (faixas.length === 0) { toast({ title: 'Adicione ao menos uma faixa', variant: 'destructive' }); return }

    setSaving(true)
    try {
      const payload = { nome, descricao: descricao || undefined, faixas }
      if (tabela) await tabelasMargemService.update(tabela.id, payload)
      else await tabelasMargemService.create(payload)
      toast({ title: tabela ? 'Tabela atualizada' : 'Tabela criada' })
      onSaved()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.response?.data?.error, variant: 'destructive' })
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{tabela ? 'Editar Tabela de Margem' : 'Nova Tabela de Margem'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Padrão" required />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Faixas de Margem</Label>
              <Button type="button" size="sm" variant="outline" onClick={addFaixa}><Plus size={14} /> Faixa</Button>
            </div>
            <div className="rounded-lg border border-[var(--border)] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--muted)]/30 text-xs">
                    <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)]">Mín. Rolos</th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)]">Máx. Rolos</th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)]">Margem (%)</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {faixas.map((f, i) => (
                    <tr key={i} className="border-t border-[var(--border)]">
                      <td className="px-3 py-1.5">
                        <Input type="number" className="h-8" value={f.min_rolos} onChange={(e) => updateFaixa(i, 'min_rolos', Number(e.target.value))} />
                      </td>
                      <td className="px-3 py-1.5">
                        <Input type="number" className="h-8" value={f.max_rolos ?? ''} placeholder="∞" onChange={(e) => updateFaixa(i, 'max_rolos', e.target.value ? Number(e.target.value) : null)} />
                      </td>
                      <td className="px-3 py-1.5">
                        <Input type="number" step="0.01" className="h-8" value={f.percentual} onChange={(e) => updateFaixa(i, 'percentual', Number(e.target.value))} />
                      </td>
                      <td className="px-1">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-[var(--destructive)]" onClick={() => removeFaixa(i)}>
                          <Trash2 size={12} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {faixas.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-4 text-xs text-[var(--muted-foreground)]">Nenhuma faixa</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving && <Loader2 size={14} className="animate-spin" />} Salvar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { requireFeature } = await import('@/lib/require-feature')
  const guard = await requireFeature(ctx, 'tabelas_margem')
  if (guard) return guard
  return { props: {} }
}
