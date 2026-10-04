import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
} from 'recharts'
import { motion } from 'framer-motion'
import {
  TrendingUp, TrendingDown, DollarSign, Users, Activity,
  ArrowUpRight, ArrowDownRight, BarChart2, PieChartIcon,
  Download, Calendar,
} from 'lucide-react'
import { formatCurrency, formatShort, filterTransactionsByDate } from '@/lib/utils'
import { exportTransactionsToCsv } from '@/lib/exportUtils'
import { logUserAction } from '@/lib/auditLogger'
import type { Transaction, DateFilter } from '@/types'
import { useWallet } from '@/context/WalletContext'

interface AnalyticsDashboardProps {
  dateFilter?: DateFilter
}

// ── Color Palette (MJS Brand) ────────────────────────────────────────
const CYAN = '#06b6d4'
const MAGENTA = '#ec4899'
const AMBER = '#f59e0b'
const VIOLET = '#8b5cf6'
const EMERALD = '#10b981'
const ROSE = '#f43f5e'

const PIE_COLORS = [CYAN, MAGENTA, AMBER, VIOLET, EMERALD, ROSE, '#64748b']

// ── Custom Tooltip ────────────────────────────────────────────────────
function CustomBarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 shadow-2xl text-right font-arabic" dir="rtl">
      <p className="text-xs text-zinc-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs font-bold" style={{ color: p.color }}>
          {p.name}: {formatCurrency((p.value || 0) * 100)}
        </p>
      ))}
    </div>
  )
}

function CustomPieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 shadow-2xl text-right font-arabic" dir="rtl">
      <p className="text-xs font-bold" style={{ color: payload[0].payload.fill }}>
        {payload[0].name}
      </p>
      <p className="text-xs text-zinc-300">{payload[0].value} معاملة ({payload[0].payload.percent}%)</p>
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color, delta, deltaLabel }: {
  label: string; value: string; sub?: string; icon: React.ComponentType<any>;
  color: string; delta?: number; deltaLabel?: string
}) {
  const isPositive = (delta ?? 0) >= 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-900/80 backdrop-blur-sm p-5 flex flex-col gap-3"
    >
      <div className="absolute inset-0 opacity-5 rounded-2xl" style={{ background: `radial-gradient(circle at top right, ${color}, transparent 70%)` }} />
      <div className="flex items-start justify-between">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: `${color}20` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {delta !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(delta).toFixed(1)}%
          </div>
        )}
      </div>
      <div dir="rtl" className="text-right">
        <p className="text-xs text-zinc-500 font-arabic mb-1">{label}</p>
        <p className="text-xl font-black text-zinc-100 ar-num">{value}</p>
        {sub && <p className="text-xs text-zinc-500 font-arabic mt-1">{sub}</p>}
        {deltaLabel && <p className="text-[11px] text-zinc-600 font-arabic mt-0.5">{deltaLabel}</p>}
      </div>
    </motion.div>
  )
}

// ── Section Header ────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, color }: { icon: React.ComponentType<any>; title: string; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-4" dir="rtl">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: `${color}20` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <h3 className="text-sm font-bold text-zinc-200 font-arabic">{title}</h3>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Main Analytics Dashboard
// ═══════════════════════════════════════════════════════════════════════
export function AnalyticsDashboard({ dateFilter }: AnalyticsDashboardProps) {
  const { activeWallet, activeWalletMeta } = useWallet()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        if (window.electronAPI?.getTransactions) {
          const res = await window.electronAPI.getTransactions({
            page: 1,
            pageSize: 10000,
            status: 'ACTIVE',
            wallet_type: activeWallet || 'LYD',
          })
          let txs = res.data || []
          if (dateFilter && dateFilter.mode !== 'NONE') {
            txs = filterTransactionsByDate(txs, dateFilter)
          }
          setTransactions(txs)
        }
      } catch (e) {
        console.error('Analytics load error:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [dateFilter, activeWallet])

  // ── Derived Analytics ──────────────────────────────────────────────
  const analytics = useMemo(() => {
    const deposits = transactions.filter((t) => t.type === 'DEPOSIT')
    const withdrawals = transactions.filter((t) => t.type === 'WITHDRAWAL')

    const totalDep = deposits.reduce((s, t) => s + t.amount_cents, 0)
    const totalWith = withdrawals.reduce((s, t) => s + t.amount_cents, 0)
    const netBalance = totalDep - totalWith

    // Payment method breakdown
    const paymentMap = new Map<string, number>()
    transactions.forEach((t) => {
      const method = t.payment_method || 'نقداً'
      paymentMap.set(method, (paymentMap.get(method) || 0) + 1)
    })
    const totalTx = transactions.length || 1
    const paymentData = Array.from(paymentMap.entries()).map(([name, count]) => ({
      name,
      value: count,
      percent: ((count / totalTx) * 100).toFixed(1),
    }))

    // Top entities by volume (sum of deposits + withdrawals)
    const entityMap = new Map<string, { dep: number; with: number; count: number }>()
    transactions.forEach((t) => {
      const name = t.client_name?.trim() || 'غير معروف'
      const prev = entityMap.get(name) || { dep: 0, with: 0, count: 0 }
      if (t.type === 'DEPOSIT') {
        entityMap.set(name, { ...prev, dep: prev.dep + t.amount_cents, count: prev.count + 1 })
      } else {
        entityMap.set(name, { ...prev, with: prev.with + t.amount_cents, count: prev.count + 1 })
      }
    })
    const topEntities = Array.from(entityMap.entries())
      .map(([name, d]) => ({
        name,
        deposits: d.dep / 100,
        withdrawals: d.with / 100,
        total: (d.dep + d.with) / 100,
        count: d.count,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)

    // Monthly trend (last 12 months)
    const monthMap = new Map<string, { dep: number; with: number; label: string }>()
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = new Intl.DateTimeFormat('ar-LY', { month: 'short', year: '2-digit' }).format(d)
      monthMap.set(key, { dep: 0, with: 0, label })
    }
    transactions.forEach((t) => {
      const d = new Date(t.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const prev = monthMap.get(key)
      if (prev) {
        if (t.type === 'DEPOSIT') prev.dep += t.amount_cents
        else prev.with += t.amount_cents
      }
    })
    const monthlyData = Array.from(monthMap.values()).map((m) => ({
      label: m.label,
      إيداعات: m.dep / 100,
      سحوبات: m.with / 100,
      صافي: (m.dep - m.with) / 100,
    }))

    // Daily trend (last 30 days)
    const dayMap = new Map<string, { dep: number; with: number }>()
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      dayMap.set(key, { dep: 0, with: 0 })
    }
    transactions.forEach((t) => {
      const key = t.created_at.slice(0, 10)
      const prev = dayMap.get(key)
      if (prev) {
        if (t.type === 'DEPOSIT') prev.dep += t.amount_cents
        else prev.with += t.amount_cents
      }
    })
    const dailyData = Array.from(dayMap.entries()).map(([date, d]) => {
      const dt = new Date(date)
      return {
        label: `${dt.getDate()}/${dt.getMonth() + 1}`,
        إيداعات: d.dep / 100,
        سحوبات: d.with / 100,
      }
    })

    // Current vs previous month comparison
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`
    const thisMonth = monthMap.get(thisMonthKey) || { dep: 0, with: 0, label: '' }
    const prevMonth = monthMap.get(prevMonthKey) || { dep: 0, with: 0, label: '' }
    const depDelta = prevMonth.dep > 0 ? ((thisMonth.dep - prevMonth.dep) / prevMonth.dep) * 100 : 0
    const withDelta = prevMonth.with > 0 ? ((thisMonth.with - prevMonth.with) / prevMonth.with) * 100 : 0

    // Unique entities count
    const uniqueEntities = new Set(transactions.map((t) => t.client_name?.trim())).size

    return {
      totalDep, totalWith, netBalance,
      depCount: deposits.length, withCount: withdrawals.length,
      uniqueEntities, paymentData, topEntities,
      monthlyData, dailyData, depDelta, withDelta,
      avgDeposit: deposits.length > 0 ? totalDep / deposits.length : 0,
      avgWithdrawal: withdrawals.length > 0 ? totalWith / withdrawals.length : 0,
    }
  }, [transactions])

  // ── Export Handler ─────────────────────────────────────────────────
  const handleExportCsv = () => {
    logUserAction('EXPORT_CSV', 'تقارير وطباعة', 'تصدير بيانات المعاملات CSV', `عدد السجلات: ${transactions.length}`)
    exportTransactionsToCsv(transactions)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
          <p className="text-sm text-zinc-500 font-arabic">جاري تحليل البيانات...</p>
        </div>
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <BarChart2 className="w-12 h-12 text-zinc-700" />
        <p className="text-sm text-zinc-500 font-arabic">لا توجد بيانات لعرض التحليلات</p>
        <p className="text-xs text-zinc-600 font-arabic">ابدأ بإضافة معاملات لرؤية التحليلات</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 bg-zinc-950 min-h-full font-arabic" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-zinc-100">لوحة التحليلات</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {transactions.length} معاملة محللة
          </p>
        </div>
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          تصدير CSV
        </button>
      </div>

      {/* ── KPI Cards Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي الإيداعات"
          value={formatShort(analytics.totalDep)}
          sub={`${analytics.depCount} عملية`}
          icon={TrendingUp}
          color={CYAN}
          delta={analytics.depDelta}
          deltaLabel="مقارنة بالشهر الماضي"
        />
        <StatCard
          label="إجمالي السحوبات"
          value={formatShort(analytics.totalWith)}
          sub={`${analytics.withCount} عملية`}
          icon={TrendingDown}
          color={MAGENTA}
          delta={analytics.withDelta}
          deltaLabel="مقارنة بالشهر الماضي"
        />
        <StatCard
          label="صافي الرصيد"
          value={formatShort(Math.abs(analytics.netBalance))}
          sub={analytics.netBalance >= 0 ? 'رصيد موجب ✓' : 'رصيد سالب ✗'}
          icon={DollarSign}
          color={analytics.netBalance >= 0 ? EMERALD : ROSE}
        />
        <StatCard
          label="الجهات النشطة"
          value={String(analytics.uniqueEntities)}
          sub={`متوسط الإيداع: ${formatShort(analytics.avgDeposit)}`}
          icon={Users}
          color={VIOLET}
        />
      </div>

      {/* ── Monthly Trend Chart ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 backdrop-blur-sm p-5"
      >
        <SectionHeader icon={Activity} title="الاتجاه الشهري (آخر 12 شهراً)" color={CYAN} />
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={analytics.monthlyData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id="depGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CYAN} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CYAN} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="withGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={MAGENTA} stopOpacity={0.3} />
                <stop offset="95%" stopColor={MAGENTA} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
            <Tooltip content={<CustomBarTooltip />} />
            <Legend
              formatter={(value) => <span className="text-xs text-zinc-400 font-arabic">{value}</span>}
              wrapperStyle={{ direction: 'rtl' }}
            />
            <Area type="monotone" dataKey="إيداعات" stroke={CYAN} fill="url(#depGrad)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="سحوبات" stroke={MAGENTA} fill="url(#withGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* ── Two-column: Payment Methods + Top Entities ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Payment Method Distribution */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 backdrop-blur-sm p-5"
        >
          <SectionHeader icon={PieChartIcon} title="توزيع طرق الدفع" color={AMBER} />
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={200}>
              <PieChart>
                <Pie
                  data={analytics.paymentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {analytics.paymentData.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex-1 space-y-2" dir="rtl">
              {analytics.paymentData.map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs text-zinc-300 font-arabic truncate">{item.name}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-zinc-200 ar-num">{item.value}</span>
                    <span className="text-[10px] text-zinc-500 mr-1 ar-num">({item.percent}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Daily Trend (30 days) */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 backdrop-blur-sm p-5"
        >
          <SectionHeader icon={Calendar} title="النشاط اليومي (آخر 30 يوم)" color={VIOLET} />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={analytics.dailyData} margin={{ top: 4, right: 0, left: 0, bottom: 4 }} barSize={6} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#52525b', fontSize: 8 }} axisLine={false} tickLine={false}
                interval={4}
              />
              <YAxis hide />
              <Tooltip content={<CustomBarTooltip />} />
              <Bar dataKey="إيداعات" fill={CYAN} radius={[3, 3, 0, 0]} />
              <Bar dataKey="سحوبات" fill={MAGENTA} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* ── Top Entities by Volume ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 backdrop-blur-sm p-5"
      >
        <SectionHeader icon={BarChart2} title="أكثر الجهات نشاطاً (حسب الحجم)" color={MAGENTA} />
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={analytics.topEntities}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
            barSize={10}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'inherit' }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            <Tooltip content={<CustomBarTooltip />} />
            <Legend
              formatter={(value) => <span className="text-xs text-zinc-400 font-arabic">{value}</span>}
              wrapperStyle={{ direction: 'rtl', paddingTop: '8px' }}
            />
            <Bar dataKey="deposits" name="إيداعات" fill={CYAN} radius={[0, 4, 4, 0]} />
            <Bar dataKey="withdrawals" name="سحوبات" fill={MAGENTA} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* ── Summary Stats Row ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-4"
      >
        {[
          { label: 'متوسط الإيداع الواحد', value: formatShort(analytics.avgDeposit), color: CYAN },
          { label: 'متوسط السحب الواحد', value: formatShort(analytics.avgWithdrawal), color: MAGENTA },
          { label: 'نسبة الإيداع/السحب', value: analytics.totalWith > 0 ? `${(analytics.totalDep / analytics.totalWith).toFixed(2)}x` : '—', color: AMBER },
          { label: 'إجمالي المعاملات', value: String(transactions.length), color: VIOLET },
        ].map((item, i) => (
          <div key={i} className="rounded-xl border border-zinc-800/50 bg-zinc-900/60 p-4 text-right">
            <p className="text-[11px] text-zinc-500 font-arabic mb-1">{item.label}</p>
            <p className="text-base font-black ar-num" style={{ color: item.color }}>{item.value}</p>
          </div>
        ))}
      </motion.div>

    </div>
  )
}
