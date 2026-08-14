import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Loader2, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ClienteForm } from '@/components/forms/cliente-form'
import { clientesService } from '@/services/api'
import { useToast } from '@/hooks/use-toast'
import { formatCNPJ } from '@/lib/utils'
import type { Cliente } from '@/types'

interface ClienteComboboxProps {
  value: number | ''
  onChange: (id: number, cliente: Cliente) => void
  disabled?: boolean
}

/** Busca cliente por nome/CNPJ enquanto digita. Se não achar, oferece cadastrar na hora. */
export function ClienteCombobox({ value, onChange, disabled }: ClienteComboboxProps) {
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [selectedLabel, setSelectedLabel] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Cliente[]>([])
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Carrega o nome do cliente já selecionado (ex: orçamento existente)
  useEffect(() => {
    if (value && !selectedLabel) {
      clientesService.get(Number(value)).then(({ data }) => {
        setSelectedLabel(data.data.razao_social)
      }).catch(() => {})
    }
    if (!value) setSelectedLabel('')
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const runSearch = useCallback((q: string) => {
    clearTimeout(searchTimeout.current)
    if (!q.trim()) { setResults([]); setLoading(false); return }
    setLoading(true)
    searchTimeout.current = setTimeout(async () => {
      try {
        const { data } = await clientesService.list({ search: q, limit: 8 })
        setResults(data.data.data ?? data.data)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 350)
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function selectCliente(c: Cliente) {
    onChange(c.id, c)
    setSelectedLabel(c.razao_social)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  async function handleCreate(formData: any) {
    setSaving(true)
    try {
      const { data } = await clientesService.create(formData)
      toast({ title: 'Cliente criado' })
      selectCliente(data.data)
      setCreating(false)
    } catch (err: any) {
      toast({ title: 'Erro ao criar cliente', description: err.response?.data?.error, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const showEmpty = !loading && query.trim().length > 0 && results.length === 0

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome ou CNPJ..."
          disabled={disabled}
          value={open ? query : selectedLabel}
          onFocus={() => { setOpen(true); setQuery('') }}
          onChange={(e) => { setQuery(e.target.value); runSearch(e.target.value) }}
        />
      </div>

      {open && !disabled && (query.trim().length > 0) && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--popover)] text-[var(--popover-foreground)] shadow-md">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--muted-foreground)]">
              <Loader2 size={14} className="animate-spin" /> Buscando...
            </div>
          )}
          {!loading && results.map(c => (
            <button
              key={c.id}
              type="button"
              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
              onClick={() => selectCliente(c)}
            >
              <span className="font-medium">{c.razao_social}</span>
              <span className="text-xs text-[var(--muted-foreground)]">{formatCNPJ(c.cnpj)}</span>
            </button>
          ))}
          {showEmpty && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--primary)] hover:bg-[var(--accent)]"
              onClick={() => { setCreating(true); setOpen(false) }}
            >
              <Plus size={14} /> Cadastrar &quot;{query}&quot; como novo cliente
            </button>
          )}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
          <ClienteForm defaultValues={{ razao_social: query }} onSubmit={handleCreate} loading={saving} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
