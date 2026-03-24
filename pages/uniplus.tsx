import { useState, useEffect, useCallback } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import {
  RefreshCw, Settings, History, CheckCircle2, XCircle,
  Loader2, Users, Package, CreditCard,
  ShoppingCart, UserCheck, Zap, Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { uniplusService } from '@/services/api'
import { useToast } from '@/hooks/use-toast'
import type { UniplusSyncLog, UniplusEntidade, UniplusProduto, UniplusVenda } from '@/types/uniplus'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ── Tab system ────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'setup', label: 'Setup & Sync', icon: Settings },
  { key: 'clientes', label: 'Clientes', icon: Users },
  { key: 'produtos', label: 'Produtos', icon: Package },
  { key: 'vendas', label: 'Vendas', icon: ShoppingCart },
] as const
type TabKey = (typeof TABS)[number]['key']

// ── Table primitives ──────────────────────────────────────────────────────────
function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--card)]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  )
}
function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`text-left px-3 py-2.5 font-medium text-[var(--muted-foreground)] text-xs whitespace-nowrap ${className}`}>{children}</th>
}
function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-xs whitespace-nowrap ${className}`}>{children}</td>
}

// ── Shared types ──────────────────────────────────────────────────────────────
interface SyncCounts {
  clientes: number
  produtos: number
  condicoes_pagamento: number
  pedidos: number
  vendedores: number
}

interface ConfigData {
  id: number
  server_url: string
  ativo: boolean
  last_sync_at: string | null
}

const syncTypes = [
  { tipo: 'vendedores', label: 'Vendedores', icon: UserCheck, color: 'bg-purple-500' },
  { tipo: 'clientes', label: 'Clientes', icon: Users, color: 'bg-blue-500' },
  { tipo: 'produtos', label: 'Produtos', icon: Package, color: 'bg-green-500' },
  { tipo: 'condicoes_pagamento', label: 'Cond. Pagamento', icon: CreditCard, color: 'bg-orange-500' },
  { tipo: 'vendas', label: 'Vendas/Pedidos', icon: ShoppingCart, color: 'bg-red-500' },
] as const

function fmtDate(date: string | null) {
  if (!date) return 'Nunca'
  try { return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR }) }
  catch { return date }
}

function statusBadge(status: string) {
  switch (status) {
    case 'success': return <Badge className="bg-green-100 text-green-700">Sucesso</Badge>
    case 'partial': return <Badge className="bg-yellow-100 text-yellow-700">Parcial</Badge>
    case 'error': return <Badge className="bg-red-100 text-red-700">Erro</Badge>
    case 'running': return <Badge className="bg-blue-100 text-blue-700">Executando...</Badge>
    default: return <Badge>{status}</Badge>
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Setup & Sync
// ═══════════════════════════════════════════════════════════════════════════════
function SetupTab() {
  const { toast } = useToast()
  const [config, setConfig] = useState<ConfigData | null>(null)
  const [serverUrl, setServerUrl] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [userId, setUserId] = useState('24')
  const [userPassword, setUserPassword] = useState('9637')
  const [savingConfig, setSavingConfig] = useState(false)
  const [testing, setTesting] = useState(false)
  const [counts, setCounts] = useState<SyncCounts>({ clientes: 0, produtos: 0, condicoes_pagamento: 0, pedidos: 0, vendedores: 0 })
  const [logs, setLogs] = useState<UniplusSyncLog[]>([])
  const [syncing, setSyncing] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadStatus = useCallback(async () => {
    try {
      const { data } = await uniplusService.getStatus()
      if (data.data) {
        setConfig(data.data.config)
        setCounts(data.data.counts)
        setLogs(data.data.logs || [])
        if (data.data.config?.server_url) setServerUrl(data.data.config.server_url)
      }
    } catch { /* not configured yet */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  async function handleTestConnection() {
    if (!serverUrl || !authCode) { toast({ title: 'Preencha URL e código de autenticação', variant: 'destructive' }); return }
    setTesting(true)
    try {
      const { data } = await uniplusService.testConnection({ server_url: serverUrl, auth_code: authCode, user_id: userId, user_password: userPassword })
      toast({ title: data.success ? 'Conexão bem sucedida!' : 'Falha na conexão', description: data.error, variant: data.success ? 'default' : 'destructive' })
    } catch (err: any) {
      toast({ title: 'Erro', description: err.response?.data?.error ?? 'Falha ao testar', variant: 'destructive' })
    } finally { setTesting(false) }
  }

  async function handleSaveConfig() {
    if (!serverUrl || !authCode) { toast({ title: 'Preencha todos os campos', variant: 'destructive' }); return }
    setSavingConfig(true)
    try {
      await uniplusService.saveConfig({ server_url: serverUrl, auth_code: authCode, user_id: userId, user_password: userPassword })
      toast({ title: 'Configuração salva!' })
      loadStatus()
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.response?.data?.error ?? 'Tente novamente', variant: 'destructive' })
    } finally { setSavingConfig(false) }
  }

  async function handleSync(tipo: string) {
    setSyncing(tipo)
    try {
      const { data } = await uniplusService.sync(tipo as any)
      const result = data.data
      if (result) {
        toast({
          title: `Sincronização ${result.status === 'success' ? 'concluída' : result.status === 'partial' ? 'parcial' : 'com erros'}`,
          description: `Criados: ${result.registros_criados} | Atualizados: ${result.registros_atualizados} | Erros: ${result.registros_erros}`,
          variant: result.status === 'error' ? 'destructive' : 'default',
        })
      }
      loadStatus()
    } catch (err: any) {
      toast({ title: 'Erro na sincronização', description: err.response?.data?.error ?? 'Tente novamente', variant: 'destructive' })
    } finally { setSyncing(null) }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      {config && (
        <div className="flex justify-end">
          <Badge variant="outline">{config.ativo ? <><CheckCircle2 className="w-3 h-3 mr-1 text-green-500" /> Configurado</> : <><XCircle className="w-3 h-3 mr-1 text-red-500" /> Inativo</>}</Badge>
        </div>
      )}

      {/* ── Configuração ─────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5" /> Configuração do Servidor</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="serverUrl">URL do Servidor Yoda</Label>
              <Input id="serverUrl" placeholder="https://201.139.92.222:3000" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="authCode">Código de Autenticação (Base64)</Label>
              <Input id="authCode" type="password" placeholder="dW5pcGx1czps..." value={authCode} onChange={(e) => setAuthCode(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userId">ID do Usuário UniPlus</Label>
              <Input id="userId" placeholder="24" value={userId} onChange={(e) => setUserId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userPassword">Senha do Usuário UniPlus</Label>
              <Input id="userPassword" type="password" placeholder="****" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
              {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />} Testar Conexão
            </Button>
            <Button onClick={handleSaveConfig} disabled={savingConfig}>
              {savingConfig && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar Configuração
            </Button>
          </div>
          {config?.last_sync_at && <p className="text-sm text-muted-foreground">Última sincronização: {fmtDate(config.last_sync_at)}</p>}
        </CardContent>
      </Card>

      {/* ── Sincronização ────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><RefreshCw className="w-5 h-5" /> Sincronização</span>
            <Button onClick={() => handleSync('full')} disabled={!!syncing || !config}>
              {syncing === 'full' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} Sincronizar Tudo
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {syncTypes.map(({ tipo, label, icon: Icon, color }) => (
              <div key={tipo} className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${color} text-white`}><Icon className="w-4 h-4" /></div>
                  <div>
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">{counts[tipo as keyof SyncCounts] ?? 0} sincronizados</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleSync(tipo)} disabled={!!syncing || !config}>
                  {syncing === tipo ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Histórico ────────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><History className="w-5 h-5" /> Histórico</CardTitle></CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Nenhuma sincronização realizada ainda</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Data</th>
                    <th className="pb-2 font-medium">Tipo</th>
                    <th className="pb-2 font-medium">Direção</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium text-right">Criados</th>
                    <th className="pb-2 font-medium text-right">Atualizados</th>
                    <th className="pb-2 font-medium text-right">Erros</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="py-2 whitespace-nowrap">{fmtDate(log.started_at)}</td>
                      <td className="py-2 capitalize">{log.tipo.replace('_', ' ')}</td>
                      <td className="py-2"><Badge variant="outline" className="text-xs">{log.direcao === 'import' ? '← Import' : '→ Export'}</Badge></td>
                      <td className="py-2">{statusBadge(log.status)}</td>
                      <td className="py-2 text-right">{log.registros_criados}</td>
                      <td className="py-2 text-right">{log.registros_atualizados}</td>
                      <td className="py-2 text-right">{log.registros_erros > 0 ? <span className="text-red-600 font-medium">{log.registros_erros}</span> : '0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Clientes (browse live from UniPlus API)
// ═══════════════════════════════════════════════════════════════════════════════
function ClientesTab() {
  const { toast } = useToast()
  const [data, setData] = useState<UniplusEntidade[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [limit] = useState(100)
  const [offset, setOffset] = useState(0)

  const fetchData = useCallback(async (newOffset = 0) => {
    setLoading(true)
    try {
      const res = await uniplusService.browse('entidades', limit, newOffset)
      setData(res.data.data || [])
      setOffset(newOffset)
      setLoaded(true)
    } catch (err: any) {
      toast({ title: 'Erro ao carregar clientes', description: err.response?.data?.error ?? err.message, variant: 'destructive' })
    } finally { setLoading(false) }
  }, [limit, toast])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = search
    ? data.filter(e =>
      e.nome?.toLowerCase().includes(search.toLowerCase()) ||
      e.cnpjCpf?.includes(search) ||
      e.codigo?.includes(search) ||
      e.email?.toLowerCase().includes(search.toLowerCase()) ||
      e.cidade?.toLowerCase().includes(search.toLowerCase())
    )
    : data

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <Input placeholder="Buscar nome, CNPJ, código, email, cidade..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData(0)} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
        <span className="text-xs text-[var(--muted-foreground)]">{filtered.length} de {data.length} registros</span>
      </div>

      <TableWrapper>
        <thead className="bg-[var(--muted)]">
          <tr>
            <Th>Código</Th>
            <Th>Nome</Th>
            <Th>CNPJ/CPF</Th>
            <Th>Tipo</Th>
            <Th>Cidade/UF</Th>
            <Th>Telefone</Th>
            <Th>Email</Th>
            <Th>Vendedor</Th>
            <Th>IE</Th>
            <Th>Limite Créd.</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {loading && !loaded ? (
            <tr><td colSpan={11} className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
          ) : filtered.length === 0 ? (
            <tr><td colSpan={11} className="text-center py-12 text-[var(--muted-foreground)]">{loaded ? 'Nenhum registro' : 'Carregando...'}</td></tr>
          ) : filtered.map((e, i) => (
            <tr key={`${e.codigo}-${i}`} className="border-t border-[var(--border)] hover:bg-[var(--muted)]/50">
              <Td className="font-mono font-medium">{e.codigo}</Td>
              <Td className="max-w-[200px] truncate font-medium">{e.nome}</Td>
              <Td className="font-mono">{e.cnpjCpf}</Td>
              <Td>{e.tipoPessoa === 'J' ? 'PJ' : e.tipoPessoa === 'F' ? 'PF' : e.tipoPessoa}</Td>
              <Td>{e.cidade}{e.estado ? `/${e.estado}` : ''}</Td>
              <Td className="font-mono">{e.telefone || e.celular || '—'}</Td>
              <Td className="max-w-[180px] truncate">{e.email || '—'}</Td>
              <Td>{e.nomeVendedor || '—'}</Td>
              <Td className="font-mono">{e.inscricaoEstadual || '—'}</Td>
              <Td className="text-right">{e.limiteCredito && e.limiteCredito !== '0.00' ? `R$ ${e.limiteCredito}` : '—'}</Td>
              <Td>{e.inativo === 0 ? <Badge className="bg-green-100 text-green-700 text-[10px]">Ativo</Badge> : <Badge className="bg-red-100 text-red-700 text-[10px]">Inativo</Badge>}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>

      {loaded && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => fetchData(Math.max(0, offset - limit))} disabled={offset === 0 || loading}>← Anterior</Button>
          <span className="text-xs text-[var(--muted-foreground)]">Offset: {offset} | Página {Math.floor(offset / limit) + 1}</span>
          <Button variant="outline" size="sm" onClick={() => fetchData(offset + limit)} disabled={data.length < limit || loading}>Próximo →</Button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Produtos (browse live from UniPlus API)
// ═══════════════════════════════════════════════════════════════════════════════
function ProdutosTab() {
  const { toast } = useToast()
  const [data, setData] = useState<UniplusProduto[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [limit] = useState(100)
  const [offset, setOffset] = useState(0)

  const fetchData = useCallback(async (newOffset = 0) => {
    setLoading(true)
    try {
      const res = await uniplusService.browse('produtos', limit, newOffset)
      setData(res.data.data || [])
      setOffset(newOffset)
      setLoaded(true)
    } catch (err: any) {
      toast({ title: 'Erro ao carregar produtos', description: err.response?.data?.error ?? err.message, variant: 'destructive' })
    } finally { setLoading(false) }
  }, [limit, toast])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = search
    ? data.filter(p =>
      p.nome?.toLowerCase().includes(search.toLowerCase()) ||
      p.codigo?.includes(search) ||
      p.referencia?.includes(search) ||
      p.ncm?.includes(search) ||
      p.nomeFornecedor?.toLowerCase().includes(search.toLowerCase())
    )
    : data

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <Input placeholder="Buscar nome, código, referência, NCM, fornecedor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData(0)} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
        <span className="text-xs text-[var(--muted-foreground)]">{filtered.length} de {data.length} registros</span>
      </div>

      <TableWrapper>
        <thead className="bg-[var(--muted)]">
          <tr>
            <Th>Código</Th>
            <Th>Nome</Th>
            <Th>Referência</Th>
            <Th>Grupo</Th>
            <Th>Fornecedor</Th>
            <Th>Unid.</Th>
            <Th>Preço</Th>
            <Th>Custo</Th>
            <Th>NCM</Th>
            <Th>CEST</Th>
            <Th>Peso</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {loading && !loaded ? (
            <tr><td colSpan={12} className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
          ) : filtered.length === 0 ? (
            <tr><td colSpan={12} className="text-center py-12 text-[var(--muted-foreground)]">{loaded ? 'Nenhum registro' : 'Carregando...'}</td></tr>
          ) : filtered.map((p, i) => (
            <tr key={`${p.codigo}-${i}`} className="border-t border-[var(--border)] hover:bg-[var(--muted)]/50">
              <Td className="font-mono font-medium">{p.codigo}</Td>
              <Td className="max-w-[250px] truncate font-medium">{p.nome}</Td>
              <Td className="font-mono">{p.referencia || '—'}</Td>
              <Td>{p.nomeGrupoProduto || '—'}</Td>
              <Td className="max-w-[150px] truncate">{p.nomeFornecedor || '—'}</Td>
              <Td>{p.unidadeMedida || '—'}</Td>
              <Td className="text-right font-mono">{p.preco && p.preco !== '0' ? `R$ ${Number(p.preco).toFixed(2)}` : '—'}</Td>
              <Td className="text-right font-mono">{p.custo && p.custo !== '0' ? `R$ ${Number(p.custo).toFixed(2)}` : '—'}</Td>
              <Td className="font-mono">{p.ncm || '—'}</Td>
              <Td className="font-mono">{p.cest || '—'}</Td>
              <Td className="text-right">{p.peso && p.peso !== '0' ? `${p.peso} kg` : '—'}</Td>
              <Td>{p.inativo === 0 ? <Badge className="bg-green-100 text-green-700 text-[10px]">Ativo</Badge> : <Badge className="bg-red-100 text-red-700 text-[10px]">Inativo</Badge>}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>

      {loaded && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => fetchData(Math.max(0, offset - limit))} disabled={offset === 0 || loading}>← Anterior</Button>
          <span className="text-xs text-[var(--muted-foreground)]">Offset: {offset} | Página {Math.floor(offset / limit) + 1}</span>
          <Button variant="outline" size="sm" onClick={() => fetchData(offset + limit)} disabled={data.length < limit || loading}>Próximo →</Button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Vendas (browse live from UniPlus API)
// ═══════════════════════════════════════════════════════════════════════════════
function VendasTab() {
  const { toast } = useToast()
  const [data, setData] = useState<UniplusVenda[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [limit] = useState(100)
  const [offset, setOffset] = useState(0)

  const fetchData = useCallback(async (newOffset = 0) => {
    setLoading(true)
    try {
      const res = await uniplusService.browse('vendas', limit, newOffset)
      setData(res.data.data || [])
      setOffset(newOffset)
      setLoaded(true)
    } catch (err: any) {
      toast({ title: 'Erro ao carregar vendas', description: err.response?.data?.error ?? err.message, variant: 'destructive' })
    } finally { setLoading(false) }
  }, [limit, toast])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = search
    ? data.filter(v =>
      v.nomeCliente?.toLowerCase().includes(search.toLowerCase()) ||
      v.documento?.includes(search) ||
      v.nomeVendedor?.toLowerCase().includes(search.toLowerCase()) ||
      v.codigoCliente?.includes(search) ||
      String(v.idVenda)?.includes(search)
    )
    : data

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <Input placeholder="Buscar cliente, documento, vendedor, ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData(0)} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
        <span className="text-xs text-[var(--muted-foreground)]">{filtered.length} de {data.length} registros</span>
      </div>

      <TableWrapper>
        <thead className="bg-[var(--muted)]">
          <tr>
            <Th>ID</Th>
            <Th>Documento</Th>
            <Th>Cliente</Th>
            <Th>Cód. Cli.</Th>
            <Th>Vendedor</Th>
            <Th>Emissão</Th>
            <Th>Vlr Produtos</Th>
            <Th>Desconto</Th>
            <Th>Vlr Total</Th>
            <Th>Filial</Th>
            <Th>PDV</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {loading && !loaded ? (
            <tr><td colSpan={12} className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
          ) : filtered.length === 0 ? (
            <tr><td colSpan={12} className="text-center py-12 text-[var(--muted-foreground)]">{loaded ? 'Nenhum registro' : 'Carregando...'}</td></tr>
          ) : filtered.map((v, i) => (
            <tr key={`${v.idVenda}-${i}`} className="border-t border-[var(--border)] hover:bg-[var(--muted)]/50">
              <Td className="font-mono font-medium">{v.idVenda}</Td>
              <Td className="font-mono">{v.documento || '—'}</Td>
              <Td className="max-w-[200px] truncate font-medium">{v.nomeCliente || '—'}</Td>
              <Td className="font-mono">{v.codigoCliente}</Td>
              <Td>{v.nomeVendedor || '—'}</Td>
              <Td className="font-mono">{v.emissao ? new Date(v.emissao + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</Td>
              <Td className="text-right font-mono">{v.valorProdutos ? `R$ ${Number(v.valorProdutos).toFixed(2)}` : '—'}</Td>
              <Td className="text-right font-mono">{v.desconto && v.desconto !== '0' ? `R$ ${Number(v.desconto).toFixed(2)}` : '—'}</Td>
              <Td className="text-right font-mono font-medium">{v.valorTotal ? `R$ ${Number(v.valorTotal).toFixed(2)}` : '—'}</Td>
              <Td>{v.codigoFilial}</Td>
              <Td>{v.pdv}</Td>
              <Td>
                <Badge className={`text-[10px] ${v.status === 1 ? 'bg-green-100 text-green-700' : v.status === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>
                  {v.status === 1 ? 'Finalizada' : v.status === 0 ? 'Aberta' : `#${v.status}`}
                </Badge>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>

      {loaded && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => fetchData(Math.max(0, offset - limit))} disabled={offset === 0 || loading}>← Anterior</Button>
          <span className="text-xs text-[var(--muted-foreground)]">Offset: {offset} | Página {Math.floor(offset / limit) + 1}</span>
          <Button variant="outline" size="sm" onClick={() => fetchData(offset + limit)} disabled={data.length < limit || loading}>Próximo →</Button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function UniplusPage() {
  const [tab, setTab] = useState<TabKey>('setup')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Integração UniPlus</h1>
        <p className="text-muted-foreground">Sincronize e visualize dados do UniPlus ERP</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-[var(--muted)] rounded-lg overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-md transition-colors font-medium whitespace-nowrap ${
                tab === t.key ? 'bg-[var(--card)] shadow-sm' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'setup' && <SetupTab />}
      {tab === 'clientes' && <ClientesTab />}
      {tab === 'produtos' && <ProdutosTab />}
      {tab === 'vendas' && <VendasTab />}
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  if ((session.user as any)?.tipo !== 'admin') return { redirect: { destination: '/dashboard', permanent: false } }
  return { props: {} }
}
