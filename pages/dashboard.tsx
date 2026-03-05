import { useEffect, useState } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { FileText, ShoppingCart, Users, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { dashboardService } from '@/services/api'
import { formatCurrency, formatLocalDate } from '@/lib/utils'

interface DashboardData {
  clientes: number
  orcamentos: { total: number; rascunho: number; enviado: number; aprovado: number; valor_aprovado: number }
  pedidos: { total: number; pendente: number; producao: number; valor_total: number }
  recentOrcamentos: Array<{ numero: string; status: string; valor_total: number; created_at: string; cliente_nome: string }>
}

const STATUS_BADGE: Record<string, string> = {
  rascunho: 'badge-rascunho',
  enviado: 'badge-enviado',
  aprovado: 'badge-aprovado',
  convertido: 'badge-convertido',
  pendente: 'badge-pendente',
  producao: 'badge-producao',
  entregue: 'badge-entregue',
  cancelado: 'badge-cancelado',
}

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado',
  convertido: 'Convertido', pendente: 'Pendente', producao: 'Produção',
  entregue: 'Entregue', cancelado: 'Cancelado',
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardService.get()
      .then((r) => setData(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Clientes" value={data?.clientes ?? 0} icon={Users} />
        <StatCard title="Orçamentos" value={data?.orcamentos.total ?? 0} icon={FileText} />
        <StatCard title="Pedidos" value={data?.pedidos.total ?? 0} icon={ShoppingCart} />
        <StatCard
          title="Valor Aprovado"
          value={formatCurrency(data?.orcamentos.valor_aprovado ?? 0)}
          icon={TrendingUp}
          highlight
        />
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Orçamentos por Status</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data && Object.entries({
              rascunho: data.orcamentos.rascunho,
              enviado: data.orcamentos.enviado,
              aprovado: data.orcamentos.aprovado,
            }).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[status]}`}>
                  {STATUS_LABEL[status]}
                </span>
                <span className="text-sm font-medium">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Pedidos por Status</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data && Object.entries({
              pendente: data.pedidos.pendente,
              producao: data.pedidos.producao,
            }).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[status]}`}>
                  {STATUS_LABEL[status]}
                </span>
                <span className="text-sm font-medium">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent quotes */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Orçamentos Recentes</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data?.recentOrcamentos.length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)]">Nenhum orçamento ainda.</p>
            )}
            {data?.recentOrcamentos.map((orc) => (
              <div key={orc.numero} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                <div>
                  <p className="text-sm font-medium">{orc.numero}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{orc.cliente_nome} · {formatLocalDate(orc.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[orc.status]}`}>
                    {STATUS_LABEL[orc.status]}
                  </span>
                  {orc.valor_total && (
                    <span className="text-sm font-medium">{formatCurrency(orc.valor_total)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, highlight }: {
  title: string; value: string | number; icon: React.ElementType; highlight?: boolean
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${highlight ? 'text-[var(--primary)]' : ''}`}>{value}</p>
          </div>
          <div className={`p-2 rounded-lg ${highlight ? 'bg-[var(--accent)]' : 'bg-[var(--muted)]'}`}>
            <Icon size={20} className={highlight ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)]'} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession(ctx)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  return { props: {} }
}
