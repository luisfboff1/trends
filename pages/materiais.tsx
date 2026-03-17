import { useState, useEffect, useCallback } from 'react'
import { GetServerSideProps } from 'next'
import { getSession, useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  tiposPapelService, fornecedoresPapelService,
  facasService, coresPantoneService, tubetesService, acabamentosService,
} from '@/services/api'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/utils'
import { tipoPapelSchema, type TipoPapelInput } from '@/lib/validations/tipo-papel'
import { facaSchema, type FacaInput } from '@/lib/validations/faca'
import type { TipoPapel, Faca, CorPantone, Tubete, Acabamento, FornecedorPapel } from '@/types'

// ── Tab system ────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'papeis', label: 'Tipos de Papel' },
  { key: 'facas', label: 'Facas' },
  { key: 'cores', label: 'Cores Pantone' },
  { key: 'tubetes', label: 'Tubetes' },
  { key: 'acabamentos', label: 'Acabamentos' },
] as const
type TabKey = (typeof TABS)[number]['key']

// ── Shared table wrapper ──────────────────────────────────────────────────────
function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--card)]">
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`text-left px-4 py-3 font-medium text-[var(--muted-foreground)] ${className}`}>{children}</th>
}

function Td({ children, className = '', colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return <td className={`px-4 py-3 ${className}`} colSpan={colSpan}>{children}</td>
}

function LoadingRow({ cols }: { cols: number }) {
  return <tr><td colSpan={cols} className="text-center py-12"><div className="h-5 w-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
}

function EmptyRow({ cols, text = 'Nenhum item' }: { cols: number; text?: string }) {
  return <tr><td colSpan={cols} className="text-center py-12 text-[var(--muted-foreground)]">{text}</td></tr>
}

function ActionButtons({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex gap-1 justify-end">
      <Button variant="ghost" size="icon" onClick={onEdit}><Pencil size={14} /></Button>
      <Button variant="ghost" size="icon" className="text-[var(--destructive)]" onClick={onDelete}><Trash2 size={14} /></Button>
    </div>
  )
}

function DeleteDialog({ open, onClose, onConfirm, text }: { open: boolean; onClose: () => void; onConfirm: () => void; text: string }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader>
        <p className="text-sm text-[var(--muted-foreground)]">{text}</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={onConfirm}>Desativar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Tipos de Papel
// ═══════════════════════════════════════════════════════════════════════════════

function TipoPapelForm({ defaultValues, onSubmit, loading }: {
  defaultValues?: Partial<TipoPapelInput>; onSubmit: (d: TipoPapelInput) => Promise<void>; loading?: boolean
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<TipoPapelInput>({
    resolver: zodResolver(tipoPapelSchema),
    defaultValues: defaultValues ?? {},
  })
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="tp-nome">Nome *</Label>
          <Input id="tp-nome" {...register('nome')} placeholder="Ex: COUCHE BORRACHA" />
          {errors.nome && <p className="text-xs text-[var(--destructive)]">{errors.nome.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tp-preco">Preço m² *</Label>
          <Input id="tp-preco" type="number" step="0.0001" {...register('preco_m2', { valueAsNumber: true })} placeholder="0.0000" />
          {errors.preco_m2 && <p className="text-xs text-[var(--destructive)]">{errors.preco_m2.message}</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tp-desc">Descrição</Label>
        <Textarea id="tp-desc" {...register('descricao')} rows={2} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={loading}>{loading && <Loader2 size={14} className="animate-spin" />} Salvar</Button>
      </div>
    </form>
  )
}

interface FornecedorFormData {
  fornecedor: string; preco_m2: number; pago?: number; icms?: number; ipi?: number; frete?: number; total?: number; data_compra?: string
}

function FornecedorRow({ f, tipoPapelId, onChanged }: { f: FornecedorPapel; tipoPapelId: number; onChanged: () => void }) {
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { register, handleSubmit } = useForm<FornecedorFormData>({
    defaultValues: { fornecedor: f.fornecedor, preco_m2: Number(f.preco_m2), pago: f.pago ? Number(f.pago) : undefined, icms: f.icms ? Number(f.icms) : undefined, ipi: f.ipi ? Number(f.ipi) : undefined, frete: f.frete ? Number(f.frete) : undefined, total: f.total ? Number(f.total) : undefined, data_compra: f.data_compra?.slice(0, 10) },
  })

  async function save(d: FornecedorFormData) {
    try {
      await fornecedoresPapelService.update(tipoPapelId, f.id, d)
      toast({ title: 'Fornecedor atualizado' })
      setEditing(false)
      onChanged()
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    }
  }

  async function remove() {
    try {
      await fornecedoresPapelService.delete(tipoPapelId, f.id)
      toast({ title: 'Fornecedor removido' })
      onChanged()
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' })
    }
  }

  if (editing) {
    return (
      <tr className="bg-[var(--muted)]/20">
        <td colSpan={6} className="px-6 py-2">
          <form onSubmit={handleSubmit(save)} className="grid grid-cols-4 gap-2 items-end">
            <Input size={1} placeholder="Fornecedor" {...register('fornecedor')} />
            <Input size={1} type="number" step="0.0001" placeholder="R$/m²" {...register('preco_m2', { valueAsNumber: true })} />
            <Input size={1} type="date" {...register('data_compra')} />
            <div className="flex gap-1">
              <Button size="sm" type="submit">Salvar</Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>X</Button>
            </div>
          </form>
        </td>
      </tr>
    )
  }

  return (
    <tr className="bg-[var(--muted)]/10 text-xs">
      <Td className="pl-10">{f.fornecedor}</Td>
      <Td>{formatCurrency(Number(f.preco_m2))}</Td>
      <Td>{f.icms != null ? `${Number(f.icms)}%` : '—'}</Td>
      <Td>{f.data_compra ? new Date(f.data_compra).toLocaleDateString('pt-BR') : '—'}</Td>
      <Td className="text-right">{f.total != null ? formatCurrency(Number(f.total)) : '—'}</Td>
      <Td>
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(true)}><Pencil size={12} /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-[var(--destructive)]" onClick={() => { if (deleting) { remove() } else { setDeleting(true); setTimeout(() => setDeleting(false), 2000) } }}>
            <Trash2 size={12} />
          </Button>
        </div>
      </Td>
    </tr>
  )
}

function PapeisTab() {
  const { toast } = useToast()
  const [tipos, setTipos] = useState<TipoPapel[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; tipo?: TipoPapel }>({ open: false })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [fornecedores, setFornecedores] = useState<Record<number, FornecedorPapel[]>>({})
  const [addingForn, setAddingForn] = useState<number | null>(null)
  const addForm = useForm<FornecedorFormData>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await tiposPapelService.list(false)
      setTipos(data.data.data ?? data.data)
    } catch {
      toast({ title: 'Erro ao carregar', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function loadFornecedores(tipoPapelId: number) {
    try {
      const { data } = await fornecedoresPapelService.list(tipoPapelId)
      setFornecedores(prev => ({ ...prev, [tipoPapelId]: data.data }))
    } catch { /* silent */ }
  }

  function toggleExpand(id: number) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!fornecedores[id]) loadFornecedores(id)
  }

  async function handleSave(d: TipoPapelInput) {
    setSaving(true)
    try {
      if (modal.tipo) await tiposPapelService.update(modal.tipo.id, d)
      else await tiposPapelService.create(d)
      toast({ title: modal.tipo ? 'Tipo atualizado' : 'Tipo criado' })
      setModal({ open: false }); load()
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.response?.data?.error, variant: 'destructive' })
    } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    try {
      await tiposPapelService.delete(id)
      toast({ title: 'Tipo removido' }); setDeleteId(null); load()
    } catch { toast({ title: 'Erro ao remover', variant: 'destructive' }) }
  }

  async function handleAddFornecedor(tipoPapelId: number, d: FornecedorFormData) {
    try {
      await fornecedoresPapelService.create(tipoPapelId, d)
      toast({ title: 'Fornecedor adicionado' })
      setAddingForn(null); addForm.reset()
      loadFornecedores(tipoPapelId); load()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.response?.data?.error, variant: 'destructive' })
    }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setModal({ open: true })}><Plus size={16} /> Novo Tipo de Papel</Button>
      </div>
      <TableWrapper>
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
            <Th className="w-8" />
            <Th>Nome</Th>
            <Th className="text-right">Preço Médio m²</Th>
            <Th className="hidden md:table-cell">Fornecedores</Th>
            <Th>Status</Th>
            <Th className="w-20" />
          </tr>
        </thead>
        <tbody>
          {loading && <LoadingRow cols={6} />}
          {!loading && tipos.length === 0 && <EmptyRow cols={6} text="Nenhum tipo cadastrado" />}
          {!loading && tipos.map((t) => (
            <>
              <tr key={t.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/30 transition-colors">
                <Td>
                  <button onClick={() => toggleExpand(t.id)} className="p-0.5 rounded hover:bg-[var(--muted)]">
                    {expanded === t.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                </Td>
                <Td className="font-medium">{t.nome}</Td>
                <Td className="text-right">
                  {(t as any).preco_m2_medio
                    ? <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold badge-aprovado">{formatCurrency(Number((t as any).preco_m2_medio))}</span>
                    : formatCurrency(Number(t.preco_m2))
                  }
                </Td>
                <Td className="hidden md:table-cell text-[var(--muted-foreground)]">{fornecedores[t.id]?.length ?? '—'}</Td>
                <Td>
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${t.ativo ? 'badge-aprovado' : 'badge-cancelado'}`}>
                    {t.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </Td>
                <Td><ActionButtons onEdit={() => setModal({ open: true, tipo: t })} onDelete={() => setDeleteId(t.id)} /></Td>
              </tr>
              {expanded === t.id && (
                <>
                  {/* Fornecedores header */}
                  <tr key={`h-${t.id}`} className="bg-[var(--muted)]/20 text-xs">
                    <Td className="pl-10 font-semibold text-[var(--muted-foreground)]" colSpan={6}>
                      <div className="flex items-center justify-between">
                        <span>Fornecedores</span>
                        <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => { setAddingForn(t.id); addForm.reset() }}>
                          <Plus size={12} /> Adicionar
                        </Button>
                      </div>
                    </Td>
                  </tr>
                  {addingForn === t.id && (
                    <tr key={`add-${t.id}`} className="bg-[var(--muted)]/20">
                      <td colSpan={6} className="px-6 py-2">
                        <form onSubmit={addForm.handleSubmit((d) => handleAddFornecedor(t.id, d))} className="grid grid-cols-4 gap-2 items-end">
                          <Input size={1} placeholder="Fornecedor" {...addForm.register('fornecedor')} />
                          <Input size={1} type="number" step="0.0001" placeholder="R$/m²" {...addForm.register('preco_m2', { valueAsNumber: true })} />
                          <Input size={1} type="date" {...addForm.register('data_compra')} />
                          <div className="flex gap-1">
                            <Button size="sm" type="submit">Salvar</Button>
                            <Button size="sm" variant="ghost" type="button" onClick={() => setAddingForn(null)}>X</Button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                  {(fornecedores[t.id] ?? []).map((f) => (
                    <FornecedorRow key={f.id} f={f} tipoPapelId={t.id} onChanged={() => { loadFornecedores(t.id); load() }} />
                  ))}
                  {fornecedores[t.id]?.length === 0 && (
                    <tr key={`empty-${t.id}`} className="bg-[var(--muted)]/10"><td colSpan={6} className="text-center py-4 text-xs text-[var(--muted-foreground)]">Nenhum fornecedor</td></tr>
                  )}
                </>
              )}
            </>
          ))}
        </tbody>
      </TableWrapper>

      <Dialog open={modal.open} onOpenChange={(o) => !o && setModal({ open: false })}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{modal.tipo ? 'Editar Tipo de Papel' : 'Novo Tipo de Papel'}</DialogTitle></DialogHeader>
          <TipoPapelForm defaultValues={modal.tipo} onSubmit={handleSave} loading={saving} />
        </DialogContent>
      </Dialog>
      <DeleteDialog open={deleteId !== null} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && handleDelete(deleteId)} text="Desativar este tipo de papel?" />
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Facas
// ═══════════════════════════════════════════════════════════════════════════════

const TIPOS_FACA = [
  { value: 'rotativa_160', label: 'Rotativa 160mm' },
  { value: 'rotativa_250', label: 'Rotativa 250mm' },
  { value: 'batida', label: 'Batida' },
]

function FacaForm({ defaultValues, onSubmit, loading }: {
  defaultValues?: Partial<FacaInput>; onSubmit: (d: FacaInput) => Promise<void>; loading?: boolean
}) {
  const { register, handleSubmit, control, formState: { errors } } = useForm<FacaInput>({
    resolver: zodResolver(facaSchema),
    defaultValues: { colunas: 1, velocidade_multiplicador: 1, percentual_adicional: 0, ...defaultValues },
  })
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Nome *</Label>
          <Input {...register('nome')} placeholder="Ex: Faca 50x30 1col" />
          {errors.nome && <p className="text-xs text-[var(--destructive)]">{errors.nome.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Tipo *</Label>
          <Controller name="tipo" control={control} render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {TIPOS_FACA.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )} />
          {errors.tipo && <p className="text-xs text-[var(--destructive)]">{errors.tipo.message}</p>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Largura (mm) *</Label>
          <Input type="number" step="0.01" {...register('largura_mm', { valueAsNumber: true })} />
          {errors.largura_mm && <p className="text-xs text-[var(--destructive)]">{errors.largura_mm.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Altura (mm) *</Label>
          <Input type="number" step="0.01" {...register('altura_mm', { valueAsNumber: true })} />
          {errors.altura_mm && <p className="text-xs text-[var(--destructive)]">{errors.altura_mm.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Colunas</Label>
          <Input type="number" {...register('colunas', { valueAsNumber: true })} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Máquina</Label>
          <Input {...register('maquina')} placeholder="Opcional" />
        </div>
        <div className="space-y-1.5">
          <Label>% Adicional</Label>
          <Input type="number" step="0.01" {...register('percentual_adicional', { valueAsNumber: true })} />
        </div>
        <div className="space-y-1.5">
          <Label>Veloc. Multiplicador</Label>
          <Input type="number" step="0.01" {...register('velocidade_multiplicador', { valueAsNumber: true })} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={loading}>{loading && <Loader2 size={14} className="animate-spin" />} Salvar</Button>
      </div>
    </form>
  )
}

function FacasTab() {
  const { toast } = useToast()
  const [facas, setFacas] = useState<Faca[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; faca?: Faca }>({ open: false })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await facasService.list(filtroTipo || undefined)
      setFacas(data.data.data ?? data.data)
    } catch { toast({ title: 'Erro ao carregar', variant: 'destructive' }) }
    finally { setLoading(false) }
  }, [filtroTipo])

  useEffect(() => { load() }, [load])

  async function handleSave(d: FacaInput) {
    setSaving(true)
    try {
      if (modal.faca) await facasService.update(modal.faca.id, d)
      else await facasService.create(d)
      toast({ title: modal.faca ? 'Faca atualizada' : 'Faca criada' })
      setModal({ open: false }); load()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.response?.data?.error, variant: 'destructive' })
    } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    try { await facasService.delete(id); toast({ title: 'Faca removida' }); setDeleteId(null); load() }
    catch { toast({ title: 'Erro ao remover', variant: 'destructive' }) }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex gap-1 p-1 bg-[var(--muted)] rounded-lg">
          <button onClick={() => setFiltroTipo('')} className={`px-3 py-1.5 text-sm rounded-md transition-colors font-medium ${!filtroTipo ? 'bg-[var(--card)] shadow-sm' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}>Todas</button>
          {TIPOS_FACA.map(t => (
            <button key={t.value} onClick={() => setFiltroTipo(t.value)} className={`px-3 py-1.5 text-sm rounded-md transition-colors font-medium ${filtroTipo === t.value ? 'bg-[var(--card)] shadow-sm' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}>{t.label}</button>
          ))}
        </div>
        <Button onClick={() => setModal({ open: true })}><Plus size={16} /> Nova Faca</Button>
      </div>
      <TableWrapper>
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
            <Th>Nome</Th>
            <Th>Tipo</Th>
            <Th className="text-right">Largura</Th>
            <Th className="text-right">Altura</Th>
            <Th className="text-right hidden md:table-cell">Colunas</Th>
            <Th className="hidden lg:table-cell">Máquina</Th>
            <Th className="w-20" />
          </tr>
        </thead>
        <tbody>
          {loading && <LoadingRow cols={7} />}
          {!loading && facas.length === 0 && <EmptyRow cols={7} text="Nenhuma faca cadastrada" />}
          {!loading && facas.map(f => (
            <tr key={f.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/30 transition-colors">
              <Td className="font-medium">{f.nome}</Td>
              <Td>
                <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold">
                  {TIPOS_FACA.find(t => t.value === f.tipo)?.label ?? f.tipo}
                </span>
              </Td>
              <Td className="text-right">{Number(f.largura_mm)}mm</Td>
              <Td className="text-right">{Number(f.altura_mm)}mm</Td>
              <Td className="text-right hidden md:table-cell">{f.colunas}</Td>
              <Td className="hidden lg:table-cell text-[var(--muted-foreground)]">{f.maquina ?? '—'}</Td>
              <Td><ActionButtons onEdit={() => setModal({ open: true, faca: f })} onDelete={() => setDeleteId(f.id)} /></Td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>

      <Dialog open={modal.open} onOpenChange={(o) => !o && setModal({ open: false })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{modal.faca ? 'Editar Faca' : 'Nova Faca'}</DialogTitle></DialogHeader>
          <FacaForm defaultValues={modal.faca} onSubmit={handleSave} loading={saving} />
        </DialogContent>
      </Dialog>
      <DeleteDialog open={deleteId !== null} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && handleDelete(deleteId)} text="Desativar esta faca?" />
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Cores Pantone
// ═══════════════════════════════════════════════════════════════════════════════

function CoresTab() {
  const { toast } = useToast()
  const [cores, setCores] = useState<CorPantone[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; cor?: CorPantone }>({ open: false })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await coresPantoneService.list()
      setCores(data.data.data ?? data.data)
    } catch { toast({ title: 'Erro ao carregar', variant: 'destructive' }) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function handleSave(d: Record<string, unknown>) {
    setSaving(true)
    try {
      if (modal.cor) await coresPantoneService.update(modal.cor.id, d)
      else await coresPantoneService.create(d)
      toast({ title: modal.cor ? 'Cor atualizada' : 'Cor criada' }); setModal({ open: false }); load()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.response?.data?.error, variant: 'destructive' })
    } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    try { await coresPantoneService.delete(id); toast({ title: 'Cor removida' }); setDeleteId(null); load() }
    catch { toast({ title: 'Erro', variant: 'destructive' }) }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setModal({ open: true })}><Plus size={16} /> Nova Cor</Button>
      </div>
      <TableWrapper>
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
            <Th>Código</Th>
            <Th>Nome</Th>
            <Th className="text-right">Custo m²</Th>
            <Th className="text-right hidden md:table-cell">% Hora Sep.</Th>
            <Th className="w-20" />
          </tr>
        </thead>
        <tbody>
          {loading && <LoadingRow cols={5} />}
          {!loading && cores.length === 0 && <EmptyRow cols={5} text="Nenhuma cor Pantone cadastrada" />}
          {!loading && cores.map(c => (
            <tr key={c.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/30 transition-colors">
              <Td className="font-mono font-medium">{c.codigo}</Td>
              <Td>{c.nome ?? '—'}</Td>
              <Td className="text-right">{formatCurrency(Number(c.custo_m2))}</Td>
              <Td className="text-right hidden md:table-cell">{Number(c.percentual_hora_separacao)}%</Td>
              <Td><ActionButtons onEdit={() => setModal({ open: true, cor: c })} onDelete={() => setDeleteId(c.id)} /></Td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>

      <Dialog open={modal.open} onOpenChange={(o) => !o && setModal({ open: false })}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{modal.cor ? 'Editar Cor Pantone' : 'Nova Cor Pantone'}</DialogTitle></DialogHeader>
          <CorPantoneForm defaultValues={modal.cor} onSubmit={handleSave} loading={saving} />
        </DialogContent>
      </Dialog>
      <DeleteDialog open={deleteId !== null} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && handleDelete(deleteId)} text="Desativar esta cor?" />
    </>
  )
}

function CorPantoneForm({ defaultValues, onSubmit, loading }: {
  defaultValues?: Partial<CorPantone>; onSubmit: (d: Record<string, unknown>) => Promise<void>; loading?: boolean
}) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { codigo: defaultValues?.codigo ?? '', nome: defaultValues?.nome ?? '', custo_m2: defaultValues?.custo_m2 != null ? Number(defaultValues.custo_m2) : 0.30, percentual_hora_separacao: defaultValues?.percentual_hora_separacao != null ? Number(defaultValues.percentual_hora_separacao) : 0 },
  })
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Código *</Label>
          <Input {...register('codigo', { required: 'Código obrigatório' })} placeholder="Pantone 186 C" />
          {errors.codigo && <p className="text-xs text-[var(--destructive)]">{(errors.codigo as any).message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Nome</Label>
          <Input {...register('nome')} placeholder="Vermelho" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Custo por m² (R$)</Label>
          <Input type="number" step="0.01" {...register('custo_m2', { valueAsNumber: true })} />
        </div>
        <div className="space-y-1.5">
          <Label>% Hora Separação</Label>
          <Input type="number" step="0.01" {...register('percentual_hora_separacao', { valueAsNumber: true })} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={loading}>{loading && <Loader2 size={14} className="animate-spin" />} Salvar</Button>
      </div>
    </form>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Tubetes
// ═══════════════════════════════════════════════════════════════════════════════

function TubetesTab() {
  const { toast } = useToast()
  const [tubetes, setTubetes] = useState<Tubete[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; tubete?: Tubete }>({ open: false })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await tubetesService.list()
      setTubetes(data.data.data ?? data.data)
    } catch { toast({ title: 'Erro ao carregar', variant: 'destructive' }) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function handleSave(d: Record<string, unknown>) {
    setSaving(true)
    try {
      if (modal.tubete) await tubetesService.update(modal.tubete.id, d)
      else await tubetesService.create(d)
      toast({ title: modal.tubete ? 'Tubete atualizado' : 'Tubete criado' }); setModal({ open: false }); load()
    } catch (err: any) { toast({ title: 'Erro', description: err.response?.data?.error, variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    try { await tubetesService.delete(id); toast({ title: 'Tubete removido' }); setDeleteId(null); load() }
    catch { toast({ title: 'Erro', variant: 'destructive' }) }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setModal({ open: true })}><Plus size={16} /> Novo Tubete</Button>
      </div>
      <TableWrapper>
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
            <Th>Diâmetro</Th>
            <Th>Descrição</Th>
            <Th className="text-right">Custo/Unidade</Th>
            <Th className="w-20" />
          </tr>
        </thead>
        <tbody>
          {loading && <LoadingRow cols={4} />}
          {!loading && tubetes.length === 0 && <EmptyRow cols={4} text="Nenhum tubete cadastrado" />}
          {!loading && tubetes.map(t => (
            <tr key={t.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/30 transition-colors">
              <Td className="font-medium">{t.diametro_mm}mm</Td>
              <Td className="text-[var(--muted-foreground)]">{t.descricao ?? '—'}</Td>
              <Td className="text-right">{formatCurrency(Number(t.custo_unidade))}</Td>
              <Td><ActionButtons onEdit={() => setModal({ open: true, tubete: t })} onDelete={() => setDeleteId(t.id)} /></Td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>

      <Dialog open={modal.open} onOpenChange={(o) => !o && setModal({ open: false })}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{modal.tubete ? 'Editar Tubete' : 'Novo Tubete'}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); handleSave({ diametro_mm: Number(fd.get('diametro_mm')), descricao: fd.get('descricao') || undefined, custo_unidade: Number(fd.get('custo_unidade')) }) }} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Diâmetro (mm) *</Label>
              <Input name="diametro_mm" type="number" defaultValue={modal.tubete?.diametro_mm} required />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input name="descricao" defaultValue={modal.tubete?.descricao ?? ''} />
            </div>
            <div className="space-y-1.5">
              <Label>Custo por Unidade (R$) *</Label>
              <Input name="custo_unidade" type="number" step="0.0001" defaultValue={modal.tubete?.custo_unidade != null ? Number(modal.tubete.custo_unidade) : ''} required />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="submit" disabled={saving}>{saving && <Loader2 size={14} className="animate-spin" />} Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <DeleteDialog open={deleteId !== null} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && handleDelete(deleteId)} text="Desativar este tubete?" />
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Acabamentos
// ═══════════════════════════════════════════════════════════════════════════════

function AcabamentosTab() {
  const { toast } = useToast()
  const [acabamentos, setAcabamentos] = useState<Acabamento[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; acabamento?: Acabamento }>({ open: false })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await acabamentosService.list()
      setAcabamentos(data.data.data ?? data.data)
    } catch { toast({ title: 'Erro ao carregar', variant: 'destructive' }) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function handleSave(d: Record<string, unknown>) {
    setSaving(true)
    try {
      if (modal.acabamento) await acabamentosService.update(modal.acabamento.id, d)
      else await acabamentosService.create(d)
      toast({ title: modal.acabamento ? 'Acabamento atualizado' : 'Acabamento criado' }); setModal({ open: false }); load()
    } catch (err: any) { toast({ title: 'Erro', description: err.response?.data?.error, variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    try { await acabamentosService.delete(id); toast({ title: 'Acabamento removido' }); setDeleteId(null); load() }
    catch { toast({ title: 'Erro', variant: 'destructive' }) }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setModal({ open: true })}><Plus size={16} /> Novo Acabamento</Button>
      </div>
      <TableWrapper>
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
            <Th>Nome</Th>
            <Th>Descrição</Th>
            <Th className="text-right">% Adicional</Th>
            <Th className="w-20" />
          </tr>
        </thead>
        <tbody>
          {loading && <LoadingRow cols={4} />}
          {!loading && acabamentos.length === 0 && <EmptyRow cols={4} text="Nenhum acabamento cadastrado" />}
          {!loading && acabamentos.map(a => (
            <tr key={a.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/30 transition-colors">
              <Td className="font-medium">{a.nome}</Td>
              <Td className="text-[var(--muted-foreground)]">{a.descricao ?? '—'}</Td>
              <Td className="text-right">{Number(a.percentual_adicional)}%</Td>
              <Td><ActionButtons onEdit={() => setModal({ open: true, acabamento: a })} onDelete={() => setDeleteId(a.id)} /></Td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>

      <Dialog open={modal.open} onOpenChange={(o) => !o && setModal({ open: false })}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{modal.acabamento ? 'Editar Acabamento' : 'Novo Acabamento'}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); handleSave({ nome: fd.get('nome'), descricao: fd.get('descricao') || undefined, percentual_adicional: Number(fd.get('percentual_adicional')) }) }} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input name="nome" defaultValue={modal.acabamento?.nome ?? ''} required />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input name="descricao" defaultValue={modal.acabamento?.descricao ?? ''} />
            </div>
            <div className="space-y-1.5">
              <Label>% Adicional *</Label>
              <Input name="percentual_adicional" type="number" step="0.01" defaultValue={modal.acabamento?.percentual_adicional != null ? Number(modal.acabamento.percentual_adicional) : 0} required />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="submit" disabled={saving}>{saving && <Loader2 size={14} className="animate-spin" />} Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <DeleteDialog open={deleteId !== null} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && handleDelete(deleteId)} text="Desativar este acabamento?" />
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function MateriaisPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const isAdmin = (session?.user as any)?.tipo === 'admin'
  const [tab, setTab] = useState<TabKey>('papeis')

  useEffect(() => {
    if (session && !isAdmin) router.push('/dashboard')
  }, [session, isAdmin])

  if (!isAdmin) return null

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-[var(--muted)] rounded-lg overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm rounded-md transition-colors font-medium whitespace-nowrap ${
              tab === t.key ? 'bg-[var(--card)] shadow-sm' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'papeis' && <PapeisTab />}
      {tab === 'facas' && <FacasTab />}
      {tab === 'cores' && <CoresTab />}
      {tab === 'tubetes' && <TubetesTab />}
      {tab === 'acabamentos' && <AcabamentosTab />}
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession(ctx)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  return { props: {} }
}
