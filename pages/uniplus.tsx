import { useState, useEffect, useCallback } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import {
  RefreshCw, Settings, History, CheckCircle2, XCircle,
  AlertTriangle, Loader2, Users, Package, CreditCard,
  ShoppingCart, UserCheck, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { uniplusService } from '@/services/api'
import { useToast } from '@/hooks/use-toast'
import type { UniplusSyncLog } from '@/types/uniplus'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

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

export default function UniplusPage() {
  const { toast } = useToast()

  // Config state
  const [config, setConfig] = useState<ConfigData | null>(null)
  const [serverUrl, setServerUrl] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [userId, setUserId] = useState('24')
  const [userPassword, setUserPassword] = useState('9637')
  const [savingConfig, setSavingConfig] = useState(false)
  const [testing, setTesting] = useState(false)

  // Sync state
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
        if (data.data.config?.server_url) {
          setServerUrl(data.data.config.server_url)
        }
      }
    } catch {
      // Config not set yet
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  async function handleTestConnection() {
    if (!serverUrl || !authCode) {
      toast({ title: 'Preencha URL e código de autenticação', variant: 'destructive' })
      return
    }
    setTesting(true)
    try {
      const { data } = await uniplusService.testConnection({
        server_url: serverUrl, auth_code: authCode, user_id: userId, user_password: userPassword,
      })
      if (data.success) {
        toast({ title: 'Conexão bem sucedida!' })
      } else {
        toast({ title: 'Falha na conexão', description: data.error, variant: 'destructive' })
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.response?.data?.error ?? 'Falha ao testar', variant: 'destructive' })
    } finally {
      setTesting(false)
    }
  }

  async function handleSaveConfig() {
    if (!serverUrl || !authCode) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' })
      return
    }
    setSavingConfig(true)
    try {
      await uniplusService.saveConfig({
        server_url: serverUrl, auth_code: authCode, user_id: userId, user_password: userPassword,
      })
      toast({ title: 'Configuração salva!' })
      loadStatus()
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.response?.data?.error ?? 'Tente novamente', variant: 'destructive' })
    } finally {
      setSavingConfig(false)
    }
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
    } finally {
      setSyncing(null)
    }
  }

  function formatDate(date: string | null) {
    if (!date) return 'Nunca'
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR })
    } catch {
      return date
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Integração UniPlus</h1>
          <p className="text-muted-foreground">
            Sincronize dados entre o Trends e o UniPlus ERP
          </p>
        </div>
        {config && (
          <Badge variant="outline" className="text-sm">
            {config.ativo ? (
              <><CheckCircle2 className="w-3 h-3 mr-1 text-green-500" /> Configurado</>
            ) : (
              <><XCircle className="w-3 h-3 mr-1 text-red-500" /> Inativo</>
            )}
          </Badge>
        )}
      </div>

      {/* ── Configuração ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" /> Configuração do Servidor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="serverUrl">URL do Servidor Yoda</Label>
              <Input
                id="serverUrl"
                placeholder="https://201.139.92.222:8443"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="authCode">Código de Autenticação (Base64)</Label>
              <Input
                id="authCode"
                type="password"
                placeholder="dW5pcGx1czps..."
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userId">ID do Usuário UniPlus</Label>
              <Input
                id="userId"
                placeholder="24"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userPassword">Senha do Usuário UniPlus</Label>
              <Input
                id="userPassword"
                type="password"
                placeholder="9637"
                value={userPassword}
                onChange={(e) => setUserPassword(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
              {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
              Testar Conexão
            </Button>
            <Button onClick={handleSaveConfig} disabled={savingConfig}>
              {savingConfig ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Salvar Configuração
            </Button>
          </div>
          {config?.last_sync_at && (
            <p className="text-sm text-muted-foreground">
              Última sincronização: {formatDate(config.last_sync_at)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Sincronização ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" /> Sincronização
            </span>
            <Button
              onClick={() => handleSync('full')}
              disabled={!!syncing || !config}
            >
              {syncing === 'full' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sincronizar Tudo
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {syncTypes.map(({ tipo, label, icon: Icon, color }) => (
              <div key={tipo} className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${color} text-white`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">
                      {counts[tipo as keyof SyncCounts] ?? 0} sincronizados
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSync(tipo)}
                  disabled={!!syncing || !config}
                >
                  {syncing === tipo ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Histórico ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" /> Histórico de Sincronização
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              Nenhuma sincronização realizada ainda
            </p>
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
                    <th className="pb-2 font-medium">Usuário</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="py-2 whitespace-nowrap">{formatDate(log.started_at)}</td>
                      <td className="py-2 capitalize">{log.tipo.replace('_', ' ')}</td>
                      <td className="py-2">
                        <Badge variant="outline" className="text-xs">
                          {log.direcao === 'import' ? '← Import' : '→ Export'}
                        </Badge>
                      </td>
                      <td className="py-2">{statusBadge(log.status)}</td>
                      <td className="py-2 text-right">{log.registros_criados}</td>
                      <td className="py-2 text-right">{log.registros_atualizados}</td>
                      <td className="py-2 text-right">
                        {log.registros_erros > 0 ? (
                          <span className="text-red-600 font-medium">{log.registros_erros}</span>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td className="py-2">{(log as any).usuario_nome || '—'}</td>
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

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  if ((session.user as any)?.tipo !== 'admin') return { redirect: { destination: '/dashboard', permanent: false } }
  return { props: {} }
}
