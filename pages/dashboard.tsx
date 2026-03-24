import { useEffect, useState, useCallback } from 'react'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import {
  FileText, ShoppingCart, Users, TrendingUp, DollarSign, Package,
  ArrowUpRight, ArrowDownRight, BarChart3,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { dashboardService } from '@/services/api'
import { formatCurrency } from '@/lib/utils'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Sector, Legend,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChartData {
  monthlyPedidos: { mes: string; total: number; quantidade: number }[]
  monthlyVendas: { mes: string; total: number; valor: number }[]
  tipoProducao: { tipo: string; total: number }[]
  statusPedidos: Record<string, number>
  statusVendas: Record<string, number>
  topClientes: { nome: string; total: number; valor: number }[]
  currentMonth: { pedidos: number; vendas: number; valorVendas: number; quantidade: number }
  previousMonth: { pedidos: number; vendas: number; valorVendas: number; quantidade: number }
  totals: { pedidos: number; valorTotal: number; clientes: number; orcamentos: number }
}

// ── Constants ─────────────────────────────────────────────────────────────────
const MESES_SHORT: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
  '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
}

const CHART_COLORS = [
  '#dd2620', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
]

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente', producao: 'Produção', entregue: 'Entregue',
  cancelado: 'Cancelado', concluido: 'Concluído',
}

const STATUS_COLOR: Record<string, string> = {
  pendente: '#eab308', producao: '#f97316', entregue: '#22c55e',
  cancelado: '#ef4444', concluido: '#22c55e',
}

// ── Tooltip styles (light mode) ───────────────────────────────────────────────
const TOOLTIP_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.95)',
  backdropFilter: 'blur(12px)',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  fontSize: 12,
  color: '#1f2937',
  boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
  padding: '8px 12px',
}
const TOOLTIP_LABEL: React.CSSProperties = { color: '#6b7280', fontWeight: 600, fontSize: 11 }
const TOOLTIP_ITEM: React.CSSProperties = { color: '#1f2937', fontSize: 12 }
const AXIS_TICK = { fontSize: 10, fill: '#9ca3af' }
const GRID_STROKE = '#f3f4f6'

// ── Helpers ───────────────────────────────────────────────────────────────────
function mesLabel(mes: string) {
  const [, m] = mes.split('-')
  return MESES_SHORT[m] || m
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

// ── Active donut shape ────────────────────────────────────────────────────────
function renderActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props
  return (
    <g>
      <Sector
        cx={cx} cy={cy}
        innerRadius={innerRadius - 2} outerRadius={outerRadius + 6}
        startAngle={startAngle} endAngle={endAngle}
        fill={fill}
        style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))', transition: 'all 200ms ease' }}
      />
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#1f2937" fontSize={12} fontWeight={600}>
        {payload.tipo.length > 14 ? payload.tipo.slice(0, 13) + '…' : payload.tipo}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#6b7280" fontSize={11}>
        {value} pedidos
      </text>
    </g>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [data, setData] = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(true)
  const [donutActive, setDonutActive] = useState<number | undefined>(undefined)

  useEffect(() => {
    dashboardService.charts()
      .then((r) => setData(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const onDonutEnter = useCallback((_: unknown, i: number) => setDonutActive(i), [])
  const onDonutLeave = useCallback(() => setDonutActive(undefined), [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) return null

  const vendasPct = pctChange(data.currentMonth.vendas, data.previousMonth.vendas)
  const pedidosPct = pctChange(data.currentMonth.pedidos, data.previousMonth.pedidos)
  const valorPct = pctChange(data.currentMonth.valorVendas, data.previousMonth.valorVendas)
  const qtdPct = pctChange(data.currentMonth.quantidade, data.previousMonth.quantidade)

  // Merge monthly data for combined chart
  const allMonths = new Set([
    ...data.monthlyPedidos.map(m => m.mes),
    ...data.monthlyVendas.map(m => m.mes),
  ])
  const monthlyMerged = Array.from(allMonths).sort().map(mes => {
    const p = data.monthlyPedidos.find(x => x.mes === mes)
    const v = data.monthlyVendas.find(x => x.mes === mes)
    return {
      mes: mesLabel(mes),
      pedidos: p?.total ?? 0,
      vendas: v?.total ?? 0,
      valorVendas: v?.valor ?? 0,
      quantidade: p?.quantidade ?? 0,
    }
  })

  return (
    <div className="space-y-6">
      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Vendas este Mês"
          value={data.currentMonth.vendas}
          pct={vendasPct}
          icon={ShoppingCart}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <KpiCard
          title="Pedidos este Mês"
          value={data.currentMonth.pedidos}
          pct={pedidosPct}
          icon={Package}
          color="text-orange-600"
          bg="bg-orange-50"
        />
        <KpiCard
          title="Faturamento do Mês"
          value={formatCurrency(data.currentMonth.valorVendas)}
          pct={valorPct}
          icon={DollarSign}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <KpiCard
          title="Qtd. Produzida no Mês"
          value={Number(data.currentMonth.quantidade).toLocaleString('pt-BR')}
          pct={qtdPct}
          icon={BarChart3}
          color="text-purple-600"
          bg="bg-purple-50"
        />
      </div>

      {/* ── Totais Gerais ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniCard title="Total de Pedidos" value={data.totals.pedidos} icon={FileText} />
        <MiniCard title="Total de Clientes" value={data.totals.clientes} icon={Users} />
        <MiniCard title="Total de Orçamentos" value={data.totals.orcamentos} icon={FileText} />
        <MiniCard title="Faturamento Total" value={formatCurrency(data.totals.valorTotal)} icon={TrendingUp} highlight />
      </div>

      {/* ── Evolução Mensal (Area) ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Evolução de Vendas Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyMerged} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-vendas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="grad-valor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="mes" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={40}
                yAxisId="left" tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={50}
                yAxisId="right" orientation="right"
                tickFormatter={(v: number) => v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v}`} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL}
                formatter={(v: number, name: string) => [
                  name === 'valorVendas' ? formatCurrency(v) : v,
                  name === 'vendas' ? 'Vendas' : name === 'valorVendas' ? 'Faturamento' : name,
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Area yAxisId="left" type="monotone" dataKey="vendas" name="Vendas"
                stroke="#3b82f6" strokeWidth={2.5} fill="url(#grad-vendas)"
                activeDot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                animationDuration={1200} animationEasing="ease-out" />
              <Area yAxisId="right" type="monotone" dataKey="valorVendas" name="Faturamento"
                stroke="#10b981" strokeWidth={2} fill="url(#grad-valor)" strokeDasharray="5 3"
                activeDot={{ r: 5, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                animationDuration={1200} animationEasing="ease-out" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Pedidos por Mês (Bar) + Donut Tipos ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Pedidos por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyMerged} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-bar-pedidos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#dd2620" stopOpacity={1} />
                    <stop offset="100%" stopColor="#dd2620" stopOpacity={0.5} />
                  </linearGradient>
                  <linearGradient id="grad-bar-vendas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="mes" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL}
                  cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="pedidos" name="Pedidos" fill="url(#grad-bar-pedidos)"
                  radius={[6, 6, 0, 0]} maxBarSize={24}
                  animationBegin={0} animationDuration={800} animationEasing="ease-out" />
                <Bar dataKey="vendas" name="Vendas" fill="url(#grad-bar-vendas)"
                  radius={[6, 6, 0, 0]} maxBarSize={24}
                  animationBegin={80} animationDuration={800} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Tipos de Produção</CardTitle>
          </CardHeader>
          <CardContent>
            {data.tipoProducao.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-[var(--muted-foreground)] text-sm">
                Sem dados
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <defs>
                      {data.tipoProducao.map((_, i) => {
                        const color = CHART_COLORS[i % CHART_COLORS.length]
                        return (
                          <linearGradient key={i} id={`donut-${i}`} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={1} />
                            <stop offset="100%" stopColor={color} stopOpacity={0.65} />
                          </linearGradient>
                        )
                      })}
                    </defs>
                    <Pie
                      data={data.tipoProducao}
                      cx="50%" cy="50%"
                      innerRadius="38%" outerRadius="65%"
                      paddingAngle={3}
                      dataKey="total" nameKey="tipo"
                      activeIndex={donutActive}
                      activeShape={renderActiveShape}
                      onMouseEnter={onDonutEnter}
                      onMouseLeave={onDonutLeave}
                      animationBegin={100} animationDuration={800} animationEasing="ease-out"
                    >
                      {data.tipoProducao.map((_, i) => (
                        <Cell key={i} fill={`url(#donut-${i})`} stroke="rgba(255,255,255,0.8)" strokeWidth={1} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2">
                  {data.tipoProducao.map((d, i) => (
                    <div key={d.tipo}
                      className="flex items-center gap-1.5 cursor-pointer transition-opacity duration-200"
                      style={{ opacity: donutActive !== undefined && donutActive !== i ? 0.4 : 1 }}
                      onMouseEnter={() => setDonutActive(i)}
                      onMouseLeave={() => setDonutActive(undefined)}
                    >
                      <span className="inline-block rounded-full shrink-0"
                        style={{ width: 8, height: 8, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-[11px] text-[var(--muted-foreground)]">{d.tipo}</span>
                      <span className="text-[10px] text-[var(--muted-foreground)] font-medium">({d.total})</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Status + Top Clientes ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Status Pedidos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(data.statusPedidos).map(([status, count]) => {
              const total = Object.values(data.statusPedidos).reduce((s, v) => s + v, 0)
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{STATUS_LABEL[status] ?? status}</span>
                    <span className="text-xs text-[var(--muted-foreground)]">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--muted)] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: STATUS_COLOR[status] ?? '#9ca3af' }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Status Vendas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(data.statusVendas).map(([status, count]) => {
              const total = Object.values(data.statusVendas).reduce((s, v) => s + v, 0)
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{STATUS_LABEL[status] ?? status}</span>
                    <span className="text-xs text-[var(--muted-foreground)]">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--muted)] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: STATUS_COLOR[status] ?? '#9ca3af' }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Top Clientes</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topClientes.slice(0, 8).map((c, i) => (
                <div key={c.nome} className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--muted)] text-[10px] font-bold text-[var(--muted-foreground)] shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{c.nome}</p>
                    <p className="text-[10px] text-[var(--muted-foreground)]">
                      {c.total} pedidos · {formatCurrency(c.valor)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── KPI Card (with trend) ─────────────────────────────────────────────────────
function KpiCard({ title, value, pct, icon: Icon, color, bg }: {
  title: string; value: string | number; pct: number; icon: React.ElementType; color: string; bg: string
}) {
  const isUp = pct >= 0
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)] font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            <div className="flex items-center gap-1 mt-1.5">
              {isUp ? <ArrowUpRight size={12} className="text-emerald-500" /> : <ArrowDownRight size={12} className="text-red-500" />}
              <span className={`text-[11px] font-semibold ${isUp ? 'text-emerald-500' : 'text-red-500'}`}>
                {isUp ? '+' : ''}{pct}%
              </span>
              <span className="text-[10px] text-[var(--muted-foreground)]">vs mês anterior</span>
            </div>
          </div>
          <div className={`p-2.5 rounded-xl ${bg}`}>
            <Icon size={20} className={color} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Mini Card ─────────────────────────────────────────────────────────────────
function MiniCard({ title, value, icon: Icon, highlight }: {
  title: string; value: string | number; icon: React.ElementType; highlight?: boolean
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-[var(--muted-foreground)]">{title}</p>
            <p className={`text-lg font-bold mt-0.5 ${highlight ? 'text-[var(--primary)]' : ''}`}>{value}</p>
          </div>
          <div className={`p-2 rounded-lg ${highlight ? 'bg-[var(--accent)]' : 'bg-[var(--muted)]'}`}>
            <Icon size={18} className={highlight ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)]'} />
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
