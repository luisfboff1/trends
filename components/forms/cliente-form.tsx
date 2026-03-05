import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Search, Loader2 } from 'lucide-react'
import { clienteSchema } from '@/lib/validations/cliente'
import type { ClienteInput } from '@/lib/validations/cliente'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { clientesService, usuariosService } from '@/services/api'
import { formatCNPJ } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface ClienteFormProps {
  defaultValues?: Partial<ClienteInput>
  onSubmit: (data: ClienteInput) => Promise<void>
  loading?: boolean
}

export function ClienteForm({ defaultValues, onSubmit, loading }: ClienteFormProps) {
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [vendedores, setVendedores] = useState<{ id: number; nome: string }[]>([])
  const { toast } = useToast()

  useEffect(() => {
    usuariosService.listVendedores().then(r => setVendedores(r.data?.data ?? [])).catch(() => {})
  }, [])

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ClienteInput>({
    resolver: zodResolver(clienteSchema),
    defaultValues: defaultValues ?? {},
  })

  const cnpj = watch('cnpj', '')

  async function lookupCnpj() {
    const raw = cnpj.replace(/\D/g, '')
    if (raw.length !== 14) return
    setCnpjLoading(true)
    try {
      const { data } = await clientesService.lookupCnpj(raw)
      const d = data.data
      setValue('razao_social', d.razao_social)
      setValue('email', d.email ?? '')
      setValue('telefone', d.telefone ?? '')
      setValue('endereco', d.endereco ?? '')
      setValue('cidade', d.cidade ?? '')
      setValue('estado', d.estado ?? '')
    } catch {
      toast({ title: 'CNPJ não encontrado', description: 'Preencha os dados manualmente.', variant: 'destructive' })
    } finally {
      setCnpjLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="cnpj">CNPJ *</Label>
        <div className="flex gap-2">
          <Input
            id="cnpj"
            placeholder="00.000.000/0000-00"
            {...register('cnpj')}
            onChange={(e) => setValue('cnpj', formatCNPJ(e.target.value))}
          />
          <Button type="button" variant="outline" size="icon" onClick={lookupCnpj} disabled={cnpjLoading} title="Buscar dados do CNPJ">
            {cnpjLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          </Button>
        </div>
        {errors.cnpj && <p className="text-xs text-[var(--destructive)]">{errors.cnpj.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="razao_social">Razão Social *</Label>
        <Input id="razao_social" {...register('razao_social')} placeholder="Nome da empresa" />
        {errors.razao_social && <p className="text-xs text-[var(--destructive)]">{errors.razao_social.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register('email')} placeholder="contato@empresa.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="telefone">Telefone</Label>
          <Input id="telefone" {...register('telefone')} placeholder="(00) 00000-0000" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="endereco">Endereço</Label>
        <Input id="endereco" {...register('endereco')} placeholder="Rua, número, complemento" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="cidade">Cidade</Label>
          <Input id="cidade" {...register('cidade')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="estado">UF</Label>
          <Input id="estado" {...register('estado')} maxLength={2} className="uppercase" placeholder="SC" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="vendedor_id">Vendedor responsável</Label>
        <Select
          value={watch('vendedor_id') ? String(watch('vendedor_id')) : ''}
          onValueChange={(v) => setValue('vendedor_id', v ? Number(v) : undefined)}
        >
          <SelectTrigger id="vendedor_id">
            <SelectValue placeholder="Selecione um vendedor (opcional)" />
          </SelectTrigger>
          <SelectContent>
            {vendedores.map((v) => (
              <SelectItem key={v.id} value={String(v.id)}>{v.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 size={14} className="animate-spin" />}
          Salvar
        </Button>
      </div>
    </form>
  )
}
